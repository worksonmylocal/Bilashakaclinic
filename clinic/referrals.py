"""The referral out of a visit: the doctor's consultation, else the clinic attendance."""

import frappe

HTS_SERVICE = "HTS Attendance"


def referral_for_visit(visit):
	"""{source, name, facility, urgency, reason, notes} when the patient is referred to another facility, else None."""
	v = frappe.db.get_value("Clinic Visit", visit, ["consultation", "attendance"], as_dict=True)
	if not v:
		return None
	if v.consultation:
		c = frappe.db.get_value(
			"Clinic Consultation", v.consultation,
			["refer_out", "referral_facility", "referral_urgency", "referral_reason", "referral_notes"], as_dict=True,
		)
		if c and c.refer_out:
			return {"source": "Clinic Consultation", "name": v.consultation, "facility": c.referral_facility,
				"urgency": c.referral_urgency, "reason": c.referral_reason, "notes": c.referral_notes}
	if v.attendance:
		a = frappe.db.get_value(
			"Clinic Attendance", v.attendance, ["refer_out", "referral_facility", "referral_reason", "service_type"], as_dict=True
		)
		if a and a.refer_out and a.service_type != HTS_SERVICE:  # HIV testing records never leave the HTS clinic
			return {"source": "Clinic Attendance", "name": v.attendance, "facility": a.referral_facility,
				"urgency": None, "reason": a.referral_reason, "notes": None}
	return None
