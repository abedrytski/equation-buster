// Local dev server: `deno run -A serve.ts`
// Serves the static files (index.html, style.css, gamеру цe.js) on http://localhost:8000

import { serveDir } from "jsr:@std/http/file-server";

Deno.serve({ port: 8000 }, (req) => {
  return serveDir(req, { fsRoot: ".", showIndex: true, quiet: true });
});
