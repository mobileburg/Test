// Адрес серверной части (веб-приложение Google Apps Script, см. server/README.md).
// Таблица со статистикой: «Учебный портал — статистика» в Google Таблицах владельца сайта.
window.PORTAL_API = window.PORTAL_API || "https://script.google.com/macros/s/AKfycbyJrZ6wsZNZRi8TWmV8Lh2Q6tk8y3itHu7VL7qxTlEv0PInpBe0eE8VhZoTEq9fFc7u/exec";
// Помощник (ИИ-чат на Gemini) — только для вошедшего пользователя.
if (window.PORTAL_ASSISTANT === undefined) window.PORTAL_ASSISTANT = true;
