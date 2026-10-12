frappe.ui.form.on("Clinic Child Record", {
	refresh(frm) {
		if (frm.is_new()) return;
		frm.add_custom_button(__("Rebuild Schedule"), () => {
			frappe.confirm(
				__("Re-lay this card from the current facility schedule? Doses already given are kept."),
				() => frm.call("rebuild_schedule").then(() => frm.reload_doc())
			);
		});
		frm.add_custom_button(__("Visit History"), () => {
			frappe.set_route("List", "Clinic Attendance", { patient: frm.doc.patient });
		}, __("View"));
		if (frm.doc.is_defaulter) {
			frm.dashboard.set_headline(
				__("{0} dose(s) overdue. Next due: {1} on {2}", [frm.doc.overdue_count, frm.doc.next_due_vaccine || "—", frappe.datetime.str_to_user(frm.doc.next_due_date) || "—"]),
				"orange"
			);
		}
	},
});
