import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import formatdate, getdate, nowdate

from clinic.utils import age_text


class ClinicPatient(Document):
	def onload(self):
		self.age = age_text(self.date_of_birth)

	def before_validate(self):
		# set before Frappe fetches the employer's billing flags onto the patient
		if self.patient_type == "Employee" and not self.employer:
			self.employer = frappe.db.get_value("Clinic Employer", {"uses_employee_records": 1}, "name")

	def validate(self):
		self.validate_date_of_birth()
		self.validate_type_fields()
		self.age = age_text(self.date_of_birth)

	def validate_date_of_birth(self):
		if self.date_of_birth and getdate(self.date_of_birth) > getdate(nowdate()):
			frappe.throw(
				_("Date of birth {0} is in the future. Check the day and month are the right way round.").format(
					formatdate(self.date_of_birth)
				)
			)

	def on_update(self):
		"""A corrected date of birth must re-date the child's immunization card."""
		if self.has_value_changed("date_of_birth") and not self.is_new():
			child = frappe.db.get_value("Clinic Child Record", {"patient": self.name}, "name")
			if child:
				frappe.get_doc("Clinic Child Record", child).save(ignore_permissions=True)

	def validate_type_fields(self):
		if self.patient_type == "Employee":
			# Staff of the farm that owns the system come from the Employee list; other farms' staff are typed in
			if not self.employer:
				frappe.throw(_("Select the employee's farm"))
			if frappe.db.get_value("Clinic Employer", self.employer, "uses_employee_records"):
				if not self.employee:
					frappe.throw(_("Select the employee from the Employee list"))
				self.staff_no = self.section = None
				duplicate = frappe.db.exists("Clinic Patient", {"employee": self.employee, "name": ["!=", self.name]})
				if duplicate:
					frappe.throw(
						_("Employee {0} is already registered as patient {1}").format(self.employee, duplicate)
					)
			else:
				self.employee = self.department = None
				if self.staff_no:
					duplicate = frappe.db.exists(
						"Clinic Patient",
						{"employer": self.employer, "staff_no": self.staff_no, "name": ["!=", self.name]},
					)
					if duplicate:
						frappe.throw(
							_("Staff no. {0} at {1} is already registered as patient {2}").format(
								self.staff_no, self.employer, duplicate
							)
						)
			self.village = None
		else:
			self.employee = self.department = self.employer = self.staff_no = self.section = None
