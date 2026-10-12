import frappe
from frappe import _
from frappe.utils import date_diff, nowdate


def execute(filters=None):
	filters = frappe._dict(filters or {})
	columns = [
		{"label": _("Invoice"), "fieldname": "bill", "fieldtype": "Link", "options": "Clinic Bill", "width": 130},
		{"label": _("Invoice No."), "fieldname": "invoice_no", "fieldtype": "Data", "width": 130},
		{"label": _("Date"), "fieldname": "invoiced_on", "fieldtype": "Date", "width": 100},
		{"label": _("Employer"), "fieldname": "employer", "fieldtype": "Link", "options": "Clinic Employer", "width": 170},
		{"label": _("Staff No."), "fieldname": "staff_no", "fieldtype": "Data", "width": 90},
		{"label": _("Employee"), "fieldname": "patient_name", "fieldtype": "Data", "width": 170},
		{"label": _("Visit"), "fieldname": "visit", "fieldtype": "Link", "options": "Clinic Visit", "width": 130},
		{"label": _("Amount"), "fieldname": "total", "fieldtype": "Currency", "width": 110},
		{"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 100},
		{"label": _("Days Outstanding"), "fieldname": "days", "fieldtype": "Int", "width": 120},
		{"label": _("Receipt No."), "fieldname": "receipt_no", "fieldtype": "Data", "width": 130},
	]
	conditions = ""
	if filters.get("employer"):
		conditions += " AND b.employer = %(employer)s"
	status = filters.get("status") or "Outstanding"
	if status == "Outstanding":
		conditions += " AND b.status = 'Invoiced'"
	elif status == "Paid":
		conditions += " AND b.status = 'Paid'"
	data = frappe.db.sql(
		f"""
		SELECT b.name AS bill, b.invoice_no, DATE(b.invoiced_on) AS invoiced_on, b.employer,
			IFNULL(NULLIF(p.staff_no, ''), p.employee) AS staff_no, b.patient_name, b.visit, b.total, b.status, b.receipt_no
		FROM `tabClinic Bill` b LEFT JOIN `tabClinic Patient` p ON p.name = b.patient
		WHERE b.invoice_no IS NOT NULL AND b.invoice_no != ''
			AND DATE(b.invoiced_on) BETWEEN %(from_date)s AND %(to_date)s {conditions}
		ORDER BY b.employer, b.invoiced_on
		""",
		filters,
		as_dict=True,
	)
	for row in data:
		row.days = date_diff(nowdate(), row.invoiced_on) if row.status == "Invoiced" else None
	by_employer = {}
	for row in data:
		if row.status == "Invoiced":
			by_employer[row.employer] = by_employer.get(row.employer, 0) + float(row.total or 0)
	chart = {
		"data": {"labels": list(by_employer), "datasets": [{"name": _("Outstanding"), "values": list(by_employer.values())}]},
		"type": "bar",
	} if by_employer else None
	outstanding = sum(by_employer.values())
	summary = [
		{"label": _("Outstanding"), "value": outstanding, "datatype": "Currency", "indicator": "Red" if outstanding else "Green"},
		{"label": _("Invoices Listed"), "value": len(data), "datatype": "Int", "indicator": "Blue"},
	]
	return columns, data, None, chart, summary
