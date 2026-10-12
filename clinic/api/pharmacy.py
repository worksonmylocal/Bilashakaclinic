"""Data and actions behind the Pharmacy page."""

import frappe
from frappe.utils import add_days, nowdate

from frappe import _
from frappe.utils import flt

from clinic import billing
from clinic.api.common import clean, minutes_since, patient_card, require, to_number, today_start, user_name


@frappe.whitelist()
def dashboard():
	require("pharmacy")
	start = today_start()

	pending = frappe.db.sql(
		"""
		SELECT d.name, d.visit, d.patient, d.patient_name, d.patient_type, d.creation AS since,
			IFNULL(c.doctor, a.clinician) AS doctor, v.sex, v.age_years, p.allergies, v.employer, v.billable,
			(SELECT COUNT(*) FROM `tabClinic Dispensing Item` i WHERE i.parent = d.name) AS item_count,
			IFNULL((SELECT GROUP_CONCAT(x.diagnosis SEPARATOR ', ') FROM `tabClinic Consultation Diagnosis` x
				WHERE x.parent = d.consultation), a.service_type) AS diagnoses
		FROM `tabClinic Dispensing` d
		LEFT JOIN `tabClinic Consultation` c ON c.name = d.consultation
		LEFT JOIN `tabClinic Attendance` a ON a.name = d.attendance
		LEFT JOIN `tabClinic Visit` v ON v.name = d.visit
		LEFT JOIN `tabClinic Patient` p ON p.name = d.patient
		WHERE d.docstatus = 0 ORDER BY d.creation
		""",
		as_dict=True,
	)
	for row in pending:
		row.wait_minutes = minutes_since(row.since)
		row.doctor_name = user_name(row.doctor)
		bill = billing.summary(row.visit)
		row.bill_total = bill["total"] if bill else 0
		row.billing_mode = bill["billing_mode"] if bill else billing.terms(row.visit)["billing_mode"]

	# Billed patients who finished with the doctor/lab but have nothing to dispense still pay here
	payment_only = frappe.db.sql(
		"""
		SELECT b.name AS bill, b.visit, b.patient, b.patient_name, b.total, b.billing_mode, b.creation AS since,
			v.patient_type, v.sex, v.age_years, v.employer
		FROM `tabClinic Bill` b JOIN `tabClinic Visit` v ON v.name = b.visit
		WHERE b.status = 'Open' AND b.total > 0 AND v.status = 'Waiting Pharmacy'
			AND NOT EXISTS (SELECT 1 FROM `tabClinic Dispensing` d WHERE d.visit = b.visit AND d.docstatus = 0)
		ORDER BY b.modified
		""",
		as_dict=True,
	)
	for row in payment_only:
		row.wait_minutes = minutes_since(row.since)
		row.total = billing.summary(row.visit)["total"]

	dispensed = frappe.db.sql(
		"""
		SELECT d.name, d.visit, d.patient_name, d.patient_type, d.dispensed_on, d.pharmacist,
			(SELECT COUNT(*) FROM `tabClinic Dispensing Item` i WHERE i.parent = d.name) AS item_count
		FROM `tabClinic Dispensing` d WHERE d.docstatus = 1 AND d.dispensed_on >= %s
		ORDER BY d.dispensed_on DESC
		""",
		start,
		as_dict=True,
	)
	paid = {
		b.visit: b
		for b in frappe.get_all(
			"Clinic Bill", {"status": ["in", ["Paid", "Invoiced"]], "visit": ["in", [r.visit for r in dispensed] or [""]]},
			["visit", "name", "receipt_no", "invoice_no", "total", "status", "billing_mode"]
		)
	}
	needs_sheet = {r.visit for r in dispensed if billing.terms(r.visit)["sick_sheet"]}
	for row in dispensed:
		row.pharmacist_name = user_name(row.pharmacist)
		row.bill = paid.get(row.visit)
		row.sick_sheet = row.visit in needs_sheet

	stats = frappe.db.sql(
		"""
		SELECT COUNT(*) AS prescriptions,
			IFNULL(SUM(d.patient_type = 'Employee'), 0) AS employees,
			IFNULL(SUM(d.patient_type = 'Community Member'), 0) AS community,
			AVG(TIMESTAMPDIFF(MINUTE, d.creation, d.dispensed_on)) AS avg_wait,
			(SELECT IFNULL(SUM(i.dispensed_qty), 0) FROM `tabClinic Dispensing Item` i
				JOIN `tabClinic Dispensing` d2 ON d2.name = i.parent
				WHERE d2.docstatus = 1 AND d2.dispensed_on >= %(start)s) AS units,
			(SELECT COUNT(*) FROM `tabClinic Dispensing Item` i
				JOIN `tabClinic Dispensing` d3 ON d3.name = i.parent
				WHERE d3.docstatus = 1 AND d3.dispensed_on >= %(start)s) AS line_count
		FROM `tabClinic Dispensing` d WHERE d.docstatus = 1 AND d.dispensed_on >= %(start)s
		""",
		{"start": start},
		as_dict=True,
	)[0]

	collected = frappe.db.sql(
		"SELECT IFNULL(SUM(total), 0), COUNT(*) FROM `tabClinic Bill` WHERE status = 'Paid' AND paid_on >= %s", start
	)[0]
	invoiced = frappe.db.sql(
		"SELECT IFNULL(SUM(total), 0), COUNT(*) FROM `tabClinic Bill` WHERE invoiced_on >= %s", start
	)[0]

	return {
		"kpis": {
			"waiting": len(pending) + len(payment_only),
			"longest_wait": max((r.wait_minutes for r in pending + payment_only), default=0),
			"collected_today": flt(collected[0]),
			"receipts_today": collected[1],
			"invoiced_today": flt(invoiced[0]),
			"invoices_today": invoiced[1],
			"with_allergies": sum(1 for r in pending if r.allergies),
			"dispensed_today": stats.prescriptions,
			"units_today": round(stats.units or 0),
			"lines_today": stats.line_count,
			"avg_wait": round(stats.avg_wait or 0),
			"employees_today": stats.employees,
			"community_today": stats.community,
		},
		"pending": pending,
		"payment_only": payment_only,
		"dispensed": dispensed,
	}


@frappe.whitelist()
def insights():
	require("pharmacy")
	since = add_days(nowdate(), -13)
	top_drugs = frappe.db.sql(
		"""
		SELECT IFNULL(i.drug_name, i.drug) AS label, SUM(i.dispensed_qty) AS qty, COUNT(*) AS prescriptions,
			SUM(IF(d.patient_type = 'Employee', i.dispensed_qty, 0)) AS employees,
			SUM(IF(d.patient_type = 'Community Member', i.dispensed_qty, 0)) AS community
		FROM `tabClinic Dispensing Item` i JOIN `tabClinic Dispensing` d ON d.name = i.parent
		WHERE d.docstatus = 1 AND DATE(d.dispensed_on) >= %s
		GROUP BY i.drug, i.drug_name ORDER BY qty DESC LIMIT 8
		""",
		add_days(nowdate(), -29),
		as_dict=True,
	)
	by_day = frappe.db.sql(
		"""
		SELECT DATE(dispensed_on) AS day,
			SUM(patient_type = 'Employee') AS employees,
			SUM(patient_type = 'Community Member') AS community
		FROM `tabClinic Dispensing` WHERE docstatus = 1 AND DATE(dispensed_on) >= %s
		GROUP BY DATE(dispensed_on) ORDER BY day
		""",
		since,
		as_dict=True,
	)
	return {"top_drugs": top_drugs, "by_day": [{**row, "day": str(row.day)} for row in by_day]}


@frappe.whitelist()
def get_dispensing(name):
	require("pharmacy")
	doc = frappe.get_doc("Clinic Dispensing", name)
	data = doc.as_dict(no_nulls=True)
	data["patient_card"] = patient_card(doc.patient)
	if doc.consultation:
		data["doctor_name"] = user_name(frappe.db.get_value("Clinic Consultation", doc.consultation, "doctor"))
		data["diagnoses"] = frappe.get_all(
			"Clinic Consultation Diagnosis", filters={"parent": doc.consultation}, pluck="diagnosis"
		)
	else:
		service, clinician = frappe.db.get_value("Clinic Attendance", doc.attendance, ["service_type", "clinician"])
		data["doctor_name"] = user_name(clinician)
		data["diagnoses"] = [service]
	data["weight_kg"] = frappe.db.get_value(
		"Clinic Triage", frappe.db.get_value("Clinic Visit", doc.visit, "triage"), "weight_kg"
	)
	t = billing.terms(doc.visit)
	data.update(billable=True, billing_mode=t["billing_mode"], sick_sheet=t["sick_sheet"], employer=t["employer"])
	data["bill"] = billing.summary(doc.visit)
	data["prices"] = billing.drug_prices()
	return data


def _payment_args(payment):
	payment = frappe.parse_json(payment) if payment else {}
	return payment.get("mode"), flt(payment.get("amount")), clean(payment.get("reference"))


@frappe.whitelist()
def dispense(name, items, notes=None, submit=1, payment=None):
	"""Record what was handed out. Cash patients pay here; farm staff are invoiced to the farm."""
	require("pharmacy")
	rows = {row["name"]: row for row in frappe.parse_json(items)}
	doc = frappe.get_doc("Clinic Dispensing", name)
	if doc.docstatus != 0:
		frappe.throw(_("{0} has already been dispensed").format(name))
	for row in doc.items:
		if row.name in rows:
			row.dispensed_qty = to_number(rows[row.name].get("dispensed_qty")) or 0
			row.not_available = 1 if rows[row.name].get("not_available") else 0
	doc.notes = clean(notes)
	doc.save()  # also brings the drug charges on the bill up to date
	bill = None
	if int(submit):
		bill = billing.sync(doc.visit)
		if bill and flt(bill.total) > 0:
			if bill.billing_mode == "Invoice":
				bill = billing.issue_invoice(doc.visit)
			else:
				mode, amount, reference = _payment_args(payment)
				bill = billing.pay(doc.visit, mode, amount, reference)  # settled first so the visit can close
		doc.submit()
	settled = bill if bill and bill.status in ("Paid", "Invoiced") else None
	return {
		"name": doc.name,
		"docstatus": doc.docstatus,
		"visit": doc.visit,
		"visit_status": frappe.db.get_value("Clinic Visit", doc.visit, "status"),
		"bill": settled.name if settled else None,
		"document": ("invoice" if settled.status == "Invoiced" else "receipt") if settled else None,
		"sick_sheet": billing.terms(doc.visit)["sick_sheet"],
	}


@frappe.whitelist()
def get_payment(visit):
	"""Bill for a patient who has nothing to dispense but still has to settle it."""
	require("pharmacy")
	patient = frappe.db.get_value("Clinic Visit", visit, "patient")
	t = billing.terms(visit)
	return {
		"patient_card": patient_card(patient),
		"employer": t["employer"],
		"billing_mode": t["billing_mode"],
		"sick_sheet": t["sick_sheet"],
		"bill": billing.summary(visit),
	}


def _close_visit(visit):
	from clinic.clinic.doctype.clinic_visit.clinic_visit import set_visit_status

	if frappe.db.get_value("Clinic Visit", visit, "status") == "Waiting Pharmacy":
		set_visit_status(visit, "Completed")  # nothing left to dispense


@frappe.whitelist()
def take_payment(visit, payment):
	"""Cash patient with nothing to dispense."""
	require("pharmacy")
	mode, amount, reference = _payment_args(payment)
	bill = billing.pay(visit, mode, amount, reference)
	_close_visit(visit)
	return {"bill": bill.name, "document": "receipt", "visit": visit, "sick_sheet": billing.terms(visit)["sick_sheet"],
		"visit_status": frappe.db.get_value("Clinic Visit", visit, "status")}


@frappe.whitelist()
def issue_invoice(visit):
	"""Farm employee with nothing to dispense: raise the invoice and close the visit."""
	require("pharmacy")
	bill = billing.issue_invoice(visit)
	_close_visit(visit)
	return {"bill": bill.name, "document": "invoice", "visit": visit, "sick_sheet": billing.terms(visit)["sick_sheet"],
		"visit_status": frappe.db.get_value("Clinic Visit", visit, "status")}
