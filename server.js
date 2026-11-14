import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Load .env (no dependency needed).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { newGame, act, hint, INTRO } = await import("./game.js");
const { interpret, jevEnabled } = await import("./jev.js");

const PORT = process.env.PORT || 3000;
const page = () => readFileSync(new URL("./public/index.html", import.meta.url));
const sessions = new Map(); // sessionId -> game state (in memory; resets on restart)

async function handleCommand(body) {
  let { sessionId, input } = body;
  if (!sessionId || !sessions.has(sessionId)) {
    sessionId = randomUUID();
    sessions.set(sessionId, newGame());
    if (!input) return { sessionId, text: INTRO };
  }

  input = String(input || "").trim().slice(0, 300);
  if (!input) return { sessionId, text: "" };

  const state = sessions.get(sessionId);
  const { action, confidence, stuck, source } = await interpret(input, state);

  let text;
  if (action === "unclear") {
    text = "You hesitate, not sure how to do that here. Try being more specific.";
  } else {
    const result = act(state, action);
    sessions.set(sessionId, result.state);
    text = result.text;
    // Jev noticed the player sounds stuck: nudge them (unless they already asked for help).
    if (stuck > 0.7 && action !== "help" && !result.state.escaped) {
      text += `\n\n(A thought surfaces: ${hint(result.state)})`;
    }
  }

  console.log(`[${source}] "${input}" -> ${action} (conf ${confidence.toFixed(2)}, stuck ${stuck.toFixed(2)})`);
  return { sessionId, text, escaped: sessions.get(sessionId).escaped };
}

http
  .createServer(async (req, res) => {
    try {
      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(page());
      }
      if (req.method === "POST" && req.url === "/api/command") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 10_000) throw new Error("body too large");
        }
        const out = await handleCommand(JSON.parse(raw || "{}"));
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(out));
      }
      res.writeHead(404).end("Not found");
    } catch (err) {
      console.error(err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ text: "The room glitches. Try that again." }));
    }
  })
  .listen(PORT, () => {
    console.log(`The Server Room is running at http://localhost:${PORT}`);
    console.log(jevEnabled() ? "Parser: Jev" : "Parser: keyword fallback (set JEV_API_KEY in .env to use Jev)");
  });
