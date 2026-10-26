import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  tools: ["read", "grep", "glob", "ls"],
  hosting: {
    egressDomains: ["script.google.com", "script.googleusercontent.com"],
    secretNames: ["RELAY_SECRET"],
  },
});
