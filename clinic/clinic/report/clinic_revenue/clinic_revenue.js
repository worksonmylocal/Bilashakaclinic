frappe.query_reports["Clinic Revenue"] = {
    filters: [
        { fieldname: "from_date", label: __("From Date"), fieldtype: "Date", default: frappe.datetime.month_start(), reqd: 1 },
        { fieldname: "to_date", label: __("To Date"), fieldtype: "Date", default: frappe.datetime.get_today(), reqd: 1 },
        { fieldname: "employer", label: __("Employer"), fieldtype: "Link", options: "Clinic Employer" },
        { fieldname: "group_by", label: __("Group By"), fieldtype: "Select", options: ["Daily", "Monthly", "Employer", "Payment Method"], default: "Daily" },
    ],
};
