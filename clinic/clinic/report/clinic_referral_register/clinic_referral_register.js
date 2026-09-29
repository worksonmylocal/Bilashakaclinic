frappe.query_reports["Clinic Referral Register"] = {
	filters: [
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.month_start(),
			reqd: 1,
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1,
		},
		{
			fieldname: "patient_type",
			label: __("Patient Type"),
			fieldtype: "Select",
			options: ["", "Employee", "Community Member"],
			description: __("Leave blank to show both"),
		},
		{
			fieldname: "direction",
			label: __("Direction"),
			fieldtype: "Select",
			options: ["", "In", "Out"],
			description: __("In: referred to us. Out: referred by us."),
		},
	],
};
