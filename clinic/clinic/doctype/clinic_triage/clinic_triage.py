import frappe
from frappe import _
from frappe.model.document import Document

from clinic.clinic.doctype.clinic_visit.clinic_visit import CLOSED_STATUSES, set_visit_status


class ClinicTriage(Document):
	def validate(self):
		self.validate_visit()
		self.validate_ranges()
		self.set_bmi()
		self.set_alerts()

	def on_update(self):
		frappe.db.set_value("Clinic Visit", self.visit, "triage", self.name)
		visit = frappe.db.get_value("Clinic Visit", self.visit, ["status", "service_point"], as_dict=True)
		# Waiting Triage -> the doctor's queue or the queue of the clinic chosen at triage
		if visit.status in ("Waiting Triage", "Waiting Consultation", "Waiting Clinic"):
			going_to_doctor = (visit.service_point or "Consultation") == "Consultation"
			set_visit_status(self.visit, "Waiting Consultation" if going_to_doctor else "Waiting Clinic")

	def validate_visit(self):
		if not self.is_new():
			return
		status = frappe.db.get_value("Clinic Visit", self.visit, "status")
		if status in CLOSED_STATUSES:
			frappe.throw(_("Visit {0} is {1}").format(self.visit, status))
		existing = frappe.db.exists("Clinic Triage", {"visit": self.visit})
		if existing:
			frappe.throw(_("Triage {0} has already been recorded for this visit").format(existing))

	def validate_ranges(self):
		limits = {
			"bp_systolic": (40, 300, _("Systolic BP")),
			"bp_diastolic": (20, 200, _("Diastolic BP")),
			"pulse_rate": (20, 250, _("Pulse")),
			"respiratory_rate": (4, 80, _("Respiratory rate")),
			"temperature": (25, 45, _("Temperature")),
			"spo2": (30, 100, _("SpO₂")),
			"weight_kg": (0.3, 400, _("Weight")),
			"height_cm": (20, 260, _("Height")),
		}
		for field, (low, high, label) in limits.items():
			value = self.get(field)
			if value and not low <= value <= high:
				frappe.throw(_("{0} of {1} looks wrong. Expected between {2} and {3}.").format(label, value, low, high))
		if self.bp_systolic and self.bp_diastolic and self.bp_diastolic >= self.bp_systolic:
			frappe.throw(_("Diastolic BP must be lower than systolic BP"))
		if bool(self.bp_systolic) != bool(self.bp_diastolic):
			frappe.throw(_("Enter both systolic and diastolic BP"))

	def set_bmi(self):
		self.bmi, self.bmi_category = None, None
		if not (self.weight_kg and self.height_cm):
			return
		self.bmi = round(self.weight_kg / (self.height_cm / 100) ** 2, 1)
		if self.bmi < 18.5:
			self.bmi_category = "Underweight"
		elif self.bmi < 25:
			self.bmi_category = "Normal"
		elif self.bmi < 30:
			self.bmi_category = "Overweight"
		else:
			self.bmi_category = "Obese"

	def set_alerts(self):
		alerts = []
		if self.temperature and self.temperature >= 38:
			alerts.append(_("Fever ({0} °C)").format(self.temperature))
		elif self.temperature and self.temperature < 35.5:
			alerts.append(_("Low temperature ({0} °C)").format(self.temperature))
		if self.spo2 and self.spo2 < 95:
			alerts.append(_("Low oxygen saturation ({0}%)").format(self.spo2))
		if self.bp_systolic and (self.bp_systolic >= 140 or self.bp_diastolic >= 90):
			alerts.append(_("High BP ({0}/{1})").format(self.bp_systolic, self.bp_diastolic))
		elif self.bp_systolic and self.bp_systolic < 90:
			alerts.append(_("Low BP ({0}/{1})").format(self.bp_systolic, self.bp_diastolic))
		if self.pulse_rate and self.pulse_rate > 100:
			alerts.append(_("Tachycardia ({0} bpm)").format(self.pulse_rate))
		elif self.pulse_rate and self.pulse_rate < 60:
			alerts.append(_("Bradycardia ({0} bpm)").format(self.pulse_rate))
		if self.respiratory_rate and (self.respiratory_rate > 24 or self.respiratory_rate < 12):
			alerts.append(_("Abnormal respiratory rate ({0}/min)").format(self.respiratory_rate))
		if self.blood_glucose and (self.blood_glucose > 11.1 or self.blood_glucose < 3.9):
			alerts.append(_("Abnormal glucose ({0} mmol/L)").format(self.blood_glucose))
		self.alerts = "\n".join(alerts)
