"""The HIV testing clinic: clients walk in directly, so the clinic registers them and opens their attendance itself."""

import frappe
from frappe import _

from clinic.api import clinic_unit
from clinic.api.common import require

LABEL = "HTS Clinic"
SERVICE = "HTS Attendance"


@frappe.whitelist()
def start_client(patient):
	"""Open a visit and an HTS attendance for a client who has just walked in (no triage, no TB screening)."""
	require("hts")
	open_visit = frappe.db.get_value(
		"Clinic Visit", {"patient": patient, "status": ["not in", ["Completed", "Cancelled"]]}, ["name", "service_point"], as_dict=True
	)
	if open_visit:
		if open_visit.service_point == LABEL:
			return {"visit": open_visit.name, "resumed": True}  # already being attended here
		frappe.throw(
			_("This client already has an open visit ({0}) at another point. It must be completed or cancelled first.").format(open_visit.name)
		)
	visit = frappe.get_doc(
		{"doctype": "Clinic Visit", "patient": patient, "visit_purpose": "Consultation", "visit_source": "Walk-in", "service_point": LABEL}
	).insert()
	clinic_unit.start("hts", visit.name, SERVICE)
	return {"visit": visit.name, "resumed": False}
