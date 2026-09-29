import frappe
from frappe import _
from frappe.model.document import Document

from clinic.utils import age_text


class ClinicPatient(Document):
	def onload(self):
		self.age = age_text(self.date_of_birth)

	def validate(self):
		self.validate_type_fields()
		self.age = age_text(self.date_of_birth)

	def validate_type_fields(self):
		if self.patient_type == "Employee":
			duplicate = frappe.db.exists(
				"Clinic Patient", {"employee": self.employee, "name": ["!=", self.name]}
			)
			if duplicate:
				frappe.throw(
					_("Employee {0} is already registered as patient {1}").format(self.employee, duplicate)
				)
			self.village = None
		else:
			self.employee = None
			self.department = None
