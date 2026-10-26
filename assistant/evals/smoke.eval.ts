import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Помощник отвечает по-русски и по делу на школьный вопрос.",
  async test(t) {
    await t.send("Что такое алкены? Объясни коротко.");
    t.succeeded();
  },
});
