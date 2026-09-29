frappe.ui.form.on("Clinic Lab Test", {
	setup(frm) {
		frm.set_query("visit", () => ({ filters: { status: ["not in", ["Completed", "Cancelled"]] } }));
		frm.set_query("test_type", () => ({ filters: { enabled: 1 } }));
	},

	refresh(frm) {
		if (frm.is_new() || ["Resulted", "Cancelled"].includes(frm.doc.status)) return;
		const external = frm.doc.performed_where === "External";

		if (frm.doc.status === "Requested") {
			frm.add_custom_button(__("Collect Sample"), () => set_status(frm, "Sample Collected"));
		}
		if (external && ["Requested", "Sample Collected"].includes(frm.doc.status)) {
			frm.add_custom_button(__("Send to External Facility"), () => set_status(frm, "Sent to External"));
		}
		frm.add_custom_button(__("Mark Resulted"), () => set_status(frm, "Resulted")).addClass("btn-primary");
		frm.add_custom_button(__("Cancel Test"), () => set_status(frm, "Cancelled"), __("Actions"));
	},

	test_type(frm) {
		if (!frm.doc.test_type) return;
		frappe.db.get_doc("Clinic Lab Test Type", frm.doc.test_type).then((doc) => {
			frm.set_value("performed_where", doc.performed_where);
			frm.set_value("external_facility", doc.default_external_facility || null);
		});
	},
});

function set_status(frm, status) {
	frm.set_value("status", status);
	return frm.save().then(() => frm.reload_doc());
}
