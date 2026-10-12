import frappe
from frappe import _


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, get_chart(data)


def get_columns():
	return [
		{"label": _("Milestone"), "fieldname": "milestone", "fieldtype": "Data", "width": 120},
		{"label": _("Vaccine"), "fieldname": "vaccine", "fieldtype": "Data", "width": 220},
		{"label": _("Doses Given"), "fieldname": "given", "fieldtype": "Int", "width": 120},
		{"label": _("Male"), "fieldname": "male", "fieldtype": "Int", "width": 90},
		{"label": _("Female"), "fieldname": "female", "fieldtype": "Int", "width": 90},
		{"label": _("Still Due"), "fieldname": "still_due", "fieldtype": "Int", "width": 110},
		{"label": _("Overdue"), "fieldname": "overdue", "fieldtype": "Int", "width": 100},
		{"label": _("Coverage %"), "fieldname": "coverage", "fieldtype": "Percent", "width": 120},
	]


def get_data(filters):
	given = frappe.db.sql(
		"""
		SELECT d.milestone, d.vaccine, COUNT(*) AS given,
			SUM(c.sex = 'Male') AS male, SUM(c.sex = 'Female') AS female
		FROM `tabClinic Immunization Dose` d
		JOIN `tabClinic Child Record` c ON c.name = d.parent
		WHERE d.date_given BETWEEN %(from_date)s AND %(to_date)s
			AND d.date_given >= c.registration_date
		GROUP BY d.milestone, d.vaccine
		""",
		filters,
		as_dict=True,
	)
	# Children whose dose has fallen due by the end of the period, whether or not it was given
	eligible = frappe.db.sql(
		"""
		SELECT d.milestone, d.vaccine,
			COUNT(*) AS eligible,
			SUM(IFNULL(d.date_given, '') != '') AS done,
			SUM(IFNULL(d.date_given, '') = '' AND DATE_ADD(d.due_date, INTERVAL IFNULL(d.grace_days, 0) DAY) < CURDATE()) AS overdue,
			SUM(IFNULL(d.date_given, '') = '' AND DATE_ADD(d.due_date, INTERVAL IFNULL(d.grace_days, 0) DAY) >= CURDATE()) AS still_due
		FROM `tabClinic Immunization Dose` d
		JOIN `tabClinic Child Record` c ON c.name = d.parent
		WHERE c.status = 'Active' AND d.status != 'Not Applicable' AND d.due_date <= %(to_date)s
			AND (IFNULL(d.optional, 0) = 0 OR IFNULL(d.date_given, '') != '')
		GROUP BY d.milestone, d.vaccine
		""",
		filters,
		as_dict=True,
	)
	by_key = {(r.milestone, r.vaccine): r for r in eligible}
	rows = []
	for r in given:
		e = by_key.pop((r.milestone, r.vaccine), None)
		rows.append({
			**r,
			"still_due": e.still_due if e else 0,
			"overdue": e.overdue if e else 0,
			"coverage": (e.done or 0) * 100 / e.eligible if e and e.eligible else 0,
		})
	for key, e in by_key.items():  # due, but nothing given in this period
		rows.append({
			"milestone": key[0], "vaccine": key[1], "given": 0, "male": 0, "female": 0,
			"still_due": e.still_due, "overdue": e.overdue,
			"coverage": (e.done or 0) * 100 / e.eligible if e.eligible else 0,
		})
	order = ["At Birth", "6 Weeks", "10 Weeks", "14 Weeks", "6 Months", "9 Months", "12 Months", "18 Months"]
	rows.sort(key=lambda r: (order.index(r["milestone"]) if r["milestone"] in order else 99, r["vaccine"]))
	return rows


def get_chart(data):
	return {
		"data": {
			"labels": [r["vaccine"] for r in data],
			"datasets": [{"name": _("Doses Given"), "values": [int(r["given"] or 0) for r in data]}],
		},
		"type": "bar",
	}
