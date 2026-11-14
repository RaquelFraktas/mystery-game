# The Server Room

A text-based escape room. The player types whatever they'd actually try; the room responds.

## Run

    npm install
    cp .env.example .env   # add JEV_API_KEY to use Jev (optional)
    npm start              # http://localhost:3000

The game is saved in the player's browser (localStorage), so it survives a refresh and server
restarts. It resets after 30 minutes idle, or when the player types `restart`.

## Deploy to Vercel

1. Import the repo in Vercel (framework preset: Other, no build command).
2. Settings -> Environment Variables -> add `JEV_API_KEY`.

`public/` is served as the site and `api/command.js` runs as a serverless function.
The server stores nothing: the browser sends the game's action list with each command.

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
- `api/command.js` — handles each player command (a Vercel function; keeps the API key off the browser)
- `server.js` — local dev server only
- `public/index.html` — the terminal UI; saves the game (action list + transcript) in localStorage
