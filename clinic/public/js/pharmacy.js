/* Pharmacy page */
(async function () {
    const { call, $, $$, esc, num, timeOf, wait, typeTag, pill, ageSex, empty, toast, kpis, hbars, chart, modal, field, read, banner, COLORS } = Desk;

    await Desk.shell({
        page: "pharmacy",
        eyebrow: "Northlake Medical Centre · Pharmacy",
        title: "Pharmacy",
        sub: "Prescriptions from the doctor, ready to be checked and dispensed",
        tools: `<button class="iconbtn" id="refresh" title="Refresh">${Desk.REFRESH_ICON}</button>`,
    });
    Desk.tabs((tab) => tab === "insights" && loadInsights());
    $("#refresh").addEventListener("click", () => { loadAll(); toast("Refreshed"); });

    let dash;

    async function loadAll() {
        dash = await call("pharmacy.dashboard");
        const k = dash.kpis;
        kpis($("#kpis"), [
            { label: "Waiting to be Dispensed", value: k.waiting, cls: k.waiting ? "warn" : "", unit: k.waiting ? `Longest wait ${Desk.duration(k.longest_wait)}` : "No prescriptions waiting" },
            { label: "Dispensed Today", value: k.dispensed_today, cls: "good", unit: `${Desk.split(k.employees_today, k.community_today)}` },
            { label: "Items Dispensed", value: num(k.units_today), unit: `${k.lines_today} medicine lines today` },
            { label: "Avg Wait", value: `${k.avg_wait}<span style="font-size:14px;font-weight:500"> min</span>`, unit: "Prescription → dispensed" },
            { label: "Allergy Alerts", value: k.with_allergies, cls: k.with_allergies ? "bad" : "", unit: "Waiting patients with allergies on file" },
        ]);
        renderQueue(); renderDispensed();
        if ($("#tab-insights").classList.contains("on")) loadInsights();
    }

    function renderQueue() {
        $("#queue-meta").textContent = dash.pending.length ? `${dash.pending.length} waiting` : "";
        $("#queue").innerHTML = dash.pending.length ? dash.pending.map((r) => `
            <div class="qcard"><div class="qcard__stripe ${r.allergies ? "Emergency" : ""}"></div>
                <div><div class="qcard__name">${esc(r.patient_name)} ${typeTag(r.patient_type)}</div>
                <div class="qcard__meta">${esc(r.visit)} · ${esc(ageSex(r))} · ${r.item_count} item(s) · Dr ${esc(r.doctor_name || "—")}</div>
                ${r.diagnoses ? `<div class="qcard__note">${esc(r.diagnoses)}</div>` : ""}
                ${r.allergies ? `<div class="qcard__note alert">⚠ Allergy: ${esc(r.allergies)}</div>` : ""}</div>
                <div class="qcard__side">${wait(r.wait_minutes, 10, 25)}<button class="btn btn--primary btn--sm" data-open="${esc(r.name)}">Dispense</button></div></div>`).join("")
            : empty("No prescriptions waiting.");
        $$("#queue [data-open]").forEach((b) => b.addEventListener("click", () => openDispensing(b.dataset.open)));
    }

    function renderDispensed() {
        $("#dispensed").innerHTML = dash.dispensed.length ? `<table class="dtable"><tr><th>Time</th><th>Patient</th><th>Type</th><th class="num">Items</th><th>Pharmacist</th><th></th></tr>
            ${dash.dispensed.map((r) => `<tr><td>${timeOf(r.dispensed_on)}</td><td><b style="color:var(--ink)">${esc(r.patient_name)}</b></td><td>${typeTag(r.patient_type)}</td>
                <td class="num">${r.item_count}</td><td>${esc(r.pharmacist_name || "")}</td>
                <td class="num"><button class="btn btn--link btn--sm" data-open="${esc(r.name)}">View</button></td></tr>`).join("")}</table>`
            : empty("Nothing dispensed yet today.");
        $$("#dispensed [data-open]").forEach((b) => b.addEventListener("click", () => openDispensing(b.dataset.open)));
    }

    async function loadInsights() {
        const d = await call("pharmacy.insights");
        hbars($("#top-drugs"), d.top_drugs, { format: (v, r) => `${num(v)} <span style="color:var(--ink-mute)">(${r.prescriptions}×)</span>` });
        chart("day-chart", { type: "bar", data: { labels: d.by_day.map((r) => r.day.slice(5)), datasets: Desk.stackedDatasets(d.by_day) }, options: { ...Desk.stackedOptions, plugins: { legend: { display: false } } } });
    }

    async function openDispensing(name) {
        const d = await call("pharmacy.get_dispensing", { name });
        const done = d.docstatus === 1;
        const p = d.patient_card;
        const h = modal({
            title: done ? "Dispensed" : "Dispense medication",
            sub: `${esc(d.name)} · ${esc(d.visit)} · prescribed by Dr ${esc(d.doctor_name || "—")}`,
            size: "wide",
            body: `${banner(p, { extra: d.weight_kg ? `<span class="flag flag--info">${d.weight_kg} kg</span>` : "" })}
                ${p.allergies ? `<div class="liveinfo" style="background:var(--bad-bg);color:var(--bad)">⚠ Known allergies: <b>${esc(p.allergies)}</b> — check every item before dispensing.</div>` : ""}
                ${d.diagnoses.length ? `<div class="printnote" style="margin-bottom:14px">Diagnosis: ${d.diagnoses.map(esc).join(", ")}</div>` : ""}
                <table class="rtable"><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Days</th><th>Prescribed</th><th style="width:120px">${done ? "Dispensed" : "Dispense qty"}</th></tr>
                ${d.items.map((r) => `<tr><td><b style="color:var(--ink)">${esc(r.drug_name || r.drug)}</b>${r.route && r.route !== "Oral" ? `<br><span class="printnote">${esc(r.route)}</span>` : ""}
                    ${r.instructions ? `<br><span class="printnote">${esc(r.instructions)}</span>` : ""}</td>
                    <td>${esc(r.dose || "")}</td><td>${esc(r.frequency || "")}</td><td>${r.duration_days || ""}</td>
                    <td>${r.prescribed_qty} ${esc(r.uom || "")}</td>
                    <td>${done ? `<b>${r.dispensed_qty}</b>` : `<input type="number" min="0" step="any" data-item="${esc(r.name)}" value="${r.dispensed_qty}">`}</td></tr>`).join("")}</table>
                <div style="margin-top:16px">${field("notes", "Pharmacy notes", { type: "textarea", rows: 2, value: d.notes, attrs: done ? "disabled" : "", placeholder: "Substitutions, counselling given, items out of stock…" })}</div>`,
            foot: done ? [{ label: "Close" }] : [
                { label: "Close" },
                { label: "Save", onClick: (hh) => submit(hh, 0) },
                { label: "Dispense & complete ✓", cls: "btn--primary", onClick: (hh) => submit(hh, 1) },
            ],
        });

        async function submit(hh, finalise) {
            const items = $$("[data-item]", hh.body).map((i) => ({ name: i.dataset.item, dispensed_qty: i.value }));
            if (finalise && items.every((i) => !Number(i.dispensed_qty))) return toast("Enter the quantities dispensed", "warn");
            const short = $$("[data-item]", hh.body).filter((i) => Number(i.value) < Number(d.items.find((x) => x.name === i.dataset.item).prescribed_qty));
            if (finalise && short.length && !confirm(`${short.length} item(s) are being dispensed below the prescribed quantity. Continue?`)) return;
            const notes = read(hh.body).notes;
            await call("pharmacy.dispense", { name, items, notes, submit: finalise });
            toast(finalise ? "Dispensed. Visit completed." : "Saved");
            hh.close();
            loadAll();
        }
    }

    await loadAll();
    Desk.poll(loadAll);
})();
