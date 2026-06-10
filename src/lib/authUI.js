// Auth UI - handles login/signup forms and flow

import * as auth from "./auth.js";

const authScreenEl = document.getElementById("authScreen");
const loginFormEl = document.getElementById("loginForm");
const signupFormEl = document.getElementById("signupForm");

const loginEmailEl = document.getElementById("loginEmail");
const loginPasswordEl = document.getElementById("loginPassword");
const loginBtnEl = document.getElementById("loginBtn");
const loginErrorEl = document.getElementById("loginError");

const signupEmailEl = document.getElementById("signupEmail");
const signupPasswordEl = document.getElementById("signupPassword");
const signupConfirmEl = document.getElementById("signupConfirm");
const signupBtnEl = document.getElementById("signupBtn");
const signupErrorEl = document.getElementById("signupError");

const switchToSignupEl = document.getElementById("switchToSignup");
const switchToLoginEl = document.getElementById("switchToLogin");
const testLoginBtnEl = document.getElementById("testLoginBtn");

let onAuthSuccessCallback = null;

// Initialize auth UI
export function initAuthUI(onAuthSuccess) {
  onAuthSuccessCallback = onAuthSuccess;

  // Form switches
  switchToSignupEl.addEventListener("click", (e) => {
    e.preventDefault();
    showSignupForm();
  });

  switchToLoginEl.addEventListener("click", (e) => {
    e.preventDefault();
    showLoginForm();
  });

  // Login form
  loginBtnEl.addEventListener("click", handleLogin);
  loginEmailEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });
  loginPasswordEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  // Signup form
  signupBtnEl.addEventListener("click", handleSignup);
  signupEmailEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSignup();
  });
  signupPasswordEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSignup();
  });
  signupConfirmEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSignup();
  });

  // Test login
  testLoginBtnEl.addEventListener("click", handleTestLogin);

  // Show auth screen initially (user not logged in)
  showAuthScreen();
}

export function showAuthScreen() {
  authScreenEl.hidden = false;
  showLoginForm();
}

export function hideAuthScreen() {
  authScreenEl.hidden = true;
}

function showLoginForm() {
  loginFormEl.hidden = false;
  signupFormEl.hidden = true;
  loginEmailEl.focus();
  clearError("login");
}

function showSignupForm() {
  loginFormEl.hidden = true;
  signupFormEl.hidden = false;
  signupEmailEl.focus();
  clearError("signup");
}

async function handleLogin() {
  const email = loginEmailEl.value.trim();
  const password = loginPasswordEl.value;

  clearError("login");

  if (!email || !password) {
    showError("login", "Please enter email and password");
    return;
  }

  loginBtnEl.disabled = true;
  loginBtnEl.textContent = "Logging in...";

  const { user, error } = await auth.signIn(email, password);

  loginBtnEl.disabled = false;
  loginBtnEl.textContent = "Login";

  if (error) {
    showError("login", error);
  } else {
    console.log("Login successful:", user.email);
    clearForm("login");
    onAuthSuccessCallback?.(user);
  }
}

async function handleSignup() {
  const email = signupEmailEl.value.trim();
  const password = signupPasswordEl.value;
  const confirm = signupConfirmEl.value;

  clearError("signup");

  if (!email || !password || !confirm) {
    showError("signup", "Please fill in all fields");
    return;
  }

  if (password.length < 6) {
    showError("signup", "Password must be at least 6 characters");
    return;
  }

  if (password !== confirm) {
    showError("signup", "Passwords don't match");
    return;
  }

  signupBtnEl.disabled = true;
  signupBtnEl.textContent = "Creating account...";

  const { user, error } = await auth.signUp(email, password);

  signupBtnEl.disabled = false;
  signupBtnEl.textContent = "Sign Up";

  if (error) {
    showError("signup", error);
  } else {
    console.log("Signup successful:", user.email);
    clearForm("signup");
    // Auto-login after signup (optional - user might need to verify email)
    showLoginForm();
    loginEmailEl.value = email;
    loginPasswordEl.value = password;
    showError("login", "Account created! Logging you in...");
    // Give user a moment to see the message, then auto-login
    setTimeout(() => {
      handleLogin();
    }, 1500);
  }
}

async function handleTestLogin() {
  testLoginBtnEl.disabled = true;
  testLoginBtnEl.textContent = "Creating test account...";

  const { user, error } = await auth.signUpTest();

  testLoginBtnEl.disabled = false;
  testLoginBtnEl.textContent = "Quick Test Login";

  if (error) {
    showError("login", `Test login failed: ${error}`);
  } else {
    console.log("Test account created:", user.email);
    onAuthSuccessCallback?.(user);
  }
}

function showError(form, message) {
  const errorEl = form === "login" ? loginErrorEl : signupErrorEl;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError(form) {
  const errorEl = form === "login" ? loginErrorEl : signupErrorEl;
  errorEl.hidden = true;
}

function clearForm(form) {
  if (form === "login") {
    loginEmailEl.value = "";
    loginPasswordEl.value = "";
  } else {
    signupEmailEl.value = "";
    signupPasswordEl.value = "";
    signupConfirmEl.value = "";
  }
}
