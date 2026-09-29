/* Laboratory report: fetches one visit's released results and lays them out for A4 printing */
(async function () {
    const { call, esc } = Desk;
    const visit = new URLSearchParams(location.search).get("visit");
    const msg = document.getElementById("msg");
    const btn = document.getElementById("print");
    if (!visit) { msg.textContent = "No visit selected."; return; }

    let d;
    try { d = await call("lab.report", { visit }); }
    catch (e) { msg.textContent = e.message || "The report could not be loaded."; return; }

    const dt = (v, time) => {
        if (!v) return "";
        const x = new Date(String(v).replace(" ", "T"));
        if (isNaN(x)) return String(v);
        const day = x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        return time ? `${day}, ${x.toTimeString().slice(0, 5)}` : day;
    };
    const c = d.clinic, p = d.patient, v = d.visit;
    const [first, ...rest] = String(c.clinic_name || "").split(" ");
    const sub = [rest.join(" "), c.branch].filter(Boolean).join(" · ");
    const contact = [
        c.address && esc(c.address).replace(/\n/g, "<br>"),
        c.po_box && esc(c.po_box),
        [c.phone, c.alt_phone].filter(Boolean).map(esc).join(" / ") && "Tel: " + [c.phone, c.alt_phone].filter(Boolean).map(esc).join(" / "),
        c.email && esc(c.email),
        c.website && esc(c.website),
        c.licence_no && `<b>Reg. No.</b> ${esc(c.licence_no)}`,
    ].filter(Boolean).join("<br>") || '<span style="opacity:.6">Add the clinic address and phone in Clinic Settings</span>';

    const firstCollected = d.tests.map((t) => t.sample_collected_on || t.requested_on).filter(Boolean).sort()[0];
    const lastResulted = d.tests.map((t) => t.resulted_on).filter(Boolean).sort().slice(-1)[0];
    const referred = v.referring_facility;
    const techs = [...new Set(d.tests.map((t) => t.technician_name).filter(Boolean))].join(", ");

    const flagText = (f) => ({ High: "H", Low: "L", Positive: "POS", Abnormal: "ABN" }[f] || (f === "Normal" || f === "Negative" ? "" : ""));
    // Grading scales (Negative / Trace / + / ++ ...) print as just their normal value
    const shortRef = (ref) => { const o = String(ref || "").split(" / "); return o.length > 3 ? o[0] : (ref || ""); };
    const abnormal = (f) => ["High", "Low", "Positive", "Abnormal"].includes(f);

    const testHtml = d.tests.map((t) => {
        const rows = t.results.map((r) => `<tr class="${abnormal(r.flag) ? "abn" : ""}">
            <td>${esc(r.parameter)}</td><td class="res">${esc(r.value)}</td><td>${esc(r.unit || "")}</td>
            <td class="ref">${esc(shortRef(r.reference))}</td><td class="flag">${esc(flagText(r.flag))}</td></tr>`).join("");
        const overall = t.interpretation
            ? `<span>Overall: <span class="overall ${["Positive", "Abnormal"].includes(t.interpretation) ? "bad" : "ok"}">${esc(t.interpretation)}</span></span>` : "";
        return `<section class="test">
            <div class="test__head"><b>${esc(t.test_type)}</b><span>${esc([t.category, t.sample_type && "Sample: " + t.sample_type].filter(Boolean).join("  ·  "))}</span></div>
            ${rows ? `<table class="rtab"><thead><tr><th style="width:32%">Parameter</th><th style="width:22%">Result</th><th style="width:12%">Unit</th><th>Reference range</th><th style="width:9%">Flag</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
            <div class="tnote" ${rows ? "" : 'style="border-top:1px solid var(--hair);border-radius:0 0 6px 6px"'}>
                ${overall}
                ${t.result_comments ? `<span><b>Comment:</b> ${esc(t.result_comments)}</span>` : ""}
                ${t.performed_where === "External" ? `<span><b>Performed at:</b> ${esc(t.external_facility || "external laboratory")}</span>` : ""}
                <span><b>Reported:</b> ${esc(dt(t.resulted_on, true))}</span>
            </div></section>`;
    }).join("");

    document.title = `Lab Report - ${p.full_name} - ${v.name}`;
    document.getElementById("sheet-wrap").innerHTML = `
    <article class="sheet">
        <div class="wm">CONFIDENTIAL</div>
        <header class="rh">
            <div class="rh__brand"><img src="/assets/clinic/images/northlake-mark.svg" alt="">
                <div class="rh__name"><b>${esc(first)}</b><span>${esc(sub)}</span><i></i></div></div>
            <div class="rh__contact">${contact}</div>
        </header>
        <div class="rule"></div>
        <div class="titlebar"><h1>Laboratory Report</h1>
            <div class="conf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Confidential</div></div>
        <section class="meta">
            <dl>
                <dt>Patient</dt><dd class="big">${esc(p.full_name)}</dd>
                <dt>Patient No.</dt><dd>${esc(p.name)}</dd>
                <dt>Age / Sex</dt><dd>${esc([p.age, p.sex].filter(Boolean).join(" / ") || "—")}</dd>
                <dt>Phone</dt><dd>${esc(p.phone || "—")}</dd>
                ${p.national_id ? `<dt>ID No.</dt><dd>${esc(p.national_id)}</dd>` : ""}
            </dl>
            <dl>
                <dt>Report No.</dt><dd>${esc(v.name)}</dd>
                <dt>Collected</dt><dd>${esc(dt(firstCollected, true))}</dd>
                <dt>Reported</dt><dd>${esc(dt(lastResulted, true))}</dd>
                <dt>${referred ? "Referred by" : "Requested by"}</dt><dd>${esc(referred ? [v.referring_clinician, v.referring_facility].filter(Boolean).join(", ") : "Clinic doctor")}</dd>
                ${v.referral_reason ? `<dt>Clinical details</dt><dd>${esc(v.referral_reason)}</dd>` : ""}
            </dl>
        </section>
        ${d.pending ? `<div class="pending">${d.pending} more test${d.pending > 1 ? "s are" : " is"} still in progress for this patient and will be reported separately.</div>` : ""}
        ${testHtml}
        <div class="legend">H = above reference range · L = below reference range · POS = positive · ABN = abnormal. Results outside the range are shown in bold red.</div>
        <div class="sign">
            <div><span class="sig"></span><small>Reported by · signature</small><b>${esc(techs || "—")}</b>Laboratory technologist</div>
            <div><span class="sig"></span><small>Verified by · signature &amp; stamp</small><b>${esc(c.lab_incharge || "Laboratory in-charge")}</b>${esc(c.lab_incharge_title || "")}</div>
        </div>
        <footer class="foot">
            <span class="c">CONFIDENTIAL</span> — This report contains privileged medical information intended only for the patient named above and their referring clinician.
            If you are not the intended recipient, do not read, copy or share it; please return it to ${esc(c.clinic_name || "the clinic")}${c.phone ? " (" + esc(c.phone) + ")" : ""}.
            ${c.report_footer_note ? `<div style="margin-top:3px">${esc(c.report_footer_note)}</div>` : ""}
            <div class="row"><span>${esc(c.clinic_name || "")}${c.branch ? " · " + esc(c.branch) : ""}</span><span>Printed ${esc(dt(d.printed_on, true))} by ${esc(d.printed_by)} · ${esc(v.name)}</span></div>
        </footer>
    </article>`;
    msg.style.display = "none";
    btn.disabled = false;
    btn.addEventListener("click", () => window.print());
})();
