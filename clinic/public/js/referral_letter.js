/* Referral letter for a patient sent to another facility: laid out for A4 printing / Save as PDF */
(async function () {
    const { call, esc } = Desk;
    const visit = new URLSearchParams(location.search).get("visit");
    const msg = document.getElementById("msg");
    const btn = document.getElementById("print");
    if (!visit) { msg.textContent = "No visit selected."; return; }

    let d;
    try { d = await call("documents.patient_referral", { visit }); }
    catch (e) { msg.textContent = e.message || "The letter could not be loaded."; return; }

    const dt = (v, time) => {
        if (!v) return "";
        const x = new Date(String(v).replace(" ", "T"));
        if (isNaN(x)) return String(v);
        const day = x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        return time ? `${day}, ${x.toTimeString().slice(0, 5)}` : day;
    };
    const c = d.clinic, p = d.patient, r = d.referral, t = d.triage || {}, s = d.summary || {}, cl = d.clinician || {};
    const [first, ...rest] = String(c.clinic_name || "").split(" ");
    const sub = [rest.join(" "), c.branch].filter(Boolean).join(" · ");
    const contact = [
        c.address && esc(c.address).replace(/\n/g, "<br>"), c.po_box && esc(c.po_box),
        [c.phone, c.alt_phone].filter(Boolean).map(esc).join(" / ") && "Tel: " + [c.phone, c.alt_phone].filter(Boolean).map(esc).join(" / "),
        c.email && esc(c.email), c.licence_no && `<b>Reg. No.</b> ${esc(c.licence_no)}`,
    ].filter(Boolean).join("<br>") || '<span style="opacity:.6">Add the clinic address and phone in Clinic Settings</span>';
    const vitals = [
        t.bp_systolic && `BP ${t.bp_systolic}/${t.bp_diastolic} mmHg`, t.pulse_rate && `Pulse ${t.pulse_rate} bpm`, t.temperature && `Temp ${t.temperature} °C`,
        t.spo2 && `SpO₂ ${t.spo2}%`, t.respiratory_rate && `RR ${t.respiratory_rate}/min`, t.weight_kg && `Weight ${t.weight_kg} kg`,
    ].filter(Boolean).join("  ·  ");
    const row = (label, value) => (value ? `<p style="margin:0 0 6px"><b>${label}:</b> ${esc(value).replace(/\n/g, "<br>")}</p>` : "");
    const dx = d.diagnoses.map((x) => esc(x.diagnosis) + (x.type ? ` <i>(${esc(x.type)})</i>` : "")).join("; ");
    const rx = d.prescriptions.map((x) => esc([x.drug, x.dose, x.frequency, x.days ? x.days + " days" : ""].filter(Boolean).join(" "))).join("<br>");
    const labs = d.labs.map((x) => `<b>${esc(x.test_type)}</b>: ${x.results && x.results.length ? esc(x.results.join("; ")) : esc(x.interpretation || x.status)}${x.interpretation && x.results.length ? ` (${esc(x.interpretation)})` : ""}`).join("<br>");
    const anc = s.gestation != null ? `${s.gestation} weeks' gestation${s.edd ? ", EDD " + dt(s.edd) : ""}${s.gravida ? ", G" + s.gravida + "P" + (s.parity || 0) : ""}` : "";

    document.title = `Referral Letter - ${p.full_name} - ${d.visit.name}`;
    document.getElementById("sheet-wrap").innerHTML = `
    <article class="sheet">
        <div class="wm">CONFIDENTIAL</div>
        <header class="rh">
            <div class="rh__brand"><img src="/assets/clinic/images/northlake-mark.svg" alt="">
                <div class="rh__name"><b>${esc(first)}</b><span>${esc(sub)}</span><i></i></div></div>
            <div class="rh__contact">${contact}</div>
        </header>
        <div class="rule"></div>
        <div class="titlebar"><h1>Referral Letter</h1>
            <div class="conf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Confidential</div></div>

        <section class="meta">
            <dl>
                <dt>Date</dt><dd>${esc(dt(d.printed_on))}</dd>
                <dt>To</dt><dd class="big">The Medical Officer in Charge</dd>
                <dt>Facility</dt><dd><b>${esc(r.facility || "—")}</b></dd>
            </dl>
            <dl>
                <dt>Our ref.</dt><dd>${esc(d.visit.name)}</dd>
                <dt>Urgency</dt><dd>${esc(r.urgency || "Routine")}</dd>
                <dt>Referred by</dt><dd>${esc(cl.name || "Clinic doctor")}</dd>
            </dl>
        </section>

        <p style="margin:14px 0 6px"><b>RE: Referral of ${esc(p.full_name)}</b></p>
        <p style="margin:0 0 12px">Dear Colleague, kindly see and manage the patient below, whom we are referring to your facility. A summary of the care given here follows.</p>

        <section class="meta">
            <dl>
                <dt>Patient</dt><dd class="big">${esc(p.full_name)}</dd>
                <dt>Patient No.</dt><dd>${esc(p.name)}</dd>
                <dt>Age / Sex</dt><dd>${esc([p.age, p.sex].filter(Boolean).join(" / ") || "—")}</dd>
            </dl>
            <dl>
                <dt>Phone</dt><dd>${esc(p.phone || "—")}</dd>
                ${p.national_id ? `<dt>ID No.</dt><dd>${esc(p.national_id)}</dd>` : ""}
                <dt>Allergies</dt><dd>${esc(p.allergies || s.allergies || "None recorded")}</dd>
            </dl>
        </section>

        <section class="test"><div class="test__head"><b>Reason for referral</b><span>${esc(dt(d.visit.visit_date))}</span></div>
            <div class="tnote" style="display:block;border-top:1px solid var(--hair);padding:10px 12px">
                ${row("Reason", r.reason)}${row("Notes", r.notes)}${!r.reason && !r.notes ? "<p style='margin:0'>For further management.</p>" : ""}
            </div></section>

        <section class="test" style="margin-top:10px"><div class="test__head"><b>Clinical summary</b><span>${esc(s.service || "Consultation")}</span></div>
            <div class="tnote" style="display:block;border-top:1px solid var(--hair);padding:10px 12px">
                ${row("Presenting complaint", s.complaint || t.chief_complaint)}${row("History", s.history)}${row("Vitals at triage", vitals)}${row("Examination", s.examination)}
                ${anc ? row("Pregnancy", anc) : ""}${row("Complications", s.complications)}
                ${dx ? `<p style="margin:0 0 6px"><b>Diagnosis:</b> ${dx}</p>` : ""}${row("Impression", s.impression)}
                ${row("Management so far", s.management)}${row("Procedures done", s.procedures)}
                ${rx ? `<p style="margin:0 0 6px"><b>Medication prescribed:</b><br>${rx}</p>` : ""}
                ${labs ? `<p style="margin:0 0 6px"><b>Investigations:</b><br>${labs}</p>` : ""}
            </div></section>

        <p style="margin:14px 0 0">Please send your findings and any discharge summary to <b>${esc(c.clinic_name || "us")}</b>${c.phone ? ", Tel " + esc(c.phone) : ""}${c.email ? ", " + esc(c.email) : ""}. Thank you.</p>

        <div class="sign">
            <div>${cl.signature ? `<img src="${esc(cl.signature)}" alt="" style="height:44px;display:block;margin-bottom:-10px">` : ""}<span class="sig"></span><small>Referring clinician · signature</small><b>${esc(cl.name || "—")}</b>${esc([cl.designation, cl.registration_no && "Reg. " + cl.registration_no].filter(Boolean).join(" · "))}</div>
            <div><span class="sig"></span><small>Stamp</small><b>${esc(c.clinic_name || "")}</b></div>
        </div>
        <footer class="foot">
            <span class="c">CONFIDENTIAL</span> — This letter contains privileged medical information intended only for the receiving clinician.
            If you are not the intended recipient, do not read, copy or share it; please return it to ${esc(c.clinic_name || "the clinic")}${c.phone ? " (" + esc(c.phone) + ")" : ""}.
            <div class="row"><span>${esc(c.clinic_name || "")}${c.branch ? " · " + esc(c.branch) : ""}</span><span>Printed ${esc(dt(d.printed_on, true))} by ${esc(d.printed_by)} · ${esc(d.visit.name)}</span></div>
        </footer>
    </article>`;
    msg.style.display = "none";
    btn.disabled = false;
    btn.addEventListener("click", () => window.print());
})();
