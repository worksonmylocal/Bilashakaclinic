import frappe

from clinic.api.common import allowed_pages


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/clinic"
        raise frappe.Redirect
    pages = allowed_pages()
    if not pages:
        frappe.throw("You do not have a clinic role.", frappe.PermissionError)
    frappe.local.flags.redirect_location = f"/clinic/{pages[0]}"
    raise frappe.Redirect
