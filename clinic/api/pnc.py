"""The postnatal register: registration (PNC number), earlier visits and look-ups."""

import frappe
from frappe import _

from clinic.api.common import clean, patient_card, pick, require
from clinic.clinic.doctype.clinic_pnc_record.clinic_pnc_record import next_pnc_no
from clinic.utils import age_text

PAGE = "mch"
FIELDS = ["pnc_no", "registration_date", "phone", "village", "marital_status"]


def _record_dict(doc):
	data = doc.as_dict(no_nulls=True)
	data["age"] = age_text(doc.dob) if doc.dob else None
	for field in ("pnc_no", "phone", "village", "marital_status", "delivery_date", "delivery_time", "delivery_place",
		"delivery_mode", "delivery_outcome", "last_visit_date"):
		data.setdefault(field, None)
	for field in ("gravida", "parity", "visits_count"):
		data.setdefault(field, 0)
	if data.get("delivery_time") is not None:
		data["delivery_time"] = str(data["delivery_time"])[:5]
	return data


def visit_history(record, limit=8):
	"""Earlier visits for this delivery, newest first."""
	return frappe.get_all(
		"Clinic Attendance",
		filters={"pnc_record": record, "service_type": "Postnatal Attendance", "status": "Completed"},
		fields=["name", "attendance_date", "postnatal_visit_no", "days_postpartum", "mother_pnc_timing", "bp_systolic",
			"bp_diastolic", "maternal_condition", "infant_weight_kg", "infant_feeding", "pnc_fp_method", "maternal_complications"],
		order_by="attendance_date desc",
		limit=limit,
	)


@frappe.whitelist()
def get_record(patient=None, record=None):
	"""The mother's active PNC register entry, or what is needed to open one."""
	require(PAGE)
	if not record and patient:
		record = frappe.db.get_value("Clinic PNC Record", {"patient": patient, "status": "Active"}, "name")
	if not record:
		anc = frappe.db.get_value(
			"Clinic ANC Record", {"patient": patient}, ["gravida", "parity", "abortions", "anc_no"], as_dict=True,
			order_by="creation desc",
		) if patient else None
		return {"registered": False, "patient": patient_card(patient) if patient else None,
			"suggested_pnc_no": next_pnc_no(), "from_anc": anc}
	doc = frappe.get_doc("Clinic PNC Record", record)
	return {"registered": True, "record": _record_dict(doc), "patient": patient_card(doc.patient), "history": visit_history(doc.name)}


@frappe.whitelist()
def register(data):
	"""Open the PNC register entry for a mother who is already a patient."""
	require(PAGE)
	data = frappe.parse_json(data)
	patient = data.get("patient")
	if not patient:
		frappe.throw(_("Select the mother first"))
	existing = frappe.db.get_value("Clinic PNC Record", {"patient": patient, "status": "Active"}, "name")
	if existing:
		return get_record(record=existing)
	sex = frappe.db.get_value("Clinic Patient", patient, "sex")
	if sex and sex.lower().startswith("m"):
		frappe.throw(_("The postnatal register is for mothers"))
	values = {}
	anc = frappe.db.get_value("Clinic ANC Record", {"patient": patient}, ["gravida", "parity"], as_dict=True, order_by="creation desc")
	if anc:  # what the antenatal register already knows need not be asked again
		values = {"gravida": anc.gravida, "parity": anc.parity}
	doc = frappe.get_doc({"doctype": "Clinic PNC Record", "patient": patient, **values, **pick(data, FIELDS)})
	doc.insert()
	return get_record(record=doc.name)


@frappe.whitelist()
def save_record(record, data):
	require(PAGE)
	data = frappe.parse_json(data)
	doc = frappe.get_doc("Clinic PNC Record", record)
	for field in ("pnc_no", "phone", "village", "marital_status", "status", "exit_notes"):
		if field in data:
			doc.set(field, clean(data[field]))
	doc.save()
	return _record_dict(doc)
