
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
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "1.0.0";
const $ = id => document.getElementById(id);

let currentUser = null;
let businessProfile = {};
let busy = false;
let authMode = "login";
let activePage = "dashboard";
let cache = { transactions: [], customers: [], projects: [], inventory: [] };

const authScreen = $("authScreen");
const dashboard = $("dashboard");
const authForm = $("authForm");
const authMessage = $("authMessage");

function showMessage(text, type = "error") {
  authMessage.textContent = text;
  authMessage.className = `message ${type}`;
  authMessage.hidden = false;
}

function clearMessage() {
  authMessage.hidden = true;
  authMessage.textContent = "";
}

function errorText(error) {
  const known = {
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/email-already-in-use": "This email already has an account. Please sign in.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Allow popups and try again.",
    "auth/unauthorized-domain": "Add your website domain in Firebase Authorized domains.",
    "permission-denied": "Firebase denied access. Check your Firestore Rules."
  };
  return known[error?.code] || error?.message || "Something went wrong.";
}

function setAuthMode(mode) {
  authMode = mode;
  clearMessage();

  const registering = mode === "register";
  $("authTitle").textContent = registering ? "Create your account" : "Welcome back";
  $("authSubtitle").textContent = registering
    ? "Start managing your business with NEXORA."
    : "Sign in to continue to your workspace.";

  $("nameField").hidden = !registering;
  $("name").required = registering;
  $("forgotButton").hidden = registering;
  $("submitButton").textContent = registering ? "Create Account" : "Sign In";
  $("toggleMode").textContent = registering
    ? "Already have an account? Sign in"
    : "New to NEXORA? Create an account";
}

async function saveProfile(user, displayName = "") {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const data = {
    uid: user.uid,
    name: user.displayName || displayName || user.email?.split("@")[0] || "User",
    email: user.email || "",
    updatedAt: serverTimestamp()
  };

  if (!snap.exists()) {
    Object.assign(data, {
      createdAt: serverTimestamp(),
      role: "user",
      plan: "free"
    });
  }

  await setDoc(ref, data, { merge: true });
}

$("toggleMode").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "register" : "login");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;

  busy = true;
  clearMessage();
  $("submitButton").disabled = true;
  $("googleButton").disabled = true;

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    if (authMode === "register") {
      const name = $("name").value.trim();
      if (name.length < 2) throw new Error("Enter your full name.");

      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await saveProfile(result.user, name);
    } else {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await saveProfile(result.user);
    }
  } catch (error) {
    showMessage(errorText(error));
  } finally {
    busy = false;
    $("submitButton").disabled = false;
    $("googleButton").disabled = false;
  }
});

$("googleButton").addEventListener("click", async () => {
  try {
    clearMessage();
    const result = await signInWithPopup(auth, googleProvider);
    await saveProfile(result.user);
  } catch (error) {
    showMessage(errorText(error));
  }
});

$("forgotButton").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) {
    showMessage("Enter your email address first.");
    $("email").focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    showMessage(errorText(error));
  }
});

$("logoutButton").addEventListener("click", () => signOut(auth));

function money(value) {
  const currency = businessProfile.currency || "PKR";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  } catch {
    return `${currency} ${(Number(value) || 0).toFixed(2)}`;
  }
}

function userCollection(name) {
  if (!currentUser) throw new Error("Please sign in first.");
  return collection(db, "users", currentUser.uid, name);
}

async function getRecords(name) {
  const snap = await getDocs(userCollection(name));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function loadAll() {
  const names = ["transactions", "customers", "projects", "inventory"];
  const results = await Promise.all(names.map(getRecords));

  names.forEach((name, index) => {
    cache[name] = results[index];
  });

  renderPage(activePage);
}

function addAppStyles() {
  if ($("nxAppStyles")) return;

  const style = document.createElement("style");
  style.id = "nxAppStyles";
  style.textContent = `
    .nx-area{display:grid;gap:16px;margin-top:20px}
    .nx-card{background:#101629;border:1px solid #26324b;border-radius:16px;padding:20px;min-width:0}
    .nx-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
    .nx-form label{display:block;color:#aab6d0;font-size:12px}
    .nx-form input,.nx-form select,.nx-form textarea{width:100%;margin-top:7px;padding:12px;border:1px solid #2c3854;border-radius:10px;background:#0a1020;color:#f4f6ff}
    .nx-form button{grid-column:1/-1}
    .nx-btn{border:1px solid #354363;border-radius:9px;padding:9px 12px;background:#18233b;color:#e8edff}
    .nx-primary{border:0;border-radius:10px;padding:12px;background:linear-gradient(110deg,#397ff5,#8b6aff);color:#fff;font-weight:700}
    .nx-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #26324b}
    .nx-row:last-child{border-bottom:0}
    .nx-muted{color:#9ba8c4;font-size:12px;line-height:1.6}
    .nx-good{color:#5de0ad}.nx-bad{color:#ff9aa9}
    .nx-table{width:100%;border-collapse:collapse;min-width:480px;font-size:12px}
    .nx-table th,.nx-table td{text-align:left;padding:12px 9px;border-bottom:1px solid #26324b}
    .nx-table th{color:#9ba8c4;font-weight:600}
    .nx-table-wrap{overflow:auto}
    .nx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .nx-stat{padding:16px;border:1px solid #26324b;border-radius:12px;background:#0c1324}
    .nx-stat strong{display:block;font-size:20px;margin-top:8px;overflow-wrap:anywhere}
    .nx-actions{display:flex;gap:7px;flex-wrap:wrap}
    .nx-actions button{font-size:11px}
    .nx-empty{padding:22px 0;color:#9ba8c4;font-size:13px}
    @media(max-width:650px){.nx-form,.nx-grid{grid-template-columns:1fr}.nx-card{padding:15px}}
  `;
  document.head.appendChild(style);
}

function makeCard(title, description = "") {
  const card = document.createElement("section");
  card.className = "nx-card";

  const heading = document.createElement("div");
  heading.className = "card-heading";

  const inner = document.createElement("div");
  const h = document.createElement("h3");
  h.textContent = title;
  inner.appendChild(h);

  if (description) {
    const p = document.createElement("p");
    p.textContent = description;
    inner.appendChild(p);
  }

  heading.appendChild(inner);
  card.appendChild(heading);
  return card;
}

function addField(form, label, name, type = "text", required = true) {
  const wrapper = document.createElement("label");
  wrapper.append(document.createTextNode(label));

  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.required = required;

  if (type === "number") {
    input.min = "0";
    input.step = "0.01";
  }

  if (type === "date") input.value = new Date().toISOString().slice(0, 10);

  wrapper.appendChild(input);
  form.appendChild(wrapper);
  return input;
}

function addSelect(form, label, name, options) {
  const wrapper = document.createElement("label");
  wrapper.append(document.createTextNode(label));

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

function addSubmit(form, label = "Save") {
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "nx-primary";
  button.textContent = label;
  form.appendChild(button);
  return button;
}

function makeFormCard(title, description, setup, onSave) {
  const card = makeCard(title, description);
  const form = document.createElement("form");
  form.className = "nx-form";
  setup(form);

  const button = addSubmit(form);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    button.disabled = true;

    try {
      await onSave(new FormData(form));
      form.reset();
      await loadAll();
    } catch (error) {
      alert(errorText(error));
    } finally {
      button.disabled = false;
    }
  });

  card.appendChild(form);
  return card;
}

function makeListCard(title, description, items, renderItem) {
  const card = makeCard(title, description);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "nx-empty";
    empty.textContent = "No records yet. Add your first record above.";
    card.appendChild(empty);
  } else {
    items.forEach(item => card.appendChild(renderItem(item)));
  }

  return card;
}

function makeRow(title, detail, amount = "") {
  const row = document.createElement("div");
  row.className = "nx-row";

  const left = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = title || "Untitled";
  const small = document.createElement("div");
  small.className = "nx-muted";
  small.textContent = detail || "";
  left.append(strong, small);

  const right = document.createElement("strong");
  right.textContent = amount;
  row.append(left, right);
  return row;
}

async function removeRecord(collectionName, id) {
  if (!confirm("Delete this record permanently?")) return;

  try {
    await deleteDoc(doc(db, "users", currentUser.uid, collectionName, id));
    await loadAll();
  } catch (error) {
    alert(errorText(error));
  }
}

function addDeleteButton(row, collectionName, id) {
  const actions = document.createElement("div");
  actions.className = "nx-actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "nx-btn";
  button.textContent = "Delete";
  button.addEventListener("click", () => removeRecord(collectionName, id));

  actions.appendChild(button);
  row.appendChild(actions);
  return row;
}

function businessSetupPage() {
  const area = $("dynamicWorkspace");
  const card = makeFormCard(
    "Business profile",
    "Choose your business identity, profession and reporting currency.",
    form => {
      const name = addField(form, "Business name", "businessName");
      name.value = businessProfile.businessName || "";
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
      ]).value = businessProfile.profession || "other";

      addSelect(form, "Currency", "currency", [
        ["PKR", "PKR — Pakistani Rupee"],
        ["USD", "USD — US Dollar"],
        ["GBP", "GBP — British Pound"],
        ["EUR", "EUR — Euro"],
        ["AED", "AED — UAE Dirham"],
        ["SAR", "SAR — Saudi Riyal"]
      ]).value = businessProfile.currency || "PKR";
    },
    async data => {
      const businessName = String(data.get("businessName") || "").trim();
      if (!businessName) throw new Error("Enter a business name.");

      await setDoc(doc(db, "users", currentUser.uid), {
        businessName,
        profession: String(data.get("profession")),
        currency: String(data.get("currency")),
        updatedAt: serverTimestamp()
      }, { merge: true });

      businessProfile = {
        ...businessProfile,
        businessName,
        profession: String(data.get("profession")),
        currency: String(data.get("currency"))
      };
    }
  );

  area.appendChild(card);
}

function renderOverview(area) {
  const tx = cache.transactions;
  const income = tx.filter(x => x.type === "income").reduce((s, x) => s + Number(x.amount || 0), 0);
  const expense = tx.filter(x => x.type === "expense").reduce((s, x) => s + Number(x.amount || 0), 0);
  const activeProjects = cache.projects.filter(x => x.status !== "completed").length;

  const stats = document.createElement("div");
  stats.className = "nx-grid";

  [
    ["Total income", money(income)],
    ["Net result", money(income - expense)],
    ["Expenses", money(expense)],
    ["Customers", String(cache.customers.length)],
    ["Active projects", String(activeProjects)],
    ["Inventory items", String(cache.inventory.length)]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "nx-stat";
    item.innerHTML = "";
    const small = document.createElement("span");
    small.className = "nx-muted";
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(small, strong);
    stats.appendChild(item);
  });

  area.appendChild(stats);

  const recent = [...tx].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 8);
  area.appendChild(makeListCard("Recent transactions", "Actual records from your account.", recent, item => {
    return makeRow(
      item.description,
      `${item.type} · ${item.date || ""}`,
      `${item.type === "expense" ? "−" : "+"}${money(item.amount)}`
    );
  }));

  const business = makeCard("Your business", "Your private workspace");
  const name = document.createElement("p");
  name.textContent = businessProfile.businessName || "Business profile not set up yet.";
  const details = document.createElement("p");
  details.className = "nx-muted";
  details.textContent = `${businessProfile.profession || "Choose your profession"} · ${businessProfile.currency || "PKR"}`;
  const edit = document.createElement("button");
  edit.className = "nx-btn";
  edit.textContent = "Set up / Edit business";
  edit.addEventListener("click", () => renderPage("settings"));
  business.append(name, details, edit);
  area.appendChild(business);
}

function renderTransactions(area) {
  area.appendChild(makeFormCard(
    "Add transaction",
    "Record income or expenses. Dashboard totals are calculated from these entries.",
    form => {
      addSelect(form, "Type", "type", [["income", "Income / Sale"], ["expense", "Expense"]]);
      addField(form, "Description", "description");
      addField(form, "Amount", "amount", "number");
      addField(form, "Date", "date", "date");
    },
    async data => {
      const amount = Number(data.get("amount"));
      const description = String(data.get("description") || "").trim();
      if (!description) throw new Error("Enter a description.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");

      await addDoc(userCollection("transactions"), {
        type: String(data.get("type")),
        description,
        amount,
        date: String(data.get("date")),
        createdAt: serverTimestamp()
      });
    }
  ));

  const items = [...cache.transactions].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  area.appendChild(makeListCard("All transactions", "Income and expenses saved to Firebase.", items, item => {
    const row = makeRow(
      item.description,
      `${item.type} · ${item.date || ""}`,
      `${item.type === "expense" ? "−" : "+"}${money(item.amount)}`
    );
    return addDeleteButton(row, "transactions", item.id);
  }));
}

function renderCustomers(area) {
  area.appendChild(makeFormCard(
    "Add customer",
    "Build your customer directory.",
    form => {
      addField(form, "Customer name", "name");
      addField(form, "Email", "email", "email", false);
      addField(form, "Phone", "phone", "tel", false);
      addField(form, "Notes", "notes", "text", false);
    },
    async data => {
      const name = String(data.get("name") || "").trim();
      if (!name) throw new Error("Enter a customer name.");

      await addDoc(userCollection("customers"), {
        name,
        email: String(data.get("email") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        notes: String(data.get("notes") || "").trim(),
        createdAt: serverTimestamp()
      });
    }
  ));

  area.appendChild(makeListCard("Customer directory", "Saved customers.", cache.customers, item => {
    const detail = [item.email, item.phone, item.notes].filter(Boolean).join(" · ");
    return addDeleteButton(makeRow(item.name, detail), "customers", item.id);
  }));
}

function renderProjects(area) {
  area.appendChild(makeFormCard(
    "Create project",
    "Track work, clients and project status.",
    form => {
      addField(form, "Project name", "name");
      addField(form, "Client / customer", "client", "text", false);
      addField(form, "Due date", "dueDate", "date", false);
      addSelect(form, "Status", "status", [
        ["planned", "Planned"],
        ["in_progress", "In progress"],
        ["on_hold", "On hold"],
        ["completed", "Completed"]
      ]);
    },
    async data => {
      const name = String(data.get("name") || "").trim();
      if (!name) throw new Error("Enter a project name.");

      await addDoc(userCollection("projects"), {
        name,
        client: String(data.get("client") || "").trim(),
        dueDate: String(data.get("dueDate") || ""),
        status: String(data.get("status")),
        createdAt: serverTimestamp()
      });
    }
  ));

  area.appendChild(makeListCard("Projects", "Your saved project list.", cache.projects, item => {
    const row = makeRow(item.name, `${item.client || "No client"} · Due ${item.dueDate || "not set"} · ${item.status}`);
    const actions = document.createElement("div");
    actions.className = "nx-actions";

    const status = document.createElement("button");
    status.className = "nx-btn";
    status.textContent = "Mark completed";
    status.disabled = item.status === "completed";
    status.addEventListener("click", async () => {
      try {
        await updateDoc(doc(db, "users", currentUser.uid, "projects", item.id), {
          status: "completed",
          updatedAt: serverTimestamp()
        });
        await loadAll();
      } catch (error) {
        alert(errorText(error));
      }
    });

    actions.appendChild(status);
    row.appendChild(actions);
    return addDeleteButton(row, "projects", item.id);
  }));
}

function renderInventory(area) {
  area.appendChild(makeFormCard(
    "Add inventory item",
    "Track stock quantities and unit prices.",
    form => {
      addField(form, "Item name", "name");
      addField(form, "SKU / code", "sku", "text", false);
      addField(form, "Quantity", "quantity", "number");
      addField(form, "Unit cost", "unitCost", "number");
      addField(form, "Low-stock alert level", "minStock", "number");
    },
    async data => {
      const name = String(data.get("name") || "").trim();
      const quantity = Number(data.get("quantity"));
      const unitCost = Number(data.get("unitCost") || 0);
      const minStock = Number(data.get("minStock") || 0);

      if (!name) throw new Error("Enter an item name.");
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Enter a valid quantity.");
      if (unitCost < 0 || minStock < 0) throw new Error("Values cannot be negative.");

      await addDoc(userCollection("inventory"), {
        name,
        sku: String(data.get("sku") || "").trim(),
        quantity,
        unitCost,
        minStock,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  ));

  area.appendChild(makeListCard("Inventory", "Low-stock items are marked automatically.", cache.inventory, item => {
    const low = Number(item.quantity || 0) <= Number(item.minStock || 0);
    const row = makeRow(
      item.name,
      `${item.sku || "No SKU"} · Qty: ${item.quantity} · Unit cost: ${money(item.unitCost)}`,
      low ? "LOW STOCK" : "IN STOCK"
    );
    if (low) row.classList.add("nx-bad");

    const actions = document.createElement("div");
    actions.className = "nx-actions";

    const adjust = document.createElement("button");
    adjust.className = "nx-btn";
    adjust.textContent = "Adjust quantity";
    adjust.addEventListener("click", async () => {
      const raw = prompt("Enter the new stock quantity:", String(item.quantity));
      if (raw === null) return;
      const quantity = Number(raw);
      if (!Number.isFinite(quantity) || quantity < 0) {
        alert("Enter a valid non-negative quantity.");
        return;
      }

      try {
        await updateDoc(doc(db, "users", currentUser.uid, "inventory", item.id), {
          quantity,
          updatedAt: serverTimestamp()
        });
        await loadAll();
      } catch (error) {
        alert(errorText(error));
      }
    });

    actions.appendChild(adjust);
    row.appendChild(actions);
    return addDeleteButton(row, "inventory", item.id);
  }));
}

function downloadCSV() {
  const rows = [
    ["Type", "Description", "Date", "Amount"],
    ...cache.transactions.map(item => [
      item.type,
      item.description || "",
      item.date || "",
      Number(item.amount || 0)
    ])
  ];

  const csv = rows.map(row =>
    row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nexora-transactions.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function renderReports(area) {
  const tx = cache.transactions;
  const income = tx.filter(x => x.type === "income").reduce((s, x) => s + Number(x.amount || 0), 0);
  const expense = tx.filter(x => x.type === "expense").reduce((s, x) => s + Number(x.amount || 0), 0);

  const summary = makeCard("Financial report", "Calculated from saved transaction records.");
  const grid = document.createElement("div");
  grid.className = "nx-grid";

  [["Income", money(income)], ["Expenses", money(expense)], ["Net result", money(income - expense)]].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "nx-stat";
    const small = document.createElement("span");
    small.className = "nx-muted";
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(small, strong);
    grid.appendChild(item);
  });

  summary.appendChild(grid);

  const button = document.createElement("button");
  button.className = "nx-primary";
  button.style.marginTop = "16px";
  button.textContent = "Export transactions as CSV";
  button.addEventListener("click", downloadCSV);
  summary.appendChild(button);
  area.appendChild(summary);

  area.appendChild(makeListCard("Transaction details", "All current financial records.", tx, item =>
    makeRow(item.description, `${item.type} · ${item.date || ""}`, money(item.amount))
  ));
}

function renderSettings(area) {
  businessSetupPage();
}

function renderPage(page) {
  activePage = page;
  addAppStyles();

  const titles = {
    dashboard: "Workspace overview",
    transactions: "Transactions",
    customers: "Customers",
    projects: "Projects",
    inventory: "Inventory",
    reports: "Reports",
    settings: "Business settings"
  };

  $("dashboardHome").hidden = false;
  $("moduleNotice").hidden = true;
  $("pageTitle") && ($("pageTitle").textContent = titles[page] || "Workspace");
  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const home = $("dashboardHome");
  const welcome = home.querySelector(".welcome");
  const stats = home.querySelector(".stats");
  const oldGrids = home.querySelectorAll(".dashboard-grid,.bottom-grid");

  oldGrids.forEach(element => element.remove());

  let area = $("dynamicWorkspace");
  if (!area) {
    area = document.createElement("div");
    area.id = "dynamicWorkspace";
    area.className = "nx-area";
    home.appendChild(area);
  }
  area.replaceChildren();

  if (welcome) welcome.hidden = page !== "dashboard";
  if (stats) stats.hidden = page !== "dashboard";

  if (page === "dashboard") renderOverview(area);
  if (page === "transactions") renderTransactions(area);
  if (page === "customers") renderCustomers(area);
  if (page === "projects") renderProjects(area);
  if (page === "inventory") renderInventory(area);
  if (page === "reports") renderReports(area);
  if (page === "settings") renderSettings(area);
}

async function loadAccount(user) {
  currentUser = user;
  authScreen.hidden = true;
  dashboard.hidden = false;

  const name = user.displayName || user.email?.split("@")[0] || "User";
  $("welcomeName").textContent = name;
  $("welcomeNameInline").textContent = name;
  $("userEmail").textContent = user.email || "";
  $("avatar").textContent = name.charAt(0).toUpperCase();
  $("versionLabel").textContent = `NEXORA v${VERSION} · Business workspace`;

  await saveProfile(user);
  const profileSnap = await getDoc(doc(db, "users", user.uid));
  businessProfile = profileSnap.exists() ? profileSnap.data() : {};

  await loadAll();

  if (!businessProfile.businessName) renderPage("settings");
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    renderPage(button.dataset.page || "dashboard");
  });
});

$("backToDashboard")?.addEventListener("click", () => renderPage("dashboard"));

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    businessProfile = {};
    cache = { transactions: [], customers: [], projects: [], inventory: [] };
    dashboard.hidden = true;
    authScreen.hidden = false;
    return;
  }

  try {
    await loadAccount(user);
  } catch (error) {
    console.error("NEXORA load error:", error);
    dashboard.hidden = true;
    authScreen.hidden = false;
    showMessage(`Could not load workspace. ${errorText(error)}`);
  }
});

setAuthMode("login");
