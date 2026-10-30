"""The Child Welfare Clinic register: registration, immunization card and defaulters."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, getdate, nowdate

from clinic.api.common import clean, patient_card, pick, require_any, to_number, user_name
from clinic.clinic.doctype.clinic_child_record.clinic_child_record import next_cwc_no
from clinic.utils import age_in_months, age_text

PAGES = ("mch", "consultation")

# One row per child with at least one dose past its grace period. Worked out live from the
# doses themselves, so it is right even if a stored flag has not been refreshed yet.
OVERDUE_SQL = """
	SELECT c.name AS child, c.cwc_no, c.serial_no, c.patient, c.child_name, c.dob, c.sex,
		c.caregiver_name, c.caregiver_relationship, c.caregiver_phone, c.alt_phone, c.village,
		COUNT(*) AS overdue, MIN(d.due_date) AS oldest_due,
		GROUP_CONCAT(d.vaccine ORDER BY d.due_date SEPARATOR ', ') AS vaccines
	FROM `tabClinic Child Record` c
	JOIN `tabClinic Immunization Dose` d ON d.parent = c.name AND d.parenttype = 'Clinic Child Record'
	WHERE c.status = 'Active' AND IFNULL(d.date_given, '') = '' AND d.status != 'Not Applicable'
		AND IFNULL(d.optional, 0) = 0
		AND DATE_ADD(d.due_date, INTERVAL IFNULL(d.grace_days, 0) DAY) < CURDATE()
	GROUP BY c.name
	ORDER BY oldest_due
"""


def _child_dict(doc):
	data = doc.as_dict(no_nulls=True)
	data["age"] = age_text(doc.dob)
	data["age_months"] = age_in_months(doc.dob)
	# as_dict drops empty values, but the screens read these keys unconditionally
	for field in ("next_due_vaccine", "next_due_date", "cwc_no", "caregiver_name", "caregiver_phone",
		"alt_phone", "village", "delivery_place", "delivery_facility", "birth_weight_kg", "birth_notes",
		"caregiver_relationship", "immunization_summary", "exit_reason"):
		data.setdefault(field, None)
	for field in ("is_defaulter", "overdue_count"):
		data.setdefault(field, 0)
	data["doses"] = [
		{
			"idx": r.idx, "name": r.name, "milestone": r.milestone, "vaccine": r.vaccine,
			"due_date": str(r.due_date) if r.due_date else None, "date_given": str(r.date_given) if r.date_given else None,
			"batch_no": r.batch_no, "status": r.status, "optional": r.optional, "age_days": r.age_days,
			"given_by": user_name(r.given_by) if r.given_by else None,
		}
		for r in doc.immunizations
	]
	return data


def growth_history(patient, limit=8):
	"""Earlier CWC visits' measurements, newest first, for monitoring growth between visits."""
	rows = frappe.get_all(
		"Clinic Attendance",
		filters={"patient": patient, "service_type": "CWC Attendance", "status": "Completed"},
		fields=["name", "attendance_date", "cwc_age_months", "weight_kg", "height_cm", "muac_cm",
			"weight_category", "stunting_status", "muac_category", "developmental_status", "danger_signs"],
		order_by="attendance_date desc",
		limit=limit,
	)
	return rows


@frappe.whitelist()
def get_child(patient=None, child=None):
	"""The child's register entry, or what is needed to open one."""
	require_any(*PAGES)
	if not child and patient:
		child = frappe.db.get_value("Clinic Child Record", {"patient": patient}, "name")
	if not child:
		card = patient_card(patient) if patient else None
		return {"registered": False, "patient": card, "suggested_cwc_no": next_cwc_no()}
	doc = frappe.get_doc("Clinic Child Record", child)
	return {
		"registered": True,
		"child": _child_dict(doc),
		"patient": patient_card(doc.patient),
		"growth": growth_history(doc.patient),
	}


@frappe.whitelist()
def register_child(data):
	"""Open the register entry for a child who is already a patient."""
	require_any(*PAGES)
	data = frappe.parse_json(data)
	patient = data.get("patient")
	if not patient:
		frappe.throw(_("Select the child first"))
	existing = frappe.db.get_value("Clinic Child Record", {"patient": patient}, "name")
	if existing:
		return get_child(child=existing)

	fields = [
		"cwc_no", "registration_date", "caregiver_name", "caregiver_relationship", "caregiver_phone",
		"alt_phone", "village", "delivery_place", "delivery_facility", "birth_notes",
	]
	dob = frappe.db.get_value("Clinic Patient", patient, "date_of_birth")
	if dob and age_in_months(dob) > 59:
		frappe.throw(_("The CWC register is for children under 5 years. This child is {0}.").format(age_text(dob)))
	doc = frappe.get_doc(
		{
			"doctype": "Clinic Child Record",
			"patient": patient,
			**pick(data, fields),
			"birth_weight_kg": to_number(data.get("birth_weight_kg")),
		}
	)
	doc.insert()
	return get_child(child=doc.name)


@frappe.whitelist()
def save_child(child, data):
	"""Update the register entry (details that carry over to every later visit)."""
	require_any(*PAGES)
	data = frappe.parse_json(data)
	doc = frappe.get_doc("Clinic Child Record", child)
	for field in (
		"cwc_no", "caregiver_name", "caregiver_relationship", "caregiver_phone", "alt_phone",
		"village", "delivery_place", "delivery_facility", "birth_notes", "status", "exit_reason",
	):
		if field in data:
			doc.set(field, clean(data[field]))
	if "birth_weight_kg" in data:
		doc.birth_weight_kg = to_number(data["birth_weight_kg"])
	doc.save()
	return _child_dict(doc)


@frappe.whitelist()
def record_doses(child, doses, attendance=None):
	"""Mark the doses given at this visit, with their batch numbers."""
	require_any(*PAGES)
	doses = frappe.parse_json(doses)
	doc = frappe.get_doc("Clinic Child Record", child)
	doc.dob = frappe.db.get_value("Clinic Patient", doc.patient, "date_of_birth")  # never trust a stale copy
	rows = {r.name: r for r in doc.immunizations}
	given = []
	for entry in doses:
		row = rows.get(entry.get("name"))
		if not row:
			continue
		date_given = clean(entry.get("date_given"))
		if date_given:
			if getdate(date_given) > getdate(nowdate()):
				frappe.throw(_("{0}: a dose cannot be given in the future").format(row.vaccine))
			if doc.dob and getdate(date_given) < getdate(doc.dob):
				frappe.throw(
					_("{0}: {1} is before the child's date of birth ({2}). Correct the date of birth on the patient record if it is wrong.").format(
						row.vaccine, frappe.utils.formatdate(date_given), frappe.utils.formatdate(doc.dob)
					)
				)
			if not row.date_given:
				row.given_by = frappe.session.user
				row.attendance = attendance
			given.append(row.vaccine)
		else:
			row.given_by = row.attendance = None
		row.date_given = date_given
		row.batch_no = clean(entry.get("batch_no"))
		if entry.get("not_applicable"):
			row.status = "Not Applicable"
			row.date_given = row.batch_no = None
		elif row.status == "Not Applicable":
			row.status = "Scheduled"
	doc.save()

	if attendance and given:
		frappe.db.set_value("Clinic Attendance", attendance, {
			"child_record": doc.name,
			"doses_given_today": ", ".join(given),
		})
	return {"child": _child_dict(doc), "given": given}


@frappe.whitelist()
def defaulters(limit=None):
	"""Children with at least one immunization past its grace period."""
	require_any(*PAGES)
	rows = frappe.db.sql(OVERDUE_SQL, as_dict=True)
	today = getdate(nowdate())
	for row in rows:
		row.age = age_text(row.dob)
		row.days_late = (today - getdate(row.oldest_due)).days
		row.last_seen = frappe.db.get_value(
			"Clinic Attendance", {"patient": row.patient, "status": "Completed", "service_type": ["!=", "HTS Attendance"]}, "attendance_date",
			order_by="attendance_date desc",
		)
	if limit:
		rows = rows[: cint(limit)]
	return rows


@frappe.whitelist()
def due_soon(days=14):
	"""Children with a dose due within the next fortnight (not yet overdue)."""
	require_any(*PAGES)
	return frappe.db.sql(
		"""
		SELECT c.name AS child, c.cwc_no, c.patient, c.child_name, c.caregiver_name, c.caregiver_phone,
			MIN(d.due_date) AS due_date,
			GROUP_CONCAT(d.vaccine ORDER BY d.due_date SEPARATOR ', ') AS vaccines
		FROM `tabClinic Child Record` c
		JOIN `tabClinic Immunization Dose` d ON d.parent = c.name AND d.parenttype = 'Clinic Child Record'
		WHERE c.status = 'Active' AND IFNULL(d.date_given, '') = '' AND d.status != 'Not Applicable'
			AND IFNULL(d.optional, 0) = 0 AND d.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL %s DAY)
		GROUP BY c.name ORDER BY due_date
		""",
		cint(days),
		as_dict=True,
	)


@frappe.whitelist()
def stats():
	"""Headline numbers for the CWC side of the MCH desk."""
	require_any(*PAGES)
	first_of_month = frappe.utils.get_first_day(nowdate())
	overdue = frappe.db.sql(f"SELECT COUNT(*) FROM ({OVERDUE_SQL}) x")[0][0]
	doses_month = frappe.db.sql(
		"""
		SELECT COUNT(*) FROM `tabClinic Immunization Dose` d
		JOIN `tabClinic Child Record` c ON c.name = d.parent
		WHERE d.parenttype = 'Clinic Child Record' AND d.date_given >= %s AND d.date_given >= c.registration_date
		""",
		first_of_month,
	)[0][0]
	return {
		"registered": frappe.db.count("Clinic Child Record", {"status": "Active"}),
		"new_this_month": frappe.db.count("Clinic Child Record", {"registration_date": [">=", first_of_month]}),
		"defaulters": overdue,
		"due_soon": len(due_soon()),
		"doses_this_month": doses_month,
	}


@frappe.whitelist()
def search_children(q=""):
	"""Find a child by CWC number, name, serial number or guardian's phone."""
	require_any(*PAGES)
	q = (q or "").strip()
	like = f"%{q}%"
	rows = frappe.get_all(
		"Clinic Child Record",
		or_filters=[
			["cwc_no", "like", like], ["child_name", "like", like],
			["caregiver_name", "like", like], ["caregiver_phone", "like", like],
			["serial_no", "like", like],
		] if q else None,
		fields=["name", "cwc_no", "serial_no", "patient", "child_name", "dob", "sex",
				"caregiver_name", "caregiver_phone", "is_defaulter", "next_due_vaccine", "next_due_date"],
		order_by="modified desc",
		limit=15,
	)
	for row in rows:
		row.age = age_text(row.dob)
	return rows
