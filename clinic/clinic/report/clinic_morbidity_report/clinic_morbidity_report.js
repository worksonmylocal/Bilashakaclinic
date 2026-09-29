frappe.query_reports["Clinic Morbidity Report"] = {
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
			fieldname: "department",
			label: __("Department / Farm Section"),
			fieldtype: "Link",
			options: "Department",
		},
		{
			fieldname: "category",
			label: __("Category"),
			fieldtype: "Select",
			options: ["", "Infectious", "Respiratory", "Gastrointestinal", "Cardiovascular/Metabolic", "Musculoskeletal", "Skin", "Eye/ENT", "Genito-urinary/Reproductive", "Injury/Poisoning", "Mental Health", "Other"],
		},
		{
			fieldname: "diagnosis_type",
			label: __("Diagnosis Type"),
			fieldtype: "Select",
			options: ["", "Provisional", "Confirmed"],
		},
		{
			fieldname: "occupational_only",
			label: __("Occupational Conditions Only"),
			fieldtype: "Check",
		},
	],
};
