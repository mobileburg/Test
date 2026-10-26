import { defineChannel, localDevStrict, POST, sharedSecretAuth } from "@grok/agent-sdk/channels";
import { z } from "zod";
import { deliver } from "../lib/relay.js";

type WebState = { chatId: string };
type Pending = { reqIds: string[] };

const key = (sessionId: string, turnId: string | undefined) => `pending:${sessionId}:${turnId ?? "-"}`;

export default defineChannel<WebState>({
  auth: [sharedSecretAuth({ header: "x-relay-secret", secret: "RELAY_SECRET" }), localDevStrict()],
  state: { chatId: "" },
  routes: [
    POST("/ask", {
      description: "Вопрос с сайта учебного центра (через сервер портала)",
      bodySchema: z.object({
        reqId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
        chatId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
        message: z.string().min(1).max(4000),
        page: z.string().max(300).optional(),
        title: z.string().max(300).optional(),
      }),
      handler: async (_request, { send, waitUntil, body }) => {
        const where = body.page ? `\n\n(Вопрос задан на странице сайта: ${body.title || ""} — ${body.page})` : "";
        waitUntil(
          send(body.message + where, {
            continuationToken: `chat:${body.chatId}`,
            admission: "coalesce",
            deliveryId: body.reqId,
            state: { chatId: body.chatId },
            title: `Чат ${body.chatId}`,
          }).catch(() => deliver({ chatId: body.chatId, reqIds: [body.reqId], error: "Помощник не смог начать ответ." }))
        );
        return new Response(null, { status: 202 });
      },
    }),
  ],
  events: {
    async "message.received"(event, _channel, ctx) {
      await ctx.host.kv.put(key(event.sessionId, event.turnId), { reqIds: event.data.deliveryIds ?? [] });
    },
    async "nudge.delivered"(event, _channel, ctx) {
      const id = event.data.deliveryId;
      if (!id) return;
      const k = key(event.sessionId, event.turnId);
      const cur = ((await ctx.host.kv.get(k)) as Pending | null) ?? { reqIds: [] };
      await ctx.host.kv.put(k, { reqIds: [...cur.reqIds, id] });
    },
    async "message.completed"(event, channel, ctx) {
      if (event.data.finishReason === "tool_call" || !event.data.text) return;
      const k = key(event.sessionId, event.turnId);
      const cur = (await ctx.host.kv.get(k)) as Pending | null;
      if (!cur || !cur.reqIds.length) return;
      await deliver({ chatId: channel.state.chatId, reqIds: cur.reqIds, text: event.data.text });
      await ctx.host.kv.delete(k);
    },
    async "turn.failed"(event, channel, ctx) {
      const k = key(event.sessionId, event.turnId);
      const cur = (await ctx.host.kv.get(k)) as Pending | null;
      if (!cur || !cur.reqIds.length) return;
      const cancelled = event.data.status === "cancelled";
      await deliver({ chatId: channel.state.chatId, reqIds: cur.reqIds, error: cancelled ? "Ответ прерван." : "Не получилось ответить, попробуй ещё раз." });
      await ctx.host.kv.delete(k);
    },
  },
});
