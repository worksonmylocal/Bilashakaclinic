import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_days, cint, getdate, nowdate

from clinic.utils import age_text

ACTIVE_STATUS = "Active"


class ClinicANCRecord(Document):
	def before_insert(self):
		if not self.serial_no:
			last = frappe.db.sql("SELECT IFNULL(MAX(serial_no), 0) FROM `tabClinic ANC Record`")[0][0]
			self.serial_no = cint(last) + 1
		if not self.anc_no:
			self.anc_no = next_anc_no()

	def validate(self):
		patient = frappe.db.get_value("Clinic Patient", self.patient, ["date_of_birth", "full_name", "sex"], as_dict=True)
		self.dob = patient.date_of_birth
		self.age = age_text(self.dob) if self.dob else None
		self.edd = add_days(self.lmp, 280) if self.lmp else None
		if self.status == ACTIVE_STATUS:
			other = frappe.db.exists(
				"Clinic ANC Record", {"patient": self.patient, "status": ACTIVE_STATUS, "name": ["!=", self.name or ""]}
			)
			if other:
				frappe.throw(_("{0} already has an active ANC register entry ({1}). Close it before opening another.").format(patient.full_name, other))

	def on_update(self):
		self.sync_patient()

	def sync_patient(self):
		"""The register is the source of truth for the client's contact details."""
		values = {}
		if self.phone:
			values["phone"] = self.phone
		if self.village:
			values["village"] = self.village
		if self.partner_name:
			values["next_of_kin"] = self.partner_name
			values["next_of_kin_relationship"] = "Partner"
			values["next_of_kin_phone"] = self.partner_phone
		if values:
			frappe.db.set_value("Clinic Patient", self.patient, values, update_modified=False)


def next_anc_no():
	from frappe.model.naming import make_autoname

	return make_autoname("ANC/.YYYY./.####")
