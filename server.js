// Local dev server (`npm start`). On Vercel this file isn't used: public/ is
// served as static files and api/command.js runs as a serverless function.

import http from "node:http";
import { readFileSync, existsSync } from "node:fs";

// Load .env (no dependency needed). Must run before the imports below read process.env.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { default: command } = await import("./api/command.js");
const { jevEnabled } = await import("./jev.js");

const PORT = process.env.PORT || 3000;
const page = () => readFileSync(new URL("./public/index.html", import.meta.url));

http
  .createServer(async (req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page());
    }
    if (req.url === "/api/command") return command(req, res);
    res.writeHead(404).end("Not found");
  })
  .listen(PORT, () => {
    console.log(`The Server Room is running at http://localhost:${PORT}`);
    console.log(jevEnabled() ? "Parser: Jev" : "Parser: keyword fallback (set JEV_API_KEY in .env to use Jev)");  });
