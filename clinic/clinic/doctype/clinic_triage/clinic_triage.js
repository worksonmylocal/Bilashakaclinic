frappe.ui.form.on("Clinic Triage", {
	refresh(frm) {
		if (!frm.is_new() && frm.doc.visit) {
			frm.add_custom_button(__("Open Consultation"), () => {
				frappe.db.get_value("Clinic Visit", frm.doc.visit, "consultation").then((r) => {
					const consultation = r.message && r.message.consultation;
					if (consultation) return frappe.set_route("Form", "Clinic Consultation", consultation);
					frappe.new_doc("Clinic Consultation", { visit: frm.doc.visit });
				});
			});
		}
	},

	weight_kg: calculate_bmi,
	height_cm: calculate_bmi,
});

function calculate_bmi(frm) {
	const { weight_kg, height_cm } = frm.doc;
	if (weight_kg && height_cm) {
		frm.set_value("bmi", flt(weight_kg / Math.pow(height_cm / 100, 2), 1));
	}
}
