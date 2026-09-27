(function () {
  "use strict";

  const C = window.SUPERY_CONFIG;
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.initData);
  const STORE_KEY = "supery:v1";

  // ---------- Telegram setup ----------
  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor("#050505");
      tg.setBackgroundColor("#050505");
    } catch (_) {}
  }
  const tgUser = (inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;

  const haptic = (type) => {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (type === "success" || type === "error") tg.HapticFeedback.notificationOccurred(type);
      else tg.HapticFeedback.impactOccurred(type || "light");
    } catch (_) {}
  };

  // ---------- State (localStorage, MVP) ----------
  const defaultState = () => ({
    registrations: [],
    application: null, // { tier, sentAt }
    memberNo: String(Math.floor(1000 + Math.random() * 9000)),
  });
  let state;
  try {
    state = Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY)) || {});
  } catch (_) {
    state = defaultState();
  }
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
  };

  // ---------- Helpers ----------
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" });
  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const isRegistered = (id) => state.registrations.includes(id);
  const seatsTaken = (ev) => ev.taken + (isRegistered(ev.id) ? 1 : 0);
  const upcoming = () =>
    C.events.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  const userName = () =>
    tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") : "Гость клуба";

  const currentTier = () => {
    const id = state.application ? state.application.tier : "guest";
    return C.tiers.find((t) => t.id === id) || C.tiers[0];
  };

  let toastTimer;
  const toast = (msg) => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  };

  const openTelegram = (username, text) => {
    const url = `https://t.me/${username}${text ? "?text=" + encodeURIComponent(text) : ""}`;
    if (tg && tg.openTelegramLink && inTelegram) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  };

  // ---------- Navigation ----------
  const history = [];
  let current = "home";

  function go(screen, opts = {}) {
    if (screen === current && !opts.force) return;
    if (!opts.back) history.push(current);
    current = screen;
    $$(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === screen));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.go === (screen === "event" ? "events" : screen)));
    window.scrollTo(0, 0);

    if (screen === "profile") renderProfile();
    if (screen === "events") renderEvents();

    if (tg && tg.BackButton) {
      screen === "home" ? tg.BackButton.hide() : tg.BackButton.show();
    }
    haptic("light");
  }

  function back() {
    const prev = history.pop() || "home";
    go(prev, { back: true, force: true });
  }

  if (tg && tg.BackButton) tg.BackButton.onClick(back);

  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-go]");
    if (target) { e.preventDefault(); go(target.dataset.go); }
  });

  // ---------- Home ----------
  function renderHome() {
    $("#hero-img").src = C.club.heroImage;
    $("#club-name").textContent = C.club.name;
    $("#club-tagline").textContent = C.club.tagline;
    $("#club-about").textContent = C.club.about;

    $("#stats").innerHTML = C.stats
      .map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
      .join("");

    $("#perks").innerHTML = C.perks
      .map(
        (p, i) => `
        <div class="perk glass reveal" style="animation-delay:${i * 80}ms">
          <i class="fas ${esc(p.icon)}"></i>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.text)}</p>
        </div>`
      )
      .join("");

    const next = upcoming()[0];
    $("#next-event").innerHTML = next ? eventCard(next) : `<div class="empty">Скоро анонсируем новые события</div>`;
  }

  // ---------- Events ----------
  let eventFilter = "Все";

  function eventCard(ev) {
    const taken = seatsTaken(ev);
    const pct = Math.min(100, Math.round((taken / ev.seats) * 100));
    const left = Math.max(0, ev.seats - taken);
    return `
      <article class="event-card reveal" data-event="${esc(ev.id)}">
        <div class="cover">
          <img src="${esc(ev.image)}" alt="" loading="lazy">
          ${isRegistered(ev.id) ? `<span class="badge registered">Вы идёте</span>` : ""}
          ${ev.membersOnly ? `<span class="badge">Members only</span>` : ""}
        </div>
        <div class="event-body">
          <div class="event-cat">${esc(ev.category)}</div>
          <h3 class="event-title">${esc(ev.title)}</h3>
          <div class="meta">
            <span><i class="far fa-calendar"></i>${esc(fmtDate(ev.date))} · ${esc(fmtTime(ev.date))}</span>
            <span><i class="fas fa-location-dot"></i>${esc(ev.place)}</span>
          </div>
          <div class="progress"><div style="width:${pct}%"></div></div>
          <div class="seats">${left > 0 ? `Осталось мест: ${left} из ${ev.seats}` : "Мест нет — лист ожидания"}</div>
        </div>
      </article>`;
  }

  function renderEvents() {
    const cats = ["Все", ...new Set(C.events.map((e) => e.category))];
    $("#event-filters").innerHTML = cats
      .map((c) => `<button class="chip ${c === eventFilter ? "active" : ""}" data-filter="${esc(c)}">${esc(c)}</button>`)
      .join("");
    const list = upcoming().filter((e) => eventFilter === "Все" || e.category === eventFilter);
    $("#events-list").innerHTML = list.length ? list.map(eventCard).join("") : `<div class="empty">Нет событий в этой категории</div>`;
  }

  $("#event-filters").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    eventFilter = chip.dataset.filter;
    haptic("light");
    renderEvents();
  });

  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-event]");
    if (card) openEvent(card.dataset.event);
  });

  function openEvent(id, opts = {}) {
    const ev = C.events.find((x) => x.id === id);
    if (!ev) return;
    const reg = isRegistered(ev.id);
    const locked = ev.membersOnly && currentTier().id !== "resident";
    const left = Math.max(0, ev.seats - seatsTaken(ev));

    let action;
    if (reg) action = `<button class="btn btn-ghost btn-block" id="ev-action" data-action="cancel">Отменить запись</button>`;
    else if (locked) action = `<button class="btn btn-outline-gold btn-block" data-go="join"><i class="fas fa-lock"></i> Только для резидентов</button>`;
    else if (left === 0) action = `<button class="btn btn-ghost btn-block" id="ev-action" data-action="wait">В лист ожидания</button>`;
    else action = `<button class="btn btn-gold btn-block" id="ev-action" data-action="register">Записаться</button>`;

    $("#event-detail").innerHTML = `
      <div class="detail-hero">
        <button class="back" id="ev-back" aria-label="Назад"><i class="fas fa-arrow-left"></i></button>
        <img src="${esc(ev.image)}" alt="">
      </div>
      <div class="detail-body">
        <div class="event-cat">${esc(ev.category)}</div>
        <h1>${esc(ev.title)}</h1>
        <div class="meta">
          <span><i class="far fa-calendar"></i>${esc(fmtDate(ev.date))} · ${esc(fmtTime(ev.date))}</span>
          <span><i class="fas fa-location-dot"></i>${esc(ev.place)}</span>
          <span><i class="fas fa-user-group"></i>${seatsTaken(ev)} / ${ev.seats} участников</span>
        </div>
        <p class="muted">${esc(ev.description)}</p>
        ${action}
        <button class="btn btn-ghost btn-block mt" id="ev-ask"><i class="fab fa-telegram-plane"></i> Задать вопрос</button>
      </div>`;

    $("#ev-back").onclick = back;
    $("#ev-ask").onclick = () => openTelegram(C.club.managerTelegram, `Вопрос по событию «${ev.title}»`);
    const btn = $("#ev-action");
    if (btn) btn.onclick = () => toggleRegistration(ev, btn.dataset.action);

    if (!opts.rerender) go("event", { force: true });
  }

  function toggleRegistration(ev, action) {
    if (action === "cancel") {
      state.registrations = state.registrations.filter((x) => x !== ev.id);
      toast("Запись отменена");
      haptic("medium");
    } else {
      state.registrations.push(ev.id);
      toast(action === "wait" ? "Вы в листе ожидания" : "Вы записаны! Напомним за день");
      haptic("success");
      sendLead({ type: "event_registration", eventId: ev.id, eventTitle: ev.title });
    }
    save();
    renderHome();
    openEvent(ev.id, { rerender: true });
  }

  // ---------- Members ----------
  function renderMembers(q = "") {
    const query = q.trim().toLowerCase();
    const list = C.members.filter((m) => !query || (m.name + " " + m.role).toLowerCase().includes(query));
    $("#members").innerHTML = list.length
      ? list
          .map(
            (m) => `
          <div class="member glass">
            <img src="${esc(m.photo)}" alt="" loading="lazy">
            <h3>${esc(m.name)}</h3>
            <p>${esc(m.role)}</p>
          </div>`
          )
          .join("")
      : `<div class="empty">Никого не нашли</div>`;
  }
  $("#member-search").addEventListener("input", (e) => renderMembers(e.target.value));

  // ---------- Join ----------
  function renderTiers() {
    const selected = $("#tier-select").value || "resident";
    $("#tiers").innerHTML = C.tiers
      .map(
        (t) => `
        <div class="tier ${t.featured ? "featured" : ""} ${t.id === selected ? "selected" : ""}" data-tier="${esc(t.id)}">
          ${t.featured ? `<span class="badge">Лучший выбор</span>` : ""}
          <h3>${esc(t.name)}</h3>
          <div class="price">${esc(t.price)}</div>
          <ul>${t.features.map((f) => `<li><i class="fas fa-check"></i>${esc(f)}</li>`).join("")}</ul>
        </div>`
      )
      .join("");
  }

  function initJoin() {
    $("#tier-select").innerHTML = C.tiers
      .map((t) => `<option value="${esc(t.id)}">${esc(t.name)} — ${esc(t.price)}</option>`)
      .join("");
    $("#tier-select").value = "resident";
    renderTiers();

    const form = $("#join-form");
    if (tgUser) {
      form.name.value = userName();
      if (tgUser.username) form.contact.value = "@" + tgUser.username;
    }

    $("#tiers").addEventListener("click", (e) => {
      const card = e.target.closest("[data-tier]");
      if (!card) return;
      $("#tier-select").value = card.dataset.tier;
      renderTiers();
      haptic("light");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#tier-select").addEventListener("change", renderTiers);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;
      ["name", "contact"].forEach((n) => {
        const bad = !form[n].value.trim();
        form[n].classList.toggle("invalid", bad);
        if (bad) ok = false;
      });
      if (!ok) { haptic("error"); toast("Заполните имя и контакт"); return; }

      const data = Object.fromEntries(new FormData(form).entries());
      const tier = C.tiers.find((t) => t.id === data.tier);
      state.application = { tier: data.tier, sentAt: new Date().toISOString() };
      save();
      haptic("success");

      sendLead({ type: "application", ...data });

      const text =
        `Заявка в клуб ${C.club.name}\n` +
        `Имя: ${data.name}\nКонтакт: ${data.contact}\n` +
        (data.occupation ? `Сфера: ${data.occupation}\n` : "") +
        `Тариф: ${tier ? tier.name : data.tier}\n` +
        (data.goal ? `Запрос: ${data.goal}` : "");

      toast("Заявка отправлена!");
      if (!C.club.leadWebhook) openTelegram(C.club.managerTelegram, text);
      go("profile");
    });
  }

  function sendLead(payload) {
    if (!C.club.leadWebhook) return;
    const body = {
      ...payload,
      club: C.club.name,
      telegramUser: tgUser,
      initData: inTelegram ? tg.initData : null, // проверяйте подпись на сервере
      createdAt: new Date().toISOString(),
    };
    fetch(C.club.leadWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  // ---------- Profile ----------
  function renderProfile() {
    const tier = currentTier();
    const pending = state.application && tier.id !== "guest";
    $("#member-card").innerHTML = `
      <div class="mc-top">
        <div class="mc-logo">СУПЕР<span class="gold">Ы</span>.</div>
        <div class="mc-tier">${esc(tier.name)}</div>
      </div>
      <div>
        <div class="mc-name">${esc(userName())}</div>
        <div class="mc-sub">
          <span>№ <b>${esc(state.memberNo)}</b></span>
          <span>${pending ? "Заявка на рассмотрении" : "Статус активен"}</span>
        </div>
      </div>`;

    const mine = upcoming().filter((e) => isRegistered(e.id));
    $("#my-events").innerHTML = mine.length
      ? mine.map(eventCard).join("")
      : `<div class="empty">Вы пока никуда не записаны.<br><br><button class="link" data-go="events">Смотреть события →</button></div>`;
  }

  function initProfile() {
    $("#contact-manager").href = `https://t.me/${C.club.managerTelegram}`;
    $("#contact-manager").onclick = (e) => { e.preventDefault(); openTelegram(C.club.managerTelegram); };
    $("#contact-email").href = `mailto:${C.club.email}`;
    $("#reset-data").onclick = () => {
      const doReset = () => {
        state = defaultState();
        save();
        renderHome();
        renderProfile();
        toast("Данные сброшены");
      };
      if (tg && inTelegram && tg.showConfirm) tg.showConfirm("Сбросить записи и заявку?", (yes) => yes && doReset());
      else if (confirm("Сбросить записи и заявку?")) doReset();
    };

    if (tgUser && tgUser.photo_url) {
      $("#top-avatar").src = tgUser.photo_url;
      $("#top-avatar").hidden = false;
      $("#top-avatar-icon").hidden = true;
    }
  }

  // ---------- Boot ----------
  renderHome();
  renderEvents();
  renderMembers();
  initJoin();
  initProfile();
  if (tg && tg.BackButton) tg.BackButton.hide();

  // Deep link: t.me/<bot>/<app>?startapp=ev-1 → сразу открыть событие
  const startParam = (inTelegram && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get("startapp");
  if (startParam && C.events.some((e) => e.id === startParam)) openEvent(startParam);
})();
