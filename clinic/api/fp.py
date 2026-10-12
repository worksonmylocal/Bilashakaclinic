"""The family planning register: registration (FP number) and look-ups."""

import frappe
from frappe import _

from clinic.api.common import clean, patient_card, pick, require
from clinic.clinic.doctype.clinic_fp_record.clinic_fp_record import next_fp_no
from clinic.utils import age_text

PAGE = "antenatal"
FIELDS = ["fp_no", "registration_date", "phone", "village"]


def _record_dict(doc):
	data = doc.as_dict(no_nulls=True)
	data["age"] = age_text(doc.dob) if doc.dob else None
	for field in ("fp_no", "phone", "village", "current_method", "method_since", "last_visit_date"):
		data.setdefault(field, None)
	data.setdefault("visits_count", 0)
	return data


@frappe.whitelist()
def get_record(patient=None, record=None):
	"""The client's FP register entry, or what is needed to open one."""
	require(PAGE)
	if not record and patient:
		record = frappe.db.get_value("Clinic FP Record", {"patient": patient}, "name")
	if not record:
		return {"registered": False, "patient": patient_card(patient) if patient else None, "suggested_fp_no": next_fp_no()}
	doc = frappe.get_doc("Clinic FP Record", record)
	return {"registered": True, "record": _record_dict(doc), "patient": patient_card(doc.patient)}


@frappe.whitelist()
def register(data):
	"""Open the FP register entry for a client who is already a patient."""
	require(PAGE)
	data = frappe.parse_json(data)
	patient = data.get("patient")
	if not patient:
		frappe.throw(_("Select the client first"))
	existing = frappe.db.get_value("Clinic FP Record", {"patient": patient}, "name")
	if existing:
		return get_record(record=existing)
	doc = frappe.get_doc({"doctype": "Clinic FP Record", "patient": patient, **pick(data, FIELDS)})
	doc.insert()
	return get_record(record=doc.name)


@frappe.whitelist()
def save_record(record, data):
	require(PAGE)
	data = frappe.parse_json(data)
	doc = frappe.get_doc("Clinic FP Record", record)
	for field in ("fp_no", "phone", "village", "status", "exit_notes"):
		if field in data:
			doc.set(field, clean(data[field]))
	doc.save()
	return _record_dict(doc)
