"""Charges for visits.

Everyone is charged the same prices (Clinic Pricing). How they settle differs:
  * Cash    - community members (and staff of employers not on credit) pay at the pharmacy, with a receipt.
  * Invoice - staff of the farms get an invoice to take back to the farm, which pays later.

An open bill is always rebuilt from what actually happened in the visit (consultation, tests done, drugs
dispensed) using the current prices, so nothing depends on the order things were done or when prices were entered.
"""

import frappe
from frappe import _
from frappe.model.naming import make_autoname
from frappe.utils import flt, now_datetime

ORDER = {"Consultation": 0, "Lab Test": 1, "Drug": 2}


# ---------------------------------------------------------------- prices
def _pricing():
	return frappe.get_single("Clinic Pricing")


def consultation_price():
	return flt(_pricing().consultation_price)


def lab_price(test_type):
	return next((flt(r.price) for r in _pricing().lab_prices if r.test_type == test_type), 0.0)


def drug_prices():
	return {r.drug: flt(r.price) for r in _pricing().drug_prices}


# ---------------------------------------------------------------- how a visit is billed
def terms(visit):
	"""Billing mode and sick sheet need for a visit, read live from the patient's employer."""
	return terms_for_patient(frappe.db.get_value("Clinic Visit", visit, "patient"))


def terms_for_patient(patient):
	p = frappe.db.get_value("Clinic Patient", patient, ["patient_type", "employer"], as_dict=True)
	employer = (
		frappe.db.get_value("Clinic Employer", p.employer, ["requires_sick_sheet", "billed_at_clinic"], as_dict=True)
		if p.employer
		else None
	)
	is_staff = p.patient_type == "Employee" and employer
	return {
		"billing_mode": "Invoice" if is_staff and employer.billed_at_clinic else "Cash",
		"sick_sheet": bool(is_staff and employer.requires_sick_sheet),
		"employer": p.employer,
	}


def get_bill(visit, create=False):
	name = frappe.db.get_value("Clinic Bill", {"visit": visit, "status": ["!=", "Cancelled"]}, "name")
	if name:
		return frappe.get_doc("Clinic Bill", name)
	if create:
		bill = frappe.get_doc({"doctype": "Clinic Bill", "visit": visit, "billing_mode": terms(visit)["billing_mode"]})
		bill.insert(ignore_permissions=True)
		return bill
	return None


def _save(bill):
	bill.flags.ignore_permissions = True
	bill.save()
	return bill


# ---------------------------------------------------------------- building the bill
def desired_lines(visit):
	"""{(source doctype, source name): (type, description, qty, rate)} for everything chargeable so far."""
	lines = {}
	consultation = frappe.db.get_value("Clinic Visit", visit, "consultation")
	if consultation:
		lines[("Clinic Consultation", consultation)] = ("Consultation", _("Consultation fee"), 1, consultation_price())
	for test in frappe.get_all(
		"Clinic Lab Test",
		filters={"visit": visit, "status": ["in", ["Resulted", "Sent to External"]]},
		fields=["name", "test_type"],
	):
		lines[("Clinic Lab Test", test.name)] = ("Lab Test", test.test_type, 1, lab_price(test.test_type))
	dispensing = frappe.db.get_value("Clinic Dispensing", {"visit": visit, "docstatus": ["!=", 2]}, "name", order_by="creation desc")
	if dispensing:
		prices = drug_prices()
		for row in frappe.get_all(
			"Clinic Dispensing Item",
			filters={"parent": dispensing},
			fields=["name", "drug", "drug_name", "dispensed_qty", "not_available"],
		):
			qty = 0 if row.not_available else flt(row.dispensed_qty)
			lines[("Clinic Dispensing Item", row.name)] = ("Drug", row.drug_name or row.drug, qty, prices.get(row.drug, 0))
	# tests without a price and drugs that carry no charge simply do not appear on the bill
	return {key: line for key, line in lines.items() if flt(line[2]) > 0 and flt(line[3]) > 0}


def rebuild(bill):
	"""Bring an open bill in line with the visit. Invoiced and paid bills are never touched."""
	if bill.status != "Open":
		return bill
	want = desired_lines(bill.visit)
	have = {(r.reference_doctype, r.reference_name): r for r in bill.items}
	changed = False
	for key, row in list(have.items()):
		if key not in want:
			bill.remove(row)
			changed = True
	for key, (item_type, description, qty, rate) in want.items():
		row = have.get(key)
		if row is None:
			bill.append(
				"items",
				{
					"item_type": item_type, "description": description, "qty": qty, "rate": rate,
					"reference_doctype": key[0], "reference_name": key[1],
				},
			)
			changed = True
		elif (row.description, flt(row.qty), flt(row.rate)) != (description, flt(qty), flt(rate)):
			row.description, row.qty, row.rate = description, qty, rate
			changed = True
	if changed:
		_save(bill)
	return bill


def sync(visit, create=True):
	bill = get_bill(visit, create=create)
	return rebuild(bill) if bill else None


# hooks used by the consultation, lab test and dispensing records
def add_consultation_fee(consultation):
	sync(consultation.visit)


def sync_lab_charge(test):
	conducted = test.status in ("Resulted", "Sent to External")
	sync(test.visit, create=conducted)


def sync_drug_charges(dispensing):
	if dispensing.docstatus != 2:
		sync(dispensing.visit)


# ---------------------------------------------------------------- reading and settling
def has_unpaid_bill(visit):
	bill = get_bill(visit)
	return bool(bill and bill.status == "Open" and flt(rebuild(bill).total) > 0)


def summary(visit):
	bill = get_bill(visit)
	if not bill:
		return None
	bill = rebuild(bill)
	return {
		"name": bill.name,
		"status": bill.status,
		"billing_mode": bill.billing_mode,
		"total": flt(bill.total),
		"consultation_total": flt(bill.consultation_total),
		"lab_total": flt(bill.lab_total),
		"drug_total": flt(bill.drug_total),
		"receipt_no": bill.receipt_no,
		"invoice_no": bill.invoice_no,
		"lines": [
			{"item_type": r.item_type, "description": r.description, "qty": flt(r.qty), "rate": flt(r.rate), "amount": flt(r.amount)}
			for r in bill.items
		],
	}


def pay(visit, mode, amount, reference=None):
	"""Cash settlement at the pharmacy."""
	bill = get_bill(visit)
	if not bill:
		frappe.throw(_("There is no bill for this visit"))
	if bill.status == "Paid":
		frappe.throw(_("This bill has already been paid (receipt {0})").format(bill.receipt_no))
	if bill.status == "Invoiced":
		frappe.throw(_("This bill was invoiced to the employer ({0})").format(bill.invoice_no))
	if bill.billing_mode == "Invoice":
		frappe.throw(_("This patient's bill goes to the employer as an invoice, not cash"))
	bill = rebuild(bill)
	total, amount = flt(bill.total), flt(amount)
	if total > 0:
		if not mode:
			frappe.throw(_("Choose how the patient is paying"))
		if amount < total:
			frappe.throw(_("Amount received (KSh {0}) is less than the total due (KSh {1})").format(amount, total))
	bill.status = "Paid"
	bill.payment_mode = mode
	bill.amount_paid = amount if total > 0 else 0
	bill.change_amount = max(amount - total, 0) if total > 0 else 0
	bill.payment_reference = reference
	bill.paid_on = now_datetime()
	bill.received_by = frappe.session.user
	bill.receipt_no = make_autoname("REC-.YYYY.-.#####")
	return _save(bill)


def issue_invoice(visit):
	"""Farm staff: the bill becomes an invoice for the employer to settle later."""
	bill = get_bill(visit)
	if not bill:
		frappe.throw(_("There is no bill for this visit"))
	if bill.status == "Invoiced":
		return bill
	if bill.status != "Open":
		frappe.throw(_("This bill is already {0}").format(bill.status))
	if bill.billing_mode != "Invoice":
		frappe.throw(_("This patient pays cash, not on an employer invoice"))
	bill = rebuild(bill)
	if flt(bill.total) <= 0:
		frappe.throw(_("There is nothing to invoice"))
	bill.status = "Invoiced"
	bill.invoice_no = make_autoname("INV-.YYYY.-.#####")
	bill.invoiced_on = now_datetime()
	return _save(bill)


def record_farm_payment(bill_names, mode, reference=None):
	"""The farm has paid one or more invoices."""
	if not mode:
		frappe.throw(_("Choose how the farm paid"))
	paid = []
	for name in bill_names:
		bill = frappe.get_doc("Clinic Bill", name)
		if bill.status != "Invoiced":
			frappe.throw(_("{0} is not an outstanding invoice").format(name))
		bill.status = "Paid"
		bill.payment_mode = mode
		bill.amount_paid = flt(bill.total)
		bill.change_amount = 0
		bill.payment_reference = reference
		bill.paid_on = now_datetime()
		bill.received_by = frappe.session.user
		bill.receipt_no = make_autoname("REC-.YYYY.-.#####")
		_save(bill)
		paid.append(bill.name)
	return paid
