import frappe
from frappe import _


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, get_chart(data)


def get_columns():
	return [
		{"label": _("Department"), "fieldname": "department", "fieldtype": "Link", "options": "Department", "width": 220},
		{"label": _("Active Headcount"), "fieldname": "headcount", "fieldtype": "Int", "width": 120},
		{"label": _("Employees Seen"), "fieldname": "employees_seen", "fieldtype": "Int", "width": 120},
		{"label": _("Consultations"), "fieldname": "consultations", "fieldtype": "Int", "width": 110},
		{"label": _("Consultations per 100 Staff"), "fieldname": "rate", "fieldtype": "Float", "precision": 1, "width": 160},
		{"label": _("Sick Leave Days"), "fieldname": "sick_leave_days", "fieldtype": "Int", "width": 120},
		{"label": _("Light Duty Days"), "fieldname": "light_duty_days", "fieldtype": "Int", "width": 120},
		{"label": _("Work-related Cases"), "fieldname": "work_related", "fieldtype": "Int", "width": 130},
		{"label": _("Referred Out"), "fieldname": "referred_out", "fieldtype": "Int", "width": 100},
	]


def get_data(filters):
	conditions = ""
	if filters.get("department"):
		conditions += " AND v.department = %(department)s"

	rows = frappe.db.sql(
		f"""
		SELECT
			v.department,
			COUNT(DISTINCT v.patient) AS employees_seen,
			COUNT(DISTINCT c.name) AS consultations,
			IFNULL(SUM(c.sick_leave_days), 0) AS sick_leave_days,
			IFNULL(SUM(c.light_duty_days), 0) AS light_duty_days,
			IFNULL(SUM(c.work_related), 0) AS work_related,
			IFNULL(SUM(c.refer_out), 0) AS referred_out
		FROM `tabClinic Consultation` c
		JOIN `tabClinic Visit` v ON v.name = c.visit
		WHERE v.patient_type = 'Employee'
			AND DATE(c.consultation_date) BETWEEN %(from_date)s AND %(to_date)s
			{conditions}
		GROUP BY v.department
		ORDER BY consultations DESC
		""",
		filters,
		as_dict=True,
	)
	headcount = dict(
		frappe.db.sql(
			"SELECT department, COUNT(*) FROM `tabEmployee` WHERE status = 'Active' GROUP BY department"
		)
	)
	for row in rows:
		row.headcount = headcount.get(row.department, 0)
		row.rate = row.consultations * 100 / row.headcount if row.headcount else 0
	return rows


def get_chart(data):
	return {
		"data": {
			"labels": [row.department or _("Not set") for row in data],
			"datasets": [
				{"name": _("Consultations"), "values": [int(row.consultations or 0) for row in data]},
				{"name": _("Sick Leave Days"), "values": [int(row.sick_leave_days or 0) for row in data]},
			],
		},
		"type": "bar",
	}
