/* Child Welfare Clinic: the permanent register entry, the immunization card and defaulters.
   Loaded by the MCH & Postnatal desk; clinic_unit.js calls into window.CWC. */
window.CWC = (function () {
    const { call, $, $$, esc, dateOf, pill, empty, toast, modal, field, read, banner } = Desk;

    const api = (method, args = {}) => call("cwc." + method, args);
    // the clinic's own date: toISOString() is UTC, a day behind in the early hours of the morning
    const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    const STATUS = { Given: "good", Due: "warn", Overdue: "bad", Scheduled: "mute", "Not Applicable": "mute" };
    const MILESTONES = ["At Birth", "6 Weeks", "10 Weeks", "14 Weeks", "6 Months", "9 Months", "12 Months", "18 Months"];
    const tel = (phone) => (phone ? `<a class="telnum" href="tel:${esc(String(phone).replace(/\s/g, ""))}">${esc(phone)}</a>` : "—");
    const ago = (days) => (days >= 60 ? `${Math.floor(days / 30)} months late` : `${days} days late`);

    // ---------------------------------------------------------------- registration
    function registerForm(patient, suggested, onDone) {
        const h = modal({
            title: "Open CWC register entry",
            sub: "Recorded once. It carries over to every later visit.",
            size: "wide",
            body: `${banner(patient)}
                <div class="subhead">Registration</div>
                <div class="grid-3">
                    ${field("cwc_no", "CWC No.", { required: true, value: patient.cwc_no || suggested, help: "The number already on the child's card. Overwrite the suggestion if the child has one." })}
                    ${field("registration_date", "Date of registration", { type: "date", value: today(), required: true })}
                    ${field("village", "Residence / village / landmark", { value: patient.village || "" })}
                </div>
                <div class="subhead">Parent / guardian</div>
                <div class="grid-4">
                    ${field("caregiver_name", "Parent / guardian name", { required: true, value: patient.next_of_kin || "" })}
                    ${field("caregiver_relationship", "Relationship", { type: "select", options: ["Mother", "Father", "Grandparent", "Guardian", "Other"] })}
                    ${field("caregiver_phone", "Contact phone number", { required: true, value: patient.phone || patient.next_of_kin_phone || "" })}
                    ${field("alt_phone", "Alternative phone")}
                </div>
                <div class="subhead">Birth attendance &amp; weight</div>
                <div class="grid-4">
                    ${field("delivery_place", "Place of delivery", { type: "select", options: ["", "Health Facility", "Home", "Other"] })}
                    ${field("delivery_facility", "Facility / place")}
                    ${field("birth_weight_kg", "Birth weight (kg)", { type: "number", attrs: 'step="0.01" min="0.3" max="7"' })}
                    ${field("birth_notes", "Notes")}
                </div>
                <div class="printnote">The immunization card is laid out automatically from the child's date of birth (${esc(patient.age || "")}).</div>`,
            foot: [
                { label: "Cancel" },
                { label: "Open register entry", cls: "btn--primary", onClick: async (hh) => {
                    const v = read(hh.body);
                    if (!v.cwc_no.trim()) return toast("Enter the CWC number", "warn");
                    if (!v.caregiver_name.trim()) return toast("Enter the parent or guardian's name", "warn");
                    if (!v.caregiver_phone.trim()) return toast("Enter a contact phone number", "warn");
                    const r = await api("register_child", { data: { ...v, patient: patient.name } });
                    toast(`Registered · ${r.child.cwc_no} · serial ${r.child.serial_no}`);
                    hh.close();
                    onDone(r);
                } },
            ],
        });
        return h;
    }

    // ---------------------------------------------------------------- the immunization card
    function doseRow(d, locked, c) {
        const given = !!d.date_given;
        const na = d.status === "Not Applicable";
        const fromCard = given && c.registration_date && dateOf(d.date_given) < dateOf(c.registration_date);
        return `<tr data-dose="${esc(d.name)}" class="${na ? "na" : ""}">
            <td><b style="color:var(--ink)">${esc(d.vaccine)}</b>${d.optional ? ' <span class="printnote">optional</span>' : ""}</td>
            <td class="printnote">${esc(dateOf(d.due_date) || "—")}</td>
            <td>${pill(d.status, STATUS[d.status] || "mute")}</td>
            <td>${locked ? esc(dateOf(d.date_given) || "—")
                : `<input type="date" data-k="date_given" value="${esc(dateOf(d.date_given) || "")}" min="${esc(dateOf(c.dob) || "")}" max="${today()}" ${na ? "disabled" : ""}>`}
                ${fromCard ? '<div class="printnote" title="Given before the child was registered here">from card</div>' : ""}</td>
            <td>${locked ? esc(d.batch_no || "—")
                : `<input type="text" data-k="batch_no" placeholder="Batch no." value="${esc(d.batch_no || "")}" ${na || !given ? (na ? "disabled" : "") : ""}>`}</td>
            <td class="num">${locked ? "" : `<button class="btn btn--sm" data-give title="Record as given today">Today</button>`}</td>
        </tr>`;
    }

    function cardHtml(child, locked) {
        const byMilestone = {};
        child.doses.forEach((d) => (byMilestone[d.milestone] = byMilestone[d.milestone] || []).push(d));
        const order = MILESTONES.filter((m) => byMilestone[m]).concat(Object.keys(byMilestone).filter((m) => !MILESTONES.includes(m)));
        return order.map((m) => {
            const rows = byMilestone[m], given = rows.filter((d) => d.date_given).length;
            const late = rows.filter((d) => !d.date_given && d.status === "Overdue").length;
            return `<details class="msblock" data-ms="${esc(m)}" ${openMilestones.has(m) ? "open" : ""}>
                <summary class="msblock__head"><b>${esc(m)}</b><span>${late ? `<em style="color:var(--bad);font-style:normal;font-weight:600">${late} overdue</em> · ` : ""}${given} of ${rows.length} given</span></summary>
                <table class="rtable">
                    <tr><th style="width:30%">Vaccine</th><th>Due</th><th>Status</th><th style="width:150px">Date given</th><th style="width:150px">Batch no.</th><th></th></tr>
                    ${rows.map((d) => doseRow(d, locked, child)).join("")}
                </table>
            </details>`;
        }).join("");
    }
    const openMilestones = new Set();   // sections the user has opened stay open after a save

    // ---------------------------------------------------------------- register header (section 1)
    /** Section 1: registration and demographics. A registered child fills itself in (revisit). */
    function renderHeader(el, ctx, { attendance, kind, locked, onChange }) {
        if (!ctx) { el.innerHTML = ""; return; }
        if (!ctx.registered) {
            el.innerHTML = `<div class="cwchead cwchead--new">
                <div><span class="tag tag--com">New visit</span>
                <p style="margin:8px 0 0;color:var(--ink-3)">This child is not in the CWC register yet. Enter the CWC number from the child's card to open the register entry. After this, every visit fills itself in.</p></div>
                ${locked ? "" : '<button class="btn btn--primary" id="cwc-register">Enter CWC number &amp; register</button>'}</div>`;
            const btn = $("#cwc-register", el);
            if (btn) btn.addEventListener("click", () => registerForm(ctx.patient, ctx.suggested_cwc_no, (r) => onChange(r)));
            return;
        }
        const c = ctx.child;
        el.innerHTML = `<div class="cwcbar">
                <div><small>Visit</small><b>${kind === "Revisit" ? '<span class="tag tag--emp">Revisit</span>' : '<span class="tag tag--com">New visit</span>'}</b></div>
                <div><small>CWC No.</small><b>${esc(c.cwc_no || "—")}</b></div>
                <div><small>Serial</small><b>${esc(c.serial_no || "—")}</b></div>
                <div><small>Child</small><b>${esc(c.child_name || "—")}</b></div>
                <div><small>Age</small><b>${c.age_months != null ? esc(c.age_months) + " months" : "—"}</b></div>
                <div><small>Sex</small><b>${esc(c.sex || "—")}</b></div>
                <div><small>Caregiver</small><b>${esc(c.caregiver_name || "—")}</b><span class="printnote">${esc(c.caregiver_phone || "")}</span></div>
                <div><small>Residence</small><b>${esc(c.village || "—")}</b></div>
                <div class="cwcbar__end">${locked ? "" : '<button class="btn btn--sm" id="cwc-edit">Edit details</button>'}</div>
            </div>`;
        const edit = $("#cwc-edit", el);
        if (edit) edit.addEventListener("click", () => editDetails(c, onChange));
    }

    // ---------------------------------------------------------------- CWC attendance form (sections 2-4)
    const WEIGHT = ["", "1 = Normal", "2 = Underweight (UW)", "3 = Severe Underweight (SUW)", "4 = Overweight (OW)", "5 = Obese"];
    const STUNT = ["", "1 = Normal", "2 = Stunted", "3 = Severely Stunted"];
    const VITA = ["", "1 = 6-11 Months (100,000 IU)", "2 = 12-59 Months (200,000 IU)", "3 = Not Supplemented"];
    const DEV = ["", "1 = Normal / Up to Date", "2 = Delayed (Specify details)", "3 = Not Assessed"];
    const MILESTONES_LIST = ["Head Control", "Sitting", "Standing / Walking", "Talking / Speech"];
    const DANGER = ["Unable to Breastfeed/Drink", "Vomits Everything", "Bloody Diarrhoea", "Has Oedema", "Has Convulsions", "Lethargic / Unconscious", "None"];
    const MUAC_TEXT = { 1: "1 = Green (Normal >= 12.5cm)", 2: "2 = Yellow (MAM 11.5cm - 12.4cm)", 3: "3 = Red (SAM < 11.5cm)" };
    const muacCode = (cm) => (!cm ? 0 : cm >= 12.5 ? 1 : cm >= 11.5 ? 2 : 3);
    const csv = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
    const num = (v) => (v == null || v === "" || Number(v) === 0 ? "" : v);
    const opts = (arr) => arr.map((v) => ({ value: v, label: v || "—" }));

    function multi(group, items, selected, locked) {
        const on = new Set(selected);
        return `<div class="multi" data-multi-group="${group}">${items.map((x) => `<label class="chipcheck ${on.has(x) ? "on" : ""}">
            <input type="checkbox" data-multi="${group}" value="${esc(x)}" ${on.has(x) ? "checked" : ""} ${locked ? "disabled" : ""}> ${esc(x)}</label>`).join("")}</div>`;
    }

    function growthTable(growth) {
        if (!growth || !growth.length) return '<div class="printnote">No earlier CWC visits recorded.</div>';
        return `<table class="dtable" style="margin-top:6px"><tr><th>Date</th><th class="num">Age (mo)</th><th class="num">Weight</th><th class="num">Height</th><th class="num">MUAC</th><th>Weight cat.</th><th>Stunting</th></tr>
            ${growth.map((g) => `<tr><td>${esc(dateOf(g.attendance_date))}</td><td class="num">${esc(g.cwc_age_months ?? "")}</td>
                <td class="num">${g.weight_kg ? esc(g.weight_kg) + " kg" : "—"}</td><td class="num">${g.height_cm ? esc(g.height_cm) + " cm" : "—"}</td><td class="num">${g.muac_cm ? esc(g.muac_cm) + " cm" : "—"}</td>
                <td>${esc((g.weight_category || "—").replace(/^\d = /, ""))}</td><td>${esc((g.stunting_status || "—").replace(/^\d = /, ""))}</td></tr>`).join("")}</table>`;
    }

    /** Sections 2-4 of the CWC register, edited as part of the attendance. */
    function renderForm(el, a, ctx, { locked }) {
        const child = ctx && ctx.registered ? ctx.child : null;
        const months = child ? child.age_months : a.cwc_age_months;
        const under6 = months != null && months < 6, from12 = months != null && months >= 12;
        const growth = ctx && ctx.growth ? ctx.growth : [];
        const last = growth[0];
        const delta = last && a.weight_kg && last.weight_kg ? Number(a.weight_kg) - Number(last.weight_kg) : null;
        const dis = locked ? "disabled" : "";
        const ro = (label, value) => `<div class="field"><label>${label}</label><div class="input" style="background:transparent">${esc(value ?? "—")}</div></div>`;

        el.innerHTML = `
            <div class="subhead">2 · Anthropometric &amp; nutrition assessment</div>
            <div class="grid-4">
                ${ro("Birth weight (kg)", child && child.birth_weight_kg ? child.birth_weight_kg : "—")}
                ${field("weight_kg", "Weight (kg)", { type: "number", value: num(a.weight_kg), attrs: `step="0.01" min="0.3" max="30" ${dis}`, required: true,
                    help: last && last.weight_kg ? `Last: ${esc(last.weight_kg)} kg${delta != null ? " (" + (delta >= 0 ? "+" : "") + delta.toFixed(2) + " kg)" : ""}` : "" })}
                ${field("weight_category", "Weight category", { type: "select", options: opts(WEIGHT), value: a.weight_category || "", attrs: dis, required: true })}
                ${field("height_cm", "Height / length (cm)", { type: "number", value: num(a.height_cm), attrs: `step="0.1" min="30" max="130" ${dis}`, required: true,
                    help: last && last.height_cm ? `Last: ${esc(last.height_cm)} cm` : "" })}
                ${field("stunting_status", "Height/length stunting category", { type: "select", options: opts(STUNT), value: a.stunting_status || "", attrs: dis, required: true })}
                ${field("muac_cm", "MUAC (cm)", { type: "number", value: num(a.muac_cm), attrs: `step="0.1" min="5" max="25" ${dis}`, help: "Optional" })}
                <div class="field"><label>MUAC color category</label><div class="input" id="muac-cat" style="background:transparent">${esc(a.muac_category || "—")}</div><small>Worked out from the measurement</small></div>
            </div>
            <div class="printnote" style="margin:-4px 0 8px">Weight-for-age and stunting categories are read from the child's growth chart.</div>
            <details style="margin-bottom:10px"><summary class="printnote" style="cursor:pointer">Growth history (${growth.length} earlier visit${growth.length === 1 ? "" : "s"})</summary>${growthTable(growth)}</details>

            <div class="subhead">3 · Infant &amp; young child feeding / supplementation</div>
            <div class="grid-4">
                ${under6 || months == null ? field("cwc_exclusive_bf", "Exclusive breastfeeding (< 6 months)", { type: "select", options: opts(["", "Yes", "No"]), value: a.cwc_exclusive_bf || "", attrs: dis }) : ro("Exclusive breastfeeding", "Not applicable (6 months or older)")}
                ${field("vit_a_supplementation", "Vitamin A supplementation", { type: "select", options: opts(VITA), value: a.vit_a_supplementation || "", attrs: dis })}
                <div class="field" style="justify-content:center">${field("mnp_given", "Micronutrient powder (MNP) received", { type: "checkbox", value: a.mnp_given, attrs: dis })}</div>
                <div class="field" style="justify-content:center">${from12 || months == null ? field("dewormed", "Dewormed (12–59 months)", { type: "checkbox", value: a.dewormed, attrs: dis }) : '<span class="printnote">Deworming from 12 months</span>'}</div>
            </div>

            <div class="subhead">4 · Development &amp; health screening</div>
            <div class="grid-2">
                ${field("developmental_status", "Developmental milestones assessed", { type: "select", options: opts(DEV), value: a.developmental_status || "", attrs: dis, required: true })}
                <div class="field"><label>Milestones checked</label>${multi("milestones_checked", MILESTONES_LIST, csv(a.milestones_checked), locked)}</div>
            </div>
            <div id="delay-box" style="display:${String(a.developmental_status || "").startsWith("2") ? "block" : "none"}">
                ${field("milestone_delay_details", "Delay details (specify)", { type: "textarea", rows: 2, value: a.milestone_delay_details, attrs: dis })}</div>
            <div class="grid-2">
                <div>${field("disability_identified", "Disability identified", { type: "checkbox", value: a.disability_identified, attrs: dis })}
                    <div id="disability-box" style="display:${a.disability_identified ? "block" : "none"}">${field("disability_details", "Details", { type: "textarea", rows: 2, value: a.disability_details, attrs: dis })}</div></div>
                <div class="field"><label>Immunization status up to date</label><div class="input" style="background:transparent">${
                    child ? (a.immunization_up_to_date || (!child.is_defaulter && !child.overdue_count) ? "Yes" : `No — ${child.overdue_count} dose(s) overdue`) : "Register the child first"}</div><small>Taken from the immunization card</small></div>
            </div>
            <div class="field"><label>Danger signs screened <span class="req">*</span></label>${multi("danger_signs", DANGER, csv(a.danger_signs), locked)}
                <small>Choose every sign found, or "None" if the child has none.</small></div>`;

        if (locked) return;
        const muac = $("[data-f=muac_cm]", el);
        if (muac) muac.addEventListener("input", () => {
            const code = muacCode(Number(muac.value));
            const box = $("#muac-cat", el);
            box.textContent = code ? MUAC_TEXT[code] : "—";
            box.style.color = code === 3 ? "var(--bad)" : code === 2 ? "var(--warn)" : code === 1 ? "var(--good)" : "";
            box.style.fontWeight = code ? "600" : "";
        });
        const dev = $("[data-f=developmental_status]", el);
        dev.addEventListener("change", () => ($("#delay-box", el).style.display = dev.value.startsWith("2") ? "block" : "none"));
        const dis_ = $("[data-f=disability_identified]", el);
        dis_.addEventListener("change", () => ($("#disability-box", el).style.display = dis_.checked ? "block" : "none"));
        $$("[data-multi]", el).forEach((box) => box.addEventListener("change", () => {
            const group = $(`[data-multi-group="${box.dataset.multi}"]`, el);
            if (box.dataset.multi === "danger_signs" && box.checked) {   // "None" and a real sign exclude each other
                $$("[data-multi=danger_signs]", group).forEach((o) => { if ((o.value === "None") !== (box.value === "None") && o !== box) o.checked = false; });
            }
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

    // ---------------------------------------------------------------- immunizations tab
    /** The child's immunization card, with its own save. */
    function renderCard(el, ctx, { attendance, locked, onChange }) {
        if (!ctx) { el.innerHTML = ""; return; }
        if (!ctx.registered) {
            el.innerHTML = `<div class="liveinfo" style="background:var(--warn-bg);color:var(--warn)">Register the child on the <b>CWC Attendance</b> tab first. The immunization card is laid out from the child's date of birth.</div>`;
            return;
        }
        const c = ctx.child;
        el.innerHTML = `
            <div class="printnote" style="margin:0 0 12px">${c.is_defaulter ? `<b style="color:var(--bad)">${esc(c.overdue_count)} dose(s) overdue.</b> ` : ""}${esc(c.immunization_summary || "")}${c.next_due_vaccine ? ` · next due: <b>${esc(c.next_due_vaccine)}</b> on ${esc(dateOf(c.next_due_date))}` : " · schedule complete"}</div>
            ${locked ? "" : `<div class="printnote" style="margin:0 0 10px">Child immunized before coming here? Enter the dates and batch numbers from the child's card. Doses dated before registration are kept as history and are not counted in this clinic's figures.</div>`}
            <div id="cwc-card">${cardHtml(c, locked)}</div>
            ${locked ? "" : '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px"><button class="btn btn--primary" id="cwc-save">Save immunizations</button></div>'}`;
        $$("details.msblock", el).forEach((d) => d.addEventListener("toggle", () => (d.open ? openMilestones.add(d.dataset.ms) : openMilestones.delete(d.dataset.ms))));
        if (locked) return;
        $$("[data-give]", el).forEach((b) => b.addEventListener("click", () => {
            const row = b.closest("[data-dose]");
            $("[data-k=date_given]", row).value = today();
            $("[data-k=batch_no]", row).focus();
        }));
        $("#cwc-save", el).addEventListener("click", async (ev) => {
            const btn = ev.currentTarget;
            const doses = $$("[data-dose]", el).map((row) => ({
                name: row.dataset.dose,
                date_given: $("[data-k=date_given]", row).value,
                batch_no: $("[data-k=batch_no]", row).value,
            }));
            btn.disabled = true;
            try {
                const r = await api("record_doses", { child: c.name, doses, attendance });
                toast(r.given.length ? `Recorded: ${r.given.join(", ")}` : "Immunization card saved");
                onChange({ ...ctx, registered: true, child: r.child });
            } finally { btn.disabled = false; }
        });
    }

    function editDetails(c, onChange) {
        const h = modal({
            title: "CWC register details",
            sub: `${esc(c.child_name)} · ${esc(c.cwc_no || "")}`,
            size: "wide",
            body: `<div class="subhead">Registration</div>
                <div class="grid-3">
                    ${field("cwc_no", "CWC No.", { value: c.cwc_no, required: true })}
                    ${field("village", "Residence / village / landmark", { value: c.village })}
                    ${field("status", "Register status", { type: "select", options: ["Active", "Transferred Out", "Completed", "Deceased", "Inactive"], value: c.status })}
                </div>
                <div class="subhead">Parent / guardian</div>
                <div class="grid-4">
                    ${field("caregiver_name", "Parent / guardian name", { value: c.caregiver_name, required: true })}
                    ${field("caregiver_relationship", "Relationship", { type: "select", options: ["Mother", "Father", "Grandparent", "Guardian", "Other"], value: c.caregiver_relationship })}
                    ${field("caregiver_phone", "Contact phone number", { value: c.caregiver_phone, required: true })}
                    ${field("alt_phone", "Alternative phone", { value: c.alt_phone })}
                </div>
                <div class="subhead">Birth attendance &amp; weight</div>
                <div class="grid-4">
                    ${field("delivery_place", "Place of delivery", { type: "select", options: ["", "Health Facility", "Home", "Other"], value: c.delivery_place })}
                    ${field("delivery_facility", "Facility / place", { value: c.delivery_facility })}
                    ${field("birth_weight_kg", "Birth weight (kg)", { type: "number", value: c.birth_weight_kg, attrs: 'step="0.01"' })}
                    ${field("birth_notes", "Notes", { value: c.birth_notes })}
                </div>`,
            foot: [{ label: "Cancel" }, { label: "Save details", cls: "btn--primary", onClick: async (hh) => {
                const v = read(hh.body);
                if (!v.caregiver_name.trim() || !v.caregiver_phone.trim()) return toast("The guardian's name and phone are required", "warn");
                const child = await api("save_child", { child: c.name, data: v });
                toast("Register details saved");
                hh.close();
                onChange({ registered: true, child });
            } }],
        });
    }

    // ---------------------------------------------------------------- defaulters
    function childCard(r) {
        return `<div class="qcard" data-child="${esc(r.child)}"><div class="qcard__stripe Emergency"></div>
            <div><div class="qcard__name">${esc(r.child_name)} <span class="tag tag--com">${esc(r.sex || "")}</span> ${pill(ago(r.days_late), "bad")}</div>
            <div class="qcard__meta">${esc(r.cwc_no)} · serial ${esc(r.serial_no)} · ${esc(r.age || "")}${r.village ? " · " + esc(r.village) : ""}</div>
            <div class="qcard__note alert">${r.overdue} overdue: ${esc(r.vaccines)}</div></div>
            <div class="qcard__side"><span class="printnote">${esc(r.caregiver_name || "")}</span>
                <button class="btn btn--sm" data-open="${esc(r.child)}">Details &amp; contacts</button></div></div>`;
    }

    function renderDefaulters(el, rows) {
        el.innerHTML = rows.length
            ? rows.map(childCard).join("")
            : empty("No child has a missed immunization. Nothing to follow up.");
        $$("[data-open]", el).forEach((b) => b.addEventListener("click", () => contacts(rows.find((r) => r.child === b.dataset.open))));
    }

    /** The follow-up popup: who the child is and how to reach the guardian. */
    function contacts(r) {
        if (!r) return;
        modal({
            title: r.child_name,
            sub: `${esc(r.cwc_no)} · serial ${esc(r.serial_no)} · ${esc(r.age || "")} · ${esc(r.sex || "")}`,
            body: `<div class="contactbox">
                    <div class="contactbox__who"><small>Parent / guardian</small><b>${esc(r.caregiver_name || "—")}</b>
                        <span class="printnote">${esc(r.caregiver_relationship || "")}</span></div>
                    <div class="contactbox__nums">
                        <div><small>Phone</small><b>${tel(r.caregiver_phone)}</b></div>
                        ${r.alt_phone ? `<div><small>Alternative</small><b>${tel(r.alt_phone)}</b></div>` : ""}
                    </div>
                </div>
                <div class="grid-2" style="margin-top:4px">
                    <div class="field"><label>Residence</label><div class="input" style="background:transparent">${esc(r.village || "—")}</div></div>
                    <div class="field"><label>Last seen at the clinic</label><div class="input" style="background:transparent">${esc(dateOf(r.last_seen) || "No previous attendance")}</div></div>
                </div>
                <div class="subhead">Missed immunizations (${r.overdue})</div>
                <div class="liveinfo" style="background:var(--bad-bg);color:var(--bad)">${esc(r.vaccines)}</div>
                <div class="printnote">Oldest dose was due on ${esc(dateOf(r.oldest_due))} — ${esc(ago(r.days_late))}.</div>`,
            foot: [
                { label: "Close" },
                { label: "Open register entry", onClick: () => window.open(`/app/clinic-child-record/${encodeURIComponent(r.child)}`, "_blank") },
            ],
        });
    }

    // ---------------------------------------------------------------- child lookup
    async function findChild(onPick) {
        const h = modal({
            title: "Find a child in the CWC register",
            sub: "Search by CWC number, name, serial number or the guardian's phone.",
            size: "wide",
            body: `<div class="field"><input class="input" id="cwc-q" placeholder="Start typing…" autofocus></div><div id="cwc-results" class="queue"></div>`,
        });
        const results = $("#cwc-results", h.body);
        async function search() {
            const rows = await api("search_children", { q: $("#cwc-q", h.body).value });
            results.innerHTML = rows.length ? rows.map((r, i) => `<div class="qcard" style="grid-template-columns:1fr auto;padding:14px 18px">
                <div><div class="qcard__name">${esc(r.child_name)} ${r.is_defaulter ? pill("Defaulter", "bad") : ""}</div>
                <div class="qcard__meta">${esc(r.cwc_no)} · serial ${esc(r.serial_no)} · ${esc(r.age || "")} · guardian ${esc(r.caregiver_name || "")} ${esc(r.caregiver_phone || "")}</div></div>
                <button class="btn btn--primary btn--sm" data-i="${i}">Open</button></div>`).join("") : empty("No matching child.");
            $$("button[data-i]", results).forEach((b) => b.addEventListener("click", () => { h.close(); onPick(rows[Number(b.dataset.i)]); }));
        }
        let t;
        $("#cwc-q", h.body).addEventListener("input", () => { clearTimeout(t); t = setTimeout(search, 250); });
        search();
    }

    return { api, renderHeader, renderForm, renderCard, multiValues, renderDefaulters, contacts, findChild, registerForm };
})();
