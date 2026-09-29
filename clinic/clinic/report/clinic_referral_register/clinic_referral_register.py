import frappe
from frappe import _


def execute(filters=None):
	filters = frappe._dict(filters or {})
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"label": _("Direction"), "fieldname": "direction", "fieldtype": "Data", "width": 90},
		{"label": _("Date"), "fieldname": "date", "fieldtype": "Date", "width": 100},
		{"label": _("Patient"), "fieldname": "patient", "fieldtype": "Link", "options": "Clinic Patient", "width": 110},
		{"label": _("Patient Name"), "fieldname": "patient_name", "fieldtype": "Data", "width": 170},
		{"label": _("Patient Type"), "fieldname": "patient_type", "fieldtype": "Data", "width": 130},
		{"label": _("Facility"), "fieldname": "facility", "fieldtype": "Link", "options": "Clinic Facility", "width": 190},
		{"label": _("Urgency"), "fieldname": "urgency", "fieldtype": "Data", "width": 90},
		{"label": _("Reason"), "fieldname": "reason", "fieldtype": "Data", "width": 260},
		{"label": _("Reference"), "fieldname": "reference", "fieldtype": "Dynamic Link", "options": "ref_doctype", "width": 150},
		{"label": _("Ref DocType"), "fieldname": "ref_doctype", "fieldtype": "Data", "hidden": 1},
	]


def get_data(filters):
	inbound = """
		SELECT 'In' AS direction, DATE(v.visit_date) AS date, v.patient, v.patient_name, v.patient_type,
			v.referring_facility AS facility, '' AS urgency, v.referral_reason AS reason,
			v.name AS reference, 'Clinic Visit' AS ref_doctype
		FROM `tabClinic Visit` v
		WHERE v.visit_source = 'Referral In' AND v.status != 'Cancelled'
			AND DATE(v.visit_date) BETWEEN %(from_date)s AND %(to_date)s
			{type_condition}
	"""
	outbound = """
		SELECT 'Out' AS direction, DATE(c.consultation_date) AS date, c.patient, c.patient_name, c.patient_type,
			c.referral_facility AS facility, c.referral_urgency AS urgency, c.referral_reason AS reason,
			c.name AS reference, 'Clinic Consultation' AS ref_doctype
		FROM `tabClinic Consultation` c
		WHERE c.refer_out = 1
			AND DATE(c.consultation_date) BETWEEN %(from_date)s AND %(to_date)s
			{type_condition}
	"""
	type_condition = " AND {alias}.patient_type = %(patient_type)s" if filters.get("patient_type") else ""
	parts = []
	if filters.get("direction") in (None, "", "In"):
		parts.append(inbound.format(type_condition=type_condition.format(alias="v")))
	if filters.get("direction") in (None, "", "Out"):
		parts.append(outbound.format(type_condition=type_condition.format(alias="c")))
	return frappe.db.sql(" UNION ALL ".join(parts) + " ORDER BY date DESC", filters, as_dict=True)
