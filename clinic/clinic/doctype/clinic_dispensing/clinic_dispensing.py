import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

from clinic import billing
from clinic.clinic.doctype.clinic_visit.clinic_visit import set_visit_status


class ClinicDispensing(Document):
	def validate(self):
		for row in self.items:
			if (row.dispensed_qty or 0) < 0:
				frappe.throw(_("Row {0}: dispensed quantity cannot be negative").format(row.idx))
			if row.not_available:
				row.dispensed_qty = 0  # not in stock: nothing is handed out or charged

	def on_update(self):
		if self.docstatus == 0:
			billing.sync_drug_charges(self)

	def before_submit(self):
		if not any(row.dispensed_qty or row.not_available for row in self.items):
			frappe.throw(_("Nothing has been dispensed. Enter dispensed quantities before submitting."))
		self.dispensed_on = now_datetime()
		self.pharmacist = frappe.session.user

	def on_submit(self):
		set_visit_status(self.visit, "Completed")
