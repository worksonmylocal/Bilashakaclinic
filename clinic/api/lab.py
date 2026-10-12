"""Data and actions behind the Laboratory page."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, get_first_day, nowdate

from clinic.api.common import (
	clean,
	clinic_profile,
	require_any,
	minutes_since,
	patient_card,
	require,
	today_start,
	user_name,
)

PENDING = ["Requested", "Sample Collected"]


def _lab_only_visits(visits):
    """{visit: referring facility or ''} for visits that came only for lab tests."""
    if not visits:
        return {}
    rows = frappe.get_all(
        "Clinic Visit",
        filters={"name": ["in", list(visits)], "visit_purpose": "Lab Only"},
        fields=["name", "referring_facility"],
    )
    return {r.name: r.referring_facility or "" for r in rows}


@frappe.whitelist()
def dashboard():
	require("lab")
	start = today_start()

	queue = frappe.get_all(
		"Clinic Lab Test",
		filters={"status": ["in", PENDING]},
		fields=["name", "test_type", "category", "patient", "patient_name", "patient_type", "sex", "age_years",
				"status", "urgency", "requested_on", "requested_by", "performed_where", "visit", "consultation",
				"requires_consent", "consent_obtained", "clinical_notes"],
		order_by="requested_on asc",
	)
	for row in queue:
		row.wait_minutes = minutes_since(row.requested_on)
		row.requested_by_name = user_name(row.requested_by)
	queue.sort(key=lambda r: (r.urgency != "Urgent", r.requested_on))
	referred = _lab_only_visits({r.visit for r in queue})
	for row in queue:
		row.lab_only = row.visit in referred
		row.referred_by = referred.get(row.visit)

	external = frappe.get_all(
		"Clinic Lab Test",
		filters={"status": "Sent to External"},
		fields=["name", "test_type", "category", "patient_name", "patient_type", "external_facility", "sent_on",
				"visit", "urgency"],
		order_by="sent_on asc",
	)
	for row in external:
		row.days_out = (frappe.utils.date_diff(nowdate(), row.sent_on) if row.sent_on else 0)

	resulted = frappe.get_all(
		"Clinic Lab Test",
		filters={"status": "Resulted", "resulted_on": [">=", start]},
		fields=["name", "test_type", "category", "patient_name", "patient_type", "interpretation",
				"resulted_on", "technician", "performed_where", "visit"],
		order_by="resulted_on desc",
	)
	referred = _lab_only_visits({r.visit for r in resulted})
	for row in resulted:
		row.technician_name = user_name(row.technician)
		row.lab_only = row.visit in referred
		row.referred_by = referred.get(row.visit)

	stats = frappe.db.sql(
		"""
		SELECT
			IFNULL(SUM(status = 'Resulted' AND performed_where = 'Onsite'), 0) AS resulted,
			IFNULL(SUM(status = 'Resulted' AND interpretation = 'Positive'), 0) AS positive,
			IFNULL(SUM(status = 'Resulted' AND interpretation = 'Abnormal'), 0) AS abnormal,
			AVG(IF(status = 'Resulted' AND performed_where = 'Onsite',
				TIMESTAMPDIFF(MINUTE, requested_on, resulted_on), NULL)) AS avg_tat
		FROM `tabClinic Lab Test` WHERE resulted_on >= %s
		""",
		start,
		as_dict=True,
	)[0]
	requested = frappe.db.sql(
		"""
		SELECT COUNT(*) AS total, IFNULL(SUM(patient_type = 'Employee'), 0) AS employees,
			IFNULL(SUM(patient_type = 'Community Member'), 0) AS community
		FROM `tabClinic Lab Test` WHERE requested_on >= %s AND status != 'Cancelled'
		""",
		start,
		as_dict=True,
	)[0]

	return {
		"kpis": {
			"pending": len(queue),
			"urgent": sum(1 for r in queue if r.urgency == "Urgent"),
			"in_progress": sum(1 for r in queue if r.status == "Sample Collected"),
			"longest_wait": max((r.wait_minutes for r in queue), default=0),
			"external_out": len(external),
			"resulted_today": len(resulted),
			"positive_today": stats.positive,
			"abnormal_today": stats.abnormal,
			"positivity": round(stats.positive * 100 / stats.resulted) if stats.resulted else 0,
			"avg_tat": round(stats.avg_tat or 0),
			"requested_today": requested.total,
			"employees_today": requested.employees,
			"community_today": requested.community,
		},
		"queue": queue,
		"external": external,
		"resulted": resulted,
	}


@frappe.whitelist()
def insights():
	require("lab")
	since = add_days(nowdate(), -13)
	by_category = frappe.db.sql(
		"""
		SELECT category AS label,
			SUM(patient_type = 'Employee') AS employees,
			SUM(patient_type = 'Community Member') AS community
		FROM `tabClinic Lab Test` WHERE DATE(requested_on) >= %s AND status != 'Cancelled'
		GROUP BY category ORDER BY COUNT(*) DESC
		""",
		since,
		as_dict=True,
	)
	by_day = frappe.db.sql(
		"""
		SELECT DATE(requested_on) AS day, COUNT(*) AS tests
		FROM `tabClinic Lab Test` WHERE DATE(requested_on) >= %s AND status != 'Cancelled'
		GROUP BY DATE(requested_on) ORDER BY day
		""",
		since,
		as_dict=True,
	)
	positivity = frappe.db.sql(
		"""
		SELECT test_type AS label, COUNT(*) AS resulted,
			SUM(interpretation = 'Positive') AS positive,
			SUM(interpretation = 'Positive' AND patient_type = 'Employee') AS employees_positive,
			SUM(interpretation = 'Positive' AND patient_type = 'Community Member') AS community_positive
		FROM `tabClinic Lab Test`
		WHERE status = 'Resulted' AND DATE(resulted_on) >= %s
		GROUP BY test_type HAVING resulted > 0 ORDER BY resulted DESC LIMIT 8
		""",
		add_days(nowdate(), -29),
		as_dict=True,
	)
	top_month = frappe.db.sql(
		"""
		SELECT test_type AS label, category, COUNT(*) AS total,
			SUM(status = 'Resulted') AS resulted,
			SUM(interpretation = 'Positive') AS positive,
			SUM(patient_type = 'Employee') AS employees,
			SUM(patient_type = 'Community Member') AS community
		FROM `tabClinic Lab Test`
		WHERE status != 'Cancelled' AND DATE(requested_on) >= %s
		GROUP BY test_type, category ORDER BY total DESC, test_type LIMIT 10
		""",
		get_first_day(nowdate()),
		as_dict=True,
	)
	return {
		"top_month": top_month,
		"by_category": by_category,
		"by_day": [{**row, "day": str(row.day)} for row in by_day],
		"positivity": positivity,
	}


@frappe.whitelist()
def get_test(name):
	require("lab")
	doc = frappe.get_doc("Clinic Lab Test", name)
	data = doc.as_dict(no_nulls=True)
	data["patient_card"] = patient_card(doc.patient)
	data["requested_by_name"] = user_name(doc.requested_by)
	data["instructions"] = frappe.db.get_value("Clinic Lab Test Type", doc.test_type, "instructions")
	visit = frappe.db.get_value(
		"Clinic Visit", doc.visit, ["visit_purpose", "referring_facility", "referring_clinician"], as_dict=True
	)
	data["lab_only"] = visit.visit_purpose == "Lab Only"
	data["referring_facility"] = visit.referring_facility
	data["referring_clinician"] = visit.referring_clinician
	return data


@frappe.whitelist()
def save_test(name, data, action="save"):
	"""action: save | collect | result | send_external | cancel"""
	require("lab")
	data = frappe.parse_json(data)
	doc = frappe.get_doc("Clinic Lab Test", name)

	values = {row["name"]: row.get("value") for row in data.get("results", []) if row.get("name")}
	for row in doc.results:
		if row.name in values:
			row.value = clean(values[row.name])
	for field in ("consent_obtained",):
		if field in data:
			doc.set(field, cint(data[field]))
	for field in ("external_facility", "external_report", "result_comments", "interpretation", "sent_on"):
		if field in data:
			doc.set(field, clean(data[field]))

	if action == "collect":
		doc.status = "Sample Collected"
	elif action == "send_external":
		doc.status = "Sent to External"
	elif action == "result":
		doc.status = "Resulted"
	elif action == "cancel":
		doc.status = "Cancelled"
	doc.save()
	return {
		"name": doc.name,
		"status": doc.status,
		"interpretation": doc.interpretation,
		"visit_status": frappe.db.get_value("Clinic Visit", doc.visit, "status"),
	}


@frappe.whitelist()
def create_walk_in(patient, tests, referring_facility=None, referring_clinician=None, referral_reason=None):
	"""Lab-only visit for a patient sent in for tests (e.g. by another clinic) or a walk-in."""
	require("lab")
	tests = frappe.parse_json(tests)
	if not tests:
		frappe.throw(_("Select at least one test"))
	facility = clean(referring_facility)
	visit = frappe.get_doc(
		{
			"doctype": "Clinic Visit",
			"patient": patient,
			"visit_purpose": "Lab Only",
			"visit_source": "Referral In" if facility else "Walk-in",
			"referring_facility": facility,
			"referring_clinician": clean(referring_clinician),
			"referral_reason": clean(referral_reason),
		}
	).insert()
	created = []
	for test_type in tests:
		created.append(
			frappe.get_doc({"doctype": "Clinic Lab Test", "visit": visit.name, "test_type": test_type}).insert().name
		)
	return {"visit": visit.name, "tests": created}


@frappe.whitelist()
def report(visit):
    """Everything needed to print the laboratory report for one visit."""
    require_any("lab", "consultation")
    visit_doc = frappe.get_doc("Clinic Visit", visit)
    patient = patient_card(visit_doc.patient)

    tests = frappe.get_all(
        "Clinic Lab Test",
        filters={"visit": visit, "status": ["!=", "Cancelled"]},
        fields=["name", "test_type", "category", "sample_type", "status", "performed_where", "external_facility",
                "external_report", "interpretation", "result_comments", "requested_on", "sample_collected_on",
                "resulted_on", "technician", "urgency"],
        order_by="requested_on asc",
    )
    released, pending = [], 0
    for test in tests:
        if test.status != "Resulted":
            pending += 1
            continue
        test.technician_name = user_name(test.technician)
        test.results = frappe.get_all(
            "Clinic Lab Test Result Item",
            filters={"parent": test.name},
            fields=["parameter", "value", "unit", "reference", "flag"],
            order_by="idx asc",
        )
        test.results = [r for r in test.results if (r.value or "").strip()]
        released.append(test)

    if not released:
        frappe.throw(_("No results have been released for this visit yet"))

    visit_doc.add_comment("Info", _("Lab report opened by {0}").format(user_name(frappe.session.user)))
    return {
        "clinic": clinic_profile(),
        "visit": {
            "name": visit_doc.name,
            "visit_date": visit_doc.visit_date,
            "visit_purpose": visit_doc.visit_purpose,
            "visit_source": visit_doc.visit_source,
            "referring_facility": visit_doc.referring_facility,
            "referring_clinician": visit_doc.referring_clinician,
            "referral_reason": visit_doc.referral_reason,
        },
        "patient": patient,
        "tests": released,
        "pending": pending,
        "printed_by": user_name(frappe.session.user),
        "printed_on": frappe.utils.now_datetime(),
    }


@frappe.whitelist()
def month_results():
	"""Everything resulted since the first of this month."""
	require("lab")
	first = get_first_day(nowdate())
	rows = frappe.get_all(
		"Clinic Lab Test",
		filters={"status": "Resulted", "resulted_on": [">=", f"{first} 00:00:00"]},
		fields=["name", "test_type", "category", "patient_name", "patient_type", "interpretation",
			"resulted_on", "technician", "performed_where", "visit"],
		order_by="resulted_on desc",
	)
	referred = _lab_only_visits({r.visit for r in rows})
	for row in rows:
		row.technician_name = user_name(row.technician)
		row.lab_only = row.visit in referred
		row.referred_by = referred.get(row.visit)
	return {
		"month": frappe.utils.formatdate(first, "MMMM yyyy"),
		"rows": rows,
		"summary": {
			"total": len(rows),
			"positive": sum(1 for r in rows if r.interpretation == "Positive"),
			"abnormal": sum(1 for r in rows if r.interpretation == "Abnormal"),
			"employees": sum(1 for r in rows if r.patient_type == "Employee"),
			"community": sum(1 for r in rows if r.patient_type == "Community Member"),
			"external": sum(1 for r in rows if r.performed_where == "External"),
		},
	}
