/* Family planning: the FP register entry (FP number) and the FP attendance form.
   Loaded by the Antenatal desk; clinic_unit.js calls into window.FP. */
window.FP = (function () {
    const { call, $, $$, esc, dateOf, toast, modal, field, read, banner } = Desk;

    const api = (method, args = {}) => call("fp." + method, args);
    const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    const csv = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
    const num = (v) => (v == null || v === "" || Number(v) === 0 ? "" : v);
    const opts = (arr) => arr.map((v) => ({ value: v, label: v || "—" }));

    const CLIENT_TYPE = ["", "1 = New Client (First time ever using FP)", "2 = Revisit / Continuing Client (Same method)", "3 = Change of Method (Switching)", "4 = Restart Client (Resuming after stopping)"];
    const METHODS = ["", "None", "Implant (1-rod, Implanon NXT)", "Implant (2-rod, Jadelle / Levoplant)", "IUCD (Copper T)", "IUCD (Hormonal, LNG-IUS)",
        "BTL (tubal ligation)", "Vasectomy", "DMPA-IM (Depo-Provera)", "DMPA-SC (Sayana Press)", "COC (Microgynon)", "POP (Microlut)",
        "Male condoms", "Female condoms", "SDM / CycleBeads", "LAM"];
    const SWITCH_REASON = ["", "Side Effects", "Wants a longer-acting method", "Wants a shorter-acting method", "Method failure", "Planning a pregnancy", "Partner's preference", "Method not available", "Other"];
    const SIDE_EFFECTS = ["Heavy / Irregular Bleeding", "Amenorrhea (No Periods)", "Weight Gain", "Severe Headache / Hypertension", "Pelvic Infection / Pain"];
    const CERVICAL = ["", "1 = Screened VIA/VILI (Negative)", "2 = Screened VIA/VILI (Positive)", "3 = HPV Test (Negative)", "4 = HPV Test (Positive)", "5 = Pap Smear Done", "6 = Not Screened / Referred"];
    const ACTION = ["", "Inserted", "Removed", "Replaced", "None"];
    const VSC = ["", "Done at Facility", "Referred Out"];
    const SC = ["", "Given at Clinic", "Issued for Self-Injection"];
    const HIV = ["", "Tested Negative", "Tested Positive", "Already Known Positive", "Declined / Not Tested"];
    const P_HIV = ["", "Tested Negative", "Tested Positive", "Unknown / Not Tested"];

    // ---------------------------------------------------------------- registration (section 1)
    function registerForm(patient, suggested, onDone) {
        modal({
            title: "Open FP register entry",
            sub: "Recorded once. It carries over to every later visit.",
            size: "wide",
            body: `${banner(patient)}
                <div class="grid-3">
                    ${field("fp_no", "FP No.", { required: true, value: suggested, help: "The number already on the client's FP card. Overwrite the suggestion if she has one." })}
                    ${field("registration_date", "Date of registration", { type: "date", value: today(), required: true })}
                    ${field("village", "Residence / village / landmark", { value: patient.village || "" })}
                </div>
                <div class="grid-3">${field("phone", "Client phone number", { value: patient.phone || "", required: true })}</div>`,
            foot: [
                { label: "Cancel" },
                { label: "Open register entry", cls: "btn--primary", onClick: async (hh) => {
                    const v = read(hh.body);
                    if (!v.fp_no.trim()) return toast("Enter the FP number", "warn");
                    if (!v.phone.trim()) return toast("Enter the client's phone number", "warn");
                    const r = await api("register", { data: { ...v, patient: patient.name } });
                    toast(`Registered · ${r.record.fp_no} · serial ${r.record.serial_no}`);
                    hh.close();
                    onDone(r);
                } },
            ],
        });
    }

    function editDetails(c, onChange) {
        modal({
            title: "FP register details",
            sub: `${esc(c.client_name)} · ${esc(c.fp_no || "")}`,
            size: "wide",
            body: `<div class="grid-3">
                    ${field("fp_no", "FP No.", { value: c.fp_no, required: true })}
                    ${field("village", "Residence / village / landmark", { value: c.village })}
                    ${field("phone", "Client phone number", { value: c.phone, required: true })}
                </div>
                <div class="grid-2">
                    ${field("status", "Register status", { type: "select", options: ["Active", "Discontinued", "Transferred Out", "Inactive"], value: c.status })}
                    ${field("exit_notes", "Notes", { type: "textarea", rows: 2, value: c.exit_notes })}
                </div>`,
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

    function renderHeader(el, ctx, { locked, age, sex, onChange }) {
        if (!ctx) { el.innerHTML = ""; return; }
        if (!ctx.registered) {
            el.innerHTML = `<div class="cwchead cwchead--new">
                <div><span class="tag tag--com">Not in the FP register</span>
                <p style="margin:8px 0 0;color:var(--ink-3)">Enter the FP number from the client's card to open her register entry. After this, every visit fills itself in.</p></div>
                ${locked ? "" : '<button class="btn btn--primary" id="fp-register">Enter FP number &amp; register</button>'}</div>`;
            const btn = $("#fp-register", el);
            if (btn) btn.addEventListener("click", () => registerForm(ctx.patient, ctx.suggested_fp_no, (r) => onChange(r)));
            return;
        }
        const c = ctx.record;
        el.innerHTML = `<div class="cwcbar">
                <div><small>FP No.</small><b>${esc(c.fp_no || "—")}</b></div>
                <div><small>Serial</small><b>${esc(c.serial_no || "—")}</b></div>
                <div><small>Client</small><b>${esc(c.client_name || "—")}</b></div>
                <div><small>Age</small><b>${esc(age || c.age || "—")}</b></div>
                <div><small>Sex</small><b>${esc(sex || "—")}</b></div>
                <div><small>Phone</small><b>${esc(c.phone || "—")}</b></div>
                <div><small>Residence</small><b>${esc(c.village || "—")}</b></div>
                <div><small>Current method</small><b>${esc(c.current_method || "None on record")}</b>${c.method_since ? `<span class="printnote">since ${esc(dateOf(c.method_since))}</span>` : ""}</div>
                <div class="cwcbar__end">${locked ? "" : '<button class="btn btn--sm" id="fp-edit">Edit details</button>'}</div>
            </div>`;
        const edit = $("#fp-edit", el);
        if (edit) edit.addEventListener("click", () => editDetails(c, onChange));
    }

    // ---------------------------------------------------------------- the form (sections 1 type, 2-4)
    function multi(group, items, selected, locked) {
        const on = new Set(selected);
        return `<div class="multi" data-multi-group="${group}">${items.map((x) => `<label class="chipcheck ${on.has(x) ? "on" : ""}">
            <input type="checkbox" data-multi="${group}" value="${esc(x)}" ${on.has(x) ? "checked" : ""} ${locked ? "disabled" : ""}> ${esc(x)}</label>`).join("")}</div>`;
    }

    function renderForm(el, a, ctx, { locked }) {
        const rec = ctx && ctx.registered ? ctx.record : null;
        const dis = locked ? "disabled" : "";
        // a client already on the register is a revisit unless the nurse says otherwise
        const type = a.fp_client_type || (rec ? (rec.visits_count > 0 ? CLIENT_TYPE[2] : CLIENT_TYPE[1]) : "");
        const switching = type.startsWith("3");
        const from = a.fp_method_from || (rec && rec.current_method) || "";
        const reason = a.fp_switch_reason || "";

        el.innerHTML = `
            <div class="grid-2">
                ${field("fp_client_type", "Client type / visit type", { type: "select", options: opts(CLIENT_TYPE), value: type, attrs: dis, required: true })}
                <div class="field"><label>Date of visit</label><div class="input" style="background:transparent">${esc(dateOf(a.attendance_date) || dateOf(new Date().toISOString()))}</div></div>
            </div>
            <div id="fp-switch" style="display:${switching ? "block" : "none"}">
                <div class="grid-3">
                    ${field("fp_method_from", "Changing from", { type: "select", options: opts(METHODS), value: from, attrs: dis, help: rec && rec.current_method ? "Her current method on the register" : "" })}
                    ${field("fp_method_to", "Changing to", { type: "select", options: opts(METHODS), value: a.fp_method_to || "", attrs: dis, help: "Left blank, it follows what is issued below" })}
                    ${field("fp_switch_reason", "Reason for the change", { type: "select", options: opts(SWITCH_REASON), value: reason, attrs: dis })}
                </div>
                <div id="fp-side" style="display:${reason === "Side Effects" ? "block" : "none"}">
                    <div class="field"><label>Side effects / complications reported <span class="req">*</span></label>${multi("fp_side_effects", SIDE_EFFECTS, csv(a.fp_side_effects), locked)}</div>
                </div>
                ${field("fp_switch_notes", "Notes on the change", { type: "textarea", rows: 2, value: a.fp_switch_notes, attrs: dis })}
            </div>

            <div class="subhead">2 · Clinical assessment &amp; screening</div>
            <div class="grid-4">
                ${field("weight_kg", "Weight (kg)", { type: "number", value: num(a.weight_kg), attrs: `step="0.1" min="25" max="250" ${dis}`, help: "From triage" })}
                ${field("bp_systolic", "Systolic BP (mmHg)", { type: "number", value: num(a.bp_systolic), attrs: `min="60" max="260" ${dis}`, help: "From triage" })}
                ${field("bp_diastolic", "Diastolic BP (mmHg)", { type: "number", value: num(a.bp_diastolic), attrs: `min="30" max="160" ${dis}`, help: "From triage" })}
                ${field("cervical_screening", "Cervical cancer screening", { type: "select", options: opts(CERVICAL), value: a.cervical_screening || "", attrs: dis })}
            </div>

            <div class="subhead">3 · Contraceptive method dispensed / issued</div>
            <div class="printnote" style="margin:-4px 0 10px">Record exactly what was provided at this visit. Leave everything empty for counselling only.</div>
            <div class="fpgroup"><h4>Oral pills</h4><div class="grid-3">
                ${field("coc_cycles", "COC (Microgynon) cycles", { type: "number", value: num(a.coc_cycles), attrs: `min="0" max="24" ${dis}` })}
                ${field("pop_cycles", "POP (Microlut) cycles", { type: "number", value: num(a.pop_cycles), attrs: `min="0" max="24" ${dis}` })}
                ${field("ecp_doses", "Emergency pills (ECP) doses", { type: "number", value: num(a.ecp_doses), attrs: `min="0" max="6" ${dis}` })}</div></div>
            <div class="fpgroup"><h4>Injectables</h4><div class="grid-3">
                <div class="field" style="justify-content:center">${field("dmpa_im_given", "DMPA-IM (Depo-Provera) given", { type: "checkbox", value: a.dmpa_im_given, attrs: dis })}</div>
                ${field("dmpa_sc_given", "DMPA-SC (Sayana Press)", { type: "select", options: opts(SC), value: a.dmpa_sc_given || "", attrs: dis })}
                <div id="fp-sc-doses" style="display:${a.dmpa_sc_given === "Issued for Self-Injection" ? "block" : "none"}">${field("dmpa_sc_doses", "Self-injection doses issued", { type: "number", value: num(a.dmpa_sc_doses), attrs: `min="0" max="6" ${dis}` })}</div></div></div>
            <div class="fpgroup"><h4>Implants &amp; IUCD (long-acting)</h4><div class="grid-4">
                ${field("implant1_action", "1-rod implant (Implanon NXT)", { type: "select", options: opts(ACTION), value: a.implant1_action || "", attrs: dis })}
                ${field("implant2_action", "2-rod implant (Jadelle / Levoplant)", { type: "select", options: opts(ACTION), value: a.implant2_action || "", attrs: dis })}
                ${field("iucd_copper_action", "Copper T IUCD", { type: "select", options: opts(ACTION), value: a.iucd_copper_action || "", attrs: dis })}
                ${field("iucd_hormonal_action", "Hormonal IUCD (LNG-IUS / Mirena)", { type: "select", options: opts(ACTION), value: a.iucd_hormonal_action || "", attrs: dis })}</div></div>
            <div class="fpgroup"><h4>Condoms</h4><div class="grid-3">
                ${field("male_condoms", "Male condoms issued", { type: "number", value: num(a.male_condoms), attrs: `min="0" max="500" ${dis}` })}
                ${field("female_condoms", "Female condoms issued", { type: "number", value: num(a.female_condoms), attrs: `min="0" max="500" ${dis}` })}</div></div>
            <div class="fpgroup"><h4>Permanent methods (VSC)</h4><div class="grid-3">
                ${field("btl_status", "Tubal ligation (BTL)", { type: "select", options: opts(VSC), value: a.btl_status || "", attrs: dis })}
                ${field("vasectomy_status", "Vasectomy", { type: "select", options: opts(VSC), value: a.vasectomy_status || "", attrs: dis })}</div></div>
            <div class="fpgroup"><h4>Fertility awareness / natural</h4><div class="grid-3">
                <div class="field" style="justify-content:center">${field("sdm_given", "CycleBeads / Standard Days Method", { type: "checkbox", value: a.sdm_given, attrs: dis })}</div>
                <div class="field" style="justify-content:center">${field("lam_educated", "LAM educated", { type: "checkbox", value: a.lam_educated, attrs: dis })}</div></div></div>
            <div class="liveinfo" id="fp-summary" style="display:none"></div>

            <div class="subhead">4 · HIV integration &amp; other services</div>
            <div class="grid-4">
                ${field("fp_hiv_result", "Client HIV test result", { type: "select", options: opts(HIV), value: a.fp_hiv_result || "", attrs: dis })}
                ${field("fp_partner_hiv", "Partner HIV status", { type: "select", options: opts(P_HIV), value: a.fp_partner_hiv || "", attrs: dis })}
                <div class="field" style="justify-content:center">${field("fp_dual_protection", "Condoms provided for HIV/STI prevention (dual protection)", { type: "checkbox", value: a.fp_dual_protection, attrs: dis })}</div>
                ${field("fp_next_visit", "Next visit", { type: "date", value: a.fp_next_visit, attrs: dis })}
            </div>`;

        if (locked) return;
        const val = (k) => ($(`[data-f=${k}]`, el) || {}).value || "";
        const checked = (k) => !!($(`[data-f=${k}]`, el) || {}).checked;
        const summary = () => {   // what will be recorded as this visit's method
            const g = [];
            if (Number(val("coc_cycles")) > 0) g.push("COC");
            if (Number(val("pop_cycles")) > 0) g.push("POP");
            if (Number(val("ecp_doses")) > 0) g.push("ECP");
            if (checked("dmpa_im_given")) g.push("DMPA-IM");
            if (val("dmpa_sc_given")) g.push("DMPA-SC");
            [["implant1_action", "1-rod implant"], ["implant2_action", "2-rod implant"], ["iucd_copper_action", "Copper T"], ["iucd_hormonal_action", "LNG-IUS"]].forEach(([k, n]) => {
                if (val(k) && val(k) !== "None") g.push(`${n} ${val(k).toLowerCase()}`);
            });
            if (Number(val("male_condoms")) > 0) g.push("male condoms");
            if (Number(val("female_condoms")) > 0) g.push("female condoms");
            if (val("btl_status")) g.push("BTL: " + val("btl_status").toLowerCase());
            if (val("vasectomy_status")) g.push("vasectomy: " + val("vasectomy_status").toLowerCase());
            if (checked("sdm_given")) g.push("SDM");
            if (checked("lam_educated")) g.push("LAM");
            const box = $("#fp-summary", el);
            box.style.display = "block";
            box.innerHTML = g.length ? `This visit: <b>${esc(g.join(" · "))}</b>` : "This visit: <b>counselling only</b> (nothing issued)";
        };
        summary();
        el.addEventListener("input", summary);
        el.addEventListener("change", summary);
        const typeSel = $("[data-f=fp_client_type]", el);
        typeSel.addEventListener("change", () => ($("#fp-switch", el).style.display = typeSel.value.startsWith("3") ? "block" : "none"));
        const rsn = $("[data-f=fp_switch_reason]", el);
        rsn.addEventListener("change", () => ($("#fp-side", el).style.display = rsn.value === "Side Effects" ? "block" : "none"));
        const sc = $("[data-f=dmpa_sc_given]", el);
        sc.addEventListener("change", () => ($("#fp-sc-doses", el).style.display = sc.value === "Issued for Self-Injection" ? "block" : "none"));
        $$("[data-multi]", el).forEach((box) => box.addEventListener("change", () => {
            $$(".chipcheck", $(`[data-multi-group="${box.dataset.multi}"]`, el)).forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
        }));
    }

    /** Values of the multi-select groups (comma separated), for saving. */
    function multiValues(root) {
        const out = {};
        $$("[data-multi]", root).forEach((box) => { (out[box.dataset.multi] = out[box.dataset.multi] || []); if (box.checked) out[box.dataset.multi].push(box.value); });
        Object.keys(out).forEach((k) => (out[k] = out[k].join(", ")));
        return out;
    }

    return { api, renderHeader, renderForm, multiValues };
})();
