frappe.listview_settings["Clinic Child Record"] = {
	add_fields: ["is_defaulter", "status", "overdue_count"],
	get_indicator(doc) {
		if (doc.status !== "Active") return [__(doc.status), "gray", "status,=," + doc.status];
		if (doc.is_defaulter) return [__("Defaulter ({0})", [doc.overdue_count]), "red", "is_defaulter,=,1"];
		return [__("Up to date"), "green", "is_defaulter,=,0"];
	},
};
