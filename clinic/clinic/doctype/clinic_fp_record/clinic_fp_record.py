import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

from clinic.utils import age_text


class ClinicFPRecord(Document):
	def before_insert(self):
		if not self.serial_no:
			last = frappe.db.sql("SELECT IFNULL(MAX(serial_no), 0) FROM `tabClinic FP Record`")[0][0]
			self.serial_no = cint(last) + 1
		if not self.fp_no:
			self.fp_no = next_fp_no()

	def validate(self):
		dob = frappe.db.get_value("Clinic Patient", self.patient, "date_of_birth")
		self.dob = dob
		self.age = age_text(dob) if dob else None

	def on_update(self):
		"""The register is the source of truth for the client's contact details."""
		values = {}
		if self.phone:
			values["phone"] = self.phone
		if self.village:
			values["village"] = self.village
		if values:
			frappe.db.set_value("Clinic Patient", self.patient, values, update_modified=False)


def next_fp_no():
	from frappe.model.naming import make_autoname

	return make_autoname("FP/.YYYY./.####")
