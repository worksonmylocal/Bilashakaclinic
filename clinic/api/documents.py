"""Data for the printable documents: the sick sheet (patient journey) and the payment receipt."""

import frappe
from frappe import _
from frappe.utils import add_days, flt, getdate, now_datetime

from clinic import billing
from clinic.api.common import clinic_profile, patient_card, require_any, user_name

SIGNING_DESIGNATIONS = ("Doctor", "Clinical Officer")


def _signer(user):
	"""Who signs the sick sheet: the clinician who saw the patient, with their registration details."""
	profile = frappe.db.get_value(
		"Clinic Staff Profile", {"user": user}, ["designation", "registration_no", "signature"], as_dict=True
	) if user else None
	return {
		"name": user_name(user),
		"designation": profile.designation if profile else None,
		"registration_no": profile.registration_no if profile else None,
		"signature": profile.signature if profile else None,
		"can_sign": bool(profile and profile.designation in SIGNING_DESIGNATIONS),
	}


@frappe.whitelist()
def sick_sheet(visit):
	"""The whole journey for one visit: triage, consultation, labs, pharmacy and charges."""
	require_any("pharmacy", "consultation", "antenatal", "mch", "tb")
	v = frappe.get_doc("Clinic Visit", visit)
	terms = billing.terms(visit)
	if not terms["sick_sheet"]:
		frappe.throw(_("A sick sheet is not required for this patient's employer"))
	patient = patient_card(v.patient)

	triage = frappe.db.get_value("Clinic Triage", v.triage, "*", as_dict=True) if v.triage else None

	consultation = attendance = None
	diagnoses = []
	if v.consultation:
		consultation = frappe.get_doc("Clinic Consultation", v.consultation).as_dict(no_nulls=True)
		diagnoses = [
			{"diagnosis": d.diagnosis, "type": d.diagnosis_type}
			for d in frappe.get_all(
				"Clinic Consultation Diagnosis",
				filters={"parent": v.consultation},
				fields=["diagnosis", "diagnosis_type"],
				order_by="idx",
			)
		]
	if v.attendance:
		attendance = frappe.get_doc("Clinic Attendance", v.attendance).as_dict(no_nulls=True)

	seen_by = (consultation or attendance or {}).get("doctor") or (consultation or attendance or {}).get("clinician")
	seen_on = (consultation or {}).get("consultation_date") or (attendance or {}).get("attendance_date") or v.visit_date

	sick_days = int((consultation or {}).get("sick_leave_days") or 0)
	light_days = int((consultation or {}).get("light_duty_days") or 0)
	off_from = getdate(seen_on)

	labs = []
	for test in frappe.get_all(
		"Clinic Lab Test",
		filters={"visit": visit, "status": ["!=", "Cancelled"]},
		fields=["name", "test_type", "category", "status", "interpretation", "result_comments", "performed_where", "resulted_on"],
		order_by="requested_on asc",
	):
		test["withheld"] = bool(frappe.db.get_value("Clinic Lab Test Type", test.test_type, "requires_consent"))
		test["results"] = []
		if test.status == "Resulted" and not test["withheld"]:
			test["results"] = [
				r for r in frappe.get_all(
					"Clinic Lab Test Result Item",
					filters={"parent": test.name},
					fields=["parameter", "value", "unit", "reference", "flag"],
					order_by="idx",
				) if (r.value or "").strip()
			]
		if test["withheld"]:
			test.interpretation = None
			test.result_comments = None
		labs.append(test)

	medicines, unavailable, dispensed_on = [], [], None
	dispensing = frappe.db.get_value(
		"Clinic Dispensing", {"visit": visit, "docstatus": ["!=", 2]}, ["name", "docstatus", "dispensed_on"], as_dict=True
	)
	if dispensing:
		dispensed_on = dispensing.dispensed_on
		for row in frappe.get_all(
			"Clinic Dispensing Item",
			filters={"parent": dispensing.name},
			fields=["drug_name", "drug", "dose", "route", "frequency", "duration_days", "prescribed_qty", "dispensed_qty", "uom", "instructions", "not_available"],
			order_by="idx",
		):
			(unavailable if row.not_available else medicines).append(row)

	frappe.get_doc("Clinic Visit", visit).add_comment("Info", _("Sick sheet opened by {0}").format(user_name(frappe.session.user)))
	return {
		"clinic": clinic_profile(),
		"visit": {"name": v.name, "visit_date": v.visit_date, "employer": terms["employer"]},
		"patient": patient,
		"triage": triage,
		"consultation": consultation,
		"attendance": attendance,
		"diagnoses": diagnoses,
		"labs": labs,
		"medicines": medicines,
		"unavailable": unavailable,
		"dispensed_on": dispensed_on,
		"seen_on": seen_on,
		"sick_days": sick_days,
		"light_duty_days": light_days,
		"off_from": str(off_from) if sick_days else None,
		"off_to": str(add_days(off_from, sick_days - 1)) if sick_days else None,
		"back_on": str(add_days(off_from, sick_days)) if sick_days else None,
		"bill": billing.summary(visit),
		"signer": _signer(seen_by),
		"printed_by": user_name(frappe.session.user),
		"printed_on": now_datetime(),
	}


@frappe.whitelist()
def receipt(bill):
	"""Payment receipt for a paid bill."""
	require_any("pharmacy")
	doc = frappe.get_doc("Clinic Bill", bill)
	if doc.status != "Paid":
		frappe.throw(_("This bill has not been paid yet"))
	visit = frappe.db.get_value("Clinic Visit", doc.visit, ["patient", "visit_date"], as_dict=True)
	patient = patient_card(visit.patient)
	doc.add_comment("Info", _("Receipt printed by {0}").format(user_name(frappe.session.user)))
	return {
		"clinic": clinic_profile(),
		"receipt_no": doc.receipt_no,
		"bill": doc.name,
		"visit": doc.visit,
		"visit_date": visit.visit_date,
		"patient": patient,
		"employer": doc.employer,
		"paid_on": doc.paid_on,
		"payment_mode": doc.payment_mode,
		"payment_reference": doc.payment_reference,
		"lines": [
			{"item_type": r.item_type, "description": r.description, "qty": flt(r.qty), "rate": flt(r.rate), "amount": flt(r.amount)}
			for r in doc.items
		],
		"totals": {
			"consultation": flt(doc.consultation_total),
			"procedures": flt(doc.procedure_total),
			"lab": flt(doc.lab_total),
			"drugs": flt(doc.drug_total),
			"total": flt(doc.total),
			"paid": flt(doc.amount_paid),
			"change": flt(doc.change_amount),
		},
		"received_by": user_name(doc.received_by),
		"printed_on": now_datetime(),
	}


@frappe.whitelist()
def invoice(bill):
	"""Invoice for the employer of a farm employee."""
	require_any("pharmacy")
	doc = frappe.get_doc("Clinic Bill", bill)
	if not doc.invoice_no:
		frappe.throw(_("No invoice has been issued for this bill"))
	visit = frappe.db.get_value("Clinic Visit", doc.visit, ["patient", "visit_date"], as_dict=True)
	patient = patient_card(visit.patient)
	employer = frappe.db.get_value("Clinic Employer", doc.employer, ["employer_name", "address", "contact_person", "phone", "email"], as_dict=True) if doc.employer else None
	settings = frappe.get_cached_doc("Clinic Settings")
	doc.add_comment("Info", _("Invoice printed by {0}").format(user_name(frappe.session.user)))
	return {
		"clinic": clinic_profile(),
		"invoice_no": doc.invoice_no,
		"invoiced_on": doc.invoiced_on,
		"status": doc.status,
		"paid_on": doc.paid_on,
		"receipt_no": doc.receipt_no,
		"bill": doc.name,
		"visit": doc.visit,
		"visit_date": visit.visit_date,
		"patient": patient,
		"employer": employer,
		"lines": [
			{"item_type": r.item_type, "description": r.description, "qty": flt(r.qty), "rate": flt(r.rate), "amount": flt(r.amount)}
			for r in doc.items
		],
		"total": flt(doc.total),
		"terms": settings.invoice_terms,
		"payment_details": settings.payment_details,
		"issued_by": user_name(doc.owner),
		"printed_on": now_datetime(),
	}
