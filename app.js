
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
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "0.3.0";
const $ = id => document.getElementById(id);

const authScreen = $("authScreen");
const dashboard = $("dashboard");
const authForm = $("authForm");
const authMessage = $("authMessage");
const nameField = $("nameField");
const nameInput = $("name");
const emailInput = $("email");
const passwordInput = $("password");
const submitButton = $("submitButton");
const toggleMode = $("toggleMode");
const forgotButton = $("forgotButton");
const googleButton = $("googleButton");

let authMode = "login";
let busy = false;
let currentUser = null;
let businessProfile = null;
let records = [];
let customers = [];

function message(text, type = "error") {
  authMessage.textContent = text;
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
    : authMode === "login" ? "Sign In" : "Create Account";
}

function setMode(mode) {
  authMode = mode;
  clearMessage();

  const registering = mode === "register";
  $("authTitle").textContent = registering
    ? "Create your account" : "Welcome back";
  $("authSubtitle").textContent = registering
    ? "Start managing your business with NEXORA."
    : "Sign in to continue to your workspace.";

  nameField.hidden = !registering;
  nameInput.required = registering;
  forgotButton.hidden = registering;
  toggleMode.textContent = registering
    ? "Already have an account? Sign in"
    : "New to NEXORA? Create an account";

  submitButton.textContent = registering
    ? "Create Account" : "Sign In";
}

function friendlyError(error) {
  const errors = {
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Password must contain at least 6 characters.",
    "auth/email-already-in-use": "This email already has an account. Sign in instead.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Allow popups and try Google sign-in again.",
    "auth/unauthorized-domain": "Add this website domain in Firebase Authorized domains.",
    "auth/network-request-failed": "Check your internet connection.",
    "permission-denied": "Firestore denied access. Check your Firebase rules."
  };
  return errors[error?.code] || error?.message || "Something went wrong.";
}

async function saveUserProfile(user, name = "") {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const profile = {
    uid: user.uid,
    name: user.displayName || name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    updatedAt: serverTimestamp()
  };

  if (!snap.exists()) {
    profile.createdAt = serverTimestamp();
    profile.role = "user";
    profile.plan = "free";
    await setDoc(ref, profile);
  } else {
    await setDoc(ref, profile, { merge: true });
  }
}

function showLogin() {
  dashboard.hidden = true;
  authScreen.hidden = false;
}

function showDashboard(user) {
  authScreen.hidden = true;
  dashboard.hidden = false;

  const name = user.displayName || user.email?.split("@")[0] || "User";
  $("welcomeName").textContent = name;
  $("welcomeNameInline").textContent = name;
  $("userEmail").textContent = user.email || "";
  $("avatar").textContent = name.charAt(0).toUpperCase();
  $("versionLabel").textContent = `NEXORA v${VERSION} · Business workspace`;
}

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;

  clearMessage();
  setBusy(true);

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (authMode === "register") {
      const name = nameInput.value.trim();
      if (name.length < 2) throw new Error("Enter your name.");

      const result = await createUserWithEmailAndPassword(
        auth, email, password
      );
      await updateProfile(result.user, { displayName: name });
      await saveUserProfile(result.user, name);
      message("Account created successfully.", "success");
    } else {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await saveUserProfile(result.user);
    }
  } catch (error) {
    message(friendlyError(error));
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
    message(friendlyError(error));
  } finally {
    setBusy(false);
  }
});

forgotButton.addEventListener("click", async () => {
  clearMessage();
  const email = emailInput.value.trim();

  if (!email) {
    message("Enter your email address first.");
    emailInput.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    message("Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    message(friendlyError(error));
  }
});

toggleMode.addEventListener("click", () => {
  setMode(authMode === "login" ? "register" : "login");
});

$("logoutButton").addEventListener("click", () => signOut(auth));

function money(amount) {
  const currency = businessProfile?.currency || "USD";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

function addStyles() {
  if ($("nexoraExtraStyles")) return;

  const style = document.createElement("style");
  style.id = "nexoraExtraStyles";
  style.textContent = `
    .nx-section{margin:0 0 20px}
    .nx-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .nx-form label{display:block;color:#aebbd4;font-size:12px}
    .nx-form input,.nx-form select{display:block;width:100%;margin-top:7px;background:#0a1020;color:#f4f6ff;border:1px solid #2c3854;border-radius:10px;padding:12px}
    .nx-form button{grid-column:1/-1}
    .nx-note{color:#9ba8c4;font-size:12px;line-height:1.6}
    .nx-record{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #26324b;font-size:13px}
    .nx-positive{color:#5de0ad}.nx-negative{color:#ff9aa9}
    .nx-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    .nx-actions button{border:1px solid #354363;background:#18233b;color:#e8edff;border-radius:10px;padding:10px 13px}
    @media(max-width:520px){.nx-form{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function createSection(title, description = "") {
  const card = document.createElement("section");
  card.className = "card nx-section";
  const heading = document.createElement("div");
  heading.className = "card-heading";

  const text = document.createElement("div");
  const h = document.createElement("h3");
  h.textContent = title;
  text.appendChild(h);

  if (description) {
    const p = document.createElement("p");
    p.textContent = description;
    text.appendChild(p);
  }

  heading.appendChild(text);
  card.appendChild(heading);
  return card;
}

function addInput(form, label, name, type = "text", required = true) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;

  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.required = required;

  if (type === "number") {
    input.min = "0";
    input.step = "0.01";
  }

  wrapper.appendChild(input);
  form.appendChild(wrapper);
  return input;
}

function addSelect(form, label, name, options) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;

  const select = document.createElement("select");
  select.name = name;
  select.required = true;

  options.forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });

  wrapper.appendChild(select);
  form.appendChild(wrapper);
  return select;
}

function addButton(form, text) {
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "primary";
  button.textContent = text;
  form.appendChild(button);
  return button;
}

function renderBusinessSetup() {
  const home = $("dashboardHome");
  $("businessSetup")?.remove();

  const section = createSection(
    "Set up your business",
    "Personalize your NEXORA workspace. You can update these details later."
  );
  section.id = "businessSetup";

  const form = document.createElement("form");
  form.className = "nx-form";

  addInput(form, "Business name", "businessName");
  addSelect(form, "Profession", "profession", [
    ["shopkeeper", "Shopkeeper / Retail"],
    ["freelancer", "Freelancer"],
    ["developer", "Software Developer"],
    ["agency", "Agency"],
    ["wholesaler", "Wholesaler"],
    ["accountant", "Accountant"],
    ["consultant", "Consultant"],
    ["online_seller", "Online Seller"],
    ["manufacturer", "Manufacturer"],
    ["other", "Other"]
  ]);

  addSelect(form, "Currency", "currency", [
    ["USD", "USD — US Dollar"],
    ["PKR", "PKR — Pakistani Rupee"],
    ["GBP", "GBP — British Pound"],
    ["EUR", "EUR — Euro"],
    ["AED", "AED — UAE Dirham"],
    ["SAR", "SAR — Saudi Riyal"]
  ]);

  const button = addButton(form, "Save Business Profile");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    button.disabled = true;

    try {
      const data = new FormData(form);
      const profile = {
        businessName: String(data.get("businessName")).trim(),
        profession: String(data.get("profession")),
        currency: String(data.get("currency")),
        businessUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (!profile.businessName) throw new Error("Enter a business name.");

      await setDoc(doc(db, "users", currentUser.uid), profile, { merge: true });
      businessProfile = { ...businessProfile, ...profile };
      renderWorkspace();
      await loadBusinessData();
    } catch (error) {
      alert(friendlyError(error));
    } finally {
      button.disabled = false;
    }
  });

  section.appendChild(form);
  home.prepend(section);
}

function renderBusinessSummary() {
  $("businessSummary")?.remove();

  const section = createSection(
    businessProfile.businessName || "Your business",
    `${businessProfile.profession || "other"} · ${businessProfile.currency || "USD"}`
  );
  section.id = "businessSummary";

  const note = document.createElement("p");
  note.className = "nx-note";
  note.textContent = "Your profile is saved to your private Firebase account.";
  section.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "nx-actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Edit business profile";
  edit.addEventListener("click", renderBusinessSetup);
  actions.appendChild(edit);

  section.appendChild(actions);
  $("dashboardHome").prepend(section);
}

function renderWorkspace() {
  addStyles();

  if (!businessProfile?.businessName) {
    renderBusinessSetup();
    $("businessSummary")?.remove();
    return;
  }

  $("businessSetup")?.remove();
  renderBusinessSummary();
  renderRecordForm();
  renderCustomerForm();
  renderRecentRecords();
}

function renderRecordForm() {
  $("recordEntry")?.remove();

  const section = createSection(
    "Quick financial entry",
    "Add real income or expenses. These entries update the dashboard totals."
  );
  section.id = "recordEntry";

  const form = document.createElement("form");
  form.className = "nx-form";

  addSelect(form, "Entry type", "type", [
    ["income", "Income / Sale"],
    ["expense", "Expense"]
  ]);

  addInput(form, "Description", "description");
  addInput(form, "Amount", "amount", "number");
  addInput(form, "Date", "date", "date");

  const button = addButton(form, "Save Entry");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) return;

    button.disabled = true;
    try {
      const data = new FormData(form);
      const amount = Number(data.get("amount"));

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than zero.");
      }

      const type = String(data.get("type"));
      await addDoc(
        collection(db, "users", currentUser.uid, "transactions"),
        {
          type,
          description: String(data.get("description")).trim(),
          amount,
          date: String(data.get("date")),
          createdAt: serverTimestamp()
        }
      );

      form.reset();
      await loadBusinessData();
    } catch (error) {
      alert(friendlyError(error));
    } finally {
      button.disabled = false;
    }
  });

  section.appendChild(form);
  $("dashboardHome").appendChild(section);
}

function renderCustomerForm() {
  $("customerEntry")?.remove();

  const section = createSection(
    "Add customer",
    "Save a customer to your private business directory."
  );
  section.id = "customerEntry";

  const form = document.createElement("form");
  form.className = "nx-form";

  addInput(form, "Customer name", "name");
  addInput(form, "Email (optional)", "email", "email", false);
  addInput(form, "Phone (optional)", "phone", "tel", false);
  const button = addButton(form, "Save Customer");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    button.disabled = true;

    try {
      const data = new FormData(form);
      const name = String(data.get("name")).trim();
      if (!name) throw new Error("Enter the customer name.");

      await addDoc(
        collection(db, "users", currentUser.uid, "customers"),
        {
          name,
          email: String(data.get("email") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
          createdAt: serverTimestamp()
        }
      );

      form.reset();
      await loadBusinessData();
    } catch (error) {
      alert(friendlyError(error));
    } finally {
      button.disabled = false;
    }
  });

  section.appendChild(form);
  $("dashboardHome").appendChild(section);
}

function renderRecentRecords() {
  $("realRecords")?.remove();

  const section = createSection(
    "Saved financial entries",
    "Recent entries loaded from your Firebase database."
  );
  section.id = "realRecords";

  const income = records
    .filter(record => record.type === "income")
    .reduce((sum, record) => sum + record.amount, 0);

  const expense = records
    .filter(record => record.type === "expense")
    .reduce((sum, record) => sum + record.amount, 0);

  const stats = document.querySelectorAll(".stats .stat-value");
  if (stats[0]) stats[0].textContent = money(income);
  if (stats[1]) stats[1].textContent = money(income - expense);
  if (stats[2]) stats[2].textContent = "0";
  if (stats[3]) stats[3].textContent = String(customers.length);

  const note = document.createElement("p");
  note.className = "nx-note";
  note.textContent =
    `Recorded income: ${money(income)} · Recorded expenses: ${money(expense)} · Net result: ${money(income - expense)}`;
  section.appendChild(note);

  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "nx-note";
    empty.textContent = "No entries saved yet. Use Quick financial entry above.";
    section.appendChild(empty);
  } else {
    records.slice(0, 20).forEach(record => {
      const row = document.createElement("div");
      row.className = "nx-record";

      const description = document.createElement("span");
      description.textContent =
        `${record.type === "income" ? "Income" : "Expense"} · ${record.description || "Entry"} · ${record.date || ""}`;

      const amount = document.createElement("strong");
      amount.className = record.type === "income" ? "nx-positive" : "nx-negative";
      amount.textContent =
        `${record.type === "income" ? "+" : "−"}${money(record.amount)}`;

      row.append(description, amount);
      section.appendChild(row);
    });
  }

  const customerNote = document.createElement("p");
  customerNote.className = "nx-note";
  customerNote.textContent = `Customer records saved: ${customers.length}`;
  section.appendChild(customerNote);

  $("dashboardHome").appendChild(section);
}

async function loadBusinessData() {
  if (!currentUser) return;

  const [transactionSnap, customerSnap] = await Promise.all([
    getDocs(collection(db, "users", currentUser.uid, "transactions")),
    getDocs(collection(db, "users", currentUser.uid, "customers"))
  ]);

  records = transactionSnap.docs.map(item => {
    const data = item.data();
    return {
      id: item.id,
      ...data,
      amount: Number(data.amount) || 0
    };
  }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  customers = customerSnap.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  if (businessProfile?.businessName) {
    renderRecentRecords();
  }
}

async function loadAccount(user) {
  currentUser = user;
  showDashboard(user);

  const profileSnap = await getDoc(doc(db, "users", user.uid));
  businessProfile = profileSnap.exists() ? profileSnap.data() : {};

  renderWorkspace();
  await loadBusinessData();
}

$("backToDashboard").addEventListener("click", () => {
  $("moduleNotice").hidden = true;
  $("dashboardHome").hidden = false;
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.page === "dashboard");
  });
});

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.page === "dashboard") {
      $("dashboardHome").hidden = false;
      $("moduleNotice").hidden = true;
      return;
    }

    $("dashboardHome").hidden = true;
    $("moduleNotice").hidden = false;
    $("moduleTitle").textContent = button.dataset.title;
  });
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    businessProfile = null;
    records = [];
    customers = [];
    showLogin();
    return;
  }

  try {
    await saveUserProfile(user);
    await loadAccount(user);
  } catch (error) {
    console.error("NEXORA account loading error:", error);
    showLogin();
    message(
      "Could not load your workspace. Check Firestore rules and your internet connection."
    );
  }
});

setMode("login");
