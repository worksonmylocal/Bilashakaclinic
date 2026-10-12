frappe.query_reports["TB Screening Register"] = {
    filters: [
        { fieldname: "from_date", label: __("From Date"), fieldtype: "Date", default: frappe.datetime.month_start(), reqd: 1 },
        { fieldname: "to_date", label: __("To Date"), fieldtype: "Date", default: frappe.datetime.get_today(), reqd: 1 },
        { fieldname: "patient_type", label: __("Patient Type"), fieldtype: "Select", options: ["", "Employee", "Community Member"], description: __("Leave blank to show both") },
        { fieldname: "source", label: __("Seen At"), fieldtype: "Select", options: ["", "Consultation", "Antenatal Clinic", "MCH & Postnatal Clinic", "TB Clinic"] },
    ],
};
