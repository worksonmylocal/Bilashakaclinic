import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

from clinic.clinic.doctype.clinic_visit.clinic_visit import set_visit_status


class ClinicDispensing(Document):
	def validate(self):
		for row in self.items:
			if (row.dispensed_qty or 0) < 0:
				frappe.throw(_("Row {0}: dispensed quantity cannot be negative").format(row.idx))

	def before_submit(self):
		if not any(row.dispensed_qty for row in self.items):
			frappe.throw(_("Nothing has been dispensed. Enter dispensed quantities before submitting."))
		self.dispensed_on = now_datetime()
		self.pharmacist = frappe.session.user

	def on_submit(self):
		set_visit_status(self.visit, "Completed")
