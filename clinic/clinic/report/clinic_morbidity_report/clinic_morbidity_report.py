import frappe
from frappe import _


def execute(filters=None):
	filters = frappe._dict(filters or {})
	return get_columns(), get_data(filters), None, get_chart(filters)


def get_columns():
	return [
		{"label": _("Diagnosis"), "fieldname": "diagnosis", "fieldtype": "Link", "options": "Clinic Diagnosis", "width": 260},
		{"label": _("ICD-10"), "fieldname": "icd_code", "fieldtype": "Data", "width": 80},
		{"label": _("Category"), "fieldname": "category", "fieldtype": "Data", "width": 150},
		{"label": _("Employees"), "fieldname": "employees", "fieldtype": "Int", "width": 90},
		{"label": _("Community Members"), "fieldname": "community", "fieldtype": "Int", "width": 130},
		{"label": _("Total Cases"), "fieldname": "total", "fieldtype": "Int", "width": 100},
		{"label": _("Male"), "fieldname": "male", "fieldtype": "Int", "width": 70},
		{"label": _("Female"), "fieldname": "female", "fieldtype": "Int", "width": 70},
		{"label": _("Under 5"), "fieldname": "under_5", "fieldtype": "Int", "width": 80},
		{"label": _("5-17"), "fieldname": "age_5_17", "fieldtype": "Int", "width": 70},
		{"label": _("18-49"), "fieldname": "age_18_49", "fieldtype": "Int", "width": 70},
		{"label": _("50+"), "fieldname": "age_50_plus", "fieldtype": "Int", "width": 70},
		{"label": _("Occupational"), "fieldname": "is_occupational", "fieldtype": "Check", "width": 100},
	]


def get_data(filters):
	conditions = ""
	for field, column in (
		("patient_type", "v.patient_type"),
		("department", "v.department"),
		("category", "dg.category"),
		("diagnosis_type", "d.diagnosis_type"),
	):
		if filters.get(field):
			conditions += f" AND {column} = %({field})s"
	if filters.get("occupational_only"):
		conditions += " AND dg.is_occupational = 1"

	def count(condition=None):
		# Count each consultation once per diagnosis
		return f"COUNT(DISTINCT IF({condition}, c.name, NULL))" if condition else "COUNT(DISTINCT c.name)"

	return frappe.db.sql(
		f"""
		SELECT
			d.diagnosis,
			dg.icd_code,
			dg.category,
			dg.is_occupational,
			{count("v.patient_type = 'Employee'")} AS employees,
			{count("v.patient_type = 'Community Member'")} AS community,
			{count()} AS total,
			{count("v.sex = 'Male'")} AS male,
			{count("v.sex = 'Female'")} AS female,
			{count("v.age_years < 5")} AS under_5,
			{count("v.age_years BETWEEN 5 AND 17")} AS age_5_17,
			{count("v.age_years BETWEEN 18 AND 49")} AS age_18_49,
			{count("v.age_years >= 50")} AS age_50_plus
		FROM `tabClinic Consultation Diagnosis` d
		JOIN `tabClinic Consultation` c ON c.name = d.parent AND d.parenttype = 'Clinic Consultation'
		JOIN `tabClinic Visit` v ON v.name = c.visit
		LEFT JOIN `tabClinic Diagnosis` dg ON dg.name = d.diagnosis
		WHERE DATE(c.consultation_date) BETWEEN %(from_date)s AND %(to_date)s
			{conditions}
		GROUP BY d.diagnosis, dg.icd_code, dg.category, dg.is_occupational
		ORDER BY total DESC, d.diagnosis
		""",
		filters,
		as_dict=True,
	)


def get_chart(filters):
	return None
