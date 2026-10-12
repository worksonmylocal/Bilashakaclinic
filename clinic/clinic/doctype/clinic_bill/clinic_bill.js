frappe.ui.form.on("Clinic Bill", {
    refresh(frm) {
        if (frm.is_new()) return;
        if (frm.doc.invoice_no) {
            frm.add_custom_button(__("Print Invoice"), () => window.open(`/clinic/invoice?bill=${frm.doc.name}`, "_blank"));
        }
        if (frm.doc.receipt_no) {
            frm.add_custom_button(__("Print Receipt"), () => window.open(`/clinic/receipt?bill=${frm.doc.name}`, "_blank"));
        }
        if (frm.doc.status === "Invoiced") {
            frm.add_custom_button(__("Record Farm Payment"), () => {
                const dialog = new frappe.ui.Dialog({
                    title: __("Record Farm Payment"),
                    fields: [
                        { fieldname: "mode", label: __("Paid by"), fieldtype: "Select", options: ["Bank Transfer", "Cheque", "M-Pesa", "Cash", "Other"], default: "Bank Transfer", reqd: 1 },
                        { fieldname: "reference", label: __("Reference"), fieldtype: "Data" },
                    ],
                    primary_action_label: __("Mark as Paid"),
                    primary_action(values) {
                        frappe.call({
                            method: "clinic.api.billing_admin.record_farm_payment",
                            args: { bills: [frm.doc.name], mode: values.mode, reference: values.reference },
                            callback() { dialog.hide(); frm.reload_doc(); },
                        });
                    },
                });
                dialog.show();
            }).addClass("btn-primary");
        }
    },
});
