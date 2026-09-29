frappe.query_reports["Clinic Visit Summary"] = {
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
			fieldname: "group_by",
			label: __("Group By"),
			fieldtype: "Select",
			options: ["Daily", "Weekly", "Monthly"],
			default: "Daily",
		},
	],
};
