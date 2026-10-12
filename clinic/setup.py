import frappe

from clinic.seed_data import DIAGNOSES, LAB_TEST_TYPES, VACCINE_SCHEDULE

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


EMPLOYERS = [
	("Bilashaka Flower Farm", 1),
	("Groove Limited", 0),
	("Vitaplant Farm", 0),
	("Loldia Ndulele Farm", 0),
	("Loldia Leshau Farm", 0),
	("Color Crops Farm", 0),
]


def seed_employers():
	"""The farms whose staff get sick sheets and are billed at the clinic."""
	for name, own in EMPLOYERS:
		if not frappe.db.exists("Clinic Employer", name):
			frappe.get_doc(
				{
					"doctype": "Clinic Employer",
					"employer_name": name,
					"uses_employee_records": own,
					"requires_sick_sheet": 1,
					"billed_at_clinic": 1,
				}
			).insert(ignore_permissions=True)


def seed_vaccine_schedule():
	"""The childhood immunization schedule every CWC card is built from."""
	schedule = frappe.get_single("Clinic Vaccine Schedule")
	if schedule.items:
		return
	for milestone, vaccine, age_days, optional in VACCINE_SCHEDULE:
		schedule.append(
			"items",
			{"milestone": milestone, "vaccine": vaccine, "age_days": age_days,
			 "grace_days": 14, "optional": optional, "enabled": 1},
		)
	schedule.save(ignore_permissions=True)


def before_install():
	ensure_roles()


def after_install():
	ensure_roles()
	seed_lab_test_types()
	seed_diagnoses()
	seed_employers()
	seed_vaccine_schedule()
