// The Server Room — deterministic game engine.
// Jev (or the fallback parser) decides WHICH action the player meant;
// this file decides WHAT HAPPENS. The puzzle can't be talked around.

// Every action the player can take. The descriptions are sent to Jev as
// the options of a "choice" question, so write them the way a player thinks.
export const ACTIONS = {
  look: "Look around, describe the room, where am I",
  inventory: "Check what I'm carrying, my pockets, inventory",
  help: "Ask for help, a hint, or what to do next",
  examine_door: "Look at or inspect the exit door, the lock, the keypad",
  open_door: "Open, push, kick, force, or try to leave through the door",
  examine_terminal: "Look at or inspect the computer terminal, monitor, or screen",
  use_terminal: "Turn on, boot, type on, log in to, or use the terminal",
  insert_fuse: "Put, insert, or install the fuse into the terminal or a socket",
  terminal_unlock: "Tell or command the terminal to unlock or open the door",
  examine_desk: "Look at or inspect the desk",
  open_drawer: "Open, pull, or search the desk drawer",
  take_fuse: "Pick up, grab, or take the fuse",
  examine_fuse: "Look at or inspect the fuse",
  examine_grate: "Look at or inspect the floor grate or vent",
  open_grate: "Lift, pry, remove, or look under the floor grate",
  read_note: "Pick up or read the note, paper, or scrap",
  other: "Anything else: unrelated, nonsense, or something not in this room",
};

export function newGame() {
  return {
    drawerOpen: false,
    fuseTaken: false,
    fuseInstalled: false,
    grateOpen: false,
    noteRead: false,
    terminalOn: false,
    escaped: false,
    moves: 0,
  };
}

export const INTRO = [
  "You wake up on a cold concrete floor.",
  "",
  "A windowless room. A low hum you feel more than hear. One flickering",
  "strip light. There's a steel EXIT door, a dead TERMINAL on a metal",
  "DESK, a desk DRAWER, and a loose GRATE in the floor.",
  "",
  "Type whatever you'd actually try.",
].join("\n");

function hint(s) {
  if (!s.drawerOpen) return "That desk drawer is the only thing in here that looks like it opens.";
  if (!s.fuseTaken) return "Something small rattled in the drawer. Worth taking.";
  if (!s.fuseInstalled) return "The terminal is dead. The fuse in your hand looks like it belongs to something electrical.";
  if (!s.terminalOn) return "The terminal has power now. Try using it.";
  return "The terminal controls the door. Tell it what you want.";
}

// Returns { text, state }. Never mutates the input state.
export function act(prev, action) {
  const s = { ...prev, moves: prev.moves + 1 };
  if (s.escaped) return { text: "You're already out. Refresh to play again.", state: s };

  const say = (text) => ({ text, state: s });

  switch (action) {
    case "look":
      return say(
        [
          "Concrete walls. A steel EXIT door with no handle, just a dark status light.",
          `A metal DESK with a TERMINAL on it${s.terminalOn ? ", its screen glowing green" : s.fuseInstalled ? ", humming faintly" : ", screen black"}.`,
          `The desk DRAWER is ${s.drawerOpen ? "open" : "shut"}.`,
          `A floor GRATE ${s.grateOpen ? "lies pushed aside, exposing a shallow cavity" : "sits slightly crooked in its frame"}.`,
        ].join("\n")
      );

    case "inventory": {
      const items = [];
      if (s.fuseTaken && !s.fuseInstalled) items.push("a glass cartridge fuse");
      if (s.noteRead) items.push("a damp note");
      return say(items.length ? `You're carrying: ${items.join(", ")}.` : "Your pockets are empty. Someone was thorough.");
    }

    case "help":
      return say(hint(s));

    case "examine_door":
      return say(
        s.terminalOn
          ? "Heavy steel. The status light is amber now: waiting for a command."
          : "Heavy steel, no handle, no keyhole. A small status light above it is dark. It's controlled from somewhere."
      );

    case "open_door":
      return say(
        s.terminalOn
          ? "You shove. Nothing. The amber light blinks, almost impatiently. The terminal runs this door."
          : "You throw your shoulder into it. The door doesn't care. Your shoulder does."
      );

    case "examine_terminal":
      if (s.terminalOn) return say("The screen reads:\n\n  FACILITY CTRL v2.1\n  EXIT-1 ......... LOCKED\n  > awaiting command_");
      if (s.fuseInstalled) return say("It's humming. The power light is on, but the screen is still black. Maybe it needs switching on.");
      return say("A chunky old terminal. Dead. Around the back there's a small empty fuse holder, its clips bent open.");

    case "use_terminal":
      if (s.terminalOn) return say("The cursor blinks:\n\n  EXIT-1 ......... LOCKED\n  > awaiting command_");
      if (s.fuseInstalled) {
        s.terminalOn = true;
        return say(
          "You hit the power switch. A fan whines, the screen fizzes to life:\n\n  FACILITY CTRL v2.1\n  EXIT-1 ......... LOCKED\n  > awaiting command_\n\nAcross the room, the door's status light turns amber."
        );
      }
      return say("You jab the power button. Nothing. Not even a click. It has no power.");

    case "insert_fuse":
      if (s.fuseInstalled) return say("The fuse is already seated in the terminal.");
      if (!s.fuseTaken) return say("You don't have anything to put in there.");
      s.fuseInstalled = true;
      return say("You press the fuse into the holder on the back of the terminal. It clicks home. The terminal starts to hum.");

    case "terminal_unlock":
      if (!s.terminalOn) return say(s.fuseInstalled ? "The screen is still black. Switch it on first." : "You talk at the dead screen. It doesn't talk back.");
      s.escaped = true;
      return say(
        `  > OPEN EXIT-1\n  EXIT-1 ......... UNLOCKED\n\nThe light over the door snaps green. A heavy CLUNK. The door swings open onto a dark corridor and cold, moving air.\n\nYou're out. Escaped in ${s.moves} moves.`
      );

    case "examine_desk":
      return say(`A dented metal desk. A terminal sits on top. There's a single drawer, currently ${s.drawerOpen ? "open" : "closed"}.`);

    case "open_drawer":
      if (s.drawerOpen) return say(s.fuseTaken ? "The drawer is open and empty." : "The drawer is already open. A small glass FUSE rolls around inside.");
      s.drawerOpen = true;
      return say("The drawer sticks, then screeches open. Inside: dust, a dead pen, and a small glass FUSE.");

    case "take_fuse":
    case "examine_fuse":
      if (s.fuseInstalled) return say("The fuse is in the terminal, where it belongs.");
      if (s.fuseTaken) return say("A glass cartridge fuse, the thin wire inside still intact. It looks like it'd fit something electrical.");
      if (!s.drawerOpen) return say("What fuse? You haven't found one.");
      if (action === "examine_fuse") return say("A small glass cartridge fuse sits in the drawer. The wire inside looks intact.");
      s.fuseTaken = true;
      return say("You take the fuse. Small, glass, intact. It looks like it'd fit something electrical.");

    case "examine_grate":
      return say(s.grateOpen ? "The grate is off. Below it, a shallow cavity full of cables, and a damp NOTE." : "A square metal floor grate. One corner sits a few millimetres proud. It's not screwed down.");

    case "open_grate":
      if (s.grateOpen) return say("The grate is already off. There's a damp NOTE down there.");
      s.grateOpen = true;
      return say("You hook your fingers under the raised corner and heave. The grate scrapes aside. Below: bundled cables, a lot of dust, and a damp folded NOTE.");

    case "read_note":
      if (!s.grateOpen) return say("You don't see any note.");
      s.noteRead = true;
      return say('The note, in shaky handwriting:\n\n  "if you\'re reading this, the terminal blew its fuse again.\n   spare is in the desk. just tell the thing to open the door.\n   — M"');

    default:
      return say("Nothing happens. The hum continues, unbothered.");
  }
}

export { hint };
