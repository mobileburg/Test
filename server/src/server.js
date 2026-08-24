import Fastify from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import OpenAI, { toFile } from "openai";
import { IMPERIAL_PROMPT } from "./prompt.js";

const port = Number(process.env.PORT || 8080);
const apiKey = process.env.OPENAI_API_KEY;
const appToken = process.env.APP_TOKEN;
const maxPhotoBytes = 15 * 1024 * 1024;

const app = Fastify({
  logger: {
    redact: ["req.headers.authorization"],
  },
  trustProxy: true,
  bodyLimit: maxPhotoBytes,
});

await app.register(multipart, {
  limits: {
    files: 1,
    fileSize: maxPhotoBytes,
    fields: 2,
  },
});

await app.register(rateLimit, {
  max: 6,
  timeWindow: "1 minute",
});

const openai = apiKey ? new OpenAI({ apiKey }) : null;

app.get("/health", async () => ({
  status: "ok",
  generationConfigured: Boolean(openai),
}));

app.post("/v1/imperial-portrait", async (request, reply) => {
  if (appToken && request.headers.authorization !== `Bearer ${appToken}`) {
    return reply.code(401).send({ error: "Неверный токен приложения" });
  }
  if (!openai) {
    return reply.code(503).send({ error: "Сервис генерации ещё не настроен" });
  }

  const photo = await request.file();
  if (!photo) {
    return reply.code(400).send({ error: "Добавьте фотографию в поле photo" });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.mimetype)) {
    return reply.code(415).send({ error: "Поддерживаются JPEG, PNG и WebP" });
  }

  const input = await photo.toBuffer();
  if (input.length === 0) {
    return reply.code(400).send({ error: "Получен пустой файл" });
  }

  const result = await openai.images.edit({
    model: "gpt-image-2",
    image: await toFile(input, photo.filename || "portrait.jpg", {
      type: photo.mimetype,
    }),
    prompt: IMPERIAL_PROMPT,
    quality: "high",
    size: "1024x1536",
    output_format: "jpeg",
    output_compression: 92,
  });

  const generated = result.data?.[0];
  let output;
  if (generated?.b64_json) {
    output = Buffer.from(generated.b64_json, "base64");
  } else if (generated?.url) {
    const response = await fetch(generated.url);
    if (!response.ok) throw new Error("Не удалось получить готовое изображение");
    output = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error("AI-сервис не вернул изображение");
  }

  return reply
    .header("Content-Type", "image/jpeg")
    .header("Cache-Control", "no-store")
    .header("X-Content-Type-Options", "nosniff")
    .send(output);
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, "generation request failed");
  const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 502;
  const message = status < 500
    ? error.message
    : "Не удалось создать императорский портрет";
  reply.code(status).send({ error: message });
});

await app.listen({ host: "0.0.0.0", port });
