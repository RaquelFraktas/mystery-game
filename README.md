# The Server Room

A text-based escape room. The player types whatever they'd actually try; the room responds.

## Run

    cp .env.example .env   # add JEV_API_KEY to use Jev (optional)
    npm start              # http://localhost:3000

## How Jev fits in

Jev is a decision model: it doesn't generate text, it answers typed questions.
Each player command is sent to Jev with two questions:

- `action` (choice): which game action did the player mean? ("yank the drawer" -> `open_drawer`)
- `stuck` (yes/no): does the player sound stuck? If so, the room slips in a hint.

The puzzle logic (drawer -> fuse -> terminal -> door) lives in `game.js`, so Jev only
interprets; it can't be talked into opening the door. Without a key, a keyword
parser in `jev.js` is used instead.

- `game.js` — room state, actions, and all the room's text
- `jev.js` — Jev call + keyword fallback
- `server.js` — tiny Node server (keeps the API key off the browser)
- `public/index.html` — the terminal UI
