import frappe


def execute():
	frappe.db.set_single_value("Clinic Settings", "tb_lab_test", "Sputum for AAFB (TB)")
