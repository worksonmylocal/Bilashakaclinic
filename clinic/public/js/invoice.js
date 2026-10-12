/* Invoice to the employer for a farm employee's visit */
(async function () {
    const { call, esc, money } = Desk;
    const bill = new URLSearchParams(location.search).get("bill");
    const msg = document.getElementById("msg"), btn = document.getElementById("print");
    if (!bill) { msg.textContent = "No invoice selected."; return; }
    let d;
    try { d = await call("documents.invoice", { bill }); } catch (e) { msg.textContent = e.message || "The invoice could not be loaded."; return; }
    const dt = (v, time) => { if (!v) return ""; const x = new Date(String(v).replace(" ", "T")); if (isNaN(x)) return String(v); const day = x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); return time ? day + ", " + x.toTimeString().slice(0, 5) : day; };
    const c = d.clinic, p = d.patient, e = d.employer || {};
    const [first, ...rest] = String(c.clinic_name || "").split(" ");
    const sub = [rest.join(" "), c.branch].filter(Boolean).join(" · ");
    const contact = [c.address && esc(c.address).replace(/\n/g, "<br>"), c.po_box && esc(c.po_box),
        [c.phone, c.alt_phone].filter(Boolean).length && "Tel: " + [c.phone, c.alt_phone].filter(Boolean).map(esc).join(" / "), c.email && esc(c.email), c.licence_no && `<b>Reg. No.</b> ${esc(c.licence_no)}`].filter(Boolean).join("<br>");
    document.title = `Invoice ${d.invoice_no}`;
    const paid = d.status === "Paid";
    document.getElementById("sheet-wrap").innerHTML = `
    <article class="sheet">
        ${paid ? "" : '<div class="wm" style="font-size:80px">INVOICE</div>'}
        <header class="rh">
            <div class="rh__brand"><img src="/assets/clinic/images/northlake-mark.svg" alt=""><div class="rh__name"><b>${esc(first)}</b><span>${esc(sub)}</span><i></i></div></div>
            <div class="rh__contact">${contact}</div>
        </header>
        <div class="rule"></div>
        <div class="titlebar"><div><h1>Invoice</h1><div class="rcpt-no">No. ${esc(d.invoice_no)}</div></div>
            ${paid ? '<div class="paid-stamp">PAID</div>' : '<div class="conf" style="border-color:var(--brand);color:var(--brand)">Payable by employer</div>'}</div>
        <section class="meta">
            <dl><dt>Bill to</dt><dd class="big">${esc(e.employer_name || d.patient.employer || "—")}</dd>
                ${e.address ? `<dt>Address</dt><dd style="white-space:pre-line">${esc(e.address)}</dd>` : ""}
                ${e.contact_person ? `<dt>Attention</dt><dd>${esc(e.contact_person)}${e.phone ? " · " + esc(e.phone) : ""}</dd>` : ""}</dl>
            <dl><dt>Invoice date</dt><dd>${esc(dt(d.invoiced_on, true))}</dd><dt>Visit</dt><dd>${esc(d.visit)} · ${esc(dt(d.visit_date))}</dd>
                <dt>Status</dt><dd>${paid ? "Paid " + esc(dt(d.paid_on)) + (d.receipt_no ? " · receipt " + esc(d.receipt_no) : "") : "<b>Outstanding</b>"}</dd></dl>
        </section>
        <section class="meta" style="margin-top:-6px;background:#faf8f2">
            <dl><dt>Employee</dt><dd class="big">${esc(p.full_name)}</dd><dt>Staff No.</dt><dd>${esc(p.staff_no || p.employee || "—")}</dd></dl>
            <dl><dt>Section</dt><dd>${esc(p.department || p.section || "—")}</dd><dt>Patient No.</dt><dd>${esc(p.name)}</dd></dl>
        </section>
        <table class="tbl" style="margin-top:6px"><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
            ${d.lines.map((l) => `<tr><td>${esc(l.description)} ${l.item_type === "Consultation" ? "" : `<span class="note" style="margin:0">${esc(l.item_type)}</span>`}</td><td class="r">${l.qty}</td><td class="r">${money(l.rate)}</td><td class="r">${money(l.amount)}</td></tr>`).join("")}
        </tbody></table>
        <table class="totals"><tr class="grand"><td>Total due</td><td style="text-align:right">${money(d.total)}</td></tr></table>
        <div class="sec" style="margin-top:18px"><h2>Terms &amp; how to pay</h2><div class="body"><div class="note" style="white-space:pre-line">${esc(d.terms || "Payable by the employer on presentation of this invoice.")}${d.payment_details ? "\n\n" + esc(d.payment_details) : ""}</div></div></div>
        <div class="certify"><div><span class="sig"></span><small>Received by (farm) · name, signature &amp; date</small></div><div><div class="stamp-box">Farm stamp</div></div></div>
        <footer class="foot"><div class="row"><span>${esc(c.clinic_name || "")}${c.branch ? " · " + esc(c.branch) : ""}</span><span>Printed ${esc(dt(d.printed_on, true))} · ${esc(d.invoice_no)}</span></div></footer>
    </article>`;
    msg.style.display = "none";
    btn.disabled = false;
    btn.addEventListener("click", () => window.print());
})();
