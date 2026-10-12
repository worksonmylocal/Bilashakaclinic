import frappe
from frappe import _

from clinic.utils import age_text


def execute(filters=None):
	filters = frappe._dict(filters or {})
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"label": _("Serial No."), "fieldname": "serial_no", "fieldtype": "Int", "width": 90},
		{"label": _("CWC No."), "fieldname": "cwc_no", "fieldtype": "Link", "options": "Clinic Child Record", "width": 140},
		{"label": _("Registered"), "fieldname": "registration_date", "fieldtype": "Date", "width": 110},
		{"label": _("Child"), "fieldname": "child_name", "fieldtype": "Data", "width": 190},
		{"label": _("Date of Birth"), "fieldname": "dob", "fieldtype": "Date", "width": 110},
		{"label": _("Age"), "fieldname": "age", "fieldtype": "Data", "width": 90},
		{"label": _("Sex"), "fieldname": "sex", "fieldtype": "Data", "width": 80},
		{"label": _("Parent / Guardian"), "fieldname": "caregiver_name", "fieldtype": "Data", "width": 170},
		{"label": _("Phone"), "fieldname": "caregiver_phone", "fieldtype": "Data", "width": 120},
		{"label": _("Residence"), "fieldname": "village", "fieldtype": "Data", "width": 150},
		{"label": _("Place of Delivery"), "fieldname": "delivery_place", "fieldtype": "Data", "width": 130},
		{"label": _("Birth Weight (kg)"), "fieldname": "birth_weight_kg", "fieldtype": "Float", "precision": 2, "width": 130},
		{"label": _("Doses Given"), "fieldname": "given", "fieldtype": "Int", "width": 100},
		{"label": _("Overdue"), "fieldname": "overdue_count", "fieldtype": "Int", "width": 90},
		{"label": _("Next Due"), "fieldname": "next_due_vaccine", "fieldtype": "Data", "width": 160},
		{"label": _("Next Due On"), "fieldname": "next_due_date", "fieldtype": "Date", "width": 110},
		{"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 110},
	]


def get_data(filters):
	conditions = ""
	if filters.get("status"):
		conditions += " AND c.status = %(status)s"
	if filters.get("defaulters_only"):
		conditions += " AND c.is_defaulter = 1"
	if filters.get("sex"):
		conditions += " AND c.sex = %(sex)s"
	if filters.get("village"):
		conditions += " AND c.village LIKE %(village_like)s"
		filters["village_like"] = f"%{filters.village}%"
	rows = frappe.db.sql(
		f"""
		SELECT c.name, c.serial_no, c.cwc_no, c.registration_date, c.child_name, c.dob, c.sex,
			c.caregiver_name, c.caregiver_phone, c.village, c.delivery_place, c.birth_weight_kg,
			c.overdue_count, c.next_due_vaccine, c.next_due_date, c.status,
			(SELECT COUNT(*) FROM `tabClinic Immunization Dose` d
				WHERE d.parent = c.name AND IFNULL(d.date_given, '') != '') AS given
		FROM `tabClinic Child Record` c
		WHERE c.registration_date BETWEEN %(from_date)s AND %(to_date)s {conditions}
		ORDER BY c.serial_no
		""",
		filters,
		as_dict=True,
	)
	for row in rows:
		row.age = age_text(row.dob)
	return rows
