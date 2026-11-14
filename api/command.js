// POST /api/command — one player command in, the room's reply out.
// On Vercel this file is a serverless function; locally, server.js calls it.
//
// The server stores nothing. The browser keeps the game as the list of actions
// taken so far (in localStorage) and sends it with every command; we replay it
// through act() to rebuild the state. A tampered list can only contain real
// actions, so the worst a player can do is skip to the end of their own game.

import { ACTIONS, newGame, act, hint, INTRO } from "../game.js";
import { interpret } from "../jev.js";

const MAX_ACTIONS = 1000;
const EXPIRED =
  "You must have dozed off. When you open your eyes, everything is exactly as it was the first time you woke up.";

const isValid = (actions) =>
  Array.isArray(actions) &&
  actions.length <= MAX_ACTIONS &&
  actions.every((a) => typeof a === "string" && Object.hasOwn(ACTIONS, a));

const replay = (actions) => actions.reduce((s, a) => act(s, a).state, newGame());

// body: { input, actions, expired }  ->  { text, actions, escaped }
export async function handleCommand(body) {
  // The browser tracks the 30-minute idle timeout and tells us when it ran out.
  if (body.expired) return { text: `${EXPIRED}\n\n${INTRO}`, actions: [] };

  const input = String(body.input || "").trim().slice(0, 300);
  if (!input) return { text: INTRO, actions: [] }; // new game

  // An unreadable save (edited by hand, or from an older version) starts over.
  const actions = isValid(body.actions) ? body.actions : [];
  const state = replay(actions);
  const { action, confidence, stuck, source } = await interpret(input, state);
  console.log(`[${source}] "${input}" -> ${action} (conf ${confidence.toFixed(2)}, stuck ${stuck.toFixed(2)})`);

  if (action === "unclear") {
    return { text: "You hesitate, not sure how to do that here. Try being more specific.", actions, escaped: state.escaped };
  }

  const result = act(state, action);
  let text = result.text;
  // Jev noticed the player sounds stuck: nudge them (unless they already asked for help).
  if (stuck > 0.7 && action !== "help" && !result.state.escaped) {
    text += `\n\n(A thought surfaces: ${hint(result.state)})`;
  }
  return { text, actions: [...actions, action], escaped: result.state.escaped };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST" });
    return res.end();
  }
  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { text: "The room glitches. Try that again." });
  }
  try {
    send(res, 200, await handleCommand(body));
  } catch (err) {
    console.error(err);
    send(res, 500, { text: "The room glitches. Try that again." });
  }
}

// Vercel has already parsed a JSON body into req.body; the local server hasn't.
async function readJson(req) {
  let body = req.body;
  if (body === undefined) {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 64_000) throw new Error("body too large");
    }
    body = raw;
  }
  if (typeof body === "string") body = JSON.parse(body || "{}");
  return body && typeof body === "object" ? body : {};
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
