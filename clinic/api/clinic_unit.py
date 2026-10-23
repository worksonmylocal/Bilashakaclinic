"""Data and actions behind the Antenatal, MCH & Postnatal and TB clinic pages."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, get_first_day, nowdate

from clinic import billing
from clinic.api import anc, cwc, fp, pnc
from clinic.api.common import (
	UNITS,
	clean,
	minutes_since,
	patient_card,
	pick,
	require,
	to_number,
	today_start,
	user_name,
)

TEXT_FIELDS = [
	"fp_client_type", "fp_method", "presentation", "mode_of_delivery", "mother_condition", "baby_condition",
	"cwc_visit_type", "vaccines_given", "growth_status", "guardian_name", "guardian_phone", "tb_registration_no",
	"tb_type", "tb_category", "treatment_phase", "regimen", "adherence", "dot_supporter", "latest_sputum_result",
	"side_effects", "assessment_notes", "management_plan", "patient_advice", "referral_facility", "referral_reason",
	"follow_up_reason", "weight_category", "stunting_status", "muac_category", "cwc_exclusive_bf",
	"vit_a_supplementation", "developmental_status", "milestone_delay_details", "milestones_checked",
	"disability_details", "danger_signs",
	"anc_visit_kind", "fhr_status", "blood_group", "urine_protein", "urine_glucose", "syphilis_client",
	"syphilis_partner", "hiv_status_prior", "hiv_test_anc", "hiv_final_status", "art_status", "partner_hiv_status",
	"partner_art_status", "iptp_doses", "tt_dose", "complications", "anc_referral", "anc_remarks",
	"fp_method_from", "fp_method_to", "fp_switch_reason", "fp_switch_notes", "fp_side_effects", "cervical_screening",
	"dmpa_sc_given", "implant1_action", "implant2_action", "iucd_copper_action", "iucd_hormonal_action", "btl_status",
	"vasectomy_status", "fp_hiv_result", "fp_partner_hiv",
	"delivery_time", "delivery_place", "delivery_mode", "delivery_outcome", "mother_pnc_timing", "baby_pnc_timing",
	"maternal_condition", "breast_exam", "uterine_involution", "lochia_exam", "wound_exam", "cord_condition",
	"infant_feeding", "infant_jaundice", "infant_danger_signs", "mat_hiv_initial", "mat_hiv_retest", "maternal_haart",
	"infant_arv", "eid_pcr", "pnc_partner_hiv", "hiv_disclosure", "pnc_cervical", "cervical_treatment", "pnc_fp_method",
	"maternal_complications",
]
DATE_FIELDS = ["pnc_fp_date", "fp_next_visit", "lmp", "anc_next_visit", "delivery_date", "treatment_start_date", "follow_up_date"]
INT_FIELDS = ["anc_visit_number", "gravida", "parity", "fetal_heart_rate", "postnatal_visit_no", "abortions",
	"bp_systolic", "bp_diastolic", "ifa_count", "coc_cycles", "pop_cycles", "ecp_doses", "dmpa_sc_doses", "male_condoms",
	"female_condoms", "pulse_bpm", "resp_rate"]
FLOAT_FIELDS = ["fundal_height_cm", "hb_level", "muac_cm", "weight_kg", "height_cm", "blood_sugar", "temp_c", "infant_temp_c", "infant_weight_kg"]
CHECK_FIELDS = [
	"fp_counselled", "iron_folate_given", "ipt_given", "tt_given", "exclusive_breastfeeding", "vitamin_a_given",
	"deworming_given", "refer_out", "follow_up_required", "mnp_given", "dewormed", "disability_identified",
	"syphilis_treatment", "ctx_given", "llin_issued", "anc_dewormed", "ibp_discussed", "dmpa_im_given", "sdm_given",
	"lam_educated", "fp_dual_protection", "infant_ctx", "partner_tested_pnc", "pnc_fp_counselling", "mother_vit_a",
	"deworming_mother",
]
TB_LABELS = {1: "Presumed TB", 2: "No signs", 3: "On TB treatment", 4: "Not done"}
SPECIFIC = {
	"antenatal": ("Family planning methods — last 30 days", "fp_method"),
	"mch": ("Child growth status — last 30 days", "growth_status"),
	"tb": ("Adherence — last 30 days", "adherence"),
}


def _label(unit):
	if unit not in UNITS:
		frappe.throw(_("Unknown clinic {0}").format(unit))
	return UNITS[unit]["label"]


@frappe.whitelist()
def dashboard(unit):
	require(unit)
	label, start = _label(unit), today_start()

	def queue(status):
		return frappe.db.sql(
			"""
			SELECT v.name AS visit, v.patient, v.patient_name, v.patient_type, v.sex, v.age_years, v.department,
				v.status, v.attendance, v.visit_source, v.referring_facility, v.referring_clinician, v.referral_reason,
				t.triage_priority AS priority, t.chief_complaint, t.alerts,
				t.triage_datetime AS since
			FROM `tabClinic Visit` v LEFT JOIN `tabClinic Triage` t ON t.name = v.triage
			WHERE v.status = %(status)s AND v.service_point = %(unit)s
			ORDER BY FIELD(t.triage_priority, 'Emergency', 'Urgent', 'Routine'), t.triage_datetime
			""",
			{"status": status, "unit": label},
			as_dict=True,
		)

	waiting, in_progress, results_ready = queue("Waiting Clinic"), queue("In Clinic"), queue("Lab Results Ready")
	for row in waiting:
		row.wait_minutes = minutes_since(row.since)
	for row in results_ready:
		row.tests = frappe.get_all(
			"Clinic Lab Test",
			filters={"visit": row.visit, "status": ["!=", "Cancelled"]},
			fields=["test_type", "interpretation", "status"],
		)
		row.since = frappe.db.get_value("Clinic Lab Test", {"visit": row.visit}, "resulted_on", order_by="resulted_on desc")
		row.wait_minutes = minutes_since(row.since)

	in_flight = frappe.get_all(
		"Clinic Visit",
		filters={"service_point": label, "status": ["in", ["Waiting Lab", "Waiting Pharmacy"]], "attendance": ["is", "set"]},
		fields=["name as visit", "patient_name", "patient_type", "status", "sex", "age_years"],
		order_by="modified asc",
	)
	completed = frappe.get_all(
		"Clinic Attendance",
		filters={"clinic_unit": label, "status": "Completed", "attendance_date": [">=", start]},
		fields=["name as attendance", "visit", "patient_name", "patient_type", "sex", "age_years", "service_type",
				"attendance_date", "tb_screening", "referred_to_doctor"],
		order_by="attendance_date desc",
	)

	today = frappe.db.sql(
		"""
		SELECT IFNULL(SUM(status = 'Completed'), 0) AS seen,
			IFNULL(SUM(patient_type = 'Employee'), 0) AS employees,
			IFNULL(SUM(patient_type = 'Community Member'), 0) AS community,
			IFNULL(SUM(referred_to_doctor), 0) AS to_doctor,
			IFNULL(SUM(tb_screening_code = 1), 0) AS presumed_tb
		FROM `tabClinic Attendance` WHERE clinic_unit = %s AND attendance_date >= %s
		""",
		(label, start),
		as_dict=True,
	)[0]
	by_service = dict(
		frappe.db.sql(
			"SELECT service_type, COUNT(*) FROM `tabClinic Attendance` WHERE clinic_unit = %s AND attendance_date >= %s GROUP BY service_type",
			(label, start),
		)
	)
	avg_wait = frappe.db.sql(
		"""
		SELECT AVG(TIMESTAMPDIFF(MINUTE, t.triage_datetime, a.creation))
		FROM `tabClinic Attendance` a JOIN `tabClinic Visit` v ON v.name = a.visit
		JOIN `tabClinic Triage` t ON t.name = v.triage
		WHERE a.clinic_unit = %s AND a.attendance_date >= %s
		""",
		(label, start),
	)[0][0]

	return {
		"label": label,
		"services": UNITS[unit]["services"],
		"cwc": cwc.stats() if unit == "mch" else None,
		"kpis": {
			"waiting": len(waiting),
			"emergency": sum(1 for r in waiting if r.priority in ("Emergency", "Urgent")),
			"longest_wait": max((r.wait_minutes for r in waiting), default=0),
			"results_ready": len(results_ready),
			"in_progress": len(in_progress),
			"seen_today": today.seen,
			"employees_today": today.employees,
			"community_today": today.community,
			"to_doctor": today.to_doctor,
			"presumed_tb": today.presumed_tb,
			"avg_wait": round(avg_wait or 0),
			"by_service": {s: by_service.get(s, 0) for s in UNITS[unit]["services"]},
		},
		"waiting": waiting,
		"in_progress": in_progress,
		"results_ready": results_ready,
		"in_flight": in_flight,
		"completed": completed,
	}


@frappe.whitelist()
def insights(unit):
	require(unit)
	label = _label(unit)
	by_day = frappe.db.sql(
		"""
		SELECT DATE(attendance_date) AS day, SUM(patient_type = 'Employee') AS employees,
			SUM(patient_type = 'Community Member') AS community
		FROM `tabClinic Attendance` WHERE clinic_unit = %s AND DATE(attendance_date) >= %s
		GROUP BY DATE(attendance_date) ORDER BY day
		""",
		(label, add_days(nowdate(), -13)),
		as_dict=True,
	)
	since = add_days(nowdate(), -29)
	services = frappe.db.sql(
		"""
		SELECT service_type AS label, COUNT(*) AS value FROM `tabClinic Attendance`
		WHERE clinic_unit = %s AND DATE(attendance_date) >= %s GROUP BY service_type ORDER BY value DESC
		""",
		(label, since),
		as_dict=True,
	)
	screening = dict(
		frappe.db.sql(
			"""SELECT tb_screening_code, COUNT(*) FROM `tabClinic Attendance`
			WHERE clinic_unit = %s AND DATE(attendance_date) >= %s AND tb_screening_code > 0 GROUP BY tb_screening_code""",
			(label, since),
		)
	)
	title, field = SPECIFIC[unit]
	specific = frappe.db.sql(
		f"""SELECT {field} AS label, COUNT(*) AS value FROM `tabClinic Attendance`
		WHERE clinic_unit = %s AND DATE(attendance_date) >= %s AND IFNULL({field}, '') != ''
		GROUP BY {field} ORDER BY value DESC""",
		(label, since),
		as_dict=True,
	)
	return {
		"by_day": [{**r, "day": str(r.day)} for r in by_day],
		"services": services,
		"tb_screening": [{"label": f"{c} - {TB_LABELS[c]}", "value": screening.get(c, 0)} for c in (1, 2, 3, 4)],
		"specific_title": title,
		"specific": specific,
	}


@frappe.whitelist()
def seen_month(unit):
	require(unit)
	label, first = _label(unit), get_first_day(nowdate())
	rows = frappe.get_all(
		"Clinic Attendance",
		filters={"clinic_unit": label, "status": "Completed", "attendance_date": [">=", f"{first} 00:00:00"]},
		fields=["name as attendance", "patient_name", "patient_type", "sex", "age_years", "service_type",
				"attendance_date", "tb_screening", "referred_to_doctor"],
		order_by="attendance_date desc",
	)
	by_service = {}
	for r in rows:
		by_service[r.service_type] = by_service.get(r.service_type, 0) + 1
	return {
		"month": frappe.utils.formatdate(first, "MMMM yyyy"),
		"rows": rows,
		"summary": {
			"total": len(rows),
			"employees": sum(1 for r in rows if r.patient_type == "Employee"),
			"community": sum(1 for r in rows if r.patient_type == "Community Member"),
			"to_doctor": sum(1 for r in rows if r.referred_to_doctor),
			"presumed_tb": sum(1 for r in rows if (r.tb_screening or "").startswith("1")),
			"by_service": {s: by_service.get(s, 0) for s in UNITS[unit]["services"]},
		},
	}


@frappe.whitelist()
def workspace(unit, visit):
	require(unit)
	visit_doc = frappe.get_doc("Clinic Visit", visit)
	patient = patient_card(visit_doc.patient)
	triage = frappe.db.get_value("Clinic Triage", visit_doc.triage, "*", as_dict=True) if visit_doc.triage else None
	attendance = None
	if visit_doc.attendance:
		doc = frappe.get_doc("Clinic Attendance", visit_doc.attendance)
		attendance = doc.as_dict(no_nulls=True)
		for row in attendance.get("lab_requests", []):
			if row.get("lab_test"):
				row["lab_status"], row["result"] = frappe.db.get_value(
					"Clinic Lab Test", row["lab_test"], ["status", "interpretation"]
				)
	lab_tests = frappe.get_all(
		"Clinic Lab Test",
		filters={"visit": visit, "status": ["!=", "Cancelled"]},
		fields=["name", "test_type", "status", "interpretation", "performed_where", "result_comments",
				"external_facility", "external_report", "resulted_on"],
		order_by="requested_on asc",
	)
	for test in lab_tests:
		test.results = frappe.get_all(
			"Clinic Lab Test Result Item", filters={"parent": test.name},
			fields=["parameter", "value", "unit", "reference", "flag"], order_by="idx asc",
		)
	history = frappe.get_all(
		"Clinic Attendance",
		filters={"patient": visit_doc.patient, "visit": ["!=", visit], "status": "Completed"},
		fields=["name", "attendance_date", "clinic_unit", "service_type", "anc_visit_number", "postnatal_visit_no",
				"tb_screening", "assessment_notes", "growth_status", "fp_method", "adherence", "clinician"],
		order_by="attendance_date desc",
		limit=12,
	)
	for row in history:
		row.clinician_name = user_name(row.clinician)
	return {
		"visit": visit_doc.as_dict(),
		"patient": patient,
		"triage": triage,
		"attendance": attendance,
		"lab_tests": lab_tests,
		"history": history,
		"services": UNITS[unit]["services"],
		"bill": billing.summary(visit),
		"cwc": cwc.get_child(patient=visit_doc.patient) if (attendance or {}).get("service_type") == "CWC Attendance" else None,
		"pnc": pnc.get_record(patient=visit_doc.patient) if (attendance or {}).get("service_type") == "Postnatal Attendance" else None,
		"fp": fp.get_record(patient=visit_doc.patient) if (attendance or {}).get("service_type") == "Family Planning" else None,
		"anc": anc.get_record(patient=visit_doc.patient) if (attendance or {}).get("service_type") == "ANC Attendance" else None,
	}


@frappe.whitelist()
def start(unit, visit, service_type):
	"""Open the attendance for a visit (or return the one already open)."""
	require(unit)
	label = _label(unit)
	existing = frappe.db.get_value("Clinic Visit", visit, "attendance")
	if existing:
		return existing
	if service_type not in UNITS[unit]["services"]:
		frappe.throw(_("{0} is not offered by the {1}").format(service_type, label))
	return frappe.get_doc(
		{"doctype": "Clinic Attendance", "visit": visit, "clinic_unit": label, "service_type": service_type}
	).insert().name


def _apply(doc, data):
	for field in TEXT_FIELDS:
		if field in data:
			doc.set(field, clean(data[field]))
	for field in DATE_FIELDS:
		if field in data:
			doc.set(field, clean(data[field]))
	for field in INT_FIELDS:
		if field in data:
			doc.set(field, to_number(data[field], integer=True))
	for field in FLOAT_FIELDS:
		if field in data:
			doc.set(field, to_number(data[field]))
	for field in CHECK_FIELDS:
		if field in data:
			doc.set(field, cint(data[field]))
	if "service_type" in data and data["service_type"] in UNITS[{v["label"]: k for k, v in UNITS.items()}[doc.clinic_unit]]["services"]:
		doc.service_type = data["service_type"]
	if "procedures" in data:
		doc.set("procedures", [
			{"procedure": row["procedure"], "qty": cint(row.get("qty")) or 1, "notes": clean(row.get("notes"))}
			for row in data["procedures"] if row.get("procedure")
		])
	if "prescriptions" in data:
		doc.set("prescriptions", [
			{
				**pick(row, ["drug", "dose", "route", "frequency", "instructions"]),
				"duration_days": to_number(row.get("duration_days"), integer=True),
				"quantity": to_number(row.get("quantity")),
			}
			for row in data["prescriptions"] if row.get("drug")
		])
	if "lab_requests" in data:
		# requests already at the lab are locked; only unsent ones can change
		doc.set("lab_requests", [row for row in doc.lab_requests if row.lab_test])
		for row in data["lab_requests"]:
			if row.get("lab_test") or not row.get("test_type"):
				continue
			doc.append("lab_requests", pick(row, ["test_type", "urgency", "clinical_notes"]))


@frappe.whitelist()
def save(unit, name, data):
	require(unit)
	doc = frappe.get_doc("Clinic Attendance", name)
	_apply(doc, frappe.parse_json(data))
	doc.save()
	return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def action(unit, name, action, data=None):
	"""Save the form and then move the patient on: lab, pharmacy, the doctor, or finish."""
	require(unit)
	doc = frappe.get_doc("Clinic Attendance", name)
	if data:
		_apply(doc, frappe.parse_json(data))
		doc.save()
	methods = {
		"send_to_lab": doc.send_to_lab,
		"send_to_pharmacy": doc.send_to_pharmacy,
		"refer_to_doctor": doc.refer_to_doctor,
		"complete": doc.complete_attendance,
	}
	if action not in methods:
		frappe.throw(_("Unknown action {0}").format(action))
	methods[action]()
	return {"name": doc.name, "status": doc.status, "visit_status": frappe.db.get_value("Clinic Visit", doc.visit, "status")}


@frappe.whitelist()
def set_tb_screening(unit, name, code):
	require(unit)
	doc = frappe.get_doc("Clinic Attendance", name)
	doc.set_tb_screening(code)
	return {"tb_screening": doc.tb_screening, "status": doc.status,
			"visit_status": frappe.db.get_value("Clinic Visit", doc.visit, "status")}
