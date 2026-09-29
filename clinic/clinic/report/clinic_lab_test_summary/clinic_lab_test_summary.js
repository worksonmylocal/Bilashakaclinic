frappe.query_reports["Clinic Lab Test Summary"] = {
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
			fieldname: "category",
			label: __("Category"),
			fieldtype: "Select",
			options: ["", "Haematology", "Urinalysis", "Serology", "Parasitology", "Microbiology", "Biochemistry", "Other"],
		},
		{
			fieldname: "performed_where",
			label: __("Performed"),
			fieldtype: "Select",
			options: ["", "Onsite", "External"],
		},
		{
			fieldname: "test_type",
			label: __("Test"),
			fieldtype: "Link",
			options: "Clinic Lab Test Type",
		},
	],
};
