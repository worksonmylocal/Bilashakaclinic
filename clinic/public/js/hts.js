/* HIV testing clinic: the HTS attendance form (test type, the two tests, couple testing, counselling, prevention).
   Loaded by the HTS desk; clinic_unit.js calls into window.HTS. */
window.HTS = (function () {
    const { $, $$, esc, field } = Desk;

    const opts = (arr) => arr.map((v) => ({ value: v, label: v || "—" }));
    const csv = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
    const TEST_TYPE = ["", "Initial test", "Repeat test", "Retesting"];
    const RESULT = ["", "Reactive", "Non-reactive"];
    const COUPLE = ["", "N = Tested as couple and concordant", "Y = Tested as couple and discordant (One positive, one negative)", "N/A = Individual Testing"];
    const PREVENTION = ["Condoms Provided", "PrEP (Pre-Exposure Prophylaxis)", "PEP", "VMMC Reference", "None"];

    // the outcome follows the two tests: both reactive is positive, both non-reactive negative, anything else is inconclusive
    const outcome = (t1, t2) => (!t1 || !t2 ? "" : t1 === "Reactive" && t2 === "Reactive" ? "Positive" : t1 === t2 ? "Negative" : "Inconclusive");
    const OUTCOME_HTML = {
        "": '<span class="printnote">Enter both test results to see the outcome.</span>',
        Negative: '<b style="color:var(--good)">Negative</b> · both tests non-reactive',
        Positive: '<b style="color:var(--bad)">Positive</b> · both tests reactive. Link the client to care (use Referral if she or he is going to a CCC).',
        Inconclusive: '<b style="color:var(--warn)">Inconclusive</b> · the two tests disagree. Repeat the testing and book a follow-up.',
    };

    function multi(group, items, selected, locked) {
        const on = new Set(selected);
        return `<div class="multi" data-multi-group="${group}">${items.map((x) => `<label class="chipcheck ${on.has(x) ? "on" : ""}">
            <input type="checkbox" data-multi="${group}" value="${esc(x)}" ${on.has(x) ? "checked" : ""} ${locked ? "disabled" : ""}> ${esc(x)}</label>`).join("")}</div>`;
    }

    function renderForm(el, a, { locked }) {
        const dis = locked ? "disabled" : "";
        const result = outcome(a.hts_test1_result, a.hts_test2_result);
        el.innerHTML = `
            <div class="subhead" style="margin-top:0">1 · Type of test</div>
            <div class="grid-3">
                ${field("hts_test_type", "Test type", { type: "select", options: opts(TEST_TYPE), value: a.hts_test_type || "", attrs: dis, required: true })}
            </div>

            <div class="subhead">2 · HIV tests (both are required)</div>
            <div class="grid-3">
                ${field("hts_test1_result", "Test 1: Determine (screening)", { type: "select", options: opts(RESULT), value: a.hts_test1_result || "", attrs: dis, required: true })}
                ${field("hts_test2_result", "Test 2: Confirmatory", { type: "select", options: opts(RESULT), value: a.hts_test2_result || "", attrs: dis, required: true })}
                <div class="field"><label>Outcome</label><div class="input" id="hts-outcome" style="background:transparent;height:auto;min-height:42px">${OUTCOME_HTML[result]}</div></div>
            </div>

            <div class="subhead">3 · Couple testing &amp; discordancy status</div>
            ${field("couple_status", "Couple testing & discordancy status", { type: "select", options: opts(COUPLE), value: a.couple_status || "", attrs: dis, required: true })}

            <div class="subhead">4 · Counselling &amp; prevention</div>
            <div class="field" style="justify-content:center">${field("post_test_counselling", "Post-test counselling provided", { type: "checkbox", value: a.post_test_counselling, attrs: dis })}</div>
            <div id="hts-prev" style="display:${result === "Negative" ? "block" : "none"}">
                <div class="field"><label>Prevention services offered (client tested negative) <span class="req">*</span></label>${multi("prevention_services", PREVENTION, csv(a.prevention_services), locked)}
                    <small>Choose every service offered, or "None".</small></div>
            </div>
            <div id="hts-prev-na" class="printnote" style="display:${result === "Negative" ? "none" : "block"}">Prevention services are offered when the client's outcome is negative.</div>

            <div class="subhead">5 · Remarks</div>
            ${field("hts_remarks", "Remarks", { type: "textarea", rows: 3, value: a.hts_remarks, attrs: dis })}`;

        if (locked) return;
        const refresh = () => {
            const r = outcome($("[data-f=hts_test1_result]", el).value, $("[data-f=hts_test2_result]", el).value);
            $("#hts-outcome", el).innerHTML = OUTCOME_HTML[r];
            $("#hts-prev", el).style.display = r === "Negative" ? "block" : "none";
            $("#hts-prev-na", el).style.display = r === "Negative" ? "none" : "block";
        };
        $("[data-f=hts_test1_result]", el).addEventListener("change", refresh);
        $("[data-f=hts_test2_result]", el).addEventListener("change", refresh);
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

    return { renderForm, multiValues };
})();
