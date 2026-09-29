import frappe
from frappe import _


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, get_chart(data)


def get_columns():
	return [
		{"label": _("Test"), "fieldname": "test_type", "fieldtype": "Link", "options": "Clinic Lab Test Type", "width": 230},
		{"label": _("Category"), "fieldname": "category", "fieldtype": "Data", "width": 110},
		{"label": _("Performed"), "fieldname": "performed_where", "fieldtype": "Data", "width": 90},
		{"label": _("Requested"), "fieldname": "requested", "fieldtype": "Int", "width": 90},
		{"label": _("Employees"), "fieldname": "employees", "fieldtype": "Int", "width": 90},
		{"label": _("Community Members"), "fieldname": "community", "fieldtype": "Int", "width": 130},
		{"label": _("Resulted"), "fieldname": "resulted", "fieldtype": "Int", "width": 80},
		{"label": _("Sent External"), "fieldname": "sent_external", "fieldtype": "Int", "width": 100},
		{"label": _("Pending"), "fieldname": "pending", "fieldtype": "Int", "width": 80},
		{"label": _("Positive"), "fieldname": "positive", "fieldtype": "Int", "width": 80},
		{"label": _("Employees Positive"), "fieldname": "employees_positive", "fieldtype": "Int", "width": 130},
		{"label": _("Community Positive"), "fieldname": "community_positive", "fieldtype": "Int", "width": 130},
		{"label": _("Abnormal"), "fieldname": "abnormal", "fieldtype": "Int", "width": 80},
		{"label": _("Positivity %"), "fieldname": "positivity_rate", "fieldtype": "Percent", "width": 100},
	]


def get_data(filters):
	conditions = ""
	for field in ("patient_type", "category", "performed_where", "test_type"):
		if filters.get(field):
			conditions += f" AND t.{field} = %({field})s"

	rows = frappe.db.sql(
		f"""
		SELECT
			t.test_type,
			t.category,
			t.performed_where,
			COUNT(*) AS requested,
			SUM(t.patient_type = 'Employee') AS employees,
			SUM(t.patient_type = 'Community Member') AS community,
			SUM(t.status = 'Resulted') AS resulted,
			SUM(t.status = 'Sent to External') AS sent_external,
			SUM(t.status IN ('Requested', 'Sample Collected')) AS pending,
			SUM(t.interpretation = 'Positive') AS positive,
			SUM(t.interpretation = 'Positive' AND t.patient_type = 'Employee') AS employees_positive,
			SUM(t.interpretation = 'Positive' AND t.patient_type = 'Community Member') AS community_positive,
			SUM(t.interpretation = 'Abnormal') AS abnormal
		FROM `tabClinic Lab Test` t
		WHERE t.status != 'Cancelled'
			AND DATE(t.requested_on) BETWEEN %(from_date)s AND %(to_date)s
			{conditions}
		GROUP BY t.test_type, t.category, t.performed_where
		ORDER BY requested DESC
		""",
		filters,
		as_dict=True,
	)
	for row in rows:
		row.positivity_rate = (row.positive or 0) * 100 / row.resulted if row.resulted else 0
	return rows


def get_chart(data):
	top = data[:10]
	return {
		"data": {
			"labels": [row.test_type for row in top],
			"datasets": [
				{"name": _("Employees"), "values": [int(row.employees or 0) for row in top]},
				{"name": _("Community Members"), "values": [int(row.community or 0) for row in top]},
			],
		},
		"type": "bar",
		"barOptions": {"stacked": 1},
	}
