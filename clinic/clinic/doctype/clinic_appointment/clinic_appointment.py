import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate


class ClinicAppointment(Document):
	def validate(self):
		if self.is_new() and getdate(self.appointment_date) < getdate(nowdate()):
			frappe.throw(_("Appointment date cannot be in the past"))

	@frappe.whitelist()
	def check_in(self):
		"""Patient has arrived: open a visit linked to this appointment."""
		self.check_permission("write")
		if self.status != "Scheduled":
			frappe.throw(_("Only scheduled appointments can be checked in"))
		visit = frappe.get_doc(
			{
				"doctype": "Clinic Visit",
				"patient": self.patient,
				"visit_source": "Follow-up"
				if self.appointment_type in ("Follow-up", "Review Results")
				else "Appointment",
				"appointment": self.name,
				"reception_notes": self.reason,
			}
		).insert()
		self.visit = visit.name
		self.status = "Checked In"
		self.save()
		return visit.name


def mark_missed_appointments():
	"""Daily job: scheduled appointments whose date has passed are Missed."""
	frappe.db.set_value(
		"Clinic Appointment",
		{"status": "Scheduled", "appointment_date": ["<", nowdate()]},
		"status",
		"Missed",
	)
