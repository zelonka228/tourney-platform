// Zero-dependency static file server for the local admin panel — just
// serves index.html/app.js and opens the default browser. Talks to the
// already-deployed backend directly from the browser (see app.js), so
// this server never touches the database itself.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 5588;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = createServer(async (req, res) => {
  const path = req.url === "/" ? "/index.html" : req.url;
  try {
    const filePath = join(__dirname, path);
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
