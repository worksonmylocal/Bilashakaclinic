import frappe

from clinic import billing


def execute():
	"""Everyone is billed now (cash or employer invoice); refresh what older visits carry."""
	for visit in frappe.get_all("Clinic Visit", pluck="name"):
		t = billing.terms(visit)
		frappe.db.set_value(
			"Clinic Visit",
			visit,
			{
				"billable": 1,
				"billing_mode": t["billing_mode"],
				"employer": t["employer"],
				"sick_sheet_required": 1 if t["sick_sheet"] else 0,
			},
			update_modified=False,
		)
	for bill in frappe.get_all("Clinic Bill", pluck="name"):
		visit = frappe.db.get_value("Clinic Bill", bill, "visit")
		frappe.db.set_value(
			"Clinic Bill", bill, "billing_mode", frappe.db.get_value("Clinic Visit", visit, "billing_mode") or "Cash", update_modified=False
		)

	if not frappe.db.get_single_value("Clinic Settings", "invoice_terms"):
		frappe.db.set_single_value(
			"Clinic Settings", "invoice_terms", "Payable by the employer on presentation of this invoice."
		)
