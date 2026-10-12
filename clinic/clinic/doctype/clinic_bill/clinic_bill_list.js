frappe.listview_settings["Clinic Bill"] = {
	add_fields: ["status", "total"],
	get_indicator(doc) {
		const colours = { Open: "orange", Invoiced: "blue", Paid: "green", Cancelled: "gray" };
		return [__(doc.status), colours[doc.status], "status,=," + doc.status];
	},
};
