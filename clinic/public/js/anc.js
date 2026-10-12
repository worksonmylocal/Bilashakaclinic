/* Antenatal clinic: the ANC register entry (ANC number) and the ANC attendance form.
   Loaded by the Antenatal desk; clinic_unit.js calls into window.ANC. */
window.ANC = (function () {
    const { call, $, $$, esc, dateOf, pill, toast, modal, field, read, banner } = Desk;

    const api = (method, args = {}) => call("anc." + method, args);
    const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    const csv = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
    const num = (v) => (v == null || v === "" || Number(v) === 0 ? "" : v);
    const opts = (arr) => arr.map((v) => ({ value: v, label: v || "—" }));

    const PRESENTATION = ["", "Cephalic", "Breech", "Transverse", "Oblique", "N/A (<28 weeks)"];
    const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const UPROT = ["", "Negative", "Trace", "1+", "2+", "3+", "4+"];
    const UGLU = ["", "Negative", "Trace", "1+", "2+", "3+"];
    const SYPH = ["", "Reactive", "Non-Reactive", "Not Done"];
    const HIV_PRIOR = ["", "Positive", "Negative", "Unknown"];
    const HIV_TEST = ["", "Tested Negative", "Tested Positive", "Declined", "Not Done"];
    const HIV_FINAL = ["", "Negative", "Positive", "Unknown"];
    const ART = ["", "Already on ART before ANC", "Started ART at ANC", "Refused ART", "N/A (Negative)"];
    const P_HIV = ["", "Negative", "Positive", "Unknown / Not Tested"];
    const P_ART = ["", "On ART", "Not on ART", "N/A"];
    const IPTP = ["", "IPTp 1", "IPTp 2", "IPTp 3", "IPTp 4", "IPTp 5+", "None / Endemic Area Only"];
    const TT = ["", "TT1", "TT2", "TT3", "TT4", "TT5", "Fully Immunized / N/A"];
    const COMPLICATIONS = ["Severe Preeclampsia / Eclampsia", "Antepartum Hemorrhage (APH)", "Severe Anemia", "Gestational Diabetes", "None"];
    const REFERRALS = ["", "Referred to High-Risk Clinic / Consultant", "Referred to Laboratory", "Referred to Tertiary / Higher Facility", "Referred to CCC (Comprehensive Care Centre)", "None"];
    const HIGH_RISK = REFERRALS[1], LAB = REFERRALS[2], EXTERNAL = [REFERRALS[3], REFERRALS[4]];
    const REFERRAL_HELP = {
        [HIGH_RISK]: "Seen by the doctor in this centre: press <b>Refer to Doctor</b> to hand her over.",
        [LAB]: "Request the tests on the <b>Investigations</b> tab and press <b>Send to Lab</b>. Results return to this desk.",
    };

    const muacCategory = (cm) => (!cm ? "" : cm < 19 ? "SAM (<19.0 cm)" : cm < 23 ? "Underweight/MAM (<23.0 cm)" : "Normal (>=23.0 cm)");
    const gestation = (lmp) => (lmp ? Math.max(Math.floor((Date.now() - new Date(lmp).getTime()) / (7 * 86400000)), 0) : null);
    const eddOf = (lmp) => (lmp ? new Date(new Date(lmp).getTime() + 280 * 86400000).toISOString().slice(0, 10) : "");

    // ---------------------------------------------------------------- registration (section 1)
    function registerForm(patient, suggested, onDone) {
        modal({
            title: "Open ANC register entry",
            sub: "Recorded once. It carries over to every later visit.",
            size: "wide",
            body: `${banner(patient)}
                <div class="grid-3">
                    ${field("anc_no", "ANC No.", { required: true, value: suggested, help: "The number already in the client's ANC booklet. Overwrite the suggestion if she has one." })}
                    ${field("registration_date", "Date of registration", { type: "date", value: today(), required: true })}
                    ${field("village", "Residence / village / estate", { value: patient.village || "" })}
                </div>
                <div class="grid-3">
                    ${field("phone", "Client phone number", { value: patient.phone || "", required: true })}
                    ${field("partner_name", "Next of kin / partner name", { value: patient.next_of_kin || "" })}
                    ${field("partner_phone", "Next of kin phone number", { value: patient.next_of_kin_phone || "" })}
                </div>`,
            foot: [
                { label: "Cancel" },
                { label: "Open register entry", cls: "btn--primary", onClick: async (hh) => {
                    const v = read(hh.body);
                    if (!v.anc_no.trim()) return toast("Enter the ANC number", "warn");
                    if (!v.phone.trim()) return toast("Enter the client's phone number", "warn");
                    const r = await api("register", { data: { ...v, patient: patient.name } });
                    toast(`Registered · ${r.record.anc_no} · serial ${r.record.serial_no}`);
                    hh.close();
                    onDone(r);
                } },
            ],
        });
    }

    function editDetails(c, onChange) {
        modal({
            title: "ANC register details",
            sub: `${esc(c.client_name)} · ${esc(c.anc_no || "")}`,
            size: "wide",
            body: `<div class="grid-3">
                    ${field("anc_no", "ANC No.", { value: c.anc_no, required: true })}
                    ${field("village", "Residence / village / estate", { value: c.village })}
                    ${field("status", "Register status", { type: "select", options: ["Active", "Delivered", "Miscarriage / Abortion", "Transferred Out", "Inactive"], value: c.status,
                        help: "Choose Delivered (or another outcome) when the pregnancy ends, so the next pregnancy gets a new entry." })}
                </div>
                <div class="grid-3">
                    ${field("phone", "Client phone number", { value: c.phone, required: true })}
                    ${field("partner_name", "Next of kin / partner name", { value: c.partner_name })}
                    ${field("partner_phone", "Next of kin phone number", { value: c.partner_phone })}
                </div>
                ${field("exit_notes", "Outcome notes", { type: "textarea", rows: 2, value: c.exit_notes })}`,
            foot: [{ label: "Cancel" }, { label: "Save details", cls: "btn--primary", onClick: async (hh) => {
                const v = read(hh.body);
                if (!v.phone.trim()) return toast("The client's phone number is required", "warn");
                const record = await api("save_record", { record: c.name, data: v });
                toast("Register details saved");
                hh.close();
                onChange({ registered: true, record });
            } }],
        });
    }

    function renderHeader(el, ctx, { kind, locked, age, onChange }) {
        if (!ctx) { el.innerHTML = ""; return; }
        if (!ctx.registered) {
            const prev = ctx.previous;
            el.innerHTML = `<div class="cwchead cwchead--new">
                <div><span class="tag tag--com">New client</span>
                <p style="margin:8px 0 0;color:var(--ink-3)">This client has no active ANC register entry. Enter the ANC number from her booklet to open one. After this, every visit fills itself in.</p>
                ${prev ? `<p class="printnote" style="margin:6px 0 0">Earlier entry ${esc(prev.anc_no)} is ${esc(prev.status)}.</p>` : ""}</div>
                ${locked ? "" : '<button class="btn btn--primary" id="anc-register">Enter ANC number &amp; register</button>'}</div>`;
            const btn = $("#anc-register", el);
            if (btn) btn.addEventListener("click", () => registerForm(ctx.patient, ctx.suggested_anc_no, (r) => onChange(r)));
            return;
        }
        const c = ctx.record;
        el.innerHTML = `<div class="cwcbar">
                <div><small>Visit</small><b>${kind === "Revisit" ? '<span class="tag tag--emp">Revisit</span>' : '<span class="tag tag--com">New client</span>'}</b></div>
                <div><small>ANC No.</small><b>${esc(c.anc_no || "—")}</b></div>
                <div><small>Serial</small><b>${esc(c.serial_no || "—")}</b></div>
                <div><small>Client</small><b>${esc(c.client_name || "—")}</b></div>
                <div><small>Age</small><b>${esc(age || c.age || "—")}</b></div>
                <div><small>Phone</small><b>${esc(c.phone || "—")}</b></div>
                <div><small>Residence</small><b>${esc(c.village || "—")}</b></div>
                <div><small>Partner / kin</small><b>${esc(c.partner_name || "—")}</b><span class="printnote">${esc(c.partner_phone || "")}</span></div>
                <div class="cwcbar__end">${locked ? "" : '<button class="btn btn--sm" id="anc-edit">Edit details</button>'}</div>
            </div>`;
        const edit = $("#anc-edit", el);
        if (edit) edit.addEventListener("click", () => editDetails(c, onChange));
    }

    // ---------------------------------------------------------------- the form (sections 2-7)
    function multi(group, items, selected, locked) {
        const on = new Set(selected);
        return `<div class="multi" data-multi-group="${group}">${items.map((x) => `<label class="chipcheck ${on.has(x) ? "on" : ""}">
            <input type="checkbox" data-multi="${group}" value="${esc(x)}" ${on.has(x) ? "checked" : ""} ${locked ? "disabled" : ""}> ${esc(x)}</label>`).join("")}</div>`;
    }
    function historyTable(rows) {
        if (!rows || !rows.length) return '<div class="printnote">No earlier ANC visits recorded for this pregnancy.</div>';
        return `<table class="dtable" style="margin-top:6px"><tr><th>Date</th><th class="num">Visit</th><th class="num">Weeks</th><th class="num">Weight</th><th class="num">BP</th><th class="num">Fundal</th><th class="num">Hb</th><th>Urine prot.</th><th>IPTp</th><th>TT</th></tr>
            ${rows.map((g) => `<tr><td>${esc(dateOf(g.attendance_date))}</td><td class="num">${esc(g.anc_visit_number || "")}</td><td class="num">${esc(g.gestation_weeks ?? "")}</td>
                <td class="num">${g.weight_kg ? esc(g.weight_kg) + " kg" : "—"}</td><td class="num">${g.bp_systolic ? esc(g.bp_systolic + "/" + g.bp_diastolic) : "—"}</td>
                <td class="num">${g.fundal_height_cm ? esc(g.fundal_height_cm) : "—"}</td><td class="num">${g.hb_level ? esc(g.hb_level) : "—"}</td>
                <td>${esc(g.urine_protein || "—")}</td><td>${esc(g.iptp_doses || "—")}</td><td>${esc(g.tt_dose || "—")}</td></tr>`).join("")}</table>`;
    }

    function renderForm(el, a, ctx, { locked }) {
        const rec = ctx && ctx.registered ? ctx.record : null;
        const dis = locked ? "disabled" : "";
        // a revisit starts from what the register already knows; whatever is saved on this visit wins
        const pick = (k) => (a[k] != null && a[k] !== "" && Number(a[k]) !== 0 ? a[k] : rec && rec[k] ? rec[k] : "");
        const intOrBlank = (k) => (a[k] != null && a[k] !== "" ? a[k] : rec && rec[k] != null ? rec[k] : "");
        const lmp = a.lmp || (rec && rec.lmp) || "";
        const weeks = gestation(lmp);
        const complications = csv(a.complications);
        const ref = a.anc_referral || "";
        const ro = (label, value, id) => `<div class="field"><label>${label}</label><div class="input" ${id ? `id="${id}"` : ""} style="background:transparent">${esc(value ?? "—")}</div></div>`;
        const last = ctx && ctx.history && ctx.history[0];

        el.innerHTML = `
            <div class="subhead">2 · Obstetric history</div>
            <div class="grid-4">
                ${field("gravida", "Gravida (total pregnancies)", { type: "number", value: num(intOrBlank("gravida")), attrs: `min="1" max="20" ${dis}`, required: true })}
                ${field("parity", "Parity (live births)", { type: "number", value: intOrBlank("parity"), attrs: `min="0" max="20" ${dis}` })}
                ${field("abortions", "Abortions / miscarriages", { type: "number", value: intOrBlank("abortions"), attrs: `min="0" max="20" ${dis}` })}
                ${field("height_cm", "Height (cm)", { type: "number", value: num(pick("height_cm")), attrs: `step="0.1" min="100" max="220" ${dis}`, help: rec && rec.height_cm ? "" : "Taken at triage when measured" })}
            </div>
            <div class="grid-4">
                ${field("lmp", "LMP (last menstrual period)", { type: "date", value: lmp, attrs: `max="${today()}" ${dis}`, required: true })}
                ${ro("EDD (expected delivery)", eddOf(lmp) ? dateOf(eddOf(lmp)) : "—", "anc-edd")}
                ${ro("Gestation (weeks)", weeks != null ? weeks + " weeks" : "—", "anc-weeks")}
                ${field("anc_visit_number", "ANC visit no.", { type: "number", value: a.anc_visit_number || "", attrs: `min="1" ${dis}`, help: ctx && ctx.history && ctx.history.length ? "Counted from earlier visits here" : "Raise it if she attended elsewhere first" })}
            </div>

            <div class="subhead">3 · Physical examination &amp; clinical assessment</div>
            <div class="grid-4">
                ${field("weight_kg", "Weight (kg)", { type: "number", value: num(a.weight_kg), attrs: `step="0.1" min="25" max="200" ${dis}`, required: true,
                    help: last && last.weight_kg ? `Last: ${esc(last.weight_kg)} kg` : "From triage" })}
                ${field("bp_systolic", "Systolic BP (mmHg)", { type: "number", value: num(a.bp_systolic), attrs: `min="60" max="260" ${dis}`, required: true, help: "From triage" })}
                ${field("bp_diastolic", "Diastolic BP (mmHg)", { type: "number", value: num(a.bp_diastolic), attrs: `min="30" max="160" ${dis}`, required: true, help: "From triage" })}
                <div class="field"><label>BP reading</label><div class="input" id="anc-bp" style="background:transparent">—</div><small>Raised from 140/90</small></div>
            </div>
            <div class="grid-4">
                ${field("fundal_height_cm", "Fundal height (cm)", { type: "number", value: num(a.fundal_height_cm), attrs: `step="0.5" min="5" max="50" ${dis}` })}
                ${field("presentation", "Presentation", { type: "select", options: opts(PRESENTATION), value: a.presentation || "", attrs: dis })}
                ${field("fetal_heart_rate", "Fetal heart rate (bpm)", { type: "number", value: num(a.fetal_heart_rate), attrs: `min="60" max="220" ${dis}` })}
                ${field("fhr_status", "Fetal heart sounds", { type: "select", options: opts(["", "Present", "Absent"]), value: a.fhr_status || "", attrs: dis })}
            </div>
            <div class="grid-4">
                ${field("muac_cm", "MUAC (cm)", { type: "number", value: num(a.muac_cm), attrs: `step="0.1" min="10" max="45" ${dis}`, help: "Optional" })}
                <div class="field"><label>MUAC category</label><div class="input" id="anc-muac" style="background:transparent">${esc(a.anc_muac_category || "—")}</div><small>Worked out from the measurement</small></div>
            </div>
            <details style="margin-bottom:10px"><summary class="printnote" style="cursor:pointer">Earlier visits this pregnancy (${ctx && ctx.history ? ctx.history.length : 0})</summary>${historyTable(ctx && ctx.history)}</details>

            <div class="subhead">4 · Laboratory tests &amp; screening</div>
            <div class="grid-4">
                ${field("hb_level", "Haemoglobin (g/dL)", { type: "number", value: num(a.hb_level), attrs: `step="0.1" min="2" max="20" ${dis}` })}
                ${field("blood_group", "Blood group & rhesus", { type: "select", options: opts(BLOOD), value: a.blood_group || (ctx && ctx.patient && ctx.patient.blood_group) || "", attrs: dis })}
                ${field("blood_sugar", "Blood sugar (mmol/L)", { type: "number", value: num(a.blood_sugar), attrs: `step="0.1" min="0.5" max="40" ${dis}`, help: "From triage when taken" })}
                <div></div>
                ${field("urine_protein", "Urine protein", { type: "select", options: opts(UPROT), value: a.urine_protein || "", attrs: dis })}
                ${field("urine_glucose", "Urine glucose", { type: "select", options: opts(UGLU), value: a.urine_glucose || "", attrs: dis })}
            </div>
            <div class="grid-4">
                ${field("syphilis_client", "Syphilis test (client)", { type: "select", options: opts(SYPH), value: a.syphilis_client || "", attrs: dis })}
                <div class="field" id="syph-tx" style="justify-content:center;display:${a.syphilis_client === "Reactive" ? "flex" : "none"}">${field("syphilis_treatment", "Syphilis treatment given", { type: "checkbox", value: a.syphilis_treatment, attrs: dis })}</div>
                ${field("syphilis_partner", "Syphilis test (partner)", { type: "select", options: opts(SYPH), value: a.syphilis_partner || "", attrs: dis })}
            </div>

            <div class="subhead">5 · HIV testing &amp; PMTCT</div>
            <div class="grid-4">
                ${field("hiv_status_prior", "HIV status before ANC", { type: "select", options: opts(HIV_PRIOR), value: a.hiv_status_prior || "", attrs: dis })}
                ${field("hiv_test_anc", "HIV test at ANC", { type: "select", options: opts(HIV_TEST), value: a.hiv_test_anc || "", attrs: dis })}
                ${field("hiv_final_status", "Final maternal HIV status", { type: "select", options: opts(HIV_FINAL), value: a.hiv_final_status || "", attrs: dis, help: "Filled in from the two answers; change it if needed" })}
                ${field("art_status", "Maternal ART status", { type: "select", options: opts(ART), value: a.art_status || "", attrs: dis })}
            </div>
            <div class="grid-4">
                ${field("partner_hiv_status", "Partner HIV status", { type: "select", options: opts(P_HIV), value: a.partner_hiv_status || "", attrs: dis })}
                ${field("partner_art_status", "Partner ART status", { type: "select", options: opts(P_ART), value: a.partner_art_status || "", attrs: dis })}
                <div class="field" style="justify-content:center">${field("ctx_given", "Cotrimoxazole prophylaxis given", { type: "checkbox", value: a.ctx_given, attrs: dis })}</div>
            </div>

            <div class="subhead">6 · Preventive services &amp; supplementation</div>
            <div class="grid-4">
                ${field("ifa_count", "IFA tablets issued", { type: "number", value: num(a.ifa_count), attrs: `min="0" max="365" ${dis}` })}
                ${field("iptp_doses", "IPTp-SP dose given", { type: "select", options: opts(IPTP), value: a.iptp_doses || "", attrs: dis })}
                ${field("tt_dose", "Tetanus toxoid (TT) dose", { type: "select", options: opts(TT), value: a.tt_dose || "", attrs: dis })}
                <div class="field" style="justify-content:center">${field("llin_issued", "LLIN issued", { type: "checkbox", value: a.llin_issued, attrs: dis })}
                    ${field("anc_dewormed", "Dewormed (2nd / 3rd trimester)", { type: "checkbox", value: a.anc_dewormed, attrs: dis })}</div>
            </div>

            <div class="subhead">7 · Complications, referral &amp; remarks</div>
            <div class="field"><label>Maternal complications identified <span class="req">*</span></label>${multi("complications", COMPLICATIONS, complications, locked)}
                <small>Choose every complication found, or "None".</small></div>
            <div class="grid-2">
                ${field("anc_referral", "Referral out", { type: "select", options: opts(REFERRALS), value: ref, attrs: dis, required: true })}
                <div class="field" style="justify-content:center">${field("ibp_discussed", "Individual birth plan (IBP) discussed", { type: "checkbox", value: a.ibp_discussed, attrs: dis })}</div>
            </div>
            <div id="anc-ref-help" class="liveinfo" style="display:${REFERRAL_HELP[ref] ? "block" : "none"}">${REFERRAL_HELP[ref] || ""}</div>
            <div id="anc-ref-box" style="display:${EXTERNAL.includes(ref) ? "block" : "none"}">
                <div class="grid-2">
                    ${field("referral_facility", "Referred to (facility)", { value: a.referral_facility, placeholder: "Type to search or add", attrs: dis, required: true })}
                    ${field("referral_reason", "Reason for referral", { type: "textarea", rows: 2, value: a.referral_reason, attrs: dis })}
                </div>
            </div>
            ${field("anc_remarks", "Remarks / defaulter / delivery outcome notes", { type: "textarea", rows: 3, value: a.anc_remarks, attrs: dis })}`;

        const bpFlag = () => {
            const s = Number($("[data-f=bp_systolic]", el).value), d = Number($("[data-f=bp_diastolic]", el).value), box = $("#anc-bp", el);
            if (!s || !d) { box.textContent = "—"; box.style.color = ""; return; }
            const high = s >= 140 || d >= 90, low = s < 90;
            box.textContent = `${s}/${d}${high ? " · raised" : low ? " · low" : " · normal"}`;
            box.style.color = high ? "var(--bad)" : low ? "var(--warn)" : "var(--good)";
            box.style.fontWeight = "600";
        };
        bpFlag();
        if (locked) return;
        $("[data-f=bp_systolic]", el).addEventListener("input", bpFlag);
        $("[data-f=bp_diastolic]", el).addEventListener("input", bpFlag);
        $("[data-f=lmp]", el).addEventListener("change", (e) => {
            const w = gestation(e.target.value);
            $("#anc-edd", el).textContent = e.target.value ? dateOf(eddOf(e.target.value)) : "—";
            $("#anc-weeks", el).textContent = w != null ? w + " weeks" : "—";
        });
        $("[data-f=muac_cm]", el).addEventListener("input", (e) => {
            const cat = muacCategory(Number(e.target.value)), box = $("#anc-muac", el);
            box.textContent = cat || "—";
            box.style.color = cat.startsWith("SAM") ? "var(--bad)" : cat.startsWith("Under") ? "var(--warn)" : cat ? "var(--good)" : "";
            box.style.fontWeight = cat ? "600" : "";
        });
        $("[data-f=syphilis_client]", el).addEventListener("change", (e) => ($("#syph-tx", el).style.display = e.target.value === "Reactive" ? "flex" : "none"));
        const hiv = () => {   // the final status follows the two earlier answers until the clinician sets it
            const prior = $("[data-f=hiv_status_prior]", el).value, test = $("[data-f=hiv_test_anc]", el).value, fin = $("[data-f=hiv_final_status]", el);
            const p = test.replace("Tested ", "");
            const derived = prior === "Positive" || p === "Positive" ? "Positive" : prior === "Negative" || p === "Negative" ? "Negative" : "";
            if (derived) fin.value = derived;
            const art = $("[data-f=art_status]", el);
            if (fin.value === "Negative" && !art.value) art.value = "N/A (Negative)";
        };
        $("[data-f=hiv_status_prior]", el).addEventListener("change", hiv);
        $("[data-f=hiv_test_anc]", el).addEventListener("change", hiv);
        $("[data-f=hiv_final_status]", el).addEventListener("change", () => {
            const fin = $("[data-f=hiv_final_status]", el).value, art = $("[data-f=art_status]", el);
            if (fin === "Negative" && !art.value) art.value = "N/A (Negative)";
        });
        const refer = $("[data-f=anc_referral]", el);
        refer.addEventListener("change", () => {
            const v = refer.value, help = $("#anc-ref-help", el);
            help.style.display = REFERRAL_HELP[v] ? "block" : "none";
            help.innerHTML = REFERRAL_HELP[v] || "";
            $("#anc-ref-box", el).style.display = EXTERNAL.includes(v) ? "block" : "none";
            if (el.onReferral) el.onReferral(v);
        });
        $$("[data-multi]", el).forEach((box) => box.addEventListener("change", () => {
            const group = $(`[data-multi-group="${box.dataset.multi}"]`, el);
            if (box.checked) $$("[data-multi=complications]", group).forEach((o) => { if ((o.value === "None") !== (box.value === "None") && o !== box) o.checked = false; });
            $$(".chipcheck", group).forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
        }));
        Desk.facilityField($("[data-f=referral_facility]", el));
    }

    /** Values of the multi-select groups (comma separated), for saving. */
    function multiValues(root) {
        const out = {};
        $$("[data-multi]", root).forEach((box) => { (out[box.dataset.multi] = out[box.dataset.multi] || []); if (box.checked) out[box.dataset.multi].push(box.value); });
        Object.keys(out).forEach((k) => (out[k] = out[k].join(", ")));
        return out;
    }

    return { api, renderHeader, renderForm, multiValues, LAB, HIGH_RISK };
})();
