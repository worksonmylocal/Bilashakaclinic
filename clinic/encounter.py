"""Helpers shared by consultations and clinic attendances."""

import frappe
from frappe import _
from frappe.utils import cint

DEFAULT_TB_TEST = "Sputum for AAFB (TB)"


def tb_test_type():
	return frappe.db.get_single_value("Clinic Settings", "tb_lab_test") or DEFAULT_TB_TEST


def _new_test(doc, link_field, row):
	test = frappe.get_doc(
		{
			"doctype": "Clinic Lab Test",
			"visit": doc.visit,
			link_field: doc.name,
			"test_type": row.test_type,
			"urgency": row.urgency,
			"clinical_notes": row.clinical_notes,
		}
	).insert()
	row.lab_test = test.name
	return test


def create_lab_tests(doc, link_field):
	"""Send every lab request that has not gone to the lab yet."""
	rows = [r for r in doc.lab_requests if not r.lab_test]
	if not rows:
		frappe.throw(_("Add at least one new lab request first"))
	for row in rows:
		_new_test(doc, link_field, row)


def request_tb_test(doc, link_field=None):
	"""Presumed TB: add the sputum test to the lab requests (urgent), once.

	It is only a request until the clinician presses Send to Lab, so it goes out together with any other tests.
	"""
	test_type = tb_test_type()
	if not frappe.db.exists("Clinic Lab Test Type", test_type):
		frappe.throw(_("TB lab test '{0}' does not exist. Set it in Clinic Settings.").format(test_type))
	row = next((r for r in doc.lab_requests if r.test_type == test_type), None)
	if row:
		return row
	return doc.append(
		"lab_requests",
		{"test_type": test_type, "urgency": "Urgent", "clinical_notes": "Presumed TB on screening"},
	)


def check_tb_test_sent(doc):
	"""A patient screened as presumed TB cannot be closed until the sputum test has gone to the lab."""
	if cint((doc.tb_screening or "0")[:1]) != 1:
		return
	test_type = tb_test_type()
	for row in doc.lab_requests:
		if row.test_type == test_type and row.lab_test:
			return
	frappe.throw(_("Presumed TB: add the {0} request and press Send to Lab before closing.").format(test_type))


def create_dispensing(doc, link_field):
	if doc.dispensing and frappe.db.get_value("Clinic Dispensing", doc.dispensing, "docstatus") != 2:
		frappe.throw(_("Already sent to pharmacy ({0})").format(doc.dispensing))
	dispensing = frappe.get_doc(
		{
			"doctype": "Clinic Dispensing",
			"visit": doc.visit,
			link_field: doc.name,
			"items": [
				{
					"drug": row.drug,
					"dose": row.dose,
					"route": row.route,
					"frequency": row.frequency,
					"duration_days": row.duration_days,
					"prescribed_qty": row.quantity,
					"dispensed_qty": row.quantity,
					"instructions": row.instructions,
				}
				for row in doc.prescriptions
			],
		}
	).insert()
	doc.dispensing = dispensing.name


def create_follow_up(doc):
	if not doc.follow_up_required or doc.appointment:
		return
	appointment = frappe.get_doc(
		{
			"doctype": "Clinic Appointment",
			"patient": doc.patient,
			"appointment_date": doc.follow_up_date,
			"appointment_type": "Follow-up",
			"reason": doc.follow_up_reason,
		}
	).insert()
	doc.appointment = appointment.name
