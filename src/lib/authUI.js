// Auth UI — single-button Google OAuth flow.
// After clicking, the browser redirects to Google and back; auth is picked up
// by onAuthStateChange in auth.js, which notifies main.js via onAuthChange.

import { signInWithGoogle } from "./auth.js";

const authScreenEl = document.getElementById("authScreen");
const googleSignInBtnEl = document.getElementById("googleSignInBtn");
const authErrorEl = document.getElementById("authError");

export function initAuthUI() {
  googleSignInBtnEl.addEventListener("click", async () => {
    googleSignInBtnEl.disabled = true;
    googleSignInBtnEl.textContent = "Redirecting…";
    try {
      await signInWithGoogle();
    } catch (err) {
      authErrorEl.textContent = "Sign-in failed. Please try again.";
      authErrorEl.hidden = false;
      googleSignInBtnEl.disabled = false;
      googleSignInBtnEl.textContent = "Sign in with Google";
    }
  });
}

export function showAuthScreen() {
  authScreenEl.removeAttribute("data-loading");
  authScreenEl.hidden = false;
}

export function hideAuthScreen() {
  authScreenEl.hidden = true;
}
