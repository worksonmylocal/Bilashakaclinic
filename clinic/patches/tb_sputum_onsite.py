import frappe

TEST = "Sputum for AAFB (TB)"
OPTIONS = "Negative\nPositive (Scanty)\nPositive (1+)\nPositive (2+)\nPositive (3+)"


def execute():
	"""The sputum smear is done in the clinic's own lab, not sent out."""
	if not frappe.db.exists("Clinic Lab Test Type", TEST):
		return
	test_type = frappe.get_doc("Clinic Lab Test Type", TEST)
	test_type.performed_where = "Onsite"
	test_type.default_external_facility = None
	test_type.set("parameters", [])
	test_type.append("parameters", {"parameter": "AAFB Smear", "result_type": "Qualitative", "options": OPTIONS})
	test_type.save(ignore_permissions=True)

	# Requests that are still waiting for a result follow the new setup; finished ones stay as they were
	for name in frappe.get_all("Clinic Lab Test", {"test_type": TEST, "status": ["in", ["Requested", "Sample Collected"]]}, pluck="name"):
		test = frappe.get_doc("Clinic Lab Test", name)
		test.performed_where = "Onsite"
		test.external_facility = None
		test.set("results", [])
		test.append("results", {"parameter": "AAFB Smear", "result_type": "Qualitative", "options": OPTIONS})
		test.save(ignore_permissions=True)
