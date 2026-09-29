frappe.listview_settings["Clinic Triage"] = {
	add_fields: ["triage_priority"],
	get_indicator(doc) {
		const colours = { Routine: "green", Urgent: "orange", Emergency: "red" };
		return [__(doc.triage_priority), colours[doc.triage_priority], "triage_priority,=," + doc.triage_priority];
	},
};
