import frappe
from frappe import _


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, get_chart(data)


def get_columns():
	return [
		{"label": _("Clinic"), "fieldname": "clinic_unit", "fieldtype": "Data", "width": 180},
		{"label": _("Service"), "fieldname": "service_type", "fieldtype": "Data", "width": 170},
		{"label": _("Attendances"), "fieldname": "total", "fieldtype": "Int", "width": 110},
		{"label": _("Employees"), "fieldname": "employees", "fieldtype": "Int", "width": 100},
		{"label": _("Community Members"), "fieldname": "community", "fieldtype": "Int", "width": 140},
		{"label": _("Male"), "fieldname": "male", "fieldtype": "Int", "width": 70},
		{"label": _("Female"), "fieldname": "female", "fieldtype": "Int", "width": 70},
		{"label": _("Under 5"), "fieldname": "under_5", "fieldtype": "Int", "width": 80},
		{"label": _("5-17"), "fieldname": "age_5_17", "fieldtype": "Int", "width": 70},
		{"label": _("18-49"), "fieldname": "age_18_49", "fieldtype": "Int", "width": 70},
		{"label": _("50+"), "fieldname": "age_50_plus", "fieldtype": "Int", "width": 70},
		{"label": _("Presumed TB"), "fieldname": "presumed_tb", "fieldtype": "Int", "width": 110},
		{"label": _("Sent to Doctor"), "fieldname": "to_doctor", "fieldtype": "Int", "width": 110},
	]


def get_data(filters):
	conditions = ""
	if filters.get("patient_type"):
		conditions += " AND v.patient_type = %(patient_type)s"
	if filters.get("clinic_unit"):
		conditions += " AND a.clinic_unit = %(clinic_unit)s"
	return frappe.db.sql(
		f"""
		SELECT a.clinic_unit, a.service_type, COUNT(*) AS total,
			SUM(v.patient_type = 'Employee') AS employees,
			SUM(v.patient_type = 'Community Member') AS community,
			SUM(v.sex = 'Male') AS male, SUM(v.sex = 'Female') AS female,
			SUM(v.age_years < 5) AS under_5,
			SUM(v.age_years BETWEEN 5 AND 17) AS age_5_17,
			SUM(v.age_years BETWEEN 18 AND 49) AS age_18_49,
			SUM(v.age_years >= 50) AS age_50_plus,
			SUM(a.tb_screening_code = 1) AS presumed_tb,
			SUM(a.referred_to_doctor) AS to_doctor
		FROM `tabClinic Attendance` a JOIN `tabClinic Visit` v ON v.name = a.visit
		WHERE a.status = 'Completed' AND DATE(a.attendance_date) BETWEEN %(from_date)s AND %(to_date)s {conditions}
		GROUP BY a.clinic_unit, a.service_type
		ORDER BY a.clinic_unit, a.service_type
		""",
		filters,
		as_dict=True,
	)


def get_chart(data):
	return {
		"data": {
			"labels": [r.service_type for r in data],
			"datasets": [
				{"name": _("Employees"), "values": [int(r.employees or 0) for r in data]},
				{"name": _("Community Members"), "values": [int(r.community or 0) for r in data]},
			],
		},
		"type": "bar",
		"barOptions": {"stacked": 1},
	}
