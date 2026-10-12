import frappe
from frappe import _

LABELS = {1: "Presumed TB", 2: "No Signs", 3: "On TB Treatment", 4: "Not Done"}


def execute(filters=None):
	filters = frappe._dict(filters or {})
	data = get_data(filters)
	return get_columns(), data, None, get_chart(data), get_summary(data)


def get_columns():
	return [
		{"label": _("Code"), "fieldname": "code", "fieldtype": "Int", "width": 60},
		{"label": _("TB Screening"), "fieldname": "label", "fieldtype": "Data", "width": 160},
		{"label": _("Employees"), "fieldname": "employees", "fieldtype": "Int", "width": 100},
		{"label": _("Community Members"), "fieldname": "community", "fieldtype": "Int", "width": 140},
		{"label": _("Total"), "fieldname": "total", "fieldtype": "Int", "width": 80},
		{"label": _("% of Screened"), "fieldname": "percent", "fieldtype": "Percent", "width": 110},
		{"label": _("Male"), "fieldname": "male", "fieldtype": "Int", "width": 70},
		{"label": _("Female"), "fieldname": "female", "fieldtype": "Int", "width": 70},
		{"label": _("Under 5"), "fieldname": "under_5", "fieldtype": "Int", "width": 80},
		{"label": _("5-17"), "fieldname": "age_5_17", "fieldtype": "Int", "width": 70},
		{"label": _("18-49"), "fieldname": "age_18_49", "fieldtype": "Int", "width": 70},
		{"label": _("50+"), "fieldname": "age_50_plus", "fieldtype": "Int", "width": 70},
	]


def get_data(filters):
	conditions = ""
	if filters.get("patient_type"):
		conditions += " AND s.patient_type = %(patient_type)s"
	if filters.get("source"):
		conditions += " AND s.source = %(source)s"
	rows = {
		r.code: r
		for r in frappe.db.sql(
			f"""
			SELECT s.code,
				SUM(s.patient_type = 'Employee') AS employees,
				SUM(s.patient_type = 'Community Member') AS community,
				COUNT(*) AS total,
				SUM(s.sex = 'Male') AS male, SUM(s.sex = 'Female') AS female,
				SUM(s.age_years < 5) AS under_5,
				SUM(s.age_years BETWEEN 5 AND 17) AS age_5_17,
				SUM(s.age_years BETWEEN 18 AND 49) AS age_18_49,
				SUM(s.age_years >= 50) AS age_50_plus
			FROM (
				SELECT c.tb_screening_code AS code, v.patient_type, v.sex, v.age_years,
					'Consultation' AS source, c.consultation_date AS happened
				FROM `tabClinic Consultation` c JOIN `tabClinic Visit` v ON v.name = c.visit
				WHERE c.tb_screening_code > 0
				UNION ALL
				SELECT a.tb_screening_code, v.patient_type, v.sex, v.age_years, a.clinic_unit, a.attendance_date
				FROM `tabClinic Attendance` a JOIN `tabClinic Visit` v ON v.name = a.visit
				WHERE a.tb_screening_code > 0
			) s
			WHERE DATE(s.happened) BETWEEN %(from_date)s AND %(to_date)s {conditions}
			GROUP BY s.code
			""",
			filters,
			as_dict=True,
		)
	}
	screened = sum(r.total for r in rows.values())
	data = []
	for code, label in LABELS.items():
		r = rows.get(code) or frappe._dict(employees=0, community=0, total=0, male=0, female=0, under_5=0, age_5_17=0, age_18_49=0, age_50_plus=0)
		data.append({**r, "code": code, "label": label, "percent": (r.total or 0) * 100 / screened if screened else 0})
	return data


def get_chart(data):
	return {
		"data": {
			"labels": [f"{r['code']} - {r['label']}" for r in data],
			"datasets": [
				{"name": _("Employees"), "values": [int(r["employees"] or 0) for r in data]},
				{"name": _("Community Members"), "values": [int(r["community"] or 0) for r in data]},
			],
		},
		"type": "bar",
		"barOptions": {"stacked": 1},
	}


def get_summary(data):
	total = sum(int(r["total"] or 0) for r in data)
	presumed = int(data[0]["total"] or 0)
	return [
		{"label": _("Screened"), "value": total - int(data[3]["total"] or 0), "indicator": "Blue", "datatype": "Int"},
		{"label": _("Presumed TB"), "value": presumed, "indicator": "Red", "datatype": "Int"},
		{"label": _("On TB Treatment"), "value": int(data[2]["total"] or 0), "indicator": "Orange", "datatype": "Int"},
		{"label": _("Not Done"), "value": int(data[3]["total"] or 0), "indicator": "Grey", "datatype": "Int"},
	]
