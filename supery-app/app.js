(function () {
  "use strict";

  const C = window.SUPERY_CONFIG;
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.initData);
  const STORE_KEY = "supery:v2";

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
      if (type === "success" || type === "error") tg.HapticFeedback.notificationOccurred(type);
      else tg.HapticFeedback.impactOccurred(type || "light");
    } catch (_) {}
  };

  // ---------- State (localStorage) ----------
  const defaultState = () => ({ done: {}, power: null, subscribeRequestedAt: null });
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

  const levelDone = (lvl) => lvl.topics.filter((_, i) => state.done[key(lvl.n, i)]).length;
  const totalTopics = C.path.reduce((s, l) => s + l.topics.length, 0);
  const doneTopics = () => C.path.reduce((s, l) => s + levelDone(l), 0);
  const levelsComplete = () => C.path.filter((l) => levelDone(l) === l.topics.length).length;
  const nextLevel = () => C.path.find((l) => levelDone(l) < l.topics.length) || null;
  const power = () => C.powers.find((p) => p.id === state.power) || null;
  const userName = () => tgUser ? tgUser.first_name || "супер" : "супер";

  let toastTimer;
  const toast = (msg) => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  };

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
        progress: { done: doneTopics(), total: totalTopics, power: state.power },
        createdAt: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  // ---------- Navigation ----------
  const stack = [];
  let current = "home";
  const TAB_OF = { level: "path", powers: "path" };

  function go(screen, opts = {}) {
    if (!opts.back && screen !== current) stack.push(current);
    current = screen;
    $$(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === screen));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.go === (TAB_OF[screen] || screen)));
    window.scrollTo(0, 0);
    render();
    if (tg && tg.BackButton) screen === "home" ? tg.BackButton.hide() : tg.BackButton.show();
    haptic("light");
  }
  const back = () => go(stack.pop() || "home", { back: true });
  if (tg && tg.BackButton) tg.BackButton.onClick(back);

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go]");
    if (t) {
      e.preventDefault();
      if (t.classList.contains("tab")) stack.length = 0;
      go(t.dataset.go);
      return;
    }
    const lv = e.target.closest("[data-level]");
    if (lv) openLevel(+lv.dataset.level);
  });

  // ---------- Home ----------
  function renderHome() {
    $("#handle").textContent = C.club.handle;
    $("#club-name").textContent = C.club.name;
    $("#club-subtitle").textContent = C.club.subtitle;
    $("#quote").textContent = `«${C.quote}»`;

    const nl = nextLevel();
    const pct = Math.round((doneTopics() / totalTopics) * 100);
    $("#continue-card").innerHTML = nl
      ? `
        <div class="lb-top">
          <span class="eyebrow"><i class="dot"></i> ${doneTopics() ? "продолжить путь" : "начни путь"}</span>
          <span class="num dark">${pad(nl.n)}</span>
        </div>
        <div class="mini-bar"></div>
        <h3>${esc(nl.title)}</h3>
        <p>${esc(nl.intro)}</p>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <button class="btn btn-dark" data-level="${nl.n}">${doneTopics() ? "продолжить" : "начать"} →</button>`
      : `
        <div class="lb-top"><span class="eyebrow"><i class="dot"></i> путь пройден</span><span class="num dark">10</span></div>
        <div class="mini-bar"></div>
        <h3>ты — супер</h3>
        <p>весь путь 0–10 пройден. дальше — новая связка каждый месяц.</p>
        <button class="btn btn-dark" data-go="club">в клуб →</button>`;

    $("#formula").innerHTML = C.formula
      .map((s, i) => `<div class="step card"><span class="num">${pad(i + 1)}</span><span>${esc(s)}</span></div>`)
      .join("");

    $("#feed-preview").innerHTML = feedItem(C.feed[0], 0);
  }

  function feedItem(f, i) {
    const d = new Date(f.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    return `
      <div class="card feed-item">
        <span class="num">${pad(i + 1)}</span>
        <div>
          <div class="ft">${esc(f.type)}</div>
          <h4>${esc(f.title)}</h4>
          <div class="fd">${esc(d)}</div>
        </div>
      </div>`;
  }

  // ---------- Path map ----------
  function renderMap() {
    const pw = state.power;
    $("#map").innerHTML =
      `<div class="map-root"><b>${esc(C.club.name)}</b><span>${esc(C.club.tagline)}</span></div>` +
      C.path
        .map((l) => {
          const d = levelDone(l);
          const full = d === l.topics.length;
          const focus = pw && l.power === pw;
          return `
          <div class="lvl ${l.color} ${focus ? "focus" : ""}">
            ${focus ? `<span class="power-tag">твоя сила</span>` : ""}
            <button class="lvl-node" data-level="${l.n}">
              <i class="fas ${esc(l.icon)} ic"></i>
              <span class="tt"><em>${l.n}.</em>${esc(l.title)}</span>
              <span class="cnt ${full ? "done" : ""}">${full ? '<i class="fas fa-check"></i>' : `${d}/${l.topics.length}`}</span>
            </button>
            <div class="topics">
              ${l.topics.map((t, i) => `<span class="topic ${state.done[key(l.n, i)] ? "done" : ""}">${esc(t)}</span>`).join("")}
            </div>
          </div>`;
        })
        .join("");
  }

  // ---------- Level detail ----------
  let openN = 0;
  function openLevel(n) {
    openN = n;
    if (current === "level") { render(); window.scrollTo(0, 0); haptic("light"); }
    else go("level");
  }

  function renderLevel() {
    const l = C.path.find((x) => x.n === openN);
    if (!l) return;
    const prev = C.path.find((x) => x.n === l.n - 1);
    const next = C.path.find((x) => x.n === l.n + 1);
    const d = levelDone(l);
    const extra =
      l.n === 2
        ? `<button class="btn btn-lime" data-go="powers">${power() ? `суперсила: ${esc(power().title)} · сменить` : "выбрать суперсилу →"}</button>`
        : l.n === 10
        ? `<button class="btn btn-lime" data-go="club">открыть жизнь клуба →</button>`
        : "";

    $("#level-detail").innerHTML = `
      <button class="back" id="lv-back"><i class="fas fa-arrow-left"></i> путь</button>
      <div class="lv-head">
        <span class="num">${pad(l.n)}</span>
        <div>
          <span class="eyebrow"><i class="dot"></i> уровень ${l.n} · ${d}/${l.topics.length}</span>
          <h2 class="page-title" style="margin:6px 0 0">${esc(l.title)}</h2>
        </div>
      </div>
      <div class="bar" style="margin-top:18px"></div>
      <p class="lead" style="margin-bottom:20px">${esc(l.intro)}</p>
      <div class="lessons">
        ${l.topics.map((t, i) => {
          const done = !!state.done[key(l.n, i)];
          return `
          <button class="lesson ${done ? "done" : ""}" data-topic="${i}">
            <span class="chk"><i class="fas fa-check"></i></span>
            <span class="ln"><b>${esc(t)}</b><small>урок ${l.n}.${i + 1} · ${done ? "пройдено" : "отметь, когда пройдёшь"}</small></span>
          </button>`;
        }).join("")}
      </div>
      ${extra}
      <div class="nav-row mt">
        ${prev ? `<button class="btn btn-outline" data-level="${prev.n}">← ${pad(prev.n)}</button>` : ""}
        ${next ? `<button class="btn btn-outline" data-level="${next.n}">${pad(next.n)} →</button>` : ""}
      </div>`;

    $("#lv-back").onclick = back;
    $$("#level-detail [data-topic]").forEach((b) => {
      b.onclick = () => {
        const k = key(l.n, +b.dataset.topic);
        if (state.done[k]) delete state.done[k];
        else state.done[k] = true;
        save();
        const nowDone = levelDone(l) === l.topics.length;
        if (state.done[k] && nowDone) { haptic("success"); toast(`уровень ${l.n} пройден 🔥`); }
        else haptic("light");
        renderLevel();
      };
    });
  }

  // ---------- Powers ----------
  function renderPowers() {
    $("#powers").innerHTML = C.powers
      .map((p) => `
        <button class="power ${state.power === p.id ? "selected" : ""}" data-power="${esc(p.id)}">
          <i class="fas ${esc(p.icon)}"></i>
          <span><b>${esc(p.title)}</b><small>${esc(p.text)}</small></span>
        </button>`)
      .join("");
    $$("#powers [data-power]").forEach((b) => {
      b.onclick = () => {
        state.power = b.dataset.power;
        // выбор суперсилы закрывает урок «выбор суперсилы» на уровне 2
        const lvl2 = C.path.find((l) => l.n === 2);
        const idx = lvl2 ? lvl2.topics.indexOf("выбор суперсилы") : -1;
        if (idx >= 0) state.done[key(2, idx)] = true;
        save();
        haptic("success");
        toast(`суперсила: ${power().title}`);
        renderPowers();
      };
    });
  }

  // ---------- Club ----------
  function renderClub() {
    $("#feed").innerHTML = C.feed.map(feedItem).join("");
    const s = C.subscription;
    const requested = !!state.subscribeRequestedAt;
    $("#sub-card").innerHTML = `
      <div class="lb-top">
        <span class="eyebrow"><i class="dot"></i> ${esc(s.title)}</span>
        <span class="num dark"><i class="fas fa-crown"></i></span>
      </div>
      <div class="mini-bar"></div>
      <div class="price">${esc(s.price)}<small>${esc(s.period)}</small></div>
      <ul>${s.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <button class="btn btn-dark" id="subscribe">${requested ? "заявка отправлена · написать ещё" : "вступить в клуб →"}</button>`;
    $("#subscribe").onclick = () => {
      state.subscribeRequestedAt = new Date().toISOString();
      save();
      haptic("success");
      sendLead({ type: "subscription" });
      const u = tgUser ? `${tgUser.first_name || ""}${tgUser.username ? " (@" + tgUser.username + ")" : ""}` : "";
      openTelegram(
        C.club.managerTelegram,
        `хочу в клуб ${C.club.name}!${u ? "\nя: " + u : ""}${power() ? "\nмоя суперсила: " + power().title : ""}`
      );
      renderClub();
    };
  }

  // ---------- Profile ----------
  function renderProfile() {
    $("#profile-name").textContent = `привет, ${userName()}`;
    $("#profile-stats").innerHTML = `
      <div><b>${levelsComplete()}</b><span>уровней</span></div>
      <div><b>${doneTopics()}</b><span>уроков</span></div>
      <div><b>${Math.round((doneTopics() / totalTopics) * 100)}%</b><span>пути</span></div>`;
    const p = power();
    $("#profile-power").innerHTML = `
      <div class="power-row">
        <span class="num">${p ? `<i class="fas ${esc(p.icon)}"></i>` : "?"}</span>
        <div class="pr-text"><small>суперсила</small><b>${p ? esc(p.title) : "не выбрана"}</b></div>
        <button class="link" data-go="powers">${p ? "сменить" : "выбрать"} →</button>
      </div>`;
    $("#footnote").textContent = `${C.club.name} · ${C.club.handle}`;
  }

  $("#contact-manager").onclick = () => openTelegram(C.club.managerTelegram);
  $("#reset-data").onclick = () => {
    const doReset = () => { state = defaultState(); save(); render(); toast("прогресс сброшен"); };
    if (inTelegram && tg.showConfirm) tg.showConfirm("сбросить прогресс?", (ok) => ok && doReset());
    else if (confirm("сбросить прогресс?")) doReset();
  };

  // ---------- Render ----------
  function render() {
    if (current === "home") renderHome();
    if (current === "path") renderMap();
    if (current === "level") renderLevel();
    if (current === "powers") renderPowers();
    if (current === "club") renderClub();
    if (current === "profile") renderProfile();
  }

  render();
  if (tg && tg.BackButton) tg.BackButton.hide();

  // Deep link: t.me/<bot>/<app>?startapp=level-5 → сразу открыть уровень
  const sp = (inTelegram && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get("startapp");
  const m = sp && /^level-(\d+)$/.exec(sp);
  if (m && C.path.some((l) => l.n === +m[1])) openLevel(+m[1]);
  else if (sp === "club") go("club");
})();
