frappe.ui.form.on("Clinic Appointment", {
	refresh(frm) {
		if (frm.is_new()) return;
		if (frm.doc.status === "Scheduled") {
			frm.add_custom_button(__("Check In"), () => {
				frm.call("check_in").then((r) => {
					if (r.message) frappe.set_route("Form", "Clinic Visit", r.message);
				});
			}).addClass("btn-primary");
		}
		if (frm.doc.visit) {
			frm.add_custom_button(__("Visit"), () => frappe.set_route("Form", "Clinic Visit", frm.doc.visit), __("View"));
		}
	},
});
