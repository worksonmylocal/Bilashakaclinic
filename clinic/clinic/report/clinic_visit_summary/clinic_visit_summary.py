import frappe
from frappe import _

PERIODS = {
	"Daily": "DATE(v.visit_date)",
	"Weekly": "DATE_FORMAT(v.visit_date, '%%x-W%%v')",
	"Monthly": "DATE_FORMAT(v.visit_date, '%%Y-%%m')",
}


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, get_chart(data), get_summary(data)


def get_columns():
	return [
		{"label": _("Period"), "fieldname": "period", "fieldtype": "Data", "width": 110},
		{"label": _("Employees"), "fieldname": "employees", "fieldtype": "Int", "width": 100},
		{"label": _("Community Members"), "fieldname": "community", "fieldtype": "Int", "width": 140},
		{"label": _("Total Visits"), "fieldname": "total", "fieldtype": "Int", "width": 100},
		{"label": _("Male"), "fieldname": "male", "fieldtype": "Int", "width": 80},
		{"label": _("Female"), "fieldname": "female", "fieldtype": "Int", "width": 80},
		{"label": _("Under 5"), "fieldname": "under_5", "fieldtype": "Int", "width": 80},
		{"label": _("Referred In"), "fieldname": "referred_in", "fieldtype": "Int", "width": 100},
		{"label": _("Follow-ups"), "fieldname": "follow_ups", "fieldtype": "Int", "width": 100},
		{"label": _("Lab Only"), "fieldname": "lab_only", "fieldtype": "Int", "width": 90},
	]


def get_data(filters):
	period = PERIODS.get(filters.get("group_by") or "Daily", PERIODS["Daily"])
	conditions = ""
	if filters.get("patient_type"):
		conditions += " AND v.patient_type = %(patient_type)s"
	return frappe.db.sql(
		f"""
		SELECT
			{period} AS period,
			SUM(v.patient_type = 'Employee') AS employees,
			SUM(v.patient_type = 'Community Member') AS community,
			COUNT(*) AS total,
			SUM(v.sex = 'Male') AS male,
			SUM(v.sex = 'Female') AS female,
			SUM(v.age_years < 5) AS under_5,
			SUM(v.visit_source = 'Referral In') AS referred_in,
			SUM(v.visit_source = 'Follow-up') AS follow_ups,
			SUM(v.visit_purpose = 'Lab Only') AS lab_only
		FROM `tabClinic Visit` v
		WHERE v.status != 'Cancelled'
			AND DATE(v.visit_date) BETWEEN %(from_date)s AND %(to_date)s
			{conditions}
		GROUP BY period
		ORDER BY period
		""",
		filters,
		as_dict=True,
	)


def get_chart(data):
	return {
		"data": {
			"labels": [str(row.period) for row in data],
			"datasets": [
				{"name": _("Employees"), "values": [int(row.employees or 0) for row in data]},
				{"name": _("Community Members"), "values": [int(row.community or 0) for row in data]},
			],
		},
		"type": "bar",
		"barOptions": {"stacked": 1},
	}


def get_summary(data):
	employees = sum(int(row.employees or 0) for row in data)
	community = sum(int(row.community or 0) for row in data)
	return [
		{"label": _("Employee Visits"), "value": employees, "indicator": "Blue", "datatype": "Int"},
		{"label": _("Community Visits"), "value": community, "indicator": "Green", "datatype": "Int"},
		{"label": _("Total Visits"), "value": employees + community, "indicator": "Grey", "datatype": "Int"},
	]
