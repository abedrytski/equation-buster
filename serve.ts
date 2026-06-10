// Local dev server: `deno run -A serve.ts`
// Serves the static files (index.html, style.css, src/*.js) on http://localhost:8000.
//
// Sends `Cache-Control: no-store` on every response so the browser never serves
// stale ES modules from its HTTP cache during development — without this, edited
// .js files can be served from cache (heuristic caching), producing a mix of old
// and new code.

import { serveDir } from "jsr:@std/http/file-server";

Deno.serve({ port: 8000 }, async (req) => {
  const res = await serveDir(req, { fsRoot: ".", showIndex: true, quiet: true });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
});
