import frappe
from frappe.utils import cint, getdate, now_datetime

PATIENT_TYPES = ("Employee", "Community Member")


def age_in_years(date_of_birth, on=None):
	if not date_of_birth:
		return None
	dob = getdate(date_of_birth)
	on = getdate(on) if on else getdate()
	years = on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))
	return max(years, 0)


def age_in_months(date_of_birth, on=None):
	"""Completed months of age (0 for a newborn)."""
	if not date_of_birth:
		return None
	dob = getdate(date_of_birth)
	on = getdate(on) if on else getdate()
	months = (on.year - dob.year) * 12 + on.month - dob.month - (on.day < dob.day)
	return max(months, 0)


def age_text(date_of_birth, on=None):
	"""Human readable age: '3 yrs', '8 months' or '12 days'."""
	if not date_of_birth:
		return ""
	dob = getdate(date_of_birth)
	on = getdate(on) if on else getdate()
	years = age_in_years(dob, on)
	if years:
		return f"{years} yr" + ("s" if years != 1 else "")
	months = (on.year - dob.year) * 12 + on.month - dob.month - (on.day < dob.day)
	if months > 0:
		return f"{months} month" + ("s" if months != 1 else "")
	days = (on - dob).days
	return f"{max(days, 0)} day" + ("s" if days != 1 else "")


def age_band_sql(column="v.age_years"):
	"""SQL fragments for the standard reporting age bands."""
	return {
		"under_5": f"{column} < 5",
		"age_5_17": f"{column} BETWEEN 5 AND 17",
		"age_18_49": f"{column} BETWEEN 18 AND 49",
		"age_50_plus": f"{column} >= 50",
	}
