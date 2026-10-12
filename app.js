
/* =========================================================
   NEXORA — BUSINESS COMMAND CENTER
   Version: 2.2.0
   File: app.js
   ========================================================= */

import { auth, db, googleProvider } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "2.2.0";

const $ = (selector, root = document) => root.querySelector(selector);

const state = {
  user: null,
  profile: null,
  page: "dashboard",
  authMode: "login",
  records: {},
  settings: {
    businessName: "My Business",
    currency: "PKR",
    taxRate: 0,
    dateFormat: "local"
  },
  workspaceId: "default",
  workspaces: [],
  search: ""
};

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const money = value => {
  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: state.settings.currency || "PKR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  } catch {
    return `${Number(value) || 0}`;
  }
};

const dateText = value => {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const userDoc = () => doc(db, "users", state.user.uid);

const userCollection = name =>
  collection(db, "users", state.user.uid, name);

const modules = {
  transactions: {
    title: "Transactions",
    icon: "↔",
    collection: "transactions",
    fields: [
      ["description", "Description", "text", true],
      ["type", "Type", "select", true, ["Income", "Expense", "Transfer"]],
      ["category", "Category", "text", true],
      ["amount", "Amount", "number", true],
      ["date", "Date", "date", true],
      ["paymentMethod", "Payment Method", "select", false, ["Cash", "Bank Transfer", "Card", "Online", "Other"]],
      ["reference", "Reference", "text", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  customers: {
    title: "Customers & Leads",
    icon: "♙",
    collection: "customers",
    fields: [
      ["name", "Customer / Lead Name", "text", true],
      ["type", "Type", "select", true, ["Customer", "Lead"]],
      ["email", "Email", "email", false],
      ["phone", "Phone", "tel", false],
      ["company", "Company", "text", false],
      ["status", "Status", "select", true, ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost", "Active"]],
      ["value", "Potential Value", "number", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  suppliers: {
    title: "Suppliers",
    icon: "♧",
    collection: "suppliers",
    fields: [
      ["name", "Supplier Name", "text", true],
      ["company", "Company", "text", false],
      ["email", "Email", "email", false],
      ["phone", "Phone", "tel", false],
      ["address", "Address", "text", false],
      ["status", "Status", "select", true, ["Active", "Inactive"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  inventory: {
    title: "Inventory",
    icon: "▦",
    collection: "inventory",
    fields: [
      ["name", "Product Name", "text", true],
      ["sku", "SKU / Barcode", "text", false],
      ["category", "Category", "text", true],
      ["quantity", "Stock Quantity", "number", true],
      ["minStock", "Minimum Stock", "number", false],
      ["cost", "Unit Cost", "number", true],
      ["price", "Selling Price", "number", true],
      ["supplier", "Supplier", "text", false],
      ["expiry", "Expiry Date", "date", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  projects: {
    title: "Projects & Tasks",
    icon: "◷",
    collection: "projects",
    fields: [
      ["name", "Project / Task Name", "text", true],
      ["type", "Record Type", "select", true, ["Project", "Task"]],
      ["status", "Status", "select", true, ["Not Started", "In Progress", "On Hold", "Completed"]],
      ["priority", "Priority", "select", true, ["Low", "Medium", "High", "Urgent"]],
      ["startDate", "Start Date", "date", false],
      ["dueDate", "Due Date", "date", false],
      ["assignee", "Assigned To", "text", false],
      ["progress", "Progress (%)", "number", false],
      ["budget", "Budget", "number", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  invoices: {
    title: "Invoices & Quotes",
    icon: "▤",
    collection: "invoices",
    fields: [
      ["number", "Invoice Number", "text", true],
      ["type", "Document Type", "select", true, ["Invoice", "Quote", "Estimate", "Receipt", "Credit Note"]],
      ["customer", "Customer", "text", true],
      ["issueDate", "Issue Date", "date", true],
      ["dueDate", "Due Date", "date", false],
      ["amount", "Total Amount", "number", true],
      ["tax", "Tax Amount", "number", false],
      ["status", "Status", "select", true, ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  bills: {
    title: "Bills & Purchases",
    icon: "▧",
    collection: "bills",
    fields: [
      ["number", "Bill Number", "text", true],
      ["supplier", "Supplier", "text", true],
      ["date", "Bill Date", "date", true],
      ["dueDate", "Due Date", "date", false],
      ["amount", "Amount", "number", true],
      ["status", "Status", "select", true, ["Unpaid", "Partially Paid", "Paid", "Overdue"]],
      ["category", "Category", "text", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  appointments: {
    title: "Appointments",
    icon: "▣",
    collection: "appointments",
    fields: [
      ["title", "Appointment Title", "text", true],
      ["person", "Customer / Person", "text", false],
      ["date", "Date", "date", true],
      ["time", "Time", "time", false],
      ["status", "Status", "select", true, ["Scheduled", "Confirmed", "Completed", "Cancelled", "No Show"]],
      ["location", "Location", "text", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  branches: {
    title: "Branches",
    icon: "⌂",
    collection: "branches",
    fields: [
      ["name", "Branch Name", "text", true],
      ["code", "Branch Code", "text", false],
      ["manager", "Manager", "text", false],
      ["phone", "Phone", "tel", false],
      ["address", "Address", "text", false],
      ["status", "Status", "select", true, ["Active", "Inactive"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  menuItems: {
    title: "Menu & Items",
    icon: "🍽",
    collection: "menuItems",
    fields: [
      ["name", "Item Name", "text", true],
      ["category", "Menu Category", "text", true],
      ["price", "Selling Price", "number", true],
      ["cost", "Unit Cost", "number", false],
      ["available", "Availability", "select", true, ["Available", "Unavailable"]],
      ["ingredients", "Ingredients / Notes", "textarea", false]
    ]
  },

  orders: {
    title: "Orders",
    icon: "🧾",
    collection: "orders",
    fields: [
      ["number", "Order Number", "text", true],
      ["date", "Order Date", "date", true],
      ["customer", "Customer Name", "text", false],
      ["table", "Table / Channel", "text", false],
      ["items", "Items Summary", "textarea", true],
      ["total", "Order Total", "number", true],
      ["payment", "Payment Method", "select", true, ["Cash", "Card", "Bank Transfer", "Online", "Unpaid"]],
      ["status", "Order Status", "select", true, ["New", "Preparing", "Ready", "Served", "Completed", "Cancelled"]]
    ]
  },

  patients: {
    title: "Patients",
    icon: "🩺",
    collection: "patients",
    fields: [
      ["name", "Patient Name", "text", true],
      ["patientId", "Patient ID", "text", false],
      ["phone", "Phone", "tel", false],
      ["email", "Email", "email", false],
      ["birthDate", "Date of Birth", "date", false],
      ["bloodGroup", "Blood Group", "select", false, ["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]],
      ["allergies", "Allergies / Notes", "textarea", false]
    ]
  },

  prescriptions: {
    title: "Prescriptions",
    icon: "💊",
    collection: "prescriptions",
    fields: [
      ["patient", "Patient Name / ID", "text", true],
      ["date", "Prescription Date", "date", true],
      ["clinician", "Clinician", "text", false],
      ["medicines", "Medicines / Instructions", "textarea", true],
      ["followUp", "Follow-up Date", "date", false],
      ["status", "Status", "select", true, ["Active", "Completed", "Cancelled"]]
    ]
  },

  students: {
    title: "Students",
    icon: "🎓",
    collection: "students",
    fields: [
      ["name", "Student Name", "text", true],
      ["studentId", "Student ID", "text", false],
      ["className", "Class / Course", "text", true],
      ["guardian", "Parent / Guardian", "text", false],
      ["phone", "Contact Number", "tel", false],
      ["enrolDate", "Enrolment Date", "date", false],
      ["fee", "Course Fee", "number", false],
      ["status", "Status", "select", true, ["Active", "On Hold", "Graduated", "Withdrawn"]]
    ]
  },

  classes: {
    title: "Classes & Attendance",
    icon: "📚",
    collection: "classes",
    fields: [
      ["title", "Class / Session", "text", true],
      ["date", "Date", "date", true],
      ["time", "Start Time", "time", false],
      ["teacher", "Teacher", "text", false],
      ["className", "Class / Course", "text", true],
      ["attendance", "Attendance Count", "number", false],
      ["status", "Status", "select", true, ["Scheduled", "Completed", "Cancelled"]]
    ]
  },

  siteProjects: {
    title: "Construction Projects",
    icon: "🏗",
    collection: "siteProjects",
    fields: [
      ["name", "Project / Site Name", "text", true],
      ["client", "Client", "text", false],
      ["location", "Site Location", "text", false],
      ["startDate", "Start Date", "date", false],
      ["dueDate", "Target Completion", "date", false],
      ["budget", "Approved Budget", "number", true],
      ["spent", "Cost to Date", "number", false],
      ["progress", "Progress (%)", "number", false],
      ["status", "Status", "select", true, ["Planning", "In Progress", "On Hold", "Completed"]]
    ]
  },

  materials: {
    title: "Materials & Labour",
    icon: "🧱",
    collection: "materials",
    fields: [
      ["name", "Material / Labour Item", "text", true],
      ["site", "Project / Site", "text", false],
      ["quantity", "Quantity", "number", true],
      ["unit", "Unit", "text", false],
      ["unitCost", "Unit Cost", "number", true],
      ["date", "Entry Date", "date", true],
      ["supplier", "Supplier / Contractor", "text", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  production: {
    title: "Production Runs",
    icon: "⚙",
    collection: "production",
    fields: [
      ["batch", "Batch Number", "text", true],
      ["product", "Product", "text", true],
      ["date", "Production Date", "date", true],
      ["plannedQty", "Planned Quantity", "number", false],
      ["producedQty", "Produced Quantity", "number", true],
      ["wasteQty", "Waste Quantity", "number", false],
      ["status", "Status", "select", true, ["Planned", "In Progress", "Completed", "Cancelled"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  properties: {
    title: "Properties",
    icon: "🏠",
    collection: "properties",
    fields: [
      ["name", "Property Name", "text", true],
      ["type", "Property Type", "select", true, ["House", "Apartment", "Commercial", "Land", "Office", "Other"]],
      ["location", "Location", "text", true],
      ["price", "Asking Price", "number", true],
      ["bedrooms", "Bedrooms", "number", false],
      ["area", "Area / Size", "text", false],
      ["status", "Status", "select", true, ["Available", "Reserved", "Sold", "Rented"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  deals: {
    title: "Real Estate Deals",
    icon: "🤝",
    collection: "deals",
    fields: [
      ["name", "Deal Name", "text", true],
      ["client", "Client", "text", true],
      ["property", "Property", "text", false],
      ["amount", "Deal Value", "number", true],
      ["date", "Deal Date", "date", false],
      ["status", "Status", "select", true, ["New", "Negotiation", "Contract", "Completed", "Cancelled"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  fleet: {
    title: "Fleet Vehicles",
    icon: "🚚",
    collection: "fleet",
    fields: [
      ["vehicle", "Vehicle Name / Model", "text", true],
      ["registration", "Registration Number", "text", true],
      ["driver", "Assigned Driver", "text", false],
      ["lastService", "Last Service", "date", false],
      ["nextService", "Next Service", "date", false],
      ["status", "Status", "select", true, ["Available", "On Trip", "Maintenance", "Inactive"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  trips: {
    title: "Trips & Deliveries",
    icon: "🛣",
    collection: "trips",
    fields: [
      ["number", "Trip Number", "text", true],
      ["date", "Trip Date", "date", true],
      ["origin", "Origin", "text", true],
      ["destination", "Destination", "text", true],
      ["driver", "Driver", "text", false],
      ["vehicle", "Vehicle", "text", false],
      ["revenue", "Trip Revenue", "number", false],
      ["cost", "Trip Cost", "number", false],
      ["status", "Status", "select", true, ["Scheduled", "In Transit", "Delivered", "Cancelled"]]
    ]
  },

  crops: {
    title: "Fields & Crops",
    icon: "🌱",
    collection: "crops",
    fields: [
      ["name", "Field / Crop Name", "text", true],
      ["area", "Area / Size", "text", false],
      ["plantDate", "Planting Date", "date", false],
      ["expectedHarvest", "Expected Harvest", "date", false],
      ["season", "Season", "text", false],
      ["status", "Status", "select", true, ["Planned", "Growing", "Harvested", "Inactive"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  farmInputs: {
    title: "Farm Inputs & Harvest",
    icon: "🌾",
    collection: "farmInputs",
    fields: [
      ["name", "Input / Harvest Item", "text", true],
      ["type", "Record Type", "select", true, ["Seed", "Fertilizer", "Water", "Pesticide", "Harvest", "Other"]],
      ["date", "Date", "date", true],
      ["quantity", "Quantity", "number", false],
      ["cost", "Cost", "number", false],
      ["revenue", "Revenue", "number", false],
      ["field", "Field / Crop", "text", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  serviceJobs: {
    title: "Service Jobs",
    icon: "🛠",
    collection: "serviceJobs",
    fields: [
      ["title", "Job Title", "text", true],
      ["customer", "Customer", "text", true],
      ["date", "Job Date", "date", true],
      ["assignedTo", "Assigned To", "text", false],
      ["amount", "Service Amount", "number", false],
      ["status", "Status", "select", true, ["New", "Scheduled", "In Progress", "Completed", "Cancelled"]],
      ["notes", "Notes", "textarea", false]
    ]
  }
};

const BUSINESS_TYPES = {
  general: {
    title: "General Business",
    color: "#5794ff",
    modules: ["transactions", "customers", "suppliers", "inventory", "projects", "invoices", "bills", "appointments", "branches"]
  },
  retail: {
    title: "Retail & Shop",
    color: "#a47aff",
    modules: ["transactions", "inventory", "customers", "suppliers", "invoices", "bills", "branches"]
  },
  restaurant: {
    title: "Restaurant & Cafe",
    color: "#ff9b65",
    modules: ["transactions", "menuItems", "orders", "inventory", "customers", "suppliers", "invoices", "bills"]
  },
  services: {
    title: "Services Business",
    color: "#45d6e8",
    modules: ["transactions", "serviceJobs", "customers", "appointments", "projects", "invoices", "bills"]
  },
  healthcare: {
    title: "Healthcare & Clinic",
    color: "#39d6a2",
    modules: ["transactions", "patients", "prescriptions", "appointments", "inventory", "invoices", "bills"]
  },
  education: {
    title: "Education & Institute",
    color: "#f2c46d",
    modules: ["transactions", "students", "classes", "customers", "invoices", "bills", "appointments"]
  },
  construction: {
    title: "Construction",
    color: "#ff9b65",
    modules: ["transactions", "siteProjects", "materials", "suppliers", "customers", "invoices", "bills"]
  },
  manufacturing: {
    title: "Manufacturing",
    color: "#a47aff",
    modules: ["transactions", "production", "inventory", "suppliers", "customers", "invoices", "bills"]
  },
  realestate: {
    title: "Real Estate",
    color: "#45d6e8",
    modules: ["transactions", "properties", "deals", "customers", "appointments", "invoices", "bills"]
  },
  transport: {
    title: "Transport & Logistics",
    color: "#5794ff",
    modules: ["transactions", "fleet", "trips", "customers", "suppliers", "invoices", "bills"]
  },
  agriculture: {
    title: "Agriculture & Farming",
    color: "#39d6a2",
    modules: ["transactions", "crops", "farmInputs", "inventory", "suppliers", "customers", "bills"]
  }
};

const configPages = [
  ["settings", "⚙", "Business Settings"],
  ["workspaces", "▣", "Business Categories"],
  ["backup", "⇩", "Data Backup"]
];

function notify(message, error = false) {
  const root = $("#toastRoot");
  if (!root) return;
  root.innerHTML = `<div class="toast ${error ? "error" : ""}">${esc(message)}</div>`;
  setTimeout(() => {
    if (root.firstElementChild) root.innerHTML = "";
  }, 4000);
}

function friendlyError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/email-already-in-use": "This email already has an account. Please sign in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account was found for this email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed.",
    "permission-denied": "Firebase denied this request. Check Firestore rules and account access.",
    "unavailable": "The service is temporarily unavailable. Please try again."
  };
  return messages[code] || error?.message || "Something went wrong. Please try again.";
}

function showAuthMessage(message, error = false) {
  const box = $("#authMessage");
  box.textContent = message;
  box.classList.remove("hidden");
  box.style.borderColor = error ? "#a34459" : "#3a527a";
}

function setAuthMode(mode) {
  state.authMode = mode;
  const register = mode === "register";
  $("#authHeading").textContent = register ? "Create your account" : "Welcome back";
  $("#authDescription").textContent = register
    ? "Set up your NEXORA account and manage your business."
    : "Sign in to manage your business from one command center.";
  $("#nameField").classList.toggle("hidden", !register);
  $("#authName").required = register;
  $("#authSubmit").textContent = register ? "Create Account" : "Sign In";
  $("#showLogin").classList.toggle("primary", !register);
  $("#showRegister").classList.toggle("primary", register);
  $("#forgotPassword").classList.toggle("hidden", register);
  $("#authMessage").classList.add("hidden");
}

async function handleAuth(event) {
  event.preventDefault();
  const button = $("#authSubmit");
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  button.disabled = true;
  button.textContent = "Please wait…";

  try {
    if (state.authMode === "register") {
      const name = $("#authName").value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });

      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        name,
        email,
        role: "user",
        plan: "free",
        businessName: "My Business",
        defaultBusinessType: "general",
        currency: "PKR",
        taxRate: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      notify("Account created successfully.");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    showAuthMessage(friendlyError(error), true);
  } finally {
    button.disabled = false;
    button.textContent = state.authMode === "register" ? "Create Account" : "Sign In";
  }
}

async function ensureProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || "NEXORA User",
      email: user.email || "",
      role: "user",
      plan: "free",
      businessName: "My Business",
      defaultBusinessType: "general",
      currency: "PKR",
      taxRate: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    state.profile = {};
  } else {
    state.profile = snap.data();
  }

  state.settings = {
    ...state.settings,
    ...state.profile
  };

  state.settings.currency ||= "PKR";
}

function businessType() {
  const selected = state.workspaces.find(w => w.id === state.workspaceId);
  return selected?.businessType ||
    state.settings.defaultBusinessType ||
    state.profile?.defaultBusinessType ||
    "general";
}

function currentModules() {
  return BUSINESS_TYPES[businessType()]?.modules || BUSINESS_TYPES.general.modules;
}

function renderCategoryNav() {
  const mainNav = $("#mainNav");
  const configNav = $("#configNav");
  if (!mainNav || !configNav) return;

  const items = [
    ["dashboard", "◈", "Command Center"],
    ...currentModules().map(key => [
      key,
      modules[key]?.icon || "•",
      modules[key]?.title || key
    ])
  ];

  mainNav.innerHTML = items.map(([page, icon, label]) => `
    <button class="nav-item ${state.page === page ? "active" : ""}" data-page="${esc(page)}">
      <span class="nav-ico">${icon}</span><span>${esc(label)}</span>
    </button>
  `).join("");

  configNav.innerHTML = configPages.map(([page, icon, label]) => `
    <button class="nav-item ${state.page === page ? "active" : ""}" data-page="${page}">
      <span class="nav-ico">${icon}</span><span>${label}</span>
    </button>
  `).join("");

  const select = $("#workspaceSelect");
  if (select) {
    select.innerHTML = state.workspaces.map(w =>
      `<option value="${esc(w.id)}" ${w.id === state.workspaceId ? "selected" : ""}>${esc(w.name)}</option>`
    ).join("");
  }
}

async function loadWorkspaces() {
  const snapshot = await getDocs(userCollection("workspaces"));
  state.workspaces = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  if (!state.workspaces.some(w => w.id === state.workspaceId)) {
    state.workspaceId = state.workspaces[0]?.id || "default";
  }
}

async function loadRecords(name) {
  const mod = modules[name];
  if (!mod) return [];

  const snapshot = await getDocs(userCollection(mod.collection));
  const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  state.records[name] = rows.filter(row =>
    !row.workspaceId || row.workspaceId === state.workspaceId
  );

  return state.records[name];
}

async function loadAll() {
  await loadWorkspaces();

  const keys = new Set([
    ...Object.keys(modules),
    "workspaces"
  ]);

  for (const key of keys) {
    if (modules[key]) await loadRecords(key);
  }
}

function applyBusinessTheme() {
  const config = BUSINESS_TYPES[businessType()] || BUSINESS_TYPES.general;
  document.documentElement.style.setProperty("--blue", config.color);
  document.documentElement.style.setProperty("--purple", config.color);
  $("#topCrumb").textContent = `${config.title} · Workspace`;
}

function navTo(page) {
  state.page = page;
  state.search = "";
  $("#globalSearch").value = "";
  $("#sidebar").classList.remove("open");
  renderCategoryNav();
  renderPage();
}

function metricCard(label, value, icon, foot) {
  return `
    <article class="stat">
      <div class="stat-top">
        <span class="stat-label">${esc(label)}</span>
        <span class="stat-icon">${icon}</span>
      </div>
      <div class="stat-value">${esc(value)}</div>
      <div class="stat-foot">${esc(foot)}</div>
    </article>
  `;
}

function dashboardPage() {
  const rows = state.records.transactions || [];
  const inventory = state.records.inventory || [];
  const invoices = state.records.invoices || [];
  const income = rows.filter(r => r.type === "Income")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const expenses = rows.filter(r => r.type === "Expense")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const lowStock = inventory.filter(r =>
    Number(r.quantity || 0) <= Number(r.minStock || 0)
  ).length;
  const revenue = invoices.filter(r => r.status !== "Cancelled")
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const config = BUSINESS_TYPES[businessType()] || BUSINESS_TYPES.general;
  const totalRecords = currentModules().reduce(
    (sum, key) => sum + (state.records[key] || []).length, 0
  );

  const stats = [
    ["Income", money(income), "↗", "Recorded income"],
    ["Expenses", money(expenses), "↘", "Recorded expenses"],
    ["Net Result", money(income - expenses), "◈", "Income minus expenses"],
    ["Records", String(totalRecords), "▦", `${config.title} workspace`]
  ];

  if (businessType() === "retail" || businessType() === "restaurant") {
    stats[0] = ["Sales Revenue", money(revenue || income), "↗", "Invoices and recorded income"];
    stats[3] = ["Low Stock", String(lowStock), "▦", "Inventory reorder checks"];
  }

  if (businessType() === "healthcare") {
    stats[0] = ["Patients", String((state.records.patients || []).length), "🩺", "Patient directory"];
    stats[3] = ["Appointments", String((state.records.appointments || []).length), "▣", "Appointment records"];
  }

  if (businessType() === "education") {
    stats[0] = ["Students", String((state.records.students || []).length), "🎓", "Student directory"];
    stats[3] = ["Classes", String((state.records.classes || []).length), "📚", "Class records"];
  }

  if (businessType() === "construction") {
    stats[0] = ["Projects", String((state.records.siteProjects || []).length), "🏗", "Construction sites"];
    stats[3] = ["Materials", String((state.records.materials || []).length), "🧱", "Material entries"];
  }

  if (businessType() === "manufacturing") {
    stats[0] = ["Production Runs", String((state.records.production || []).length), "⚙", "Recorded batches"];
    stats[3] = ["Stock Items", String(inventory.length), "▦", "Inventory catalogue"];
  }

  if (businessType() === "realestate") {
    stats[0] = ["Properties", String((state.records.properties || []).length), "🏠", "Property listings"];
    stats[3] = ["Deals", String((state.records.deals || []).length), "🤝", "Sales pipeline"];
  }

  if (businessType() === "transport") {
    stats[0] = ["Fleet Vehicles", String((state.records.fleet || []).length), "🚚", "Vehicles tracked"];
    stats[3] = ["Trips", String((state.records.trips || []).length), "🛣", "Trip records"];
  }

  if (businessType() === "agriculture") {
    stats[0] = ["Fields / Crops", String((state.records.crops || []).length), "🌱", "Crop records"];
    stats[3] = ["Farm Inputs", String((state.records.farmInputs || []).length), "🌾", "Farm activity"];
  }

  const chart = [
    ["Income", income],
    ["Expenses", expenses],
    ["Invoices", revenue]
  ];
  const max = Math.max(1, ...chart.map(item => item[1]));

  const recent = currentModules()
    .flatMap(key => (state.records[key] || []).map(row => ({
      ...row,
      moduleTitle: modules[key].title
    })))
    .slice(0, 7);

  return `
    <div class="welcome">
      <div>
        <div class="eyebrow">${esc(config.title)}</div>
        <h1>Welcome to your Command Center</h1>
        <p>Monitor your operations and manage your business in one place.</p>
      </div>
      <button class="btn primary" data-add="${esc(currentModules()[0] || "transactions")}">＋ Add Record</button>
    </div>

    <div class="grid stats">
      ${stats.map(s => metricCard(...s)).join("")}
    </div>

    <div class="grid two-col">
      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Business Overview</div>
            <div class="panel-sub">Recorded financial activity</div>
          </div>
          <span class="status">Overview</span>
        </div>

        <div class="chart">
          ${chart.map(([label, value]) => `
            <div class="bar-wrap">
              <div class="bar" title="${esc(money(value))}"
                style="height:${Math.max(3, value / max * 85)}%"></div>
              <div class="bar-label">${esc(label)}</div>
            </div>
          `).join("")}
        </div>
        <div class="legend">
          <span><i class="dot" style="background:var(--blue)"></i>Recorded values</span>
          <span>${esc(money(income - expenses))} net result</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Quick Actions</div>
            <div class="panel-sub">Open a business module</div>
          </div>
        </div>
        <div class="list">
          ${currentModules().slice(0, 5).map(key => `
            <div class="list-row">
              <div class="list-main">
                <div class="list-name">${modules[key].icon} ${esc(modules[key].title)}</div>
                <div class="list-meta">${(state.records[key] || []).length} record(s)</div>
              </div>
              <button class="btn" data-goto="${key}">Open →</button>
            </div>
          `).join("")}
        </div>
      </section>
    </div>

    <section class="panel" style="margin-top:18px">
      <div class="panel-head">
        <div>
          <div class="panel-title">Workspace Information</div>
          <div class="panel-sub">Current business configuration</div>
        </div>
        <button class="btn" data-goto="workspaces">Manage Categories</button>
      </div>
      <div class="grid section-grid">
        <div class="feature-card">
          <div class="stat-icon">◈</div>
          <h3>${esc(state.settings.businessName || "My Business")}</h3>
          <p>Business name and financial preferences can be changed in settings.</p>
        </div>
        <div class="feature-card">
          <div class="stat-icon">▦</div>
          <h3>${esc(config.title)}</h3>
          <p>Your sidebar shows modules selected for this business category.</p>
        </div>
        <div class="feature-card">
          <div class="stat-icon">⇩</div>
          <h3>Data Backup</h3>
          <p>Export your records as CSV files or a JSON backup.</p>
          <button class="btn" id="exportBackup" style="margin-top:12px">Export Backup</button>
        </div>
      </div>
    </section>

    <section class="panel" style="margin-top:18px">
      <div class="panel-head">
        <div>
          <div class="panel-title">Recent Records</div>
          <div class="panel-sub">Latest items from the current workspace</div>
        </div>
      </div>
      ${recent.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Module</th><th>Record</th><th>Status / Type</th></tr></thead>
            <tbody>
              ${recent.map(r => `
                <tr>
                  <td>${esc(r.moduleTitle)}</td>
                  <td>${esc(r.name || r.title || r.description || r.number || r.batch || r.vehicle || "Record")}</td>
                  <td>${esc(r.status || r.type || "Saved")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">No records yet. Use Quick Add to create your first record.</div>`}
    </section>
  `;
}

function formatValue(key, value, row) {
  if (value === undefined || value === null || value === "") return "—";

  if ([
    "amount", "price", "cost", "revenue", "total", "budget",
    "spent", "fee", "value", "unitCost"
  ].includes(key)) return money(value);

  if ([
    "date", "dueDate", "issueDate", "startDate", "expiry",
    "birthDate", "enrolDate", "followUp", "plantDate",
    "expectedHarvest", "lastService", "nextService"
  ].includes(key)) return dateText(value);

  if (key === "quantity" && Number(value) <= Number(row.minStock || 0)) {
    return `<span class="negative">${esc(value)}</span>`;
  }

  return esc(value);
}

function modulePage(name) {
  const mod = modules[name];
  if (!mod) return dashboardPage();

  const search = state.search.toLowerCase();
  const rows = (state.records[name] || []).filter(row =>
    Object.values(row).some(value =>
      String(value ?? "").toLowerCase().includes(search)
    )
  );

  const columns = mod.fields.slice(0, 5);

  return `
    <div class="welcome">
      <div>
        <div class="eyebrow">${esc(BUSINESS_TYPES[businessType()]?.title || "Business")}</div>
        <h1>${esc(mod.title)}</h1>
        <p>Manage your ${esc(mod.title.toLowerCase())} records.</p>
      </div>
    </div>

    <div class="page-toolbar">
      <div class="toolbar-left">
        <input class="filter" id="moduleSearch" placeholder="Filter records…" value="${esc(state.search)}">
        <span class="status">${rows.length} record(s)</span>
      </div>
      <div class="toolbar-right">
        <button class="btn" data-export="${esc(name)}">Export CSV</button>
        <button class="btn primary" data-add="${esc(name)}">＋ Add New</button>
      </div>
    </div>

    <section class="panel">
      <div class="table-wrap">
        ${rows.length ? `
          <table>
            <thead>
              <tr>
                ${columns.map(f => `<th>${esc(f[1])}</th>`).join("")}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  ${columns.map(f => `<td>${formatValue(f[0], row[f[0]], row)}</td>`).join("")}
                  <td>
                    <div class="table-actions">
                      <button class="icon-btn" data-edit="${name}:${row.id}">Edit</button>
                      <button class="icon-btn" data-delete="${name}:${row.id}">Delete</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<div class="empty">No records found. Click Add New to create a record.</div>`}
      </div>
    </section>
  `;
}

function settingsPage() {
  return `
    <div class="welcome">
      <div>
        <div class="eyebrow">CONFIGURATION</div>
        <h1>Business Settings</h1>
        <p>Update your business profile and currency preferences.</p>
      </div>
    </div>

    <section class="panel">
      <form id="settingsForm">
        <div class="form-grid">
          <div class="field">
            <label>BUSINESS NAME</label>
            <input name="businessName" required value="${esc(state.settings.businessName || "")}">
          </div>
          <div class="field">
            <label>CURRENCY</label>
            <select name="currency">
              ${["PKR", "USD", "GBP", "EUR", "AED", "SAR", "INR"].map(c =>
                `<option value="${c}" ${state.settings.currency === c ? "selected" : ""}>${c}</option>`
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label>DEFAULT TAX RATE (%)</label>
            <input type="number" name="taxRate" min="0" max="100" value="${Number(state.settings.taxRate || 0)}">
          </div>
          <div class="field">
            <label>DEFAULT BUSINESS CATEGORY</label>
            <select name="defaultBusinessType">
              ${Object.entries(BUSINESS_TYPES).map(([key, item]) =>
                `<option value="${key}" ${(state.settings.defaultBusinessType || "general") === key ? "selected" : ""}>${esc(item.title)}</option>`
              ).join("")}
            </select>
          </div>
        </div>
        <button class="btn primary" type="submit">Save Settings</button>
      </form>
    </section>
  `;
}

function workspacesPage() {
  return `
    <div class="welcome">
      <div>
        <div class="eyebrow">BUSINESS CATEGORIES</div>
        <h1>Choose Your Business</h1>
        <p>Switch your workspace interface to the relevant business modules.</p>
      </div>
    </div>

    <div class="grid section-grid">
      ${Object.entries(BUSINESS_TYPES).map(([key, item]) => {
        const workspace = state.workspaces.find(w => w.businessType === key);
        const active = businessType() === key;
        return `
          <article class="feature-card">
            <div class="stat-icon" style="color:${item.color}">◈</div>
            <h3>${esc(item.title)}</h3>
            <p>${item.modules.length} relevant modules for this category.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
              ${workspace
                ? `<button class="btn ${active ? "good" : ""}" data-switch-workspace="${esc(workspace.id)}">${active ? "Current Workspace" : "Switch Workspace"}</button>`
                : `<button class="btn primary" data-create-workspace="${key}">Create Workspace</button>`
              }
            </div>
          </article>
        `;
      }).join("")}
    </div>

    <div class="notice" style="margin-top:18px">
      Each category changes the available modules and dashboard labels. Records are stored under your signed-in account. This is not a team-sharing or multi-user permission system.
    </div>
  `;
}

function backupPage() {
  return `
    <div class="welcome">
      <div>
        <div class="eyebrow">DATA MANAGEMENT</div>
        <h1>Backup & Export</h1>
        <p>Keep an offline copy of your business data.</p>
      </div>
    </div>

    <section class="panel">
      <div class="feature-card">
        <div class="stat-icon">⇩</div>
        <h3>Full JSON Backup</h3>
        <p>Export records loaded for your current workspace as a JSON file.</p>
        <button class="btn primary" id="exportBackup" style="margin-top:14px">Export JSON Backup</button>
      </div>

      <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">

      <h3>Import CSV Records</h3>
      <p class="muted small">Choose the module and a CSV file with matching field names.</p>

      <div class="form-grid" style="margin-top:16px">
        <div class="field">
          <label>MODULE</label>
          <select id="importModule">
            ${currentModules().map(key => `<option value="${key}">${esc(modules[key].title)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>CSV FILE</label>
          <input id="importFile" type="file" accept=".csv,text/csv">
        </div>
      </div>
      <button class="btn primary" id="runImport">Import CSV</button>
    </section>
  `;
}

function renderPage() {
  const titleMap = {
    dashboard: "Command Center",
    settings: "Business Settings",
    workspaces: "Business Categories",
    backup: "Data Backup"
  };

  $("#topTitle").textContent =
    titleMap[state.page] || modules[state.page]?.title || "NEXORA";

  if (modules[state.page]) {
    $("#topCrumb").textContent = `${BUSINESS_TYPES[businessType()]?.title || "Business"} · ${modules[state.page].title}`;
  }

  const content = $("#pageContent");

  if (state.page === "dashboard") content.innerHTML = dashboardPage();
  else if (state.page === "settings") content.innerHTML = settingsPage();
  else if (state.page === "workspaces") content.innerHTML = workspacesPage();
  else if (state.page === "backup") content.innerHTML = backupPage();
  else content.innerHTML = modulePage(state.page);

  bindPageEvents();
}

function fieldControl(field, record = {}) {
  const [key, label, type, required, options] = field;
  const value = record[key] ?? "";
  const req = required ? "required" : "";

  if (type === "select") {
    return `
      <div class="field">
        <label>${esc(label.toUpperCase())}</label>
        <select name="${key}" ${req}>
          <option value="">Choose…</option>
          ${(options || []).map(option =>
            `<option value="${esc(option)}" ${String(value) === option ? "selected" : ""}>${esc(option)}</option>`
          ).join("")}
        </select>
      </div>
    `;
  }

  if (type === "textarea") {
    return `
      <div class="field span-2">
        <label>${esc(label.toUpperCase())}</label>
        <textarea name="${key}" ${req}>${esc(value)}</textarea>
      </div>
    `;
  }

  return `
    <div class="field">
      <label>${esc(label.toUpperCase())}</label>
      <input name="${key}" type="${type}" value="${esc(value)}" ${req}
        ${type === "number" ? 'step="any"' : ""}>
    </div>
  `;
}

function openModal(title, body, saveHandler) {
  $("#modalRoot").innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <section class="modal">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" id="modalClose">×</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button class="btn" id="modalCancel">Cancel</button>
          <button class="btn primary" id="modalSave">Save</button>
        </div>
      </section>
    </div>
  `;

  const close = () => { $("#modalRoot").innerHTML = ""; };
  $("#modalClose").onclick = close;
  $("#modalCancel").onclick = close;

  $("#modalBackdrop").onclick = event => {
    if (event.target.id === "modalBackdrop") close();
  };

  $("#modalSave").onclick = async () => {
    const form = $("#recordForm");
    if (form && !form.reportValidity()) return;

    const button = $("#modalSave");
    button.disabled = true;
    button.textContent = "Saving…";

    try {
      await saveHandler(form);
      close();
    } catch (error) {
      notify(friendlyError(error), true);
    } finally {
      button.disabled = false;
      button.textContent = "Save";
    }
  };
}

function openRecordModal(name, id = null) {
  const mod = modules[name];
  if (!mod) return;

  const record = id
    ? (state.records[name] || []).find(item => item.id === id) || {}
    : {};

  openModal(
    `${id ? "Edit" : "Add"} ${mod.title}`,
    `<form id="recordForm"><div class="form-grid">${mod.fields.map(field => fieldControl(field, record)).join("")}</div></form>`,
    async form => {
      const formData = new FormData(form);
      const data = {};

      for (const field of mod.fields) {
        const [key, label, type, required] = field;
        const raw = formData.get(key);
        const value = raw == null ? "" : String(raw).trim();

        if (required && !value) {
          throw new Error(`${label} is required.`);
        }

        data[key] = type === "number"
          ? (value === "" ? 0 : Number(value))
          : value;
      }

      data.workspaceId = state.workspaceId;
      data.updatedAt = serverTimestamp();

      if (id) {
        await updateDoc(
          doc(db, "users", state.user.uid, mod.collection, id),
          data
        );
      } else {
        await addDoc(userCollection(mod.collection), {
          ...data,
          createdAt: serverTimestamp()
        });
      }

      await loadRecords(name);
      renderPage();
      notify(id ? "Record updated." : "Record created.");
    }
  );
}

async function deleteRecord(name, id) {
  if (!confirm("Delete this record permanently?")) return;

  try {
    const mod = modules[name];
    await deleteDoc(doc(db, "users", state.user.uid, mod.collection, id));
    await loadRecords(name);
    renderPage();
    notify("Record deleted.");
  } catch (error) {
    notify(friendlyError(error), true);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportCSV(name) {
  const rows = state.records[name] || [];
  if (!rows.length) {
    notify("There are no records to export.");
    return;
  }

  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]
    .filter(key => !["id", "workspaceId"].includes(key));

  const csv = [
    keys.map(csvEscape).join(","),
    ...rows.map(row => keys.map(key => {
      const value = row[key]?.toDate
        ? row[key].toDate().toISOString()
        : row[key];
      return csvEscape(value);
    }).join(","))
  ].join("\r\n");

  downloadFile(`${name}-${today()}.csv`, csv, "text/csv;charset=utf-8");
  notify("CSV export ready.");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

async function importCSV() {
  const file = $("#importFile")?.files?.[0];
  const name = $("#importModule")?.value;
  const mod = modules[name];

  if (!file || !mod) {
    notify("Choose a CSV file and module first.", true);
    return;
  }

  try {
    const rows = parseCSV(await file.text());
    if (rows.length < 2) throw new Error("CSV has no data rows.");

    const normalize = value =>
      String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const fieldLookup = {};
    mod.fields.forEach(field => {
      fieldLookup[normalize(field[0])] = field[0];
      fieldLookup[normalize(field[1])] = field[0];
    });

    const headers = rows[0].map(header => fieldLookup[normalize(header)]);
    let imported = 0;

    for (const row of rows.slice(1)) {
      const data = {
        workspaceId: state.workspaceId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      headers.forEach((key, index) => {
        if (!key) return;
        const field = mod.fields.find(item => item[0] === key);
        const value = String(row[index] || "").trim();
        if (value) {
          data[key] = field?.[2] === "number" ? Number(value) : value;
        }
      });

      const missing = mod.fields.some(field =>
        field[3] && !String(data[field[0]] ?? "").trim()
      );

      if (!missing) {
        await addDoc(userCollection(mod.collection), data);
        imported++;
      }
    }

    await loadRecords(name);
    renderPage();
    notify(`Imported ${imported} record(s).`);
  } catch (error) {
    notify(friendlyError(error), true);
  }
}

function exportBackup() {
  const backup = {
    app: "NEXORA",
    version: VERSION,
    exportedAt: new Date().toISOString(),
    workspaceId: state.workspaceId,
    settings: state.settings,
    records: state.records
  };

  downloadFile(
    `nexora-backup-${today()}.json`,
    JSON.stringify(backup, (key, value) =>
      value?.toDate ? value.toDate().toISOString() : value, 2),
    "application/json"
  );

  notify("JSON backup exported.");
}

async function saveSettings(event) {
  event.preventDefault();

  const form = new FormData(event.currentTarget);
  const businessName = String(form.get("businessName") || "My Business").trim();
  const currency = String(form.get("currency") || "PKR");
  const taxRate = Number(form.get("taxRate") || 0);
  const defaultBusinessType = String(form.get("defaultBusinessType") || "general");

  try {
    await setDoc(userDoc(), {
      uid: state.user.uid,
      name: state.profile?.name || state.user.displayName || "NEXORA User",
      email: state.user.email || "",
      role: state.profile?.role || "user",
      plan: state.profile?.plan || "free",
      businessName,
      currency,
      taxRate,
      defaultBusinessType,
      updatedAt: serverTimestamp()
    }, { merge: true });

    state.settings = {
      ...state.settings,
      businessName,
      currency,
      taxRate,
      defaultBusinessType
    };

    state.profile = { ...state.profile, ...state.settings };
    applyBusinessTheme();
    renderCategoryNav();
    notify("Business settings saved.");
    renderPage();
  } catch (error) {
    notify(friendlyError(error), true);
  }
}

async function createWorkspace(type) {
  const config = BUSINESS_TYPES[type];
  if (!config) return;

  const name = prompt(`Enter a name for your ${config.title} workspace:`, config.title);
  if (!name?.trim()) return;

  try {
    const created = await addDoc(userCollection("workspaces"), {
      name: name.trim(),
      businessType: type,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    state.workspaceId = created.id;
    await loadWorkspaces();
    await loadAll();
    applyBusinessTheme();
    renderCategoryNav();
    navTo("dashboard");
    notify("Workspace created.");
  } catch (error) {
    notify(friendlyError(error), true);
  }
}

function bindPageEvents() {
  const content = $("#pageContent");

  content.onclick = async event => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.add) {
      openRecordModal(button.dataset.add);
      return;
    }

    if (button.dataset.edit) {
      const index = button.dataset.edit.indexOf(":");
      openRecordModal(button.dataset.edit.slice(0, index), button.dataset.edit.slice(index + 1));
      return;
    }

    if (button.dataset.delete) {
      const index = button.dataset.delete.indexOf(":");
      deleteRecord(button.dataset.delete.slice(0, index), button.dataset.delete.slice(index + 1));
      return;
    }

    if (button.dataset.export) {
      exportCSV(button.dataset.export);
      return;
    }

    if (button.dataset.goto) {
      navTo(button.dataset.goto);
      return;
    }

    if (button.dataset.createWorkspace) {
      createWorkspace(button.dataset.createWorkspace);
      return;
    }

    if (button.dataset.switchWorkspace) {
      state.workspaceId = button.dataset.switchWorkspace;
      await loadAll();
      applyBusinessTheme();
      renderCategoryNav();
      navTo("dashboard");
      return;
    }

    if (button.id === "exportBackup") {
      exportBackup();
      return;
    }

    if (button.id === "runImport") {
      importCSV();
    }
  };

  content.oninput = event => {
    if (event.target.id !== "moduleSearch") return;

    state.search = event.target.value;
    const position = event.target.selectionStart;
    renderPage();

    const input = $("#moduleSearch");
    if (input) {
      input.focus();
      input.setSelectionRange(position, position);
    }
  };

  content.onsubmit = event => {
    if (event.target.id === "settingsForm") saveSettings(event);
  };
}

function installEvents() {
  $("#authForm").addEventListener("submit", handleAuth);

  $("#showLogin").onclick = () => setAuthMode("login");
  $("#showRegister").onclick = () => setAuthMode("register");

  $("#forgotPassword").onclick = async () => {
    const email = $("#authEmail").value.trim();
    if (!email) return showAuthMessage("Enter your email address first.", true);

    try {
      await sendPasswordResetEmail(auth, email);
      showAuthMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      showAuthMessage(friendlyError(error), true);
    }
  };

  $("#signOutBtn").onclick = () => signOut(auth);
  $("#menuToggle").onclick = () => $("#sidebar").classList.toggle("open");

  $("#quickAddBtn").onclick = () => {
    if (modules[state.page]) {
      openRecordModal(state.page);
      return;
    }

    const defaults = {
      retail: "invoices",
      restaurant: "orders",
      services: "serviceJobs",
      healthcare: "patients",
      education: "students",
      construction: "siteProjects",
      manufacturing: "production",
      realestate: "properties",
      transport: "trips",
      agriculture: "crops"
    };

    openRecordModal(defaults[businessType()] || "transactions");
  };

  $("#workspaceSelect").onchange = async event => {
    state.workspaceId = event.target.value;
    await loadAll();
    applyBusinessTheme();
    renderCategoryNav();
    navTo("dashboard");
  };

  $("#globalSearch").oninput = event => {
    state.search = event.target.value;
    if (modules[state.page]) renderPage();
  };

  $("#sidebar").onclick = event => {
    const button = event.target.closest("[data-page]");
    if (button) navTo(button.dataset.page);
  };
}

async function showApp() {
  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");

  $("#userName").textContent =
    state.profile?.name || state.user.displayName || "NEXORA User";
  $("#userEmail").textContent = state.user.email || "";
  $("#userAvatar").textContent =
    ($("#userName").textContent || "N").charAt(0).toUpperCase();

  await loadAll();
  applyBusinessTheme();
  renderCategoryNav();
  navTo("dashboard");
}

onAuthStateChanged(auth, async user => {
  state.user = user;

  if (!user) {
    $("#appView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
    return;
  }

  try {
    await ensureProfile(user);
    await showApp();
  } catch (error) {
    $("#appView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
    showAuthMessage(friendlyError(error), true);
  }
});

installEvents();
setAuthMode("login");
