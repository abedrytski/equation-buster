No # Math Survivor — Claude Code Conventions

## Testing & Verification

**Do not touch the browser (web or CLI) to test gameplay or rendering.** The user runs the game on their local dev server (`deno run -A serve.ts` at http://localhost:8000) and shares screenshots (`@screens/...`) for verification.

When making UI/gameplay changes:
1. Describe what to look at or how to test it
2. Ask the user to share a screenshot or report what they see
3. Do not launch headless browsers, curl the server, or inspect the DOM yourself

The dev server is already running; just describe the test and wait for feedback.
