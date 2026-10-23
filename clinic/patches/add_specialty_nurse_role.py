from clinic.setup import ensure_roles


def execute():
	"""Sites installed before the Clinic Specialty Nurse role existed."""
	ensure_roles()
