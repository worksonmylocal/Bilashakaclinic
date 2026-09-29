"""Data and actions behind the Pharmacy page."""

import frappe
from frappe.utils import add_days, nowdate

from clinic.api.common import clean, minutes_since, patient_card, require, to_number, today_start, user_name


@frappe.whitelist()
def dashboard():
	require("pharmacy")
	start = today_start()

	pending = frappe.db.sql(
		"""
		SELECT d.name, d.visit, d.patient, d.patient_name, d.patient_type, d.creation AS since,
			c.doctor, v.sex, v.age_years, p.allergies,
			(SELECT COUNT(*) FROM `tabClinic Dispensing Item` i WHERE i.parent = d.name) AS item_count,
			(SELECT GROUP_CONCAT(x.diagnosis SEPARATOR ', ') FROM `tabClinic Consultation Diagnosis` x
				WHERE x.parent = d.consultation) AS diagnoses
		FROM `tabClinic Dispensing` d
		LEFT JOIN `tabClinic Consultation` c ON c.name = d.consultation
		LEFT JOIN `tabClinic Visit` v ON v.name = d.visit
		LEFT JOIN `tabClinic Patient` p ON p.name = d.patient
		WHERE d.docstatus = 0 ORDER BY d.creation
		""",
		as_dict=True,
	)
	for row in pending:
		row.wait_minutes = minutes_since(row.since)
		row.doctor_name = user_name(row.doctor)

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
	for row in dispensed:
		row.pharmacist_name = user_name(row.pharmacist)

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

	return {
		"kpis": {
			"waiting": len(pending),
			"longest_wait": max((r.wait_minutes for r in pending), default=0),
			"with_allergies": sum(1 for r in pending if r.allergies),
			"dispensed_today": stats.prescriptions,
			"units_today": round(stats.units or 0),
			"lines_today": stats.line_count,
			"avg_wait": round(stats.avg_wait or 0),
			"employees_today": stats.employees,
			"community_today": stats.community,
		},
		"pending": pending,
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
	data["doctor_name"] = user_name(frappe.db.get_value("Clinic Consultation", doc.consultation, "doctor"))
	data["diagnoses"] = frappe.get_all(
		"Clinic Consultation Diagnosis", filters={"parent": doc.consultation}, pluck="diagnosis"
	)
	data["weight_kg"] = frappe.db.get_value(
		"Clinic Triage", frappe.db.get_value("Clinic Visit", doc.visit, "triage"), "weight_kg"
	)
	return data


@frappe.whitelist()
def dispense(name, items, notes=None, submit=1):
	"""Record what was actually handed out and complete the visit."""
	require("pharmacy")
	quantities = {row["name"]: to_number(row.get("dispensed_qty")) or 0 for row in frappe.parse_json(items)}
	doc = frappe.get_doc("Clinic Dispensing", name)
	for row in doc.items:
		if row.name in quantities:
			row.dispensed_qty = quantities[row.name]
	doc.notes = clean(notes)
	doc.save()
	if int(submit):
		doc.submit()
	return {"name": doc.name, "docstatus": doc.docstatus, "visit_status": frappe.db.get_value("Clinic Visit", doc.visit, "status")}
