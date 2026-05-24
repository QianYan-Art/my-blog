const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT_DIR = __dirname;
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1] || 3000);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function cacheHeaderFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") {
    return "no-cache, max-age=0, must-revalidate";
  }
  if (ext === ".json") {
    return "no-cache, max-age=0, must-revalidate";
  }
  if (ext === ".css" || ext === ".js") {
    return "public, max-age=60, must-revalidate";
  }
  return "public, max-age=86400";
}

function safePathname(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return normalized;
}

function resolveFile(requestPath) {
  const cleanPath = safePathname(requestPath);
  let filePath = path.join(ROOT_DIR, cleanPath);

  if (cleanPath === "/" || cleanPath === "") {
    filePath = path.join(ROOT_DIR, "index.html");
  } else if (!path.extname(filePath)) {
    filePath = path.join(ROOT_DIR, cleanPath, "index.html");
    if (!fs.existsSync(filePath)) {
      filePath = path.join(ROOT_DIR, `${cleanPath}.html`);
    }
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);
  const filePath = resolveFile(pathname || "/");

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const notFoundPath = path.join(ROOT_DIR, "404.html");
      fs.readFile(notFoundPath, (nfErr, nfData) => {
        if (!nfErr) {
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          res.end(nfData);
          return;
        }
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": cacheHeaderFor(filePath)
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Static blog is running: http://${HOST}:${PORT}`);
});
