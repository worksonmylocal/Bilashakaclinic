frappe.listview_settings["Clinic PNC Record"] = {
	add_fields: ["status", "delivery_date"],
	get_indicator(doc) {
		if (doc.status !== "Active") return [__(doc.status), "gray", "status,=," + doc.status];
		return [__("Active"), "green", "status,=,Active"];
	},
};
