from clinic.setup import seed_diagnoses, seed_lab_test_types


def execute():
	seed_lab_test_types()
	seed_diagnoses()
