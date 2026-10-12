frappe.query_reports["Farm Invoices"] = {
    filters: [
        { fieldname: "from_date", label: __("From Date"), fieldtype: "Date", default: frappe.datetime.add_months(frappe.datetime.get_today(), -3), reqd: 1 },
        { fieldname: "to_date", label: __("To Date"), fieldtype: "Date", default: frappe.datetime.get_today(), reqd: 1 },
        { fieldname: "employer", label: __("Farm"), fieldtype: "Link", options: "Clinic Employer" },
        { fieldname: "status", label: __("Show"), fieldtype: "Select", options: ["Outstanding", "Paid", "All"], default: "Outstanding" },
    ],
    get_datatable_options(options) {
        return Object.assign(options, { checkboxColumn: true });
    },
    onload(report) {
        report.page.add_inner_button(__("Record Farm Payment"), () => {
            const checked = report.datatable ? report.datatable.rowmanager.getCheckedRows() : [];
            const rows = checked.map((i) => report.data[i]).filter((r) => r && r.status === "Invoiced");
            if (!rows.length) return frappe.msgprint(__("Tick the outstanding invoices the farm has paid first."));
            const total = rows.reduce((s, r) => s + (r.total || 0), 0);
            const dialog = new frappe.ui.Dialog({
                title: __("Record Farm Payment"),
                fields: [
                    { fieldtype: "HTML", options: `<p>${rows.length} invoice(s) totalling <b>${format_currency(total)}</b>${new Set(rows.map((r) => r.employer)).size > 1 ? " — <b>from more than one farm</b>" : ""}.</p>` },
                    { fieldname: "mode", label: __("Paid by"), fieldtype: "Select", options: ["Bank Transfer", "Cheque", "M-Pesa", "Cash", "Other"], default: "Bank Transfer", reqd: 1 },
                    { fieldname: "reference", label: __("Reference"), fieldtype: "Data", description: __("Cheque number, bank or M-Pesa reference") },
                ],
                primary_action_label: __("Mark as Paid"),
                primary_action(values) {
                    frappe.call({
                        method: "clinic.api.billing_admin.record_farm_payment",
                        args: { bills: rows.map((r) => r.bill), mode: values.mode, reference: values.reference },
                        callback() { dialog.hide(); frappe.show_alert({ message: __("Payment recorded"), indicator: "green" }); report.refresh(); },
                    });
                },
            });
            dialog.show();
        });
    },
};
