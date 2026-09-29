frappe.listview_settings["Clinic Appointment"] = {
	add_fields: ["status"],
	get_indicator(doc) {
		const colours = { Scheduled: "blue", "Checked In": "yellow", Completed: "green", Missed: "red", Cancelled: "gray" };
		return [__(doc.status), colours[doc.status], "status,=," + doc.status];
	},
};
