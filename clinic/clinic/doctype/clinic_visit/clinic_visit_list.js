frappe.listview_settings["Clinic Visit"] = {
	add_fields: ["status", "patient_type"],
	get_indicator(doc) {
		const colours = {
			"Waiting Triage": "orange",
			"Waiting Consultation": "yellow",
			"In Consultation": "blue",
			"Waiting Lab": "purple",
			"Lab Results Ready": "cyan",
			"Waiting Pharmacy": "pink",
			Completed: "green",
			Cancelled: "gray",
		};
		return [__(doc.status), colours[doc.status] || "gray", "status,=," + doc.status];
	},
};
