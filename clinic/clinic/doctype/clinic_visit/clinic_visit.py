import frappe
from frappe import _
from frappe.model.document import Document

from clinic.utils import age_in_years

CLOSED_STATUSES = ("Completed", "Cancelled")


class ClinicVisit(Document):
	def validate(self):
		if self.is_new():
			self.status = "Waiting Lab" if self.visit_purpose == "Lab Only" else "Waiting Triage"
			self.validate_no_open_visit()
		self.age_years = age_in_years(
			frappe.db.get_value("Clinic Patient", self.patient, "date_of_birth"), self.visit_date
		)

	def validate_no_open_visit(self):
		open_visit = frappe.db.exists(
			"Clinic Visit", {"patient": self.patient, "status": ["not in", CLOSED_STATUSES]}
		)
		if open_visit:
			frappe.throw(
				_("{0} already has an open visit ({1}). Complete or cancel it first.").format(
					self.patient_name or self.patient, open_visit
				)
			)

	@frappe.whitelist()
	def cancel_visit(self):
		self.check_permission("write")
		if self.status == "Completed":
			frappe.throw(_("A completed visit cannot be cancelled"))
		set_visit_status(self.name, "Cancelled")


def set_visit_status(visit, status):
	"""Move a visit along the patient journey. Closed visits are never reopened here."""
	current = frappe.db.get_value("Clinic Visit", visit, "status")
	if not current or (current in CLOSED_STATUSES and status not in CLOSED_STATUSES):
		return
	frappe.db.set_value("Clinic Visit", visit, "status", status)
	if status == "Completed":
		appointment = frappe.db.get_value("Clinic Visit", visit, "appointment")
		if appointment:
			frappe.db.set_value("Clinic Appointment", appointment, "status", "Completed")
