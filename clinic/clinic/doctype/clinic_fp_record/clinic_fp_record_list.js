frappe.listview_settings["Clinic FP Record"] = {
	add_fields: ["status", "current_method"],
	get_indicator(doc) {
		if (doc.status !== "Active") return [__(doc.status), "gray", "status,=," + doc.status];
		return [__(doc.current_method || "Active"), "green", "status,=,Active"];
	},
};
