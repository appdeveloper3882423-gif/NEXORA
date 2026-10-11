
import { auth, db, googleProvider } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "0.2.0";

const $ = (id) => document.getElementById(id);

const authScreen = $("authScreen");
const dashboard = $("dashboard");
const authForm = $("authForm");
const authTitle = $("authTitle");
const authSubtitle = $("authSubtitle");
const nameField = $("nameField");
const nameInput = $("name");
const emailInput = $("email");
const passwordInput = $("password");
const submitButton = $("submitButton");
const toggleMode = $("toggleMode");
const forgotButton = $("forgotButton");
const googleButton = $("googleButton");
const authMessage = $("authMessage");

let authMode = "login";
let busy = false;

function showMessage(message, type = "error") {
  authMessage.textContent = message;
  authMessage.className = `message ${type}`;
  authMessage.hidden = false;
}

function clearMessage() {
  authMessage.hidden = true;
  authMessage.textContent = "";
}

function setBusy(value) {
  busy = value;
  submitButton.disabled = value;
  googleButton.disabled = value;
  submitButton.textContent = value
    ? "Please wait..."
    : authMode === "login"
      ? "Sign In"
      : "Create Account";
}

function setMode(mode) {
  authMode = mode;
  clearMessage();

  const registering = mode === "register";
  authTitle.textContent = registering ? "Create your account" : "Welcome back";
  authSubtitle.textContent = registering
    ? "Start managing your business with NEXORA."
    : "Sign in to continue to your workspace.";

  nameField.hidden = !registering;
  nameInput.required = registering;
  passwordInput.autocomplete = registering ? "new-password" : "current-password";

  submitButton.textContent = registering ? "Create Account" : "Sign In";
  toggleMode.textContent = registering
    ? "Already have an account? Sign in"
    : "New to NEXORA? Create an account";

  forgotButton.hidden = registering;
}

function friendlyError(error) {
  const messages = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/missing-password": "Please enter your password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/email-already-in-use": "This email already has an account. Please sign in.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account found. Please create an account first.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "The sign-in popup was blocked. Allow popups and try again.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication settings.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again."
  };

  return messages[error?.code] ||
    error?.message ||
    "Something went wrong. Please try again.";
}

async function saveUserProfile(user, extra = {}) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  const profile = {
    uid: user.uid,
    name: user.displayName || extra.name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    updatedAt: serverTimestamp()
  };

  if (!snapshot.exists()) {
    profile.createdAt = serverTimestamp();
    profile.plan = "free";
    profile.role = "user";
    await setDoc(userRef, profile);
  } else {
    await setDoc(userRef, profile, { merge: true });
  }
}

function showDashboard(user) {
  authScreen.hidden = true;
  dashboard.hidden = false;

  $("welcomeName").textContent =
    user.displayName || user.email?.split("@")[0] || "User";
  $("userEmail").textContent = user.email || "";
  $("avatar").textContent =
    (user.displayName || user.email || "N").trim().charAt(0).toUpperCase();
  $("versionLabel").textContent = `NEXORA v${VERSION}`;
}

function showLogin() {
  dashboard.hidden = true;
  authScreen.hidden = false;
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  clearMessage();
  setBusy(true);

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();

  try {
    if (authMode === "register") {
      if (name.length < 2) {
        throw new Error("Please enter your name (at least 2 characters).");
      }

      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(result.user, { displayName: name });
      await saveUserProfile(result.user, { name });
      showMessage("Account created successfully!", "success");
    } else {
      const result = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      await saveUserProfile(result.user);
    }
  } catch (error) {
    showMessage(friendlyError(error));
  } finally {
    setBusy(false);
  }
});

googleButton.addEventListener("click", async () => {
  if (busy) return;

  clearMessage();
  setBusy(true);

  try {
    const result = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(result.user);
  } catch (error) {
    showMessage(friendlyError(error));
  } finally {
    setBusy(false);
  }
});

forgotButton.addEventListener("click", async () => {
  clearMessage();

  const email = emailInput.value.trim();
  if (!email) {
    showMessage("Enter your email address first, then tap Forgot password.");
    emailInput.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    showMessage(friendlyError(error));
  }
});

toggleMode.addEventListener("click", () => {
  setMode(authMode === "login" ? "register" : "login");
});

$("logoutButton").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    alert(friendlyError(error));
  }
});

$("backToDashboard").addEventListener("click", () => {
  $("moduleNotice").hidden = true;
  $("dashboardHome").hidden = false;
  document.querySelectorAll(".nav-link").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === "dashboard");
  });
});

document.querySelectorAll(".nav-link").forEach((item) => {
  item.addEventListener("click", () => {
    const page = item.dataset.page;

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("active", link === item);
    });

    if (page === "dashboard") {
      $("dashboardHome").hidden = false;
      $("moduleNotice").hidden = true;
      return;
    }

    $("dashboardHome").hidden = true;
    $("moduleNotice").hidden = false;
    $("moduleTitle").textContent = item.dataset.title;
  });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  try {
    await saveUserProfile(user);
    showDashboard(user);
  } catch (error) {
    showLogin();
    showMessage(
      "Signed in, but your profile could not load. Check Firestore rules and try again."
    );
    console.error("Profile error:", error);
  }
});

setMode("login");
