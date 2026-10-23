import frappe
from frappe import _
from frappe.model.document import Document


class ClinicStaffProfile(Document):
	def validate(self):
		pin = self.get("lock_pin")
		# a stored PIN comes back masked; only a newly typed one needs checking
		if pin and set(pin) != {"*"} and not (len(pin) == 4 and pin.isdigit()):
			frappe.throw(_("The screen lock PIN must be exactly 4 digits"))
