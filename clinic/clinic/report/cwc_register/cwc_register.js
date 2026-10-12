frappe.query_reports["CWC Register"] = {
    filters: [
        { fieldname: "from_date", label: __("Registered From"), fieldtype: "Date", default: frappe.datetime.add_months(frappe.datetime.get_today(), -24), reqd: 1 },
        { fieldname: "to_date", label: __("Registered To"), fieldtype: "Date", default: frappe.datetime.get_today(), reqd: 1 },
        { fieldname: "status", label: __("Status"), fieldtype: "Select", options: ["", "Active", "Transferred Out", "Completed", "Deceased", "Inactive"], default: "Active" },
        { fieldname: "sex", label: __("Sex"), fieldtype: "Select", options: ["", "Male", "Female"] },
        { fieldname: "village", label: __("Residence / Village"), fieldtype: "Data" },
        { fieldname: "defaulters_only", label: __("Defaulters Only"), fieldtype: "Check" },
    ],
    formatter(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);
        if (column.fieldname === "overdue_count" && data && data.overdue_count > 0) {
            value = `<span style="color:var(--red-600,#c4302b);font-weight:600">${value}</span>`;
        }
        return value;
    },
};
