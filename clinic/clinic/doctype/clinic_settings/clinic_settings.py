import frappe
from frappe import _
from frappe.model.document import Document


class ClinicSettings(Document):
	def validate(self):
		if self.idle_lock_minutes and not 1 <= self.idle_lock_minutes <= 240:
			frappe.throw(_("The screen lock time must be between 1 and 240 minutes"))
