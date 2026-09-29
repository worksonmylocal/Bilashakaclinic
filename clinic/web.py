import time

import frappe
from frappe import _

from clinic.api.common import ADMIN_ROLES, PAGE_ROLES, allowed_pages


def prepare_page(context, page, any_of=None):
	"""Shared get_context for the clinic web pages: login and role check, plus session details."""
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = f"/login?redirect-to=/clinic/{page}"
		raise frappe.Redirect

	context.no_cache = 1
	context.show_sidebar = False
	context.page_key = page
	context.asset_version = int(time.time() // 300)
	context.csrf_token = frappe.sessions.get_csrf_token()
	context.user_full_name = frappe.db.get_value("User", frappe.session.user, "full_name")

	if not set(any_of or [page]) & set(allowed_pages()):
		frappe.throw(
			_("You do not have a clinic role that can open this page."), frappe.PermissionError
		)
