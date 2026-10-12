frappe.query_reports["Immunization Defaulters"] = {
    filters: [
        { fieldname: "min_days_late", label: __("At Least This Many Days Late"), fieldtype: "Int", default: 0 },
    ],
};
