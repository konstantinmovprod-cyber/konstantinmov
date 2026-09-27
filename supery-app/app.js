(function () {
  "use strict";

  const C = window.SUPERY_CONFIG;
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.initData);
  const STORE_KEY = "supery:v3";

  // ---------- Telegram ----------
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#020202"); tg.setBackgroundColor("#020202"); } catch (_) {}
  }
  const tgUser = (inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
  const haptic = (type) => {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (type === "success" || type === "error" || type === "warning") tg.HapticFeedback.notificationOccurred(type);
      else tg.HapticFeedback.impactOccurred(type || "light");
    } catch (_) {}
  };

  // ---------- State ----------
  const defaultState = () => ({
    onboarded: false,
    answers: {},
    power: null,
    done: {}, // "n:i" -> "YYYY-MM-DD"
    activeDays: [],
    badges: [],
    member: false,
    plan: "year",
    subscribeRequestedAt: null,
  });
  let state;
  try { state = Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY)) || {}); }
  catch (_) { state = defaultState(); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {} };

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const key = (n, i) => `${n}:${i}`;
  const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dayStr(new Date());
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  const level = (n) => C.path.find((l) => l.n === n);
  const lessonOf = (topic) => (C.lessons && C.lessons[topic]) || { text: "материал урока скоро появится.", task: "" };
  const isDone = (n, i) => !!state.done[key(n, i)];
  const levelDone = (l) => l.topics.filter((_, i) => isDone(l.n, i)).length;
  const totalTopics = C.path.reduce((s, l) => s + l.topics.length, 0);
  const doneTopics = () => Object.keys(state.done).length;
  const pathPct = () => Math.round((doneTopics() / totalTopics) * 100);
  const xp = () => doneTopics() * C.xpPerLesson;
  const isUnlocked = (n) => state.member || C.freeLevels.includes(n);
  const power = () => C.powers.find((p) => p.id === state.power) || null;
  const userName = () => (tgUser && tgUser.first_name) || "супер";

  const dailyGoal = () => {
    const q = C.onboarding.find((x) => x.id === "time");
    const o = q && q.options.find((x) => x.id === state.answers.time);
    return (o && o.daily) || 1;
  };
  const doneToday = () => Object.values(state.done).filter((d) => d === today()).length;

  function streak() {
    const days = new Set(state.activeDays);
    const d = new Date();
    if (!days.has(dayStr(d))) d.setDate(d.getDate() - 1);
    let s = 0;
    while (days.has(dayStr(d))) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }

  // Персональный план из ответов онбординга
  function personalPlan() {
    const a = state.answers;
    const out = [0, 1, 2];
    const pl = C.path.find((l) => l.power && l.power === state.power);
    if (pl) out.push(pl.n);
    if (a.goal === "product" && !out.includes(5)) out.push(5);
    if (a.goal === "work" && !out.includes(6)) out.push(6);
    out.push(8);
    if (a.goal === "earn") out.push(9);
    out.push(10);
    return out;
  }

  function nextLesson() {
    const order = [...personalPlan(), ...C.path.map((l) => l.n)];
    for (const n of order) {
      const l = level(n);
      const i = l.topics.findIndex((_, idx) => !isDone(n, idx));
      if (i >= 0) return { l, i };
    }
    return null;
  }

  let toastTimer;
  const toast = (msg) => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  };

  function xpPop(text) {
    const el = document.createElement("div");
    el.className = "xp-pop";
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("go"));
    setTimeout(() => el.remove(), 1200);
  }

  const openTelegram = (username, text) => {
    const url = `https://t.me/${username}${text ? "?text=" + encodeURIComponent(text) : ""}`;
    if (inTelegram && tg.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  };

  function sendLead(payload) {
    if (!C.club.leadWebhook) return;
    fetch(C.club.leadWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        telegramUser: tgUser,
        initData: inTelegram ? tg.initData : null, // проверяйте подпись на сервере
        answers: state.answers,
        power: state.power,
        progress: { done: doneTopics(), total: totalTopics },
        createdAt: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  // ---------- Achievements ----------
  function checkBadges() {
    const base = [0, 1, 2].every((n) => levelDone(level(n)) === level(n).topics.length);
    const caseIdx = level(8).topics.indexOf("кейс");
    const earned = {
      first: doneTopics() >= 1,
      power: !!state.power,
      streak3: streak() >= 3,
      base,
      case: caseIdx >= 0 && isDone(8, caseIdx),
      half: pathPct() >= 50,
      super: pathPct() >= 100,
    };
    const fresh = C.achievements.filter((a) => earned[a.id] && !state.badges.includes(a.id));
    fresh.forEach((a) => state.badges.push(a.id));
    if (fresh.length) {
      save();
      setTimeout(() => { haptic("success"); toast(`достижение: ${fresh[0].title}`); }, 900);
    }
  }

  // ---------- Navigation ----------
  const stack = [];
  let current = null;
  const TAB_OF = { level: "path", powers: "path" };

  function go(screen, opts = {}) {
    if (!opts.back && current && screen !== current && !opts.reset) stack.push(current);
    if (opts.reset) stack.length = 0;
    current = screen;
    const sec = $(`[data-screen="${screen}"]`);
    $$(".screen").forEach((s) => s.classList.toggle("active", s === sec));
    document.body.classList.toggle("fullscreen", sec.hasAttribute("data-fullscreen"));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.go === (TAB_OF[screen] || screen)));
    window.scrollTo(0, 0);
    render();
    syncBackButton();
    haptic("light");
  }
  function back() {
    if (sheetOpen()) return closeSheet();
    if (current === "onboarding") return obBack();
    go(stack.pop() || "home", { back: true });
  }
  function syncBackButton() {
    if (!tg || !tg.BackButton) return;
    const show = sheetOpen() || stack.length > 0 || (current === "onboarding" && obStep > 0);
    show ? tg.BackButton.show() : tg.BackButton.hide();
  }
  if (tg && tg.BackButton) tg.BackButton.onClick(back);

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go]");
    if (t) {
      e.preventDefault();
      if (sheetOpen()) closeSheet();
      go(t.dataset.go, { reset: t.classList.contains("tab") });
      return;
    }
    const lv = e.target.closest("[data-level]");
    if (lv) return openLevel(+lv.dataset.level);
    const ls = e.target.closest("[data-lesson]");
    if (ls) {
      const [n, i] = ls.dataset.lesson.split(":").map(Number);
      return openLesson(n, i);
    }
    if (e.target.closest("[data-paywall]")) { if (sheetOpen()) closeSheet(); go("paywall"); }
  });

  // ---------- Bottom sheet ----------
  const sheetOpen = () => document.body.classList.contains("sheet-open");
  function openSheet(html) {
    $("#sheet-body").innerHTML = html;
    $("#sheet").scrollTop = 0;
    document.body.classList.add("sheet-open");
    syncBackButton();
  }
  function closeSheet() {
    document.body.classList.remove("sheet-open");
    syncBackButton();
  }
  $("#sheet-backdrop").onclick = closeSheet;
  // свайп вниз закрывает шторку
  (() => {
    let y0 = null;
    const sh = $("#sheet");
    sh.addEventListener("touchstart", (e) => { if (sh.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener("touchend", (e) => {
      if (y0 != null && e.changedTouches[0].clientY - y0 > 80) closeSheet();
      y0 = null;
    }, { passive: true });
  })();

  // ---------- Onboarding ----------
  let obStep = 0; // 0 — приветствие, 1..N — вопросы, N+1 — план

  function renderOnboarding() {
    const qs = C.onboarding;
    const el = $('[data-screen="onboarding"]');

    if (obStep === 0) {
      el.innerHTML = `
        <div class="ob">
          <div class="welcome">
            <span class="eyebrow"><i class="dot"></i> клуб по подписке · ${esc(C.club.handle)}</span>
            <h1 class="logo-title" style="margin-top:16px">${esc(C.club.name)}</h1>
            <div class="bar"></div>
            <p class="quote">${esc(C.quote)}</p>
            <p class="lead">${esc(C.club.subtitle)}. 4 вопроса — и соберём твой личный путь.</p>
          </div>
          <div class="ob-cta">
            <button class="btn btn-lime" id="ob-start">начать путь →</button>
            <button class="text-btn" id="ob-code">уже в клубе? <b>ввести код доступа</b></button>
          </div>
        </div>`;
      $("#ob-start").onclick = () => { obStep = 1; renderOnboarding(); syncBackButton(); haptic("light"); };
      $("#ob-code").onclick = openCodeSheet;
      return;
    }

    if (obStep <= qs.length) {
      const q = qs[obStep - 1];
      const val = q.powers ? state.power : state.answers[q.id];
      const opts = q.powers
        ? [...C.powers.map((p) => ({ id: p.id, icon: p.icon, text: p.title, sub: p.text })), { id: "unknown", icon: "fa-question", text: "пока не знаю", sub: "разберёмся на уровне 2" }]
        : q.options;
      const selected = q.powers ? (state.power || (state.answers.power === "unknown" ? "unknown" : null)) : val;
      el.innerHTML = `
        <div class="ob">
          <div class="ob-top">
            <button class="ob-back" id="ob-back" aria-label="назад"><i class="fas fa-arrow-left"></i></button>
            <div class="ob-progress"><div style="width:${(obStep / (qs.length + 1)) * 100}%"></div></div>
          </div>
          <div class="ob-body">
            <span class="eyebrow"><i class="dot"></i> вопрос ${obStep} из ${qs.length}</span>
            <h2 class="ob-q">${esc(q.q)}</h2>
            <div class="options">
              ${opts.map((o) => `
                <button class="option ${selected === o.id ? "selected" : ""}" data-opt="${esc(o.id)}">
                  <i class="fas ${esc(o.icon)}"></i>
                  <span>${esc(o.text)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>
                </button>`).join("")}
            </div>
          </div>
          <div class="ob-cta"><button class="btn btn-lime" id="ob-next" ${selected ? "" : "disabled"}>дальше →</button></div>
        </div>`;
      $("#ob-back").onclick = obBack;
      $$("[data-opt]").forEach((b) => {
        b.onclick = () => {
          const id = b.dataset.opt;
          if (q.powers) {
            state.answers.power = id;
            state.power = id === "unknown" ? null : id;
          } else state.answers[q.id] = id;
          save();
          haptic("light");
          renderOnboarding();
        };
      });
      $("#ob-next").onclick = () => { obStep++; renderOnboarding(); syncBackButton(); haptic("medium"); };
      return;
    }

    // Итог: персональный план
    const plan = personalPlan();
    const lessons = plan.reduce((s, n) => s + level(n).topics.length, 0);
    const weeks = Math.max(1, Math.ceil(lessons / (dailyGoal() * 5)));
    el.innerHTML = `
      <div class="ob">
        <div class="ob-top">
          <button class="ob-back" id="ob-back" aria-label="назад"><i class="fas fa-arrow-left"></i></button>
          <div class="ob-progress"><div style="width:100%"></div></div>
        </div>
        <div class="ob-body">
          <span class="eyebrow"><i class="dot"></i> готово</span>
          <h2 class="ob-q" style="margin-bottom:12px">твой путь, ${esc(userName())}</h2>
          <div class="plan-meta">
            <span class="chip"><i class="fas fa-layer-group"></i>${plan.length} ${plural(plan.length, "уровень", "уровня", "уровней")}</span>
            <span class="chip"><i class="fas fa-book-open"></i>${lessons} ${plural(lessons, "урок", "урока", "уроков")}</span>
            <span class="chip"><i class="fas fa-calendar"></i>≈ ${weeks} ${plural(weeks, "неделя", "недели", "недель")}</span>
          </div>
          <div class="plan-list">
            ${plan.map((n) => {
              const l = level(n);
              const isPower = l.power && l.power === state.power;
              return `<div class="plan-step ${isPower ? "power" : ""}">
                <span class="num">${pad(n)}</span><b>${esc(l.title)}</b>
                <small>${isPower ? "суперсила" : isUnlocked(n) ? "открыто" : "в подписке"}</small>
              </div>`;
            }).join("")}
          </div>
        </div>
        <div class="ob-cta"><button class="btn btn-lime" id="ob-finish">поехали →</button></div>
      </div>`;
    $("#ob-back").onclick = obBack;
    $("#ob-finish").onclick = () => {
      state.onboarded = true;
      save();
      checkBadges();
      haptic("success");
      go("home", { reset: true });
    };
  }

  function obBack() {
    if (obStep > 0) { obStep--; renderOnboarding(); syncBackButton(); }
  }

  // ---------- Home ----------
  function hud() {
    const s = streak();
    return `
      <div class="hud">
        <span class="eyebrow"><i class="dot"></i> ${esc(C.club.name)}</span>
        <div class="hud-chips">
          <span class="chip ${s ? "" : "off"}"><i class="fas fa-fire"></i>${s}</span>
          <span class="chip"><i class="fas fa-bolt"></i>${xp()} xp</span>
        </div>
      </div>`;
  }

  function renderHome() {
    const next = nextLesson();
    const goal = dailyGoal();
    const td = doneToday();
    const pct = Math.min(100, Math.round((td / goal) * 100));
    const locked = next && !isUnlocked(next.l.n);

    const days = [];
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // понедельник
    for (let i = 0; i < 7; i++) {
      const ds = dayStr(d);
      days.push(`<div class="${state.activeDays.includes(ds) ? "on" : ""} ${ds === today() ? "today" : ""}">
        ${["пн", "вт", "ср", "чт", "пт", "сб", "вс"][i]}<i><span class="fas fa-check"></span></i></div>`);
      d.setDate(d.getDate() + 1);
    }

    $('[data-screen="home"]').innerHTML = `
      <div class="container">
        ${hud()}
        <h1 class="hello">привет, ${esc(userName())}</h1>
        <p class="lead">${td >= goal ? "цель дня выполнена. мастер доволен." : "один урок сегодня — и ты уже на шаг впереди."}</p>

        <div class="lime-block halftone">
          <div class="goal">
            <div class="ring" style="--p:${pct}"><span>${td}/${goal}</span></div>
            <div class="g-text"><b>цель дня</b><small>${goal} ${plural(goal, "урок", "урока", "уроков")} в день · ${pathPct()}% пути</small></div>
          </div>
          <div class="mini-bar" style="margin-top:18px"></div>
          ${next ? `
            <span class="eyebrow" style="color:var(--black)">уровень ${next.l.n} · ${esc(next.l.title)}</span>
            <h3 style="margin-top:8px">${esc(next.l.topics[next.i])}</h3>
            <p>${esc(lessonOf(next.l.topics[next.i]).text)}</p>
            ${locked
              ? `<button class="btn btn-dark" data-paywall><i class="fas fa-lock"></i> открыть в подписке</button>`
              : `<button class="btn btn-dark" data-lesson="${next.l.n}:${next.i}">${doneTopics() ? "продолжить" : "начать"} →</button>`}
          ` : `
            <h3>ты — супер</h3><p>весь путь пройден. дальше — новая связка каждый месяц.</p>
            <button class="btn btn-dark" data-go="club">в клуб →</button>`}
        </div>

        <div class="section-head"><span class="eyebrow"><i class="dot"></i> эта неделя</span><span class="eyebrow muted">серия: ${streak()} ${plural(streak(), "день", "дня", "дней")}</span></div>
        <div class="card week">${days.join("")}</div>

        ${state.member ? "" : `
        <div class="section-head"><span class="eyebrow"><i class="dot"></i> подписка</span></div>
        <button class="card member-status" data-paywall style="width:100%;text-align:left">
          <span class="num"><i class="fas fa-lock-open"></i></span>
          <span class="ms-text"><b>открой весь путь 0–10</b><small>сейчас открыты уровни ${C.freeLevels.join(", ")}</small></span>
          <i class="fas fa-chevron-right muted"></i>
        </button>`}

        <div class="section-head"><span class="eyebrow"><i class="dot"></i> формула клуба</span></div>
        <div class="formula">
          ${C.formula.map((s, i) => `<div class="step card"><span class="num">${pad(i + 1)}</span><span>${esc(s)}</span></div>`).join("")}
        </div>

        <div class="section-head"><span class="eyebrow"><i class="dot"></i> 10 · клуб суперов</span><button class="link" data-go="club">все →</button></div>
        ${feedItem(C.feed[0], 0)}

        <div class="quote-card">
          <span class="pill pill-lime">▸▸ мудрость мастера</span>
          <p class="quote">«${esc(C.quote)}»</p>
        </div>
      </div>`;
  }

  function feedItem(f, i) {
    const d = new Date(f.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    return `
      <div class="card feed-item">
        <span class="num">${pad(i + 1)}</span>
        <div><div class="ft">${esc(f.type)}</div><h4>${esc(f.title)}</h4><div class="fd">${esc(d)}</div></div>
      </div>`;
  }

  // ---------- Path ----------
  function renderPath() {
    const plan = personalPlan();
    $('[data-screen="path"]').innerHTML = `
      <div class="container">
        ${hud()}
        <h2 class="page-title" style="margin-top:22px">твой путь в мире ai</h2>
        <div class="bar"></div>
        <div class="map">
          <div class="map-root"><b>${esc(C.club.name)}</b><span>${esc(C.club.tagline)} · ${pathPct()}%</span></div>
          ${C.path.map((l) => {
            const d = levelDone(l);
            const full = d === l.topics.length;
            const lock = !isUnlocked(l.n);
            const isPower = state.power && l.power === state.power;
            const inPlan = plan.includes(l.n);
            return `
            <div class="lvl ${l.color} ${isPower ? "focus" : ""} ${lock ? "locked" : ""}">
              ${isPower ? `<span class="power-tag">твоя сила</span>` : inPlan && !full ? `<span class="power-tag" style="background:var(--graphite);color:var(--gray)">в плане</span>` : ""}
              <button class="lvl-node" data-level="${l.n}">
                <i class="fas ${esc(l.icon)} ic"></i>
                <span class="tt"><em>${l.n}.</em>${esc(l.title)}</span>
                <span class="cnt ${full ? "done" : ""}">${lock ? '<i class="fas fa-lock"></i>' : full ? '<i class="fas fa-check"></i>' : `${d}/${l.topics.length}`}</span>
              </button>
              <div class="topics">
                ${l.topics.map((t, i) => `<span class="topic ${isDone(l.n, i) ? "done" : ""}">${esc(t)}</span>`).join("")}
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`;
  }

  // ---------- Level ----------
  let openN = 0;
  function openLevel(n) {
    openN = n;
    if (current === "level") { render(); window.scrollTo(0, 0); haptic("light"); }
    else go("level");
  }

  function renderLevel() {
    const l = level(openN);
    const prev = level(l.n - 1);
    const next = level(l.n + 1);
    const lock = !isUnlocked(l.n);
    const extra =
      l.n === 2 ? `<button class="btn btn-lime" data-go="powers">${power() ? `суперсила: ${esc(power().title)} · сменить` : "выбрать суперсилу →"}</button>`
      : l.n === 10 ? `<button class="btn btn-lime" data-go="club">открыть жизнь клуба →</button>` : "";

    $('[data-screen="level"]').innerHTML = `
      <div class="container">
        <button class="back" id="lv-back"><i class="fas fa-arrow-left"></i> путь</button>
        <div class="lv-head">
          <span class="num">${pad(l.n)}</span>
          <div>
            <span class="eyebrow"><i class="dot"></i> уровень ${l.n} · ${levelDone(l)}/${l.topics.length}</span>
            <h2 class="page-title" style="margin:6px 0 0">${esc(l.title)}</h2>
          </div>
        </div>
        <div class="bar" style="margin-top:18px"></div>
        <p class="lead" style="margin-bottom:20px">${esc(l.intro)}</p>
        ${lock ? `<button class="btn btn-lime" data-paywall style="margin-bottom:16px"><i class="fas fa-lock"></i> уровень в подписке · открыть</button>` : ""}
        <div class="lessons">
          ${l.topics.map((t, i) => {
            const done = isDone(l.n, i);
            return `
            <button class="lesson ${done ? "done" : ""} ${lock ? "locked" : ""}" ${lock ? "data-paywall" : `data-lesson="${l.n}:${i}"`}>
              <span class="chk">${lock ? '<i class="fas fa-lock" style="color:var(--gray)"></i>' : '<i class="fas fa-check"></i>'}</span>
              <span class="ln"><b>${esc(t)}</b><small>урок ${l.n}.${i + 1} · ${done ? "пройдено" : "суть + задание"}</small></span>
              <span class="xp">+${C.xpPerLesson} xp</span>
            </button>`;
          }).join("")}
        </div>
        ${extra}
        <div class="nav-row mt">
          ${prev ? `<button class="btn btn-outline" data-level="${prev.n}">← ${pad(prev.n)}</button>` : ""}
          ${next ? `<button class="btn btn-outline" data-level="${next.n}">${pad(next.n)} →</button>` : ""}
        </div>
      </div>`;
    $("#lv-back").onclick = back;
  }

  // ---------- Lesson sheet ----------
  function openLesson(n, i) {
    const l = level(n);
    if (!isUnlocked(n)) return go("paywall");
    const topic = l.topics[i];
    const ls = lessonOf(topic);
    const done = isDone(n, i);
    const isPowerLesson = n === 2 && topic === "выбор суперсилы";
    openSheet(`
      <span class="eyebrow"><i class="dot"></i> уровень ${n} · урок ${n}.${i + 1}</span>
      <h3>${esc(topic)}</h3>
      <p class="lead">${esc(ls.text)}</p>
      ${ls.task ? `<div class="task"><span class="eyebrow"><i class="dot"></i> задание</span><p>${esc(ls.task)}</p></div>` : ""}
      ${ls.video ? `<button class="btn btn-outline" id="ls-video"><i class="fas fa-play"></i> смотреть урок</button>` : ""}
      ${isPowerLesson
        ? `<button class="btn btn-lime" data-go="powers">${power() ? "сменить суперсилу" : "выбрать суперсилу →"}</button>`
        : done
          ? `<button class="btn btn-outline" id="ls-toggle">отметить как непройденный</button>`
          : `<button class="btn btn-lime" id="ls-toggle">задание выполнено · +${C.xpPerLesson} xp</button>`}
      <button class="btn btn-outline" id="ls-ask"><i class="fab fa-telegram-plane"></i> вопрос мастеру</button>
    `);
    const v = $("#ls-video");
    if (v) v.onclick = () => (inTelegram && tg.openLink ? tg.openLink(ls.video) : window.open(ls.video, "_blank"));
    $("#ls-ask").onclick = () => openTelegram(C.club.managerTelegram, `вопрос по уроку «${topic}» (уровень ${n})`);
    const t = $("#ls-toggle");
    if (t) t.onclick = () => toggleLesson(n, i);
  }

  function toggleLesson(n, i) {
    const k = key(n, i);
    if (state.done[k]) {
      delete state.done[k];
      save();
      closeSheet();
      render();
      return;
    }
    const before = doneToday();
    state.done[k] = today();
    if (!state.activeDays.includes(today())) state.activeDays.push(today());
    save();
    closeSheet();
    haptic("success");
    xpPop(`+${C.xpPerLesson} xp`);
    const l = level(n);
    if (levelDone(l) === l.topics.length) setTimeout(() => toast(`уровень ${n} пройден 🔥`), 300);
    else if (before < dailyGoal() && doneToday() >= dailyGoal()) setTimeout(() => toast("цель дня выполнена 🔥"), 300);
    checkBadges();
    render();
  }

  // ---------- Powers ----------
  function renderPowers() {
    $('[data-screen="powers"]').innerHTML = `
      <div class="container">
        <button class="back" id="pw-back"><i class="fas fa-arrow-left"></i> назад</button>
        <span class="eyebrow"><i class="dot"></i> 2 · оцифровка себя</span>
        <h2 class="page-title">выбери суперсилу</h2>
        <p class="lead">одна сила — один фокус на 2 месяца. путь подсветит твой уровень, остальные останутся открыты.</p>
        <div class="powers">
          ${C.powers.map((p) => `
            <button class="power ${state.power === p.id ? "selected" : ""}" data-power="${esc(p.id)}">
              <i class="fas ${esc(p.icon)}"></i>
              <span><b>${esc(p.title)}</b><small>${esc(p.text)}</small></span>
            </button>`).join("")}
        </div>
      </div>`;
    $("#pw-back").onclick = back;
    $$("[data-power]").forEach((b) => {
      b.onclick = () => {
        state.power = b.dataset.power;
        state.answers.power = state.power;
        const idx = level(2).topics.indexOf("выбор суперсилы");
        const k = key(2, idx);
        const fresh = idx >= 0 && !state.done[k];
        if (fresh) {
          state.done[k] = today();
          if (!state.activeDays.includes(today())) state.activeDays.push(today());
          xpPop(`+${C.xpPerLesson} xp`);
        }
        save();
        haptic("success");
        toast(`суперсила: ${power().title}`);
        checkBadges();
        renderPowers();
      };
    });
  }

  // ---------- Paywall ----------
  function renderPaywall() {
    const el = $('[data-screen="paywall"]');
    if (state.member) {
      el.innerHTML = `
        <div class="pw">
          <button class="pw-close" id="pw-close" aria-label="закрыть"><i class="fas fa-xmark"></i></button>
          <div class="welcome">
            <span class="eyebrow"><i class="dot"></i> подписка активна</span>
            <h2>ты в клубе суперов</h2>
            <div class="bar"></div>
            <p class="lead">весь путь 0–10 открыт. новая связка — каждый месяц.</p>
          </div>
          <button class="btn btn-lime" data-go="path">к пути →</button>
        </div>`;
      $("#pw-close").onclick = back;
      return;
    }
    const plan = C.plans.find((p) => p.id === state.plan) || C.plans[0];
    el.innerHTML = `
      <div class="pw">
        <button class="pw-close" id="pw-close" aria-label="закрыть"><i class="fas fa-xmark"></i></button>
        <span class="eyebrow"><i class="dot"></i> подписка · ${esc(C.club.name)}</span>
        <h2>открой весь путь суперов</h2>
        <div class="bar"></div>
        <p class="lead">сейчас открыты уровни ${C.freeLevels.join(", ")}. в подписке — суперсилы, упаковка, продажи и жизнь клуба.</p>
        <ul class="features">
          ${C.planFeatures.map((f) => `<li><i class="fas ${esc(f.icon)}"></i>${esc(f.text)}</li>`).join("")}
        </ul>
        <div class="pw-spacer"></div>
        <div class="plans">
          ${C.plans.map((p) => `
            <button class="plan ${p.id === plan.id ? "selected" : ""}" data-plan="${esc(p.id)}">
              ${p.badge ? `<span class="p-badge">${esc(p.badge)}</span>` : ""}
              <span class="p-radio"></span>
              <span class="p-title">${esc(p.title)}</span>
              <span class="p-price">${esc(p.price)}</span>
              <span class="p-note">${esc(p.note)}</span>
            </button>`).join("")}
        </div>
        <button class="btn btn-lime" id="pw-buy">${state.subscribeRequestedAt ? "заявка отправлена · написать ещё" : `оформить за ${esc(plan.price)} →`}</button>
        <button class="text-btn" id="pw-code">уже оплатил? <b>ввести код доступа</b></button>
        <p class="pw-fine">оплата и выдача доступа — через мастера в telegram. после оплаты придёт код доступа.</p>
      </div>`;
    $("#pw-close").onclick = back;
    $$("[data-plan]").forEach((b) => {
      b.onclick = () => { state.plan = b.dataset.plan; save(); haptic("light"); renderPaywall(); };
    });
    $("#pw-buy").onclick = () => {
      state.subscribeRequestedAt = new Date().toISOString();
      save();
      haptic("success");
      sendLead({ type: "subscription", plan: plan.id });
      const u = tgUser ? `${tgUser.first_name || ""}${tgUser.username ? " (@" + tgUser.username + ")" : ""}` : "";
      openTelegram(
        C.club.managerTelegram,
        `хочу в клуб ${C.club.name}! тариф: ${plan.title} — ${plan.price}` +
          (u ? `\nя: ${u}` : "") + (power() ? `\nсуперсила: ${power().title}` : "")
      );
      toast("заявка отправлена мастеру");
      renderPaywall();
    };
    $("#pw-code").onclick = openCodeSheet;
  }

  function openCodeSheet() {
    openSheet(`
      <span class="eyebrow"><i class="dot"></i> доступ</span>
      <h3>код доступа</h3>
      <p class="lead">код приходит от мастера после оплаты подписки.</p>
      <input class="code-input" id="code" placeholder="SUPER····" autocomplete="off" autocapitalize="characters">
      <button class="btn btn-lime" id="code-ok">активировать</button>
    `);
    const inp = $("#code");
    setTimeout(() => inp.focus(), 300);
    const submit = () => {
      const v = inp.value.trim().toUpperCase();
      if (C.accessCodes.map((c) => c.toUpperCase()).includes(v)) {
        state.member = true;
        save();
        closeSheet();
        haptic("success");
        toast("добро пожаловать в клуб 🔥");
        sendLead({ type: "access_activated" });
        if (current === "onboarding") { obStep = Math.max(obStep, 1); renderOnboarding(); }
        else render();
      } else {
        inp.classList.add("invalid");
        haptic("error");
        toast("код не подошёл");
      }
    };
    $("#code-ok").onclick = submit;
    inp.onkeydown = (e) => { inp.classList.remove("invalid"); if (e.key === "Enter") submit(); };
  }

  // ---------- Club ----------
  function renderClub() {
    $('[data-screen="club"]').innerHTML = `
      <div class="container">
        ${hud()}
        <h2 class="page-title" style="margin-top:22px">жизнь клуба</h2>
        <div class="bar"></div>
        <div class="stack">${C.feed.map(feedItem).join("")}</div>
        ${state.member
          ? `<div class="card member-status mt"><span class="num"><i class="fas fa-crown"></i></span>
               <span class="ms-text"><b>ты в клубе</b><small>все материалы и разборы открыты</small></span></div>`
          : `<div class="lime-block halftone mt">
               <div class="lb-top"><span class="eyebrow"><i class="dot"></i> подписка</span><span class="num dark"><i class="fas fa-crown"></i></span></div>
               <div class="mini-bar"></div>
               <h3>живые разборы, кейсы и связки — в подписке</h3>
               <p>от ${esc(C.plans[C.plans.length - 1].note.replace("≈ ", ""))}</p>
               <button class="btn btn-dark" data-paywall>смотреть тарифы →</button>
             </div>`}
      </div>`;
  }

  // ---------- Profile ----------
  function renderProfile() {
    const p = power();
    const s = streak();
    $('[data-screen="profile"]').innerHTML = `
      <div class="container">
        ${hud()}
        <h2 class="page-title" style="margin-top:22px">привет, ${esc(userName())}</h2>
        <div class="bar"></div>

        <div class="card stats">
          <div><b>${s}</b><span>${plural(s, "день", "дня", "дней")} серии</span></div>
          <div><b>${xp()}</b><span>xp</span></div>
          <div><b>${pathPct()}%</b><span>пути</span></div>
        </div>

        <div class="section-head"><span class="eyebrow"><i class="dot"></i> достижения · ${state.badges.length}/${C.achievements.length}</span></div>
        <div class="card badges">
          ${C.achievements.map((a) => `
            <div class="badge-item ${state.badges.includes(a.id) ? "on" : ""}" title="${esc(a.text)}">
              <i class="fas ${esc(a.icon)}"></i><span>${esc(a.title)}</span>
            </div>`).join("")}
        </div>

        <div class="card mt">
          <div class="power-row">
            <span class="num">${p ? `<i class="fas ${esc(p.icon)}"></i>` : "?"}</span>
            <div class="pr-text"><small>суперсила</small><b>${p ? esc(p.title) : "не выбрана"}</b></div>
            <button class="link" data-go="powers">${p ? "сменить" : "выбрать"} →</button>
          </div>
        </div>

        <div class="stack gap-sm mt">
          <button class="row-link card" data-paywall><i class="fas fa-crown lime"></i><span>${state.member ? "подписка активна" : "подписка"}</span><i class="fas fa-chevron-right"></i></button>
          <button class="row-link card" id="pf-manager"><i class="fab fa-telegram-plane lime"></i><span>написать мастеру</span><i class="fas fa-chevron-right"></i></button>
          <button class="row-link card" id="pf-onboarding"><i class="fas fa-route lime"></i><span>пересобрать мой путь</span><i class="fas fa-chevron-right"></i></button>
          <button class="row-link card" id="pf-reset"><i class="fas fa-rotate-left lime"></i><span>сбросить прогресс</span><i class="fas fa-chevron-right"></i></button>
        </div>
        <p class="footnote">${esc(C.club.name)} · ${esc(C.club.handle)}</p>
      </div>`;

    $("#pf-manager").onclick = () => openTelegram(C.club.managerTelegram);
    $("#pf-onboarding").onclick = () => { obStep = 1; go("onboarding", { reset: true }); };
    $("#pf-reset").onclick = () => {
      const doReset = () => { state = defaultState(); save(); obStep = 0; go("onboarding", { reset: true }); };
      if (inTelegram && tg.showConfirm) tg.showConfirm("сбросить весь прогресс?", (ok) => ok && doReset());
      else if (confirm("сбросить весь прогресс?")) doReset();
    };
  }

  // ---------- Render ----------
  function render() {
    ({
      onboarding: renderOnboarding,
      home: renderHome,
      path: renderPath,
      level: renderLevel,
      powers: renderPowers,
      paywall: renderPaywall,
      club: renderClub,
      profile: renderProfile,
    }[current] || (() => {}))();
  }

  // ---------- Boot ----------
  if (!state.onboarded) {
    go("onboarding", { reset: true });
  } else {
    go("home", { reset: true });
    // Deep links: ?startapp=level-5 | club | paywall
    const sp = (inTelegram && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get("startapp");
    const m = sp && /^level-(\d+)$/.exec(sp);
    if (m && level(+m[1])) openLevel(+m[1]);
    else if (sp === "club" || sp === "paywall") go(sp);
  }
})();
