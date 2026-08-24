import assert from "node:assert/strict";
import test from "node:test";
import { IMPERIAL_PROMPT } from "../src/prompt.js";

test("задание модели фиксирует личность и реалистичность", () => {
  assert.match(IMPERIAL_PROMPT, /Preserve the exact identity/);
  assert.match(IMPERIAL_PROMPT, /Russian Imperial court attire/);
  assert.match(IMPERIAL_PROMPT, /not CGI and not a collage/);
});
