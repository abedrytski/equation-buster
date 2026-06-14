// Supabase auth. Credentials are injected at runtime by serve.ts via /env.js
// (window.__SUPABASE_URL / window.__SUPABASE_ANON_KEY) so no keys are hardcoded.
// Sign-in is Google OAuth only — no email/password.

let supabase = null;

async function initSupabase() {
  if (supabase) return supabase;
  for (let i = 0; i < 50; i++) {
    if (window.supabase?.createClient) {
      supabase = window.supabase.createClient(
        window.__SUPABASE_URL,
        window.__SUPABASE_ANON_KEY,
      );
      return supabase;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Supabase client failed to load from CDN");
}

export async function getSupabase() {
  return initSupabase();
}

let currentUser = null;
let authListeners = [];

export async function initAuth() {
  try {
    const sb = await getSupabase();
    // onAuthStateChange fires INITIAL_SESSION on subscription with the current
    // auth state — no separate getSession() call needed, no race condition.
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user ?? null;
      console.log("[auth] onAuthStateChange", event, currentUser?.email ?? null);
      notifyListeners({ type: event, user: currentUser });
    });
    return subscription;
  } catch (err) {
    console.error("Failed to setup auth listener:", err.message);
  }
}

export async function signInWithGoogle() {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  try {
    const sb = await getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    currentUser = null;
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

export function getCurrentUser() { return currentUser; }
export function isAuthenticated() { return currentUser !== null; }

export function onAuthChange(callback) {
  authListeners.push(callback);
  return () => { authListeners = authListeners.filter((cb) => cb !== callback); };
}

function notifyListeners(event) {
  for (const cb of authListeners) {
    try { cb(event); } catch (err) { console.error("Auth listener error:", err); }
  }
}
