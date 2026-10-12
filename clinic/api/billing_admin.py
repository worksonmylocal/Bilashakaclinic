"""Recording payments that farms make against invoices."""

import frappe

from clinic import billing
from clinic.api.common import require_any


@frappe.whitelist()
def record_farm_payment(bills, mode, reference=None):
	"""bills: the invoice numbers (Clinic Bill names) the farm has paid."""
	require_any("pharmacy")
	paid = billing.record_farm_payment(frappe.parse_json(bills), mode, reference)
	return {"paid": paid}
