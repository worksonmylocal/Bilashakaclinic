import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_days, cint, flt, getdate, nowdate

from clinic.utils import age_text

ACTIVE_STATUS = "Active"


class ClinicChildRecord(Document):
	def before_insert(self):
		if not self.serial_no:
			last = frappe.db.sql("SELECT IFNULL(MAX(serial_no), 0) FROM `tabClinic Child Record`")[0][0]
			self.serial_no = cint(last) + 1
		if not self.cwc_no:
			self.cwc_no = next_cwc_no()

	def validate(self):
		self.validate_child()
		if not self.immunizations:
			self.build_schedule()
		self.refresh_doses()

	def on_update(self):
		self.sync_patient()

	def validate_child(self):
		patient = frappe.db.get_value(
			"Clinic Patient", self.patient, ["date_of_birth", "full_name"], as_dict=True
		)
		if not patient.date_of_birth:
			frappe.throw(_("{0} has no date of birth. The immunization schedule is worked out from it.").format(patient.full_name))
		self.dob = patient.date_of_birth
		self.age = age_text(self.dob)

	def build_schedule(self):
		"""Lay out the child's card from the facility schedule, dated from their birthday."""
		self.set("immunizations", [])
		for item in sorted(schedule_items(), key=lambda r: (r.age_days, r.idx)):
			self.append(
				"immunizations",
				{
					"milestone": item.milestone, "vaccine": item.vaccine, "age_days": item.age_days,
					"grace_days": item.grace_days, "optional": item.optional,
					"due_date": add_days(self.dob, item.age_days),
				},
			)

	def refresh_doses(self):
		today, overdue, next_due = getdate(nowdate()), 0, None
		given = 0
		for row in self.immunizations:
			# due dates are always worked out from the date of birth, so a corrected birthday re-dates the card
			if self.dob and row.age_days is not None:
				row.due_date = add_days(self.dob, cint(row.age_days))
			if row.date_given:
				row.status = "Given"
				row.given_by = row.given_by or frappe.session.user
				given += 1
				continue
			if row.status == "Not Applicable":
				continue
			due = getdate(row.due_date)
			if today < due:
				row.status = "Scheduled"
			elif today <= add_days(due, cint(row.grace_days)):
				row.status = "Due"
			else:
				row.status = "Overdue"
			if row.optional:
				continue  # optional doses (county-dependent) never make a child a defaulter
			if row.status == "Overdue":
				overdue += 1
			if row.status in ("Due", "Overdue") and (next_due is None or due < getdate(next_due.due_date)):
				next_due = row
		counted = [r for r in self.immunizations if r.status != "Not Applicable" and (not r.optional or r.date_given)]
		self.overdue_count = overdue
		self.is_defaulter = 1 if overdue and self.status == ACTIVE_STATUS else 0
		self.next_due_vaccine = next_due.vaccine if next_due else None
		self.next_due_date = next_due.due_date if next_due else None
		self.immunization_summary = _("{0} of {1} doses given").format(given, len(counted))

	def sync_patient(self):
		"""The register is the source of truth for the child's contact details."""
		values = {}
		if self.caregiver_phone:
			values["phone"] = self.caregiver_phone
		if self.caregiver_name:
			values["next_of_kin"] = self.caregiver_name
			values["next_of_kin_relationship"] = self.caregiver_relationship
			values["next_of_kin_phone"] = self.caregiver_phone
		if self.village:
			values["village"] = self.village
		if values:
			frappe.db.set_value("Clinic Patient", self.patient, values, update_modified=False)

	@frappe.whitelist()
	def rebuild_schedule(self):
		"""Re-lay the card from the current facility schedule, keeping every dose already given."""
		self.check_permission("write")
		given = {(r.milestone, r.vaccine): r for r in self.immunizations if r.date_given}
		self.build_schedule()
		for row in self.immunizations:
			old = given.pop((row.milestone, row.vaccine), None)
			if old:
				row.update({"date_given": old.date_given, "batch_no": old.batch_no, "given_by": old.given_by, "attendance": old.attendance})
		for old in given.values():  # doses given that the schedule no longer lists are kept
			self.append("immunizations", {
				"milestone": old.milestone, "vaccine": old.vaccine, "due_date": old.due_date,
				"date_given": old.date_given, "batch_no": old.batch_no, "given_by": old.given_by,
				"attendance": old.attendance, "age_days": old.age_days, "grace_days": old.grace_days,
			})
		self.save()


def schedule_items():
	return [r for r in frappe.get_single("Clinic Vaccine Schedule").items if r.enabled]


def next_cwc_no():
	from frappe.model.naming import make_autoname

	return make_autoname("CWC/.YYYY./.####")


def refresh_defaulters():
	"""Nightly: keep the overdue flags current as dates roll past."""
	for name in frappe.get_all("Clinic Child Record", {"status": "Active"}, pluck="name"):
		doc = frappe.get_doc("Clinic Child Record", name)
		before = (doc.is_defaulter, doc.overdue_count, doc.next_due_vaccine)
		doc.refresh_doses()
		if (doc.is_defaulter, doc.overdue_count, doc.next_due_vaccine) != before:
			doc.save(ignore_permissions=True)
	frappe.db.commit()
