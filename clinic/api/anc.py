"""The antenatal register: registration (ANC number), visit history and look-ups."""

import frappe
from frappe import _
from frappe.utils import cint

from clinic.api.common import clean, patient_card, pick, require
from clinic.clinic.doctype.clinic_anc_record.clinic_anc_record import next_anc_no
from clinic.utils import age_text

PAGE = "antenatal"
FIELDS = ["anc_no", "registration_date", "phone", "village", "partner_name", "partner_phone"]


def _record_dict(doc):
	data = doc.as_dict(no_nulls=True)
	data["age"] = age_text(doc.dob) if doc.dob else None
	for field in ("anc_no", "phone", "village", "partner_name", "partner_phone", "lmp", "edd", "height_cm", "last_visit_date"):
		data.setdefault(field, None)
	for field in ("gravida", "parity", "abortions", "visits_count"):
		data.setdefault(field, 0)
	return data


def visit_history(record, limit=8):
	"""Earlier ANC visits for this pregnancy, newest first: the trends a nurse watches."""
	return frappe.get_all(
		"Clinic Attendance",
		filters={"anc_record": record, "service_type": "ANC Attendance", "status": "Completed"},
		fields=["name", "attendance_date", "anc_visit_number", "gestation_weeks", "weight_kg", "bp_systolic", "bp_diastolic",
			"fundal_height_cm", "hb_level", "urine_protein", "iptp_doses", "tt_dose", "complications", "anc_referral"],
		order_by="attendance_date desc",
		limit=limit,
	)


@frappe.whitelist()
def get_record(patient=None, record=None):
	"""The client's active ANC register entry, or what is needed to open one."""
	require(PAGE)
	if not record and patient:
		record = frappe.db.get_value("Clinic ANC Record", {"patient": patient, "status": "Active"}, "name")
	if not record:
		card = patient_card(patient) if patient else None
		previous = frappe.db.get_value(
			"Clinic ANC Record", {"patient": patient}, ["anc_no", "status", "gravida", "parity", "abortions"], as_dict=True,
			order_by="creation desc",
		) if patient else None
		return {"registered": False, "patient": card, "suggested_anc_no": next_anc_no(), "previous": previous}
	doc = frappe.get_doc("Clinic ANC Record", record)
	return {
		"registered": True,
		"record": _record_dict(doc),
		"patient": patient_card(doc.patient),
		"history": visit_history(doc.name),
	}


@frappe.whitelist()
def register(data):
	"""Open the ANC register entry for a client who is already a patient."""
	require(PAGE)
	data = frappe.parse_json(data)
	patient = data.get("patient")
	if not patient:
		frappe.throw(_("Select the client first"))
	existing = frappe.db.get_value("Clinic ANC Record", {"patient": patient, "status": "Active"}, "name")
	if existing:
		return get_record(record=existing)
	sex = frappe.db.get_value("Clinic Patient", patient, "sex")
	if sex and sex.lower().startswith("m"):
		frappe.throw(_("The ANC register is for female clients"))
	doc = frappe.get_doc({"doctype": "Clinic ANC Record", "patient": patient, **pick(data, FIELDS)})
	doc.insert()
	return get_record(record=doc.name)


@frappe.whitelist()
def save_record(record, data):
	"""Update the register entry (details that carry over to every later visit)."""
	require(PAGE)
	data = frappe.parse_json(data)
	doc = frappe.get_doc("Clinic ANC Record", record)
	for field in FIELDS[:1] + FIELDS[2:] + ["status", "exit_notes"]:
		if field in data:
			doc.set(field, clean(data[field]))
	doc.save()
	return _record_dict(doc)


@frappe.whitelist()
def search_records(q=""):
	"""Find a client by ANC number, name, serial number or phone."""
	require(PAGE)
	q = (q or "").strip()
	like = f"%{q}%"
	return frappe.get_all(
		"Clinic ANC Record",
		or_filters=[["anc_no", "like", like], ["client_name", "like", like], ["phone", "like", like], ["serial_no", "like", like]] if q else None,
		fields=["name", "anc_no", "serial_no", "patient", "client_name", "phone", "status", "edd", "visits_count"],
		order_by="modified desc",
		limit=15,
	)
