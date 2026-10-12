import frappe


def execute():
	"""Re-date every immunization card from the child's current date of birth (old cards kept stale due dates)."""
	for name in frappe.get_all("Clinic Child Record", pluck="name"):
		frappe.get_doc("Clinic Child Record", name).save(ignore_permissions=True)
