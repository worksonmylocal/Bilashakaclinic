import frappe

# from the clinic's printed price lists; anything already filled in is left alone
DEFAULTS = {
	"clinic_name": "Northlake Medical Centre",
	"branch": "ROCCO",
	"po_box": "P.O. Box 2040 - 20117",
	"address": "Naivasha",
	"payment_details": "Lipa na M-PESA: Paybill 522522, Account No. 1104483416",
	"report_footer_note": "Results relate only to the sample received. Please interpret them together with the clinical findings.",
	"invoice_terms": "Payable by the employer on presentation of this invoice.",
}


def execute():
	"""Clinic Settings was never saved on some sites, so receipts and reports printed with an empty letterhead."""
	for field, value in DEFAULTS.items():
		if not frappe.db.get_single_value("Clinic Settings", field):
			frappe.db.set_single_value("Clinic Settings", field, value)
	if not frappe.db.get_single_value("Clinic Settings", "idle_lock_minutes"):
		frappe.db.set_single_value("Clinic Settings", "idle_lock_minutes", 15)
	frappe.clear_cache(doctype="Clinic Settings")
