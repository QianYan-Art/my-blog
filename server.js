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
  try {
    const decoded = decodeURIComponent(pathname || "/");
    if (decoded.includes("\0")) return null;
    const normalized = path.posix.normalize(decoded.replace(/\\/g, "/"));
    if (normalized.startsWith("/../") || normalized === "/..") return null;
    return normalized;
  } catch {
    return null;
  }
}

function isWithinRoot(filePath) {
  const relative = path.relative(ROOT_DIR, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveFile(requestPath) {
  const cleanPath = safePathname(requestPath);
  if (cleanPath === null) return null;
  let filePath = path.resolve(ROOT_DIR, `.${cleanPath}`);

  if (cleanPath === "/") {
    filePath = path.join(ROOT_DIR, "index.html");
  } else if (!path.extname(cleanPath)) {
    filePath = path.resolve(ROOT_DIR, `.${cleanPath}/index.html`);
    if (!fs.existsSync(filePath)) {
      filePath = path.resolve(ROOT_DIR, `.${cleanPath}.html`);
    }
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);
  const filePath = resolveFile(pathname || "/");
  if (!filePath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("400 Bad Request");
    return;
  }

  if (!isWithinRoot(filePath)) {
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
