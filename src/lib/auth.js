// Supabase Authentication
// Handles signup, login, logout, and session management
// Uses Supabase client from window (loaded via CDN in HTML)

// Local Supabase (from `supabase status`). The publishable key is the
// client-side key; swap these for your cloud project's values to deploy.
const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// Wait for Supabase to load from CDN
let supabase = null;

async function initSupabase() {
  if (supabase) return supabase;

  // Wait for Supabase client to be available on window
  for (let i = 0; i < 50; i++) {
    if (window.supabase?.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase client initialized");
      return supabase;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  throw new Error("Supabase client failed to load from CDN");
}

export async function getSupabase() {
  return initSupabase();
}

export { supabase };

let currentUser = null;
let authListeners = [];

// Initialize auth session on app load
export async function initAuth() {
  try {
    const sb = await getSupabase();

    // Get current session from localStorage
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    if (data?.session) {
      currentUser = data.session.user;
      console.log("Restored session for user:", currentUser.email);
      notifyListeners({ type: "restore", user: currentUser });
    } else {
      console.log("No existing session");
      notifyListeners({ type: "signout", user: null });
    }
  } catch (error) {
    console.error("Failed to restore session:", error.message);
  }

  // Listen for auth changes
  try {
    const sb = await getSupabase();
    const { data: authListener } = sb.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      console.log("Auth state changed:", event, currentUser?.email);
      notifyListeners({ type: event, user: currentUser });
    });
    return authListener;
  } catch (error) {
    console.error("Failed to setup auth listener:", error.message);
  }
}

// Sign up with email and password
export async function signUp(email, password) {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // local dev auto-confirms email, so a session exists immediately
    if (data.user) currentUser = data.user;
    console.log("Signup successful:", data.user?.email);
    return { user: data.user, error: null };
  } catch (error) {
    console.error("Signup failed:", error.message);
    return { user: null, error: error.message };
  }
}

// Sign in with email and password
export async function signIn(email, password) {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    currentUser = data.user;
    console.log("Login successful:", currentUser.email);
    return { user: data.user, error: null };
  } catch (error) {
    console.error("Login failed:", error.message);
    return { user: null, error: error.message };
  }
}

// Sign out
export async function signOut() {
  try {
    const sb = await getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;

    currentUser = null;
    console.log("Signed out");
    return { error: null };
  } catch (error) {
    console.error("Logout failed:", error.message);
    return { error: error.message };
  }
}

// Get current user
export function getCurrentUser() {
  return currentUser;
}

// Check if user is authenticated
export function isAuthenticated() {
  return currentUser !== null;
}

// Subscribe to auth changes
export function onAuthChange(callback) {
  authListeners.push(callback);
  // Return unsubscribe function
  return () => {
    authListeners = authListeners.filter((cb) => cb !== callback);
  };
}

function notifyListeners(event) {
  authListeners.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      console.error("Auth listener error:", error);
    }
  });
}

// Test helper - sign up with test credentials
export async function signUpTest() {
  const email = `test_${Date.now()}@example.com`;
  const password = "TestPassword123!";
  return signUp(email, password);
}
