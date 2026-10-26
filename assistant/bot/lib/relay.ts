// Ответы уходят обратно на сервер портала (Google Apps Script), откуда их забирает сайт.
const PORTAL_URL =
  "https://script.google.com/macros/s/AKfycbyJrZ6wsZNZRi8TWmV8Lh2Q6tk8y3itHu7VL7qxTlEv0PInpBe0eE8VhZoTEq9fFc7u/exec";

export type Reply = { chatId: string; reqIds: string[]; text?: string; error?: string };

export async function deliver(reply: Reply): Promise<void> {
  const secret = process.env.RELAY_SECRET ?? "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(process.env.PORTAL_REPLY_URL || PORTAL_URL, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "reply", secret, ...reply }),
        redirect: "follow",
      });
      if (res.ok) return;
    } catch {
      // retried below
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
}
