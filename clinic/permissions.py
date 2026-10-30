"""HIV testing records are seen only by the HTS officer (and managers), never by the other clinic roles."""

import frappe

HTS_SERVICE = "HTS Attendance"
ALL_ACCESS = {"System Manager", "Clinic Manager"}
OTHER_CLINIC_ROLES = {
	"Clinic Doctor", "Clinic Nurse", "Clinic Specialty Nurse", "Clinic Pharmacist", "Clinic Lab Technician",
	"Clinic Receptionist",
}


def _scope(user):
	"""'all', 'hts' (HTS officer only) or 'others' (everyone else)."""
	if user == "Administrator":
		return "all"
	roles = set(frappe.get_roles(user))
	if roles & ALL_ACCESS:
		return "all"
	if "HTS Officer" in roles:
		return "all" if roles & OTHER_CLINIC_ROLES else "hts"
	return "others"


def attendance_query(user=None):
	scope = _scope(user or frappe.session.user)
	if scope == "hts":
		return f"`tabClinic Attendance`.service_type = '{HTS_SERVICE}'"
	if scope == "others":
		return f"`tabClinic Attendance`.service_type != '{HTS_SERVICE}'"
	return ""


def attendance_has_permission(doc, ptype=None, user=None, debug=False):
	scope = _scope(user or frappe.session.user)
	is_hts = doc.service_type == HTS_SERVICE
	if scope == "hts" and not is_hts:
		return False
	if scope == "others" and is_hts:
		return False
	return True  # Frappe treats anything but True as a refusal
