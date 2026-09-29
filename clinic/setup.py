import frappe

from clinic.seed_data import DIAGNOSES, LAB_TEST_TYPES

ROLES = [
	"Clinic Receptionist",
	"Clinic Nurse",
	"Clinic Doctor",
	"Clinic Lab Technician",
	"Clinic Pharmacist",
	"Clinic Manager",
]


def ensure_roles():
	for role in ROLES:
		if not frappe.db.exists("Role", role):
			frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1}).insert(
				ignore_permissions=True
			)


def seed_lab_test_types():
	for test in LAB_TEST_TYPES:
		if frappe.db.exists("Clinic Lab Test Type", test["test_name"]):
			continue
		doc = frappe.get_doc({"doctype": "Clinic Lab Test Type", **test})
		doc.insert(ignore_permissions=True)


def seed_diagnoses():
	for name, icd_code, category, occupational in DIAGNOSES:
		if frappe.db.exists("Clinic Diagnosis", name):
			continue
		frappe.get_doc(
			{
				"doctype": "Clinic Diagnosis",
				"diagnosis": name,
				"icd_code": icd_code,
				"category": category,
				"is_occupational": occupational,
			}
		).insert(ignore_permissions=True)


def before_install():
	ensure_roles()


def after_install():
	ensure_roles()
	seed_lab_test_types()
	seed_diagnoses()
