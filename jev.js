// Turns free-form player input into one game action.
// Uses Jev (TypeSafe's decision model) when JEV_API_KEY is set,
// otherwise a simple keyword parser so the game still works offline.

import { ACTIONS } from "./game.js";

const JEV_URL = process.env.JEV_URL || "https://api.aimlapi.com/v1/decisions";
const JEV_MODEL = process.env.JEV_MODEL || "typesafe/jev-1.14";
const MIN_CONFIDENCE = 0.45;

export const jevEnabled = () => Boolean(process.env.JEV_API_KEY);

// Returns { action, confidence, stuck, source }
export async function interpret(input, state) {
  if (jevEnabled()) {
    try {
      return await askJev(input, state);
    } catch (err) {
      console.error("Jev call failed, using keyword parser:", err.message);
    }
  }
  return { ...keywordParse(input), stuck: 0, source: "keywords" };
}

async function askJev(input, state) {
  const carrying = [];
  if (state.fuseTaken && !state.fuseInstalled) carrying.push("a fuse");

  const body = {
    model: JEV_MODEL,
    // Context lets Jev resolve things like "put it in" or "plug it in".
    state: {
      setting: "A locked room with an exit door, a terminal on a desk, a desk drawer, and a floor grate.",
      player_is_carrying: carrying,
      drawer_open: state.drawerOpen,
      grate_open: state.grateOpen,
      terminal_on: state.terminalOn,
      player_typed: input,
    },
    questions: {
      action: {
        type: "choice",
        instructions: "In this text adventure, which action is the player trying to take with what they typed?",
        criteria: ACTIONS,
      },
      stuck: {
        type: "noul",
        instructions: "Does the player sound stuck, frustrated, lost, or like they want a hint?",
      },
    },
    images: [],
  };

  const res = await fetch(JEV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.JEV_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const { answers } = await res.json();
  const choice = answers?.action?.choice;
  if (!(choice in ACTIONS)) throw new Error(`unexpected answer: ${JSON.stringify(answers)}`);

  const confidence = answers.action.confidence ?? 1;
  return {
    action: confidence < MIN_CONFIDENCE ? "unclear" : choice,
    confidence,
    stuck: answers?.stuck?.noul ?? 0,
    source: "jev",
  };
}

// Offline fallback. Order matters: more specific patterns first.
const RULES = [
  [/\b(help|hint|stuck|what (do|should) i|how do i)\b/, "help"],
  [/\b(inv|inventory|pockets?|carrying|holding)\b/, "inventory"],
  [/\b(unlock|open)\b.*\bdoor\b.*\b(terminal|computer|command)\b|\b(terminal|computer)\b.*\b(unlock|open)\b|^(unlock|open exit|exit-1)/, "terminal_unlock"],
  [/\b(put|insert|install|place|plug|fit|use)\b.*\bfuse\b|\bfuse\b.*\b(in|into)\b/, "insert_fuse"],
  [/\b(take|grab|get|pick|pocket)\b.*\bfuse\b/, "take_fuse"],
  [/\bfuse\b/, "examine_fuse"],
  [/\b(read|take|grab|get|pick)\b.*\b(note|paper|scrap)\b|\bnote\b/, "read_note"],
  [/\b(lift|pry|move|remove|open|pull|under)\b.*\b(grate|vent)\b/, "open_grate"],
  [/\b(grate|vent|floor)\b/, "examine_grate"],
  [/\b(open|pull|search|check)\b.*\bdrawer\b|\bdrawer\b/, "open_drawer"],
  [/\b(turn on|boot|power|switch on|log ?in|type|use|press)\b.*\b(terminal|computer|screen|monitor)\b/, "use_terminal"],
  [/\b(terminal|computer|screen|monitor)\b/, "examine_terminal"],
  [/\b(open|push|kick|force|leave|escape|exit|bash)\b.*\bdoor\b|\b(leave|escape)\b/, "open_door"],
  [/\bdoor\b/, "examine_door"],
  [/\bdesk\b/, "examine_desk"],
  [/^(l|look)\b|\blook around\b|\bwhere am i\b/, "look"],
];

function keywordParse(input) {
  const text = input.toLowerCase();
  for (const [re, action] of RULES) if (re.test(text)) return { action, confidence: 1 };
  return { action: "other", confidence: 1 };
}
