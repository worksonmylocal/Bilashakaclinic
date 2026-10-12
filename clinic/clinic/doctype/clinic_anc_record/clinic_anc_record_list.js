frappe.listview_settings["Clinic ANC Record"] = {
	add_fields: ["status", "edd"],
	get_indicator(doc) {
		if (doc.status !== "Active") return [__(doc.status), "gray", "status,=," + doc.status];
		return [__("Active"), "green", "status,=,Active"];
	},
};
