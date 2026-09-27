// ============================================================
//  СУПЕРЫ — контент мини-приложения.
//  Всё, что видно в приложении, редактируется здесь.
// ============================================================
window.SUPERY_CONFIG = {
  club: {
    name: "СУПЕРЫ",
    tagline: "Закрытый клуб тех, кто делает больше",
    about:
      "СУПЕРЫ — сообщество предпринимателей, креаторов и людей действия. " +
      "Встречи, нетворкинг, совместные проекты и рост вместе с сильным окружением.",
    heroImage:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=1200&auto=format&fit=crop",
    // Куда уходят заявки и вопросы (username без @)
    managerTelegram: "konstantinmov",
    email: "konstantinmovprod@gmail.com",
    // Необязательно: URL вебхука (n8n / Make / свой сервер), принимает POST JSON с заявками.
    leadWebhook: "",
  },

  stats: [
    { value: "120+", label: "участников" },
    { value: "48", label: "встреч" },
    { value: "15", label: "городов" },
  ],

  events: [
    {
      id: "ev-1",
      title: "Супер-завтрак: нетворкинг",
      date: "2026-10-04T10:00:00+03:00",
      place: "Москва, лофт «Графит»",
      category: "Нетворкинг",
      seats: 30,
      taken: 21,
      image:
        "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=900&auto=format&fit=crop",
      description:
        "Утренняя встреча участников клуба: короткие питчи, знакомства по интересам и разбор запросов.",
    },
    {
      id: "ev-2",
      title: "AI для бизнеса: практикум",
      date: "2026-10-11T19:00:00+03:00",
      place: "Онлайн, Zoom",
      category: "Воркшоп",
      seats: 100,
      taken: 64,
      image:
        "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=900&auto=format&fit=crop",
      description:
        "Как внедрить нейросети в продажи и контент за 7 дней. Живые кейсы и готовые шаблоны.",
    },
    {
      id: "ev-3",
      title: "Закрытый ужин СУПЕРОВ",
      date: "2026-10-25T20:00:00+03:00",
      place: "Москва, ресторан — адрес после подтверждения",
      category: "Only members",
      seats: 16,
      taken: 13,
      membersOnly: true,
      image:
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=900&auto=format&fit=crop",
      description:
        "Камерный ужин для резидентов клуба. Спикер-сюрприз и честные разговоры о росте.",
    },
  ],

  perks: [
    { icon: "fa-users", title: "Окружение", text: "Сильные люди, которые открывают двери." },
    { icon: "fa-calendar-check", title: "Встречи", text: "Офлайн и онлайн-ивенты каждый месяц." },
    { icon: "fa-handshake", title: "Коллаборации", text: "Совместные проекты и сделки внутри клуба." },
    { icon: "fa-bolt", title: "Рост", text: "Разборы, практикумы и доступ к экспертам." },
  ],

  members: [
    { name: "Константин Мов", role: "Основатель · AI-продакшн", photo: "https://i.pravatar.cc/200?img=12" },
    { name: "Анна Ветрова", role: "Маркетинг · E-com", photo: "https://i.pravatar.cc/200?img=47" },
    { name: "Игорь Самсонов", role: "Девелопмент", photo: "https://i.pravatar.cc/200?img=33" },
    { name: "Мария Лис", role: "Бьюти-бизнес", photo: "https://i.pravatar.cc/200?img=45" },
    { name: "Дмитрий Орлов", role: "IT · Автоматизация", photo: "https://i.pravatar.cc/200?img=15" },
    { name: "Ева Карпова", role: "Рестораны", photo: "https://i.pravatar.cc/200?img=32" },
  ],

  tiers: [
    {
      id: "guest",
      name: "Гость",
      price: "Бесплатно",
      features: ["Открытые мероприятия", "Новости клуба"],
    },
    {
      id: "member",
      name: "Участник",
      price: "4 900 ₽ / мес",
      features: ["Все мероприятия", "Закрытый чат", "Каталог участников"],
    },
    {
      id: "resident",
      name: "Резидент",
      price: "14 900 ₽ / мес",
      featured: true,
      features: ["Всё из «Участник»", "Закрытые ужины", "Личный разбор проекта", "Промо внутри клуба"],
    },
  ],
};
