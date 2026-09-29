frappe.listview_settings["Clinic Dispensing"] = {
	get_indicator(doc) {
		if (doc.docstatus === 0) return [__("Pending"), "orange", "docstatus,=,0"];
		if (doc.docstatus === 1) return [__("Dispensed"), "green", "docstatus,=,1"];
		return [__("Cancelled"), "red", "docstatus,=,2"];
	},
};
