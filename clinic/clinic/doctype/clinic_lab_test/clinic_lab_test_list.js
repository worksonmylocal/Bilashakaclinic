frappe.listview_settings["Clinic Lab Test"] = {
	add_fields: ["status", "interpretation"],
	get_indicator(doc) {
		const colours = {
			Requested: "orange",
			"Sample Collected": "yellow",
			"Sent to External": "purple",
			Resulted: "green",
			Cancelled: "gray",
		};
		return [__(doc.status), colours[doc.status], "status,=," + doc.status];
	},
};
