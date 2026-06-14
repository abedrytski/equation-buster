// Local dev server: `deno run -A serve.ts`
// Production: deploy to Deno Deploy, set SUPABASE_URL + SUPABASE_ANON_KEY env vars.
//
// Serves a dynamic /env.js endpoint that injects Supabase credentials from env
// vars (so credentials never need to be hardcoded), plus all static game files
// with Cache-Control: no-store so edited modules aren't served from cache.

import { serveDir } from "jsr:@std/http/file-server";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

const ENV_JS = `window.__SUPABASE_URL=${JSON.stringify(SUPABASE_URL)};
window.__SUPABASE_ANON_KEY=${JSON.stringify(SUPABASE_ANON_KEY)};
`;

Deno.serve({ port: +(Deno.env.get("PORT") ?? 8000) }, async (req) => {
  if (new URL(req.url).pathname === "/env.js") {
    return new Response(ENV_JS, {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store" },
    });
  }
  const res = await serveDir(req, { fsRoot: ".", showIndex: true, quiet: true });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
});
