import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from clinic.utils import age_text


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, None, get_summary(data)


def get_columns():
	return [
		{"label": _("CWC No."), "fieldname": "cwc_no", "fieldtype": "Link", "options": "Clinic Child Record", "width": 140},
		{"label": _("Serial"), "fieldname": "serial_no", "fieldtype": "Int", "width": 80},
		{"label": _("Child"), "fieldname": "child_name", "fieldtype": "Data", "width": 180},
		{"label": _("Age"), "fieldname": "age", "fieldtype": "Data", "width": 90},
		{"label": _("Sex"), "fieldname": "sex", "fieldtype": "Data", "width": 70},
		{"label": _("Missed Doses"), "fieldname": "overdue", "fieldtype": "Int", "width": 110},
		{"label": _("Vaccines Missed"), "fieldname": "vaccines", "fieldtype": "Data", "width": 300},
		{"label": _("Oldest Due"), "fieldname": "oldest_due", "fieldtype": "Date", "width": 110},
		{"label": _("Days Late"), "fieldname": "days_late", "fieldtype": "Int", "width": 100},
		{"label": _("Parent / Guardian"), "fieldname": "caregiver_name", "fieldtype": "Data", "width": 170},
		{"label": _("Phone"), "fieldname": "caregiver_phone", "fieldtype": "Data", "width": 120},
		{"label": _("Residence"), "fieldname": "village", "fieldtype": "Data", "width": 150},
	]


def get_data(filters):
	conditions = ""
	if filters.get("min_days_late"):
		conditions += " HAVING days_late >= %(min_days_late)s"
	rows = frappe.db.sql(
		f"""
		SELECT c.name, c.cwc_no, c.serial_no, c.child_name, c.dob, c.sex, c.caregiver_name,
			c.caregiver_phone, c.village,
			COUNT(*) AS overdue, MIN(d.due_date) AS oldest_due,
			DATEDIFF(CURDATE(), MIN(d.due_date)) AS days_late,
			GROUP_CONCAT(d.vaccine ORDER BY d.due_date SEPARATOR ', ') AS vaccines
		FROM `tabClinic Child Record` c
		JOIN `tabClinic Immunization Dose` d ON d.parent = c.name AND d.parenttype = 'Clinic Child Record'
		WHERE c.status = 'Active' AND IFNULL(d.date_given, '') = '' AND d.status != 'Not Applicable'
			AND IFNULL(d.optional, 0) = 0
			AND DATE_ADD(d.due_date, INTERVAL IFNULL(d.grace_days, 0) DAY) < CURDATE()
		GROUP BY c.name {conditions}
		ORDER BY days_late DESC
		""",
		filters,
		as_dict=True,
	)
	for row in rows:
		row.age = age_text(row.dob)
	return rows


def get_summary(data):
	doses = sum(int(r.overdue or 0) for r in data)
	long_overdue = sum(1 for r in data if (r.days_late or 0) >= 90)
	return [
		{"label": _("Children to Follow Up"), "value": len(data), "datatype": "Int", "indicator": "Red" if data else "Green"},
		{"label": _("Doses Missed"), "value": doses, "datatype": "Int", "indicator": "Orange"},
		{"label": _("Over 3 Months Late"), "value": long_overdue, "datatype": "Int", "indicator": "Red" if long_overdue else "Green"},
	]
