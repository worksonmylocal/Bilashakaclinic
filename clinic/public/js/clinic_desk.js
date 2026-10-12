/* Bilashaka Clinic desk: helpers shared by the Triage, Consultation, Lab and Pharmacy pages. */
window.Desk = (function () {
    const cfg = window.CLINIC || {};
    const PAGES = [
        { key: "triage", label: "Triage", href: "/clinic/triage" },
        { key: "consultation", label: "Consultation", href: "/clinic/consultation" },
        { key: "lab", label: "Laboratory", href: "/clinic/lab" },
        { key: "pharmacy", label: "Pharmacy", href: "/clinic/pharmacy" },
        { key: "antenatal", label: "Antenatal", href: "/clinic/antenatal" },
        { key: "mch", label: "MCH & PNC", href: "/clinic/mch" },
        { key: "tb", label: "TB Clinic", href: "/clinic/tb" },
    ];
    const COLORS = { emp: "#2c6bb3", com: "#228883", ink: "#0a0a0a", warn: "#b9770e", bad: "#c4302b", good: "#1a8a3a" };

    // ---------------------------------------------------------------- utils
    const esc = (s) =>
        String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const num = (n) => Number(n || 0).toLocaleString();
    const initials = (name) =>
        String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    const timeOf = (dt) => (dt ? String(dt).slice(11, 16) : "");
    const dateOf = (dt) => (dt ? String(dt).slice(0, 10) : "");
    const duration = (mins) => {
        mins = Number(mins || 0);
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60);
        return h >= 24 ? `${Math.floor(h / 24)} d` : `${h} h ${mins % 60} min`;
    };
    const waitClass = (mins, warnAt = 20, badAt = 45) => (mins >= badAt ? "bad" : mins >= warnAt ? "warn" : "");
    const wait = (mins, warnAt, badAt) => `<span class="wait ${waitClass(mins, warnAt, badAt)}">${duration(mins)}</span>`;
    const typeTag = (t) =>
        t === "Employee" ? '<span class="tag tag--emp">Employee</span>' : '<span class="tag tag--com">Community</span>';
    const pill = (text, cls = "mute") => `<span class="pill ${cls}">${esc(text)}</span>`;
    const ageSex = (r) => [r.age_years != null && r.age_years !== "" ? r.age_years + " yrs" : r.age, r.sex].filter(Boolean).join(" · ");
    const split = (e, c) => `${num(e)} employee${Number(e) === 1 ? "" : "s"} · ${num(c)} community`;
    const money = (n) => "KSh " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const empty = (msg) => `<div class="empty empty--pad">${esc(msg)}</div>`;
    const plain = (html) => {
        const d = document.createElement("div");
        d.innerHTML = html;
        return d.textContent;
    };

    // ---------------------------------------------------------------- toast
    function toast(msg, type = "") {
        let box = $(".toasts");
        if (!box) {
            box = document.createElement("div");
            box.className = "toasts";
            document.body.appendChild(box);
        }
        const t = document.createElement("div");
        t.className = "toast" + (type ? " toast--" + type : "");
        t.textContent = msg;
        box.appendChild(t);
        setTimeout(() => t.remove(), type === "error" ? 7000 : 3500);
    }

    // ---------------------------------------------------------------- api
    function serverMessage(data) {
        try {
            const msgs = JSON.parse(data._server_messages || "[]").map((m) => plain(JSON.parse(m).message));
            if (msgs.length) return msgs.join(" ");
        } catch (e) { /* fall through */ }
        if (data.exception) return String(data.exception).split(":").slice(1).join(":").trim() || "Something went wrong";
        return "Something went wrong";
    }

    async function call(method, args = {}, { quiet = false } = {}) {
        let res, data;
        try {
            res = await fetch("/api/method/clinic.api." + method, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json", "X-Frappe-CSRF-Token": cfg.csrf },
                credentials: "same-origin",
                body: JSON.stringify(args),
            });
            data = await res.json();
        } catch (e) {
            if (!quiet) toast("Could not reach the server. Check the connection.", "error");
            const err = new Error("network");
            err.handled = true;
            throw err;
        }
        if (!res.ok) {
            if (res.status === 401 || res.status === 403 && data.exc_type === "AuthenticationError") {
                location.href = "/login?redirect-to=" + encodeURIComponent(location.pathname);
            }
            const msg = serverMessage(data);
            if (!quiet) toast(msg, "error");
            const err = new Error(msg);
            err.handled = true;
            throw err;
        }
        return data.message;
    }

    // ---------------------------------------------------------------- shell
    async function shell({ page, eyebrow, title, sub, tools = "" }) {
        const who = await call("common.whoami", {}, { quiet: true }).catch(() => ({ pages: [page], full_name: cfg.user, user: cfg.user }));
        const nav = PAGES.filter((p) => who.pages.includes(p.key))
            .map((p) => `<a href="${p.href}" class="${p.key === page ? "on" : ""}">${p.label}</a>`).join("");
        $("#topbar").className = "topbar";
        $("#topbar").innerHTML = `
            <a class="brand" href="/clinic" title="Northlake Medical Centre">
                <img class="brand__mark" src="/assets/clinic/images/northlake-mark.svg" alt="">
                <span class="brand__text"><b>Northlake</b><small>Medical Centre · Rocco</small></span>
            </a>
            <div class="topbar__nav">${nav}</div>
            <div class="topbar__right">
                <a href="/app/clinic" title="Open the full system">Desk</a>
                <span>${esc(who.full_name || who.user)}</span>
                <div class="avatar">${esc(initials(who.full_name || who.user))}</div>
            </div>`;
        $("#pagehead").innerHTML = `
            <div>
                <div class="pagehead__eyebrow">${esc(eyebrow)}</div>
                <h1 class="pagehead__title">${esc(title)}</h1>
                <p class="pagehead__sub">${esc(sub)}</p>
            </div>
            <div class="pagehead__tools">${tools}</div>`;
        return who;
    }

    // Queue cards: show at most `n` at a time and scroll through the rest.
    const listScroll = new WeakMap();
    function limitList(el, n = 5) {
        if (!listScroll.has(el)) {
            listScroll.set(el, 0);
            el.addEventListener("scroll", () => listScroll.set(el, el.scrollTop), { passive: true });
        }
        el.style.maxHeight = "";
        el.classList.remove("scrolls");
        const cards = Array.from(el.children).filter((c) => c.classList.contains("qcard"));
        if (cards.length <= n || !el.offsetParent) return; // few entries, or hidden tab (measured when shown)
        const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
        const height = cards.slice(0, n).reduce((sum, c) => sum + c.offsetHeight, 0) + gap * (n - 1);
        el.style.maxHeight = Math.ceil(height) + "px";
        el.classList.add("scrolls");
        el.scrollTop = listScroll.get(el) || 0;
    }
    const limitAll = () => $$(".queue").forEach((q) => limitList(q));
    new MutationObserver((mutations) => {
        const lists = new Set();
        mutations.forEach((m) => { const q = m.target.closest && m.target.closest(".queue"); if (q) lists.add(q); });
        lists.forEach((q) => limitList(q));
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", limitAll);
    // Card heights change once the web font has loaded, so measure again then.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(limitAll, 50));
    window.addEventListener("load", () => setTimeout(limitAll, 300));

    function tabs(onChange) {
        $$(".tab").forEach((btn) =>
            btn.addEventListener("click", () => {
                $$(".tab").forEach((b) => b.classList.remove("on"));
                $$(".tabpanel").forEach((c) => c.classList.remove("on"));
                btn.classList.add("on");
                $("#tab-" + btn.dataset.tab).classList.add("on");
                requestAnimationFrame(limitAll);
                if (onChange) onChange(btn.dataset.tab);
            })
        );
    }

    const REFRESH_ICON =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';

    let openModals = 0;
    function poll(fn, ms = 30000) {
        setInterval(() => {
            if (document.visibilityState === "visible" && !openModals) fn();
        }, ms);
    }

    // ---------------------------------------------------------------- blocks
    function kpis(el, items) {
        el.innerHTML = items
            .map((k) => `<div class="kpi"><div class="kpi__label">${esc(k.label)}</div>
                <div class="kpi__value ${k.cls || ""}">${k.value}</div>
                ${k.unit ? `<div class="kpi__unit">${k.unit}</div>` : ""}</div>`)
            .join("");
    }

    function hbars(el, rows, { nameKey = "label", valueKey = "value", format = num, cls = () => "", wide = false } = {}) {
        if (!rows.length) { el.innerHTML = empty("No data yet."); return; }
        const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
        el.innerHTML = rows.map((r) => `<div class="hb${wide ? " hb--wide" : ""}">
            <div class="hb__name" title="${esc(r[nameKey])}">${esc(r[nameKey])}</div>
            <div class="hb__lane"><div class="hb__est"></div><div class="hb__act ${cls(r)}" style="width:${(Number(r[valueKey]) || 0) / max * 100}%"></div></div>
            <div class="hb__pct">${format(r[valueKey], r)}</div></div>`).join("");
    }

    const charts = {};
    function chart(id, config) {
        const ctx = document.getElementById(id);
        if (!ctx || !window.Chart) return;
        if (charts[id]) charts[id].destroy();
        const grid = { color: "rgba(10,10,10,0.05)" };
        config.options = Object.assign({ responsive: true, maintainAspectRatio: true }, config.options || {});
        if (config.type !== "doughnut") {
            config.options.scales = Object.assign(
                { y: { beginAtZero: true, grid, ticks: { precision: 0 } }, x: { grid: { display: false } } },
                config.options.scales || {}
            );
        }
        charts[id] = new Chart(ctx, config);
    }
    const stackedDatasets = (rows) => [
        { label: "Employees", data: rows.map((r) => Number(r.employees || 0)), backgroundColor: COLORS.emp, borderRadius: 6, maxBarThickness: 34 },
        { label: "Community", data: rows.map((r) => Number(r.community || 0)), backgroundColor: COLORS.com, borderRadius: 6, maxBarThickness: 34 },
    ];
    const stackedOptions = { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(10,10,10,0.05)" } } } };

    // ---------------------------------------------------------------- modal
    function modal({ title, sub = "", body = "", foot = [], size = "", onClose }) {
        const back = document.createElement("div");
        back.className = "modal-back";
        back.innerHTML = `<div class="modal ${size ? "modal--" + size : ""}" role="dialog" aria-modal="true">
            <div class="modal__head"><div><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ""}</div>
            <button class="modal__x" aria-label="Close">&times;</button></div>
            <div class="modal__body"></div><div class="modal__foot"></div></div>`;
        document.body.appendChild(back);
        openModals++;
        const bodyEl = $(".modal__body", back);
        const footEl = $(".modal__foot", back);
        if (typeof body === "string") bodyEl.innerHTML = body; else bodyEl.appendChild(body);

        const handle = {
            el: back, body: bodyEl, foot: footEl,
            close() {
                if (!back.isConnected) return;
                back.remove();
                openModals--;
                document.removeEventListener("keydown", onKey);
                if (onClose) onClose();
            },
            setFoot(buttons) {
                footEl.innerHTML = "";
                buttons.forEach((b) => {
                    const btn = document.createElement("button");
                    btn.className = "btn " + (b.cls || "");
                    btn.textContent = b.label;
                    btn.addEventListener("click", async () => {
                        if (!b.onClick) return handle.close();
                        const all = $$("button", footEl);
                        all.forEach((x) => (x.disabled = true));
                        try { await b.onClick(handle); }
                        catch (e) { if (!e.handled) { console.error(e); toast(e.message || "Something went wrong", "error"); } }
                        finally { all.forEach((x) => (x.disabled = false)); }
                    });
                    footEl.appendChild(btn);
                });
                footEl.style.display = buttons.length ? "" : "none";
            },
        };
        const onKey = (e) => { if (e.key === "Escape" && !$(".suggest__list")) handle.close(); };
        document.addEventListener("keydown", onKey);
        $(".modal__x", back).addEventListener("click", () => handle.close());
        handle.setFoot(foot);
        return handle;
    }

    // ---------------------------------------------------------------- forms
    function field(name, label, o = {}) {
        const { type = "text", value = "", options = [], required, placeholder = "", rows = 3, help = "", attrs = "", cls = "" } = o;
        const val = value == null ? "" : value;
        let input;
        if (type === "textarea") {
            input = `<textarea data-f="${name}" rows="${rows}" placeholder="${esc(placeholder)}" ${attrs}>${esc(val)}</textarea>`;
        } else if (type === "select") {
            input = `<select data-f="${name}" ${attrs}>${options.map((op) => {
                const v = typeof op === "object" ? op.value : op;
                const l = typeof op === "object" ? op.label : op;
                return `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`;
            }).join("")}</select>`;
        } else if (type === "checkbox") {
            return `<label class="check ${cls}"><input type="checkbox" data-f="${name}" ${val && val !== "0" ? "checked" : ""} ${attrs}> ${esc(label)}</label>`;
        } else {
            input = `<input type="${type}" data-f="${name}" value="${esc(val)}" placeholder="${esc(placeholder)}" ${attrs}>`;
        }
        return `<div class="field ${cls}"><label>${esc(label)}${required ? ' <span class="req">*</span>' : ""}</label>${input}${help ? `<small>${help}</small>` : ""}</div>`;
    }

    function read(root) {
        const out = {};
        $$("[data-f]", root).forEach((el) => {
            out[el.dataset.f] = el.type === "checkbox" ? (el.checked ? 1 : 0) : el.value;
        });
        return out;
    }

    function suggest(input, { fetch, render, onPick, allowNew, minChars = 0 }) {
        const wrap = document.createElement("div");
        wrap.className = "suggest";
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        input.setAttribute("autocomplete", "off");
        let list, items = [], idx = -1, timer, seq = 0;

        const hide = () => { if (list) { list.remove(); list = null; } idx = -1; };
        const pick = async (item) => { hide(); await onPick(item); };
        const show = (query) => {
            hide();
            list = document.createElement("div");
            list.className = "suggest__list";
            const rows = items.map((it, i) => {
                const r = render(it);
                return `<div class="suggest__item" data-i="${i}"><span>${esc(r.main)}</span><small>${esc(r.sub || "")}</small></div>`;
            });
            if (allowNew && query && !items.some((it) => render(it).main.toLowerCase() === query.toLowerCase())) {
                rows.push(`<div class="suggest__item suggest__add" data-new="1">+ Add “${esc(query)}”</div>`);
            }
            if (!rows.length) { list = null; return; }
            list.innerHTML = rows.join("");
            wrap.appendChild(list);
            $$(".suggest__item", list).forEach((el) =>
                el.addEventListener("mousedown", async (e) => {
                    e.preventDefault();
                    if (el.dataset.new) { const created = await allowNew(query); if (created) await pick(created); }
                    else await pick(items[Number(el.dataset.i)]);
                })
            );
        };
        const run = () => {
            const q = input.value.trim();
            if (q.length < minChars) { hide(); return; }
            clearTimeout(timer);
            timer = setTimeout(async () => {
                const mine = ++seq;
                const found = await Promise.resolve(fetch(q)).catch(() => []);
                if (mine !== seq) return;
                items = found;
                show(q);
            }, 180);
        };
        input.addEventListener("input", run);
        input.addEventListener("focus", run);
        input.addEventListener("blur", () => setTimeout(hide, 150));
        input.addEventListener("keydown", (e) => {
            if (!list) return;
            const els = $$(".suggest__item", list);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length;
                els.forEach((el, i) => el.classList.toggle("on", i === idx));
            } else if (e.key === "Enter" && idx >= 0) {
                e.preventDefault();
                els[idx].dispatchEvent(new MouseEvent("mousedown"));
            } else if (e.key === "Escape") { hide(); e.stopPropagation(); }
        });
        return { hide };
    }

    // ---------------------------------------------------------------- domain widgets
    function banner(p, { visit, extra = "" } = {}) {
        const where = p.patient_type === "Employee" ? (p.department || p.section) : p.village;
        const flags = [];
        if (p.allergies) flags.push(`<span class="flag flag--bad" title="Known allergies">⚠ Allergy: ${esc(p.allergies)}</span>`);
        if (p.chronic_conditions) flags.push(`<span class="flag flag--warn">Chronic: ${esc(p.chronic_conditions)}</span>`);
        if (p.blood_group) flags.push(`<span class="flag flag--info">${esc(p.blood_group)}</span>`);
        return `<div class="pbanner">
            <div class="pbanner__avatar">${esc(initials(p.full_name || p.patient_name))}</div>
            <div>
                <div class="pbanner__name">${esc(p.full_name || p.patient_name)} ${typeTag(p.patient_type)}</div>
                <div class="pbanner__meta">
                    <span>${esc(p.name || p.patient)}</span>
                    ${ageSex(p) ? `<span>${esc(ageSex(p))}</span>` : ""}
                    ${p.patient_type === "Employee" && p.employer ? `<span>${esc(p.employer)}${p.staff_no ? " · " + esc(p.staff_no) : ""}</span>` : ""}
                    ${where ? `<span>${esc(where)}</span>` : ""}
                    ${p.phone ? `<span>${esc(p.phone)}</span>` : ""}
                    ${visit ? `<span>${esc(visit)}</span>` : ""}
                    ${p.last_visit ? `<span>Last visit ${esc(dateOf(p.last_visit))}</span>` : ""}
                </div>
            </div>
            <div class="pbanner__flags">${flags.join("")}${extra}</div>
        </div>`;
    }

    let mastersCache;
    const masters = () => (mastersCache = mastersCache || call("common.masters"));

    // Text input that searches the facility list and lets staff add a new facility on the spot.
    async function facilityField(input) {
        if (!input) return;
        const m = await masters();
        suggest(input, {
            fetch: (q) => m.facilities.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10),
            render: (f) => ({ main: f.name, sub: f.facility_type }),
            onPick: (f) => { input.value = f.name; },
            allowNew: async (name) => {
                await call("common.add_facility", { facility_name: name });
                const f = { name, facility_type: "Clinic" };
                m.facilities.push(f);
                toast(`${name} added to the facility list`);
                return f;
            },
        });
    }

    /**
     * Search existing patients or register a new one.
     * onPick receives the patient card (name, full_name, patient_type, open_visit, ...).
     */
    async function pickPatient({ title = "Find or register a patient", onPick }) {
        const m = await masters();
        const h = modal({
            title,
            sub: "Search by name, ID number, phone or patient number.",
            size: "wide",
            body: `<div class="field"><input class="input" id="pp-q" placeholder="Start typing…" autofocus></div>
                <div id="pp-results" class="queue"></div>
                <div style="margin-top:18px"><button class="btn btn--sm" id="pp-new">+ Register a new patient</button></div>
                <div id="pp-form" style="display:none;margin-top:18px"></div>`,
        });
        const results = $("#pp-results", h.body);
        const chosen = async (p) => { h.close(); await onPick(p); };

        async function search() {
            const rows = await call("common.search_patients", { q: $("#pp-q", h.body).value });
            results.innerHTML = rows.length ? rows.map((p, i) => `<div class="qcard" style="grid-template-columns:1fr auto;padding:14px 18px">
                <div><div class="qcard__name">${esc(p.full_name)} ${typeTag(p.patient_type)}
                    ${p.open_visit ? pill("Open visit · " + p.open_visit.status, "warn") : ""}</div>
                <div class="qcard__meta">${esc(p.name)} · ${esc(ageSex(p))}${p.national_id ? " · ID " + esc(p.national_id) : ""}${p.phone ? " · " + esc(p.phone) : ""}${(p.department || p.village) ? " · " + esc(p.department || p.village) : ""}</div></div>
                <button class="btn btn--primary btn--sm" data-i="${i}">Select</button></div>`).join("") : empty("No matching patient. Register a new one below.");
            $$("button[data-i]", results).forEach((b) => b.addEventListener("click", () => chosen(rows[Number(b.dataset.i)])));
        }
        let t;
        $("#pp-q", h.body).addEventListener("input", () => { clearTimeout(t); t = setTimeout(search, 250); });
        search();

        $("#pp-new", h.body).addEventListener("click", () => {
            $("#pp-new", h.body).style.display = "none";
            const form = $("#pp-form", h.body);
            form.style.display = "block";
            renderNewPatientForm(form, m, chosen);
            $("[data-f=full_name], #emp-q", form)?.focus();
        });
        return h;
    }

    function renderNewPatientForm(form, m, chosen) {
        const employers = m.employers || [];
        let type = "Community Member", employee = null;
        let employer = (employers.find((e) => e.uses_employee_records) || employers[0] || {}).name;
        const usesRecords = () => !!(employers.find((e) => e.name === employer) || {}).uses_employee_records;
        const keepValues = (keep) => Object.entries(keep).forEach(([k, v]) => { const el = $(`[data-f=${k}]`, form); if (el && v && !el.value) el.value = v; });
        const draw = () => {
            const fromList = type === "Employee" && usesRecords();
            const typedIn = type === "Employee" && !usesRecords();
            form.innerHTML = `<div class="subhead">New patient</div>
                <div class="seg-toggle">
                    <button data-t="Community Member" class="${type === "Community Member" ? "on" : ""}">Community member</button>
                    <button data-t="Employee" class="${type === "Employee" ? "on" : ""}">Employee</button>
                </div>
                ${type === "Employee" ? `<div class="grid-2">
                    <div class="field"><label>Farm / employer <span class="req">*</span></label>
                        <select id="pp-employer">${employers.map((e) => `<option ${e.name === employer ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></div>
                    ${fromList ? `<div class="field"><label>Find employee <span class="req">*</span></label>
                        <input class="input" id="emp-q" placeholder="Employee name, number or phone">
                        ${employee ? `<small>Selected: <b>${esc(employee.employee_name)}</b> (${esc(employee.name)}) ${esc(employee.department || "")}</small>` : ""}</div>`
                        : field("staff_no", "Staff / payroll no.", { required: true })}
                </div>` : ""}
                <div class="grid-3">
                    ${field("full_name", "Full name", { required: true, value: employee?.employee_name || "", attrs: fromList && employee ? "readonly" : "" })}
                    ${field("sex", "Sex", { type: "select", options: ["", ...m.genders.filter((g) => ["Male", "Female", "Other", "Prefer not to say"].includes(g))], value: employee?.gender || "", required: true })}
                    ${field("phone", "Phone", { value: employee?.cell_number || "" })}
                    ${field("date_of_birth", "Date of birth", { type: "date", value: employee?.date_of_birth || "" })}
                    ${field("age_years", "…or age (years)", { type: "number", attrs: 'min="0" max="120"', help: "Used when the date of birth is unknown" })}
                    ${field("national_id", "National ID / Passport")}
                </div>
                ${typedIn ? `<div class="grid-3">${field("section", "Section / department")}</div>` : ""}
                ${type === "Community Member" ? `<div class="grid-3">
                    ${field("village", "Village / Location")}
                    ${field("next_of_kin", "Next of kin")}
                    ${field("next_of_kin_phone", "Next of kin phone")}</div>` : ""}
                <div class="grid-3">
                    ${field("allergies", "Known allergies", { type: "textarea", rows: 2 })}
                    ${field("chronic_conditions", "Chronic conditions", { type: "textarea", rows: 2 })}
                    ${field("blood_group", "Blood group", { type: "select", options: ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] })}
                </div>
                <div style="text-align:right"><button class="btn btn--primary" id="pp-save">Register &amp; continue</button></div>`;
            $$("[data-t]", form).forEach((b) => b.addEventListener("click", () => {
                const keep = read(form); type = b.dataset.t; employee = null; draw(); keepValues(keep);
            }));
            const empSel = $("#pp-employer", form);
            if (empSel) empSel.addEventListener("change", () => { const keep = read(form); employer = empSel.value; employee = null; draw(); keepValues(keep); });
            if (fromList) {
                suggest($("#emp-q", form), {
                    fetch: (q) => call("common.search_employees", { q }, { quiet: true }),
                    render: (e) => ({ main: e.employee_name, sub: `${e.name} · ${e.department || ""}${e.patient ? " · already a patient" : ""}` }),
                    onPick: async (e) => {
                        if (e.patient) { toast("This employee is already registered."); return chosen((await call("common.search_patients", { q: e.patient }))[0]); }
                        employee = e; const keep = read(form); draw(); keepValues(keep);
                    },
                });
            }
            $("#pp-save", form).addEventListener("click", async (ev) => {
                const btn = ev.currentTarget, v = read(form);
                if (!v.full_name.trim()) return toast("Enter the patient's name", "warn");
                if (!v.sex) return toast("Select the patient's sex", "warn");
                if (fromList && !employee) return toast("Pick the employee from the list", "warn");
                if (typedIn && !(v.staff_no || "").trim()) return toast("Enter the staff / payroll number", "warn");
                if (!v.date_of_birth && v.age_years) {
                    const d = new Date(); d.setFullYear(d.getFullYear() - Number(v.age_years));
                    v.date_of_birth = d.toISOString().slice(0, 10);
                }
                if (!v.date_of_birth) return toast("Enter a date of birth or an age", "warn");
                delete v.age_years;
                btn.disabled = true;
                try {
                    const p = await call("common.register_patient", { data: { ...v, patient_type: type, employer: type === "Employee" ? employer : null, employee: employee?.name } });
                    toast("Patient registered: " + p.name);
                    await chosen(p);
                } catch (e) { btn.disabled = false; }
            });
        };
        draw();
    }

    return { call, esc, $, $$, num, initials, timeOf, dateOf, duration, wait, waitClass, typeTag, pill, ageSex, empty, split, money,
        toast, shell, tabs, poll, kpis, hbars, chart, stackedDatasets, stackedOptions, COLORS, modal, field, read, suggest,
        banner, masters, facilityField, pickPatient, REFRESH_ICON, cfg };
})();
