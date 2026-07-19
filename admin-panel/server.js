// Zero-dependency static file server for the local admin panel — just
// serves index.html/app.js and opens the default browser. Talks to the
// already-deployed backend directly from the browser (see app.js), so
// this server never touches the database itself.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, resolve, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 5588;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = createServer(async (req, res) => {
  // req.url is attacker-controlled input (even on a "local-only" tool — any
  // page open in the same browser, or any other local process, can hit this
  // port). Decode it and resolve `..` segments, then verify the result is
  // still inside __dirname before touching the filesystem — otherwise
  // "/../../backend/.env" walks straight out of this directory and serves
  // arbitrary files from disk (confirmed: leaked JWT_SECRET + API keys).
  let decodedPath;
  try {
    decodedPath = decodeURIComponent((req.url === "/" ? "/index.html" : req.url).split("?")[0]);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }
  const filePath = resolve(__dirname, "." + decodedPath);
  if (filePath !== __dirname && !filePath.startsWith(__dirname + sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "text/plain" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Admin panel: ${url}`);
  const openCmd = process.platform === "win32" ? `start ${url}` : process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
  exec(openCmd);
});
