import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT ?? 4173);

// 正規化路由 → 實體 HTML 檔
const routes = {
  "/": "index.html",
  "/about": "about.html",
  "/settings": "settings.html",
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", `http://localhost:${port}`);
  const relative = routes[pathname] ?? pathname.slice(1);
  const target = resolve(publicDir, relative);

  // 防目錄穿越：只允許 publicDir 底下的檔案
  if (target !== publicDir && !target.startsWith(publicDir + sep)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(target);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(target)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><meta charset=utf-8><h1>404 Not Found</h1>");
  }
});

server.listen(port, () => {
  console.log(`sample-frontend 執行中：http://localhost:${port}`);
});
