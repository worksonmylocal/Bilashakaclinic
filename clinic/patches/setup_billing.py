import frappe

from clinic.setup import seed_employers


def execute():
	seed_employers()

	# Existing employee patients belong to the farm that owns the system
	for patient in frappe.get_all("Clinic Patient", {"patient_type": "Employee", "employer": ["is", "not set"]}, pluck="name"):
		frappe.get_doc("Clinic Patient", patient).save(ignore_permissions=True)

	if not frappe.db.get_single_value("Clinic Pricing", "consultation_price"):
		frappe.db.set_single_value("Clinic Pricing", "consultation_price", 350)
