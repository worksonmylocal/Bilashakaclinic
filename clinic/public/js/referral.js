/* Referral letter for a sample sent to an external laboratory: laid out for A4 printing / Save as PDF */
(async function () {
    const { call, esc } = Desk;
    const test = new URLSearchParams(location.search).get("test");
    const msg = document.getElementById("msg");
    const btn = document.getElementById("print");
    if (!test) { msg.textContent = "No test selected."; return; }

    let d;
    try { d = await call("lab.referral_letter", { name: test }); }
    catch (e) { msg.textContent = e.message || "The letter could not be loaded."; return; }

    const dt = (v, time) => {
        if (!v) return "";
        const x = new Date(String(v).replace(" ", "T"));
        if (isNaN(x)) return String(v);
        const day = x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        return time ? `${day}, ${x.toTimeString().slice(0, 5)}` : day;
    };
    const c = d.clinic, p = d.patient, t = d.test, v = d.visit;
    const [first, ...rest] = String(c.clinic_name || "").split(" ");
    const sub = [rest.join(" "), c.branch].filter(Boolean).join(" · ");
    const contact = [
        c.address && esc(c.address).replace(/\n/g, "<br>"),
        c.po_box && esc(c.po_box),
        [c.phone, c.alt_phone].filter(Boolean).map(esc).join(" / ") && "Tel: " + [c.phone, c.alt_phone].filter(Boolean).map(esc).join(" / "),
        c.email && esc(c.email),
        c.licence_no && `<b>Reg. No.</b> ${esc(c.licence_no)}`,
    ].filter(Boolean).join("<br>") || '<span style="opacity:.6">Add the clinic address and phone in Clinic Settings</span>';

    document.title = `Referral Letter - ${p.full_name} - ${t.test_type} - ${t.name}`;
    document.getElementById("sheet-wrap").innerHTML = `
    <article class="sheet">
        <div class="wm">CONFIDENTIAL</div>
        <header class="rh">
            <div class="rh__brand"><img src="/assets/clinic/images/northlake-mark.svg" alt="">
                <div class="rh__name"><b>${esc(first)}</b><span>${esc(sub)}</span><i></i></div></div>
            <div class="rh__contact">${contact}</div>
        </header>
        <div class="rule"></div>
        <div class="titlebar"><h1>Laboratory Referral</h1>
            <div class="conf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Confidential</div></div>

        <section class="meta">
            <dl>
                <dt>Date</dt><dd>${esc(dt(d.printed_on))}</dd>
                <dt>To</dt><dd class="big">The Laboratory In-charge</dd>
                <dt>Facility</dt><dd><b>${esc(t.external_facility)}</b></dd>
            </dl>
            <dl>
                <dt>Our ref.</dt><dd>${esc(t.name)} · ${esc(v.name)}</dd>
                <dt>Urgency</dt><dd>${esc(t.urgency || "Routine")}</dd>
                <dt>Referred by</dt><dd>${esc(d.requested_by || "Clinic doctor")}</dd>
            </dl>
        </section>

        <p style="margin:14px 0 6px"><b>RE: Request for laboratory investigation</b></p>
        <p style="margin:0 0 12px">Dear Colleague, kindly perform the test below on the patient named and send the results back to us.</p>

        <section class="meta">
            <dl>
                <dt>Patient</dt><dd class="big">${esc(p.full_name)}</dd>
                <dt>Patient No.</dt><dd>${esc(p.name)}</dd>
                <dt>Age / Sex</dt><dd>${esc([p.age, p.sex].filter(Boolean).join(" / ") || "—")}</dd>
                <dt>Phone</dt><dd>${esc(p.phone || "—")}</dd>
                ${p.national_id ? `<dt>ID No.</dt><dd>${esc(p.national_id)}</dd>` : ""}
            </dl>
            <dl>
                <dt>Test requested</dt><dd class="big">${esc(t.test_type)}</dd>
                <dt>Category</dt><dd>${esc(t.category || "—")}</dd>
                <dt>Sample</dt><dd>${esc(t.sample_type || "—")}</dd>
                <dt>Sample collected</dt><dd>${esc(dt(t.sample_collected_on, true) || "—")}</dd>
                <dt>Sent on</dt><dd>${esc(dt(t.sent_on) || dt(d.printed_on))}</dd>
            </dl>
        </section>

        <section class="test"><div class="test__head"><b>Clinical details</b><span>${esc(dt(v.visit_date))}</span></div>
            <div class="tnote" style="display:block;border-top:1px solid var(--hair);padding:10px 12px">
                ${t.complaint ? `<p style="margin:0 0 6px"><b>Presenting complaint:</b> ${esc(t.complaint)}</p>` : ""}
                <p style="margin:0">${[t.clinical_notes, v.referral_reason].filter(Boolean).map(esc).join("<br>") || "No further clinical notes."}</p>
            </div></section>

        <p style="margin:14px 0 0">Please send the report to <b>${esc(c.clinic_name || "us")}</b>${c.phone ? ", Tel " + esc(c.phone) : ""}${c.email ? ", " + esc(c.email) : ""}. Thank you.</p>

        <div class="sign">
            <div><span class="sig"></span><small>Sent by · signature</small><b>${esc(d.printed_by)}</b>Laboratory</div>
            <div><span class="sig"></span><small>Verified by · signature &amp; stamp</small><b>${esc(c.lab_incharge || "Laboratory in-charge")}</b>${esc(c.lab_incharge_title || "")}</div>
        </div>
        <footer class="foot">
            <span class="c">CONFIDENTIAL</span> — This letter contains privileged medical information intended only for the receiving laboratory.
            If you are not the intended recipient, do not read, copy or share it; please return it to ${esc(c.clinic_name || "the clinic")}${c.phone ? " (" + esc(c.phone) + ")" : ""}.
            <div class="row"><span>${esc(c.clinic_name || "")}${c.branch ? " · " + esc(c.branch) : ""}</span><span>Printed ${esc(dt(d.printed_on, true))} by ${esc(d.printed_by)} · ${esc(t.name)}</span></div>
        </footer>
    </article>`;
    msg.style.display = "none";
    btn.disabled = false;
    btn.addEventListener("click", () => window.print());
})();
