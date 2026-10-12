/* Sick sheet: the patient's whole journey on one confidential document */
(async function () {
    const { call, esc, money } = Desk;
    const visit = new URLSearchParams(location.search).get("visit");
    const msg = document.getElementById("msg"), btn = document.getElementById("print");
    if (!visit) { msg.textContent = "No visit selected."; return; }
    let d;
    try { d = await call("documents.sick_sheet", { visit }); } catch (e) { msg.textContent = e.message || "The sick sheet could not be loaded."; return; }

    const parse = (v) => new Date(String(v).replace(" ", "T"));
    const day = (v) => (v ? parse(v).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "");
    const dt = (v) => { if (!v) return ""; const x = parse(v); return isNaN(x) ? String(v) : x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + x.toTimeString().slice(0, 5); };
    const c = d.clinic, p = d.patient, t = d.triage, con = d.consultation, att = d.attendance, s = d.signer;
    const [first, ...rest] = String(c.clinic_name || "").split(" ");
    const sub = [rest.join(" "), c.branch].filter(Boolean).join(" · ");
    const contact = [
        c.address && esc(c.address).replace(/\n/g, "<br>"), c.po_box && esc(c.po_box),
        [c.phone, c.alt_phone].filter(Boolean).length && "Tel: " + [c.phone, c.alt_phone].filter(Boolean).map(esc).join(" / "),
        c.email && esc(c.email), c.licence_no && `<b>Reg. No.</b> ${esc(c.licence_no)}`,
    ].filter(Boolean).join("<br>") || '<span style="opacity:.6">Add the clinic address and phone in Clinic Settings</span>';
    const row = (label, value) => (value ? `<dt>${label}</dt><dd>${esc(value)}</dd>` : "");
    const abn = (f) => ["High", "Low", "Positive", "Abnormal"].includes(f);
    const flagText = (f) => ({ High: "H", Low: "L", Positive: "POS", Abnormal: "ABN" }[f] || "");
    const shortRef = (ref) => { const o = String(ref || "").split(" / "); return o.length > 3 ? o[0] : (ref || ""); };

    // ---- 1. Triage
    const vt = (label, v, unit, bad) => (v ? `<div class="vt ${bad ? "bad" : ""}"><small>${label}</small><b>${esc(v)}</b> <span class="note" style="margin:0">${unit}</span></div>` : "");
    const triage = t ? `<div class="vgrid">
            ${vt("BP", t.bp_systolic ? `${t.bp_systolic}/${t.bp_diastolic}` : "", "mmHg", t.bp_systolic >= 140 || t.bp_diastolic >= 90)}
            ${vt("Pulse", t.pulse_rate, "bpm", t.pulse_rate > 100 || t.pulse_rate < 60)}
            ${vt("Temperature", t.temperature, "°C", t.temperature >= 38)}
            ${vt("SpO₂", t.spo2, "%", t.spo2 < 95)}
            ${vt("Resp. rate", t.respiratory_rate, "/min")}
            ${vt("Weight", t.weight_kg, "kg")} ${vt("Height", t.height_cm, "cm")} ${vt("BMI", t.bmi, t.bmi_category || "")} ${vt("Glucose", t.blood_glucose, "mmol/L")}
        </div>
        <dl class="kv">${row("Complaint", t.chief_complaint)}${row("Nurse notes", t.triage_notes)}${row("Triaged", dt(t.triage_datetime))}</dl>`
        : '<div class="note">No triage recorded.</div>';

    // ---- 2. Consultation (or clinic attendance)
    const clinical = con ? `<dl class="kv">
            ${row("Presenting complaint", con.presenting_complaint)}${row("History", con.history_of_presenting_illness)}
            ${row("Examination", [con.general_examination, con.systemic_examination].filter(Boolean).join("\n"))}
            ${row("Other findings", con.investigations_notes)}
            <dt>Diagnosis</dt><dd>${d.diagnoses.length ? d.diagnoses.map((x) => `<b>${esc(x.diagnosis)}</b>${x.type === "Provisional" ? " (provisional)" : ""}`).join("<br>") : "—"}</dd>
            ${row("Management", con.management_plan)}${row("Procedures", con.procedures_done)}${row("Advice", con.patient_advice)}
            ${con.work_related ? row("Work-related", "Yes: condition or injury related to duty") : ""}
            ${con.refer_out ? row("Referred to", [con.referral_facility, con.referral_reason].filter(Boolean).join(" — ")) : ""}
        </dl>` : att ? `<dl class="kv">${row("Clinic", att.clinic_unit)}${row("Service", att.service_type)}${row("Assessment", att.assessment_notes)}${row("Management", att.management_plan)}${row("Advice", att.patient_advice)}</dl>`
        : '<div class="note">Not seen by the doctor.</div>';

    // ---- 3. Laboratory
    const labs = d.labs.length ? d.labs.map((l) => {
        if (l.withheld) return `<div class="note" style="margin-bottom:4px"><b>${esc(l.test_type)}</b> — done. Result is confidential and was given to the patient directly.</div>`;
        if (l.status !== "Resulted") return `<div class="note" style="margin-bottom:4px"><b>${esc(l.test_type)}</b> — ${esc(l.status.toLowerCase())}.</div>`;
        return `<table class="tbl" style="margin-bottom:6px"><thead><tr><th colspan="4" style="background:#eef3f0;color:var(--brand)">${esc(l.test_type)}${l.interpretation ? " — " + esc(l.interpretation) : ""}</th></tr>
            <tr><th style="width:34%">Parameter</th><th>Result</th><th>Reference</th><th style="width:8%">Flag</th></tr></thead><tbody>
            ${l.results.map((r) => `<tr class="${abn(r.flag) ? "abn" : ""}"><td>${esc(r.parameter)}</td><td><b>${esc(r.value)}</b> ${esc(r.unit || "")}</td><td>${esc(shortRef(r.reference))}</td><td>${esc(flagText(r.flag))}</td></tr>`).join("")}</tbody></table>
            ${l.result_comments ? `<div class="note">Lab comment: ${esc(l.result_comments)}</div>` : ""}`;
    }).join("") : '<div class="note">No laboratory tests were done.</div>';

    // ---- 4. Pharmacy
    const meds = d.medicines.length ? `<table class="tbl"><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th class="r">Days</th><th class="r">Qty given</th></tr></thead><tbody>
            ${d.medicines.map((m) => `<tr><td><b>${esc(m.drug_name || m.drug)}</b>${m.instructions ? `<br><span class="note" style="margin:0">${esc(m.instructions)}</span>` : ""}</td><td>${esc(m.dose || "")}${m.route && m.route !== "Oral" ? " (" + esc(m.route) + ")" : ""}</td><td>${esc(m.frequency || "")}</td><td class="r">${m.duration_days || ""}</td><td class="r">${m.dispensed_qty} ${esc(m.uom || "")}</td></tr>`).join("")}</tbody></table>`
        : '<div class="note">No medicines dispensed.</div>';
    const external = d.unavailable.length ? `<div class="note warn" style="margin-top:6px"><b>Prescribed but not available at the clinic pharmacy — buy from a pharmacy of your choice:</b>
        ${d.unavailable.map((m) => `${esc(m.drug_name || m.drug)}${m.dose ? " " + esc(m.dose) : ""}${m.frequency ? ", " + esc(m.frequency) : ""}${m.duration_days ? " × " + m.duration_days + " days" : ""} (${m.prescribed_qty} ${esc(m.uom || "")})`).join("; ")}.</div>` : "";

    // ---- 5. Recommendation
    const follow = con && con.follow_up_required && con.follow_up_date ? `Review on <b>${day(con.follow_up_date)}</b>${con.follow_up_reason ? " (" + esc(con.follow_up_reason) + ")" : ""}.` : "";
    const rest_box = d.sick_days
        ? `<div class="big">Excused from duty for ${d.sick_days} day${d.sick_days > 1 ? "s" : ""}</div>From <b>${day(d.off_from)}</b> to <b>${day(d.off_to)}</b>. Resume duty on <b>${day(d.back_on)}</b>.`
        : `<div class="big">No sick-off days recommended</div>`;
    const light = d.light_duty_days ? `<div style="margin-top:4px">Light duty / restricted work recommended for <b>${d.light_duty_days} day${d.light_duty_days > 1 ? "s" : ""}</b> after resuming.</div>` : "";

    // ---- 6. Charges
    const b = d.bill;
    const charges = b && b.lines.length ? `<table class="tbl"><thead><tr><th>Charge</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
            ${b.lines.map((l) => `<tr><td>${esc(l.description)} ${l.item_type === "Consultation" ? "" : `<span class="note" style="margin:0">${esc(l.item_type)}</span>`}</td><td class="r">${l.qty}</td><td class="r">${money(l.rate)}</td><td class="r">${money(l.amount)}</td></tr>`).join("")}
            <tr class="tot"><td colspan="3">Total</td><td class="r">${money(b.total)}</td></tr></tbody></table>
            <div class="note">${b.billing_mode === "Invoice" ? `Invoiced to ${esc(d.visit.employer || "the employer")} — invoice ${esc(b.invoice_no || "")}${b.status === "Paid" ? " (paid)" : ""}` : b.status === "Paid" ? `Paid — receipt ${esc(b.receipt_no || "")}` : "Payment pending"}</div>` : '<div class="note">No charges.</div>';

    document.title = `Sick Sheet - ${p.full_name} - ${d.visit.name}`;
    if (!s.can_sign) {
        const w = document.getElementById("warn");
        w.style.display = ""; w.innerHTML = `<b>Not yet signable:</b> ${esc(s.name || "The clinician")} has no Doctor or Clinical Officer profile. Add one under <b>Clinic Staff Profile</b> (with the registration number) so the sheet carries the right credentials.`;
    }

    document.getElementById("sheet-wrap").innerHTML = `
    <article class="sheet">
        <div class="wm">CONFIDENTIAL</div>
        <header class="rh">
            <div class="rh__brand"><img src="/assets/clinic/images/northlake-mark.svg" alt=""><div class="rh__name"><b>${esc(first)}</b><span>${esc(sub)}</span><i></i></div></div>
            <div class="rh__contact">${contact}</div>
        </header>
        <div class="rule"></div>
        <div class="titlebar"><h1>Sick Sheet</h1>
            <div class="conf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Confidential</div></div>
        <section class="meta">
            <dl>
                <dt>Employee</dt><dd class="big">${esc(p.full_name)}</dd>
                <dt>Employer</dt><dd>${esc(d.visit.employer || p.employer || "—")}</dd>
                <dt>Staff No.</dt><dd>${esc(p.staff_no || p.employee || "—")}</dd>
                <dt>Section</dt><dd>${esc(p.department || p.section || "—")}</dd>
            </dl>
            <dl>
                <dt>Age / Sex</dt><dd>${esc([p.age, p.sex].filter(Boolean).join(" / ") || "—")}</dd>
                <dt>Patient No.</dt><dd>${esc(p.name)}</dd>
                <dt>Visit No.</dt><dd>${esc(d.visit.name)}</dd>
                <dt>Date seen</dt><dd>${esc(dt(d.seen_on))}</dd>
            </dl>
        </section>
        <section class="sec"><h2>1 · Triage — vital signs</h2><div class="body">${triage}</div></section>
        <section class="sec"><h2>2 · ${con ? "Consultation" : "Clinic attendance"}</h2><div class="body">${clinical}</div></section>
        <section class="sec"><h2>3 · Laboratory</h2><div class="body">${labs}</div></section>
        <section class="sec"><h2>4 · Pharmacy</h2><div class="body">${meds}${external}</div></section>
        <section class="sec"><h2>5 · Recommendation</h2><div class="body"><div class="rest">${rest_box}${light}${follow ? `<div style="margin-top:4px">${follow}</div>` : ""}</div></div></section>
        <section class="sec"><h2>6 · Charges</h2><div class="body">${charges}</div></section>
        <div class="certify">
            <div><span class="sig">${s.signature ? `<img src="${esc(s.signature)}" alt="">` : ""}</span>
                <small>Examined and certified by</small><b>${esc(s.name || "—")}</b>
                <div class="note" style="margin:0">${esc([s.designation, s.registration_no && "Reg. No. " + s.registration_no].filter(Boolean).join(" · ") || "Doctor / Clinical Officer")}</div></div>
            <div><div class="stamp-box">Clinic stamp</div></div>
        </div>
        <footer class="foot">
            <span class="c">CONFIDENTIAL</span> — This sick sheet contains privileged medical information about the employee named above. It is issued to the employee for their employer's records only; anyone else must not read, copy or share it.
            <div class="row"><span>${esc(c.clinic_name || "")}${c.branch ? " · " + esc(c.branch) : ""}</span><span>Printed ${esc(dt(d.printed_on))} by ${esc(d.printed_by)} · ${esc(d.visit.name)}</span></div>
        </footer>
    </article>`;
    msg.style.display = "none";
    btn.disabled = false;
    btn.addEventListener("click", () => window.print());
})();
