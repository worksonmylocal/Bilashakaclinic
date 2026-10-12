/* Postnatal clinic: the PNC register entry (PNC number) and the postnatal attendance form.
   Loaded by the MCH & Postnatal desk; clinic_unit.js calls into window.PNC. */
window.PNC = (function () {
    const { call, $, $$, esc, dateOf, toast, modal, field, read, banner } = Desk;

    const api = (method, args = {}) => call("pnc." + method, args);
    const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    const csv = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
    const num = (v) => (v == null || v === "" || Number(v) === 0 ? "" : v);
    const opts = (arr) => arr.map((v) => ({ value: v, label: v || "—" }));

    const MARITAL = ["", "Married / Partnered", "Single", "Divorced / Separated", "Widowed"];
    const PLACE = ["", "1 = Health Facility (This Facility)", "2 = Health Facility (Other Facility)", "3 = Home / En Route", "4 = Other"];
    const MODE = ["", "1 = SVD (Spontaneous Vaginal Delivery)", "2 = Vacuum Extraction / Instrumental", "3 = Elective Cesarean Section", "4 = Emergency Cesarean Section"];
    const OUTCOME = ["", "Live Birth", "Fresh Stillbirth (FSB)", "Macerated Stillbirth (MSB)"];
    const T_MOTHER = ["", "1 = Within 24 Hours (Before discharge)", "2 = 48 Hours to 72 Hours (Day 2-3)", "3 = 7 Days to 14 Days (1-2 Weeks)", "4 = 6 Weeks (42 Days)", "5 = > 6 Weeks"];
    const T_BABY = ["", "1 = Within 24 Hours", "2 = 48 Hours to 72 Hours", "3 = 7 Days to 14 Days", "4 = 6 Weeks", "5 = > 6 Weeks"];
    const CONDITION = ["", "Satisfactory", "Pallor", "Jaundice", "Lethargic / Ill"];
    const BREAST = ["", "Normal / Soft", "Engorged", "Mastitis / Abscess", "Cracked / Sore Nipples"];
    const UTERUS = ["", "Normal / Well Involuted (Not palpable by 2 weeks)", "Sub-involuted / Tender", "High / Soft"];
    const LOCHIA = ["", "Normal (Rubra/Serosa/Alba)", "Foul Smelling (Sepsis suspected)", "Excessive / Postpartum Hemorrhage (PPH)"];
    const WOUND = ["", "Intact / Healed", "Episiotomy / Laceration Intact", "Infected / Dehisced Wound", "C-Section Incision Clean & Intact", "C-Section Incision Infected"];
    const CORD = ["", "Clean & Dry", "Redness / Oozing / Septic", "Off"];
    const FEEDING = ["", "Exclusive Breastfeeding (EBF)", "Replacement Feeding", "Mixed Feeding"];
    const JAUNDICE = ["", "Absent", "Mild / Physiological", "Severe / Pathological"];
    const INFANT_DANGER = ["Poor Feeding / Inability to Suck", "Convulsions", "Fever / Hypothermia", "Fast Breathing / Chest In-drawing", "Lethargy / Unconsciousness", "Yellow Palms/Soles", "None"];
    const HIV_INIT = ["", "Positive", "Negative", "Unknown"];
    const HIV_RETEST = ["", "Tested Negative", "Tested Positive", "Declined / Not Done", "N/A (Already Positive)"];
    const HAART = ["", "1 = Already on HAART before PNC", "2 = Started HAART during PNC visit", "3 = Not on HAART", "4 = N/A (Negative)"];
    const INF_ARV = ["", "1 = Nevirapine (NVP) Syrup given", "2 = NVP + AZT Dual Prophylaxis given", "3 = Refused / Not Given", "4 = N/A (HIV Negative Mother)"];
    const PCR = ["", "1 = Initial PCR at 6 Weeks Taken", "2 = Repeat PCR Taken", "3 = Not Done / Not Applicable"];
    const P_HIV = ["", "1 = Partner Tested Negative", "2 = Partner Tested Positive", "3 = Partner Status Unknown / Not Tested"];
    const DISCLOSE = ["", "Disclosed to Partner", "Not Disclosed", "N/A"];
    const CERVICAL = ["", "1 = Screened VIA/VILI (Negative)", "2 = Screened VIA/VILI (Positive)", "3 = HPV Test Done (Negative)", "4 = HPV Test Done (Positive)", "5 = Pap Smear Done",
        "6 = Eligible but Deferred (e.g. <6 weeks post-delivery)", "7 = Already Screened within 1-3 years", "8 = Not Screened"];
    const CERV_TX = ["", "1 = Cryotherapy / LEEP Done", "2 = Referred for Gynecological Management", "3 = N/A"];
    const FP = ["", "1 = Combined Oral Contraceptive (COC)", "2 = Progestin-Only Pill (POP / Microlut - Safe for breastfeeding)", "3 = Injectable (DMPA / Depo-Provera / Sayana Press)",
        "4 = Implant (Implanon / Jadelle)", "5 = Postpartum IUCD (PPIUCD)", "6 = Condoms Only", "7 = Voluntary Surgical Contraception (BTL / Vasectomy)",
        "8 = Natural / LAM (Lactational Amenorrhea Method)", "9 = Declined / None Received at this Visit"];
    const COMPLICATIONS = ["Postpartum Hemorrhage (PPH)", "Puerperal Sepsis", "Postpartum Eclampsia / Severe Hypertension", "Deep Vein Thrombosis (DVT)", "Postpartum Depression", "None"];

    // times come back as "9:15:00"; a time input needs "09:15"
    const hhmm = (v) => { const m = /(\d+):(\d+)/.exec(String(v || "")); return m ? m[1].padStart(2, "0") + ":" + m[2] : ""; };
    const daysSince = (date) => (date ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000) : null);
    // the interval the visit falls in, offered only when the day count fits one of the bands exactly
    const timingFor = (days) => (days == null ? 0 : days <= 1 ? 1 : days <= 3 ? 2 : days >= 7 && days <= 14 ? 3 : days >= 38 && days <= 45 ? 4 : days > 45 ? 5 : 0);

    // ---------------------------------------------------------------- registration (section 1)
    function registerForm(patient, suggested, onDone) {
        modal({
            title: "Open PNC register entry",
            sub: "Recorded once for this delivery. It carries over to every later visit.",
            size: "wide",
            body: `${banner(patient)}
                <div class="grid-3">
                    ${field("pnc_no", "PNC No.", { required: true, value: suggested, help: "The number already in the mother's PNC register or booklet. Overwrite the suggestion if she has one." })}
                    ${field("registration_date", "Date of registration", { type: "date", value: today(), required: true })}
                    ${field("village", "Residence / village / landmark", { value: patient.village || "" })}
                </div>
                <div class="grid-3">
                    ${field("phone", "Mother's phone number", { value: patient.phone || "", required: true })}
                    ${field("marital_status", "Marital status", { type: "select", options: opts(MARITAL) })}
                </div>`,
            foot: [
                { label: "Cancel" },
                { label: "Open register entry", cls: "btn--primary", onClick: async (hh) => {
                    const v = read(hh.body);
                    if (!v.pnc_no.trim()) return toast("Enter the PNC number", "warn");
                    if (!v.phone.trim()) return toast("Enter the mother's phone number", "warn");
                    const r = await api("register", { data: { ...v, patient: patient.name } });
                    toast(`Registered · ${r.record.pnc_no} · serial ${r.record.serial_no}`);
                    hh.close();
                    onDone(r);
                } },
            ],
        });
    }

    function editDetails(c, onChange) {
        modal({
            title: "PNC register details",
            sub: `${esc(c.mother_name)} · ${esc(c.pnc_no || "")}`,
            size: "wide",
            body: `<div class="grid-3">
                    ${field("pnc_no", "PNC No.", { value: c.pnc_no, required: true })}
                    ${field("village", "Residence / village / landmark", { value: c.village })}
                    ${field("phone", "Mother's phone number", { value: c.phone, required: true })}
                </div>
                <div class="grid-3">
                    ${field("marital_status", "Marital status", { type: "select", options: opts(MARITAL), value: c.marital_status })}
                    ${field("status", "Register status", { type: "select", options: ["Active", "Completed", "Transferred Out", "Inactive"], value: c.status,
                        help: "Choose Completed once the mother is discharged from postnatal care, so a later delivery gets a new entry." })}
                </div>
                ${field("exit_notes", "Notes", { type: "textarea", rows: 2, value: c.exit_notes })}`,
            foot: [{ label: "Cancel" }, { label: "Save details", cls: "btn--primary", onClick: async (hh) => {
                const v = read(hh.body);
                if (!v.phone.trim()) return toast("The mother's phone number is required", "warn");
                const record = await api("save_record", { record: c.name, data: v });
                toast("Register details saved");
                hh.close();
                onChange({ registered: true, record });
            } }],
        });
    }

    function renderHeader(el, ctx, { locked, age, visitNo, onChange }) {
        if (!ctx) { el.innerHTML = ""; return; }
        if (!ctx.registered) {
            const anc = ctx.from_anc;
            el.innerHTML = `<div class="cwchead cwchead--new">
                <div><span class="tag tag--com">Not in the PNC register</span>
                <p style="margin:8px 0 0;color:var(--ink-3)">Enter the PNC number to open the mother's register entry for this delivery. After this, every visit fills itself in.</p>
                ${anc ? `<p class="printnote" style="margin:6px 0 0">She is on the antenatal register (${esc(anc.anc_no)}): gravida and parity will be copied over.</p>` : ""}</div>
                ${locked ? "" : '<button class="btn btn--primary" id="pnc-register">Enter PNC number &amp; register</button>'}</div>`;
            const btn = $("#pnc-register", el);
            if (btn) btn.addEventListener("click", () => registerForm(ctx.patient, ctx.suggested_pnc_no, (r) => onChange(r)));
            return;
        }
        const c = ctx.record;
        el.innerHTML = `<div class="cwcbar">
                <div><small>Visit</small><b><span class="tag ${visitNo > 1 ? "tag--emp" : "tag--com"}">PNC visit ${esc(visitNo)}</span></b></div>
                <div><small>PNC No.</small><b>${esc(c.pnc_no || "—")}</b></div>
                <div><small>Serial</small><b>${esc(c.serial_no || "—")}</b></div>
                <div><small>Patient No.</small><b>${esc(c.patient)}</b></div>
                <div><small>Mother</small><b>${esc(c.mother_name || "—")}</b></div>
                <div><small>Age</small><b>${esc(age || c.age || "—")}</b></div>
                <div><small>Phone</small><b>${esc(c.phone || "—")}</b></div>
                <div><small>Residence</small><b>${esc(c.village || "—")}</b></div>
                <div><small>Marital status</small><b>${esc(c.marital_status || "—")}</b></div>
                <div class="cwcbar__end">${locked ? "" : '<button class="btn btn--sm" id="pnc-edit">Edit details</button>'}</div>
            </div>`;
        const edit = $("#pnc-edit", el);
        if (edit) edit.addEventListener("click", () => editDetails(c, onChange));
    }

    // ---------------------------------------------------------------- the form (sections 2-10)
    function multi(group, items, selected, locked) {
        const on = new Set(selected);
        return `<div class="multi" data-multi-group="${group}">${items.map((x) => `<label class="chipcheck ${on.has(x) ? "on" : ""}">
            <input type="checkbox" data-multi="${group}" value="${esc(x)}" ${on.has(x) ? "checked" : ""} ${locked ? "disabled" : ""}> ${esc(x)}</label>`).join("")}</div>`;
    }
    function historyTable(rows) {
        if (!rows || !rows.length) return '<div class="printnote">No earlier postnatal visits for this delivery.</div>';
        return `<table class="dtable" style="margin-top:6px"><tr><th>Date</th><th class="num">Visit</th><th class="num">Day</th><th>Mother timing</th><th class="num">BP</th><th>Condition</th><th class="num">Baby wt</th><th>Feeding</th></tr>
            ${rows.map((g) => `<tr><td>${esc(dateOf(g.attendance_date))}</td><td class="num">${esc(g.postnatal_visit_no || "")}</td><td class="num">${esc(g.days_postpartum ?? "")}</td>
                <td>${esc((g.mother_pnc_timing || "—").replace(/^\d = /, ""))}</td><td class="num">${g.bp_systolic ? esc(g.bp_systolic + "/" + g.bp_diastolic) : "—"}</td>
                <td>${esc(g.maternal_condition || "—")}</td><td class="num">${g.infant_weight_kg ? esc(g.infant_weight_kg) + " kg" : "—"}</td><td>${esc(g.infant_feeding || "—")}</td></tr>`).join("")}</table>`;
    }

    function renderForm(el, a, ctx, { locked }) {
        const rec = ctx && ctx.registered ? ctx.record : null;
        const dis = locked ? "disabled" : "";
        const pick = (k) => (a[k] != null && a[k] !== "" && Number(a[k]) !== 0 ? a[k] : rec && rec[k] ? rec[k] : "");
        const sel = (k, list) => (a[k] || (rec && rec[k]) || "");
        const delivery = a.delivery_date || (rec && rec.delivery_date) || "";
        const time = hhmm(a.delivery_time || (rec && rec.delivery_time));
        const days = daysSince(delivery);
        const outcome = a.delivery_outcome || (rec && rec.delivery_outcome) || "";
        const live = !outcome || outcome.startsWith("Live");
        const suggested = timingFor(days);
        const mTiming = a.mother_pnc_timing || (suggested ? T_MOTHER[suggested] : "");
        const bTiming = a.baby_pnc_timing || (suggested ? T_BABY[suggested] : "");
        const baby = (html) => `<div class="pnc-baby" style="display:${live ? "block" : "none"}">${html}</div>`;

        el.innerHTML = `
            <div class="subhead">2 · Maternal history &amp; delivery</div>
            <div class="grid-4">
                ${field("gravida", "Gravida", { type: "number", value: num(pick("gravida")), attrs: `min="1" max="20" ${dis}`, required: true })}
                ${field("parity", "Parity", { type: "number", value: pick("parity") || (a.parity === 0 ? 0 : ""), attrs: `min="0" max="20" ${dis}` })}
                ${field("delivery_date", "Date of delivery", { type: "date", value: delivery, attrs: `max="${today()}" ${dis}`, required: true })}
                ${field("delivery_time", "Time of delivery", { type: "time", value: time, attrs: dis })}
            </div>
            <div class="grid-3">
                ${field("delivery_place", "Place of delivery", { type: "select", options: opts(PLACE), value: sel("delivery_place"), attrs: dis, required: true })}
                ${field("delivery_mode", "Mode of delivery", { type: "select", options: opts(MODE), value: sel("delivery_mode"), attrs: dis, required: true })}
                ${field("delivery_outcome", "Delivery outcome", { type: "select", options: opts(OUTCOME), value: outcome, attrs: dis, required: true })}
            </div>
            <div class="printnote" id="pnc-days" style="margin:-4px 0 8px">${days != null ? `Day ${days} after delivery.` : "Enter the date of delivery to see the day count."}</div>

            <div class="subhead">3 · Postpartum visit timing</div>
            <div class="grid-2">
                ${field("mother_pnc_timing", "Mother PNC visit timing", { type: "select", options: opts(T_MOTHER), value: mTiming, attrs: dis, required: true,
                    help: suggested && !a.mother_pnc_timing ? "Suggested from the delivery date" : "" })}
                ${baby(field("baby_pnc_timing", "Baby PNC visit timing", { type: "select", options: opts(T_BABY), value: bTiming, attrs: dis, required: true }))}
            </div>
            <details style="margin-bottom:10px"><summary class="printnote" style="cursor:pointer">Earlier visits for this delivery (${ctx && ctx.history ? ctx.history.length : 0})</summary>${historyTable(ctx && ctx.history)}</details>

            <div class="subhead">4 · Vital signs</div>
            <div class="grid-4">
                ${field("bp_systolic", "Systolic BP (mmHg)", { type: "number", value: num(a.bp_systolic), attrs: `min="60" max="260" ${dis}`, help: "From triage" })}
                ${field("bp_diastolic", "Diastolic BP (mmHg)", { type: "number", value: num(a.bp_diastolic), attrs: `min="30" max="160" ${dis}`, help: "From triage" })}
                ${field("pulse_bpm", "Pulse (bpm)", { type: "number", value: num(a.pulse_bpm), attrs: `min="30" max="220" ${dis}`, help: "From triage" })}
                ${field("temp_c", "Temperature (°C)", { type: "number", value: num(a.temp_c), attrs: `step="0.1" min="30" max="43" ${dis}`, help: "From triage" })}
                ${field("resp_rate", "Respiratory rate (/min)", { type: "number", value: num(a.resp_rate), attrs: `min="5" max="60" ${dis}`, help: "From triage" })}
            </div>
            ${baby(`<div class="grid-4">
                ${field("infant_temp_c", "Infant temperature (°C)", { type: "number", value: num(a.infant_temp_c), attrs: `step="0.1" min="30" max="43" ${dis}` })}
                ${field("infant_weight_kg", "Infant weight (kg)", { type: "number", value: num(a.infant_weight_kg), attrs: `step="0.01" min="0.5" max="8" ${dis}` })}</div>`)}

            <div class="subhead">5 · Postnatal examinations</div>
            <div class="fpgroup"><h4>Mother</h4><div class="grid-3">
                ${field("maternal_condition", "General condition", { type: "select", options: opts(CONDITION), value: a.maternal_condition || "", attrs: dis })}
                ${field("breast_exam", "Breast examination", { type: "select", options: opts(BREAST), value: a.breast_exam || "", attrs: dis })}
                ${field("uterine_involution", "Uterine involution / fundal height", { type: "select", options: opts(UTERUS), value: a.uterine_involution || "", attrs: dis })}
                ${field("lochia_exam", "Lochia / vaginal discharge", { type: "select", options: opts(LOCHIA), value: a.lochia_exam || "", attrs: dis })}
                ${field("wound_exam", "Perineum / episiotomy / surgical wound", { type: "select", options: opts(WOUND), value: a.wound_exam || "", attrs: dis })}</div></div>
            ${baby(`<div class="fpgroup"><h4>Newborn</h4><div class="grid-3">
                ${field("cord_condition", "Umbilical cord", { type: "select", options: opts(CORD), value: a.cord_condition || "", attrs: dis })}
                ${field("infant_feeding", "Feeding assessment", { type: "select", options: opts(FEEDING), value: a.infant_feeding || "", attrs: dis })}
                ${field("infant_jaundice", "Jaundice / sclera", { type: "select", options: opts(JAUNDICE), value: a.infant_jaundice || "", attrs: dis })}</div>
                <div class="field"><label>Danger signs screened <span class="req">*</span></label>${multi("infant_danger_signs", INFANT_DANGER, csv(a.infant_danger_signs), locked)}
                    <small>Choose every sign found, or "None".</small></div></div>`)}

            <div class="subhead">6 · HAART &amp; infant prophylaxis</div>
            <div class="grid-4">
                ${field("mat_hiv_initial", "Known HIV status at PNC entry", { type: "select", options: opts(HIV_INIT), value: a.mat_hiv_initial || "", attrs: dis })}
                ${field("mat_hiv_retest", "HIV retesting at PNC", { type: "select", options: opts(HIV_RETEST), value: a.mat_hiv_retest || "", attrs: dis })}
                ${field("maternal_haart", "Maternal HAART status", { type: "select", options: opts(HAART), value: a.maternal_haart || "", attrs: dis })}
                <div class="field" style="justify-content:center">${field("ctx_given", "Maternal cotrimoxazole (CTX) given", { type: "checkbox", value: a.ctx_given, attrs: dis })}</div>
            </div>
            ${baby(`<div class="grid-3">
                ${field("infant_arv", "Infant ARV prophylaxis", { type: "select", options: opts(INF_ARV), value: a.infant_arv || "", attrs: dis })}
                ${field("eid_pcr", "Infant DNA-PCR sample", { type: "select", options: opts(PCR), value: a.eid_pcr || "", attrs: dis })}
                <div class="field" style="justify-content:center">${field("infant_ctx", "Infant cotrimoxazole started (6 weeks, HEI)", { type: "checkbox", value: a.infant_ctx, attrs: dis })}</div></div>`)}

            <div class="subhead">7 · Partner HIV status &amp; testing</div>
            <div class="grid-3">
                ${field("pnc_partner_hiv", "Partner HIV screening / status", { type: "select", options: opts(P_HIV), value: a.pnc_partner_hiv || "", attrs: dis })}
                <div class="field" style="justify-content:center">${field("partner_tested_pnc", "Partner tested at this PNC visit", { type: "checkbox", value: a.partner_tested_pnc, attrs: dis })}</div>
                ${field("hiv_disclosure", "Disclosure status", { type: "select", options: opts(DISCLOSE), value: a.hiv_disclosure || "", attrs: dis })}
            </div>

            <div class="subhead">8 · Cervical cancer screening</div>
            <div class="grid-2">
                ${field("pnc_cervical", "Cervical cancer screening status", { type: "select", options: opts(CERVICAL), value: a.pnc_cervical || "", attrs: dis })}
                ${field("cervical_treatment", "Treatment / referral", { type: "select", options: opts(CERV_TX), value: a.cervical_treatment || "", attrs: dis })}
            </div>

            <div class="subhead">9 · Counselling &amp; postnatal family planning</div>
            <div class="grid-3">
                <div class="field" style="justify-content:center">${field("pnc_fp_counselling", "Postnatal FP counselling done", { type: "checkbox", value: a.pnc_fp_counselling, attrs: dis })}</div>
                ${field("pnc_fp_method", "Postnatal FP method received", { type: "select", options: opts(FP), value: a.pnc_fp_method || "", attrs: dis })}
                <div id="pnc-fp-date" style="display:${a.pnc_fp_method && !a.pnc_fp_method.startsWith("9") ? "block" : "none"}">${field("pnc_fp_date", "Date method dispensed", { type: "date", value: a.pnc_fp_date || today(), attrs: `max="${today()}" ${dis}` })}</div>
            </div>

            <div class="subhead">10 · Haematinics, supplementation &amp; complications</div>
            <div class="grid-3">
                ${field("ifa_count", "IFA tablets issued", { type: "number", value: num(a.ifa_count), attrs: `min="0" max="365" ${dis}`, help: "e.g. 30 or 60" })}
                <div class="field" style="justify-content:center">${field("mother_vit_a", "Vitamin A given (200,000 IU, once within 6 weeks)", { type: "checkbox", value: a.mother_vit_a, attrs: dis })}</div>
                <div class="field" style="justify-content:center">${field("deworming_mother", "Deworming issued", { type: "checkbox", value: a.deworming_mother, attrs: dis })}</div>
            </div>
            <div class="field"><label>Maternal complications identified <span class="req">*</span></label>${multi("maternal_complications", COMPLICATIONS, csv(a.maternal_complications), locked)}
                <small>Choose every complication found, or "None".</small></div>`;

        if (locked) return;
        const dateIn = $("[data-f=delivery_date]", el);
        dateIn.addEventListener("change", () => {
            const d = daysSince(dateIn.value);
            $("#pnc-days", el).textContent = d != null ? `Day ${d} after delivery.` : "Enter the date of delivery to see the day count.";
            const t = timingFor(d);
            const m = $("[data-f=mother_pnc_timing]", el), b = $("[data-f=baby_pnc_timing]", el);
            if (t && !m.value) m.value = T_MOTHER[t];
            if (t && b && !b.value) b.value = T_BABY[t];
        });
        const out = $("[data-f=delivery_outcome]", el);
        out.addEventListener("change", () => {
            const isLive = !out.value || out.value.startsWith("Live");
            $$(".pnc-baby", el).forEach((x) => (x.style.display = isLive ? "block" : "none"));
        });
        const fpm = $("[data-f=pnc_fp_method]", el);
        fpm.addEventListener("change", () => ($("#pnc-fp-date", el).style.display = fpm.value && !fpm.value.startsWith("9") ? "block" : "none"));
        const hiv = () => {
            const init = $("[data-f=mat_hiv_initial]", el).value, re = $("[data-f=mat_hiv_retest]", el).value.replace("Tested ", "");
            const neg = init !== "Positive" && re !== "Positive" && (init === "Negative" || re === "Negative");
            const haart = $("[data-f=maternal_haart]", el), arv = $("[data-f=infant_arv]", el);
            if (neg && !haart.value) haart.value = HAART[4];
            if (neg && arv && !arv.value) arv.value = INF_ARV[4];
        };
        $("[data-f=mat_hiv_initial]", el).addEventListener("change", hiv);
        $("[data-f=mat_hiv_retest]", el).addEventListener("change", hiv);
        $$("[data-multi]", el).forEach((box) => box.addEventListener("change", () => {
            const group = $(`[data-multi-group="${box.dataset.multi}"]`, el);
            if (box.checked) $$(`[data-multi=${box.dataset.multi}]`, group).forEach((o) => { if ((o.value === "None") !== (box.value === "None") && o !== box) o.checked = false; });
            $$(".chipcheck", group).forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
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
