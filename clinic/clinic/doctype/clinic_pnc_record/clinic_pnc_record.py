import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, getdate, nowdate

from clinic.utils import age_text

ACTIVE_STATUS = "Active"


class ClinicPNCRecord(Document):
	def before_insert(self):
		if not self.serial_no:
			last = frappe.db.sql("SELECT IFNULL(MAX(serial_no), 0) FROM `tabClinic PNC Record`")[0][0]
			self.serial_no = cint(last) + 1
		if not self.pnc_no:
			self.pnc_no = next_pnc_no()

	def validate(self):
		patient = frappe.db.get_value("Clinic Patient", self.patient, ["date_of_birth", "full_name"], as_dict=True)
		self.dob = patient.date_of_birth
		self.age = age_text(self.dob) if self.dob else None
		if self.delivery_date and getdate(self.delivery_date) > getdate(nowdate()):
			frappe.throw(_("The date of delivery cannot be in the future"))
		if self.status == ACTIVE_STATUS:
			other = frappe.db.exists(
				"Clinic PNC Record", {"patient": self.patient, "status": ACTIVE_STATUS, "name": ["!=", self.name or ""]}
			)
			if other:
				frappe.throw(_("{0} already has an active PNC register entry ({1}). Close it before opening another.").format(patient.full_name, other))

	def on_update(self):
		"""The register is the source of truth for the mother's contact details."""
		values = {}
		if self.phone:
			values["phone"] = self.phone
		if self.village:
			values["village"] = self.village
		if values:
			frappe.db.set_value("Clinic Patient", self.patient, values, update_modified=False)


def next_pnc_no():
	from frappe.model.naming import make_autoname

	return make_autoname("PNC/.YYYY./.####")
