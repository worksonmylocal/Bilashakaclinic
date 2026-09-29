frappe.listview_settings["Clinic Consultation"] = {
	add_fields: ["status"],
	get_indicator(doc) {
		const colours = { Open: "blue", "Awaiting Lab": "purple", Completed: "green" };
		return [__(doc.status), colours[doc.status], "status,=," + doc.status];
	},
};
