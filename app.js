
/* =========================================================
   NEXORA BUSINESS COMMAND CENTER
   Version 2.3.0
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
  serverTimestamp,
  query,
  orderBy,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "2.3.0";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const money = value =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: state.settings?.currency || "PKR",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const dateFmt = value => {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const isoToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

const slug = value =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
  search: "",
  busy: false
};

/* ---------------- BUSINESS MODULES ---------------- */

const modules = {
  transactions: {
    title: "Transactions",
    crumb: "Income, expenses and transfers",
    collection: "transactions",
    icon: "↔",
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
    crumb: "Customer relationships and sales pipeline",
    collection: "customers",
    icon: "♙",
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
    crumb: "Supplier directory and contact records",
    collection: "suppliers",
    icon: "♧",
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
    crumb: "Products, stock levels and reorder alerts",
    collection: "inventory",
    icon: "▦",
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
    crumb: "Projects, milestones and task tracking",
    collection: "projects",
    icon: "◷",
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
    crumb: "Sales documents and payment status",
    collection: "invoices",
    icon: "▤",
    fields: [
      ["number", "Invoice / Quote Number", "text", true],
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
    crumb: "Supplier bills and outgoing payments",
    collection: "bills",
    icon: "▧",
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
    crumb: "Bookings, visits and reminders",
    collection: "appointments",
    icon: "▣",
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
    crumb: "Locations, branches and warehouses",
    collection: "branches",
    icon: "⌂",
    fields: [
      ["name", "Branch / Warehouse Name", "text", true],
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
    crumb: "Menu catalogue, prices and availability",
    collection: "menuItems",
    icon: "🍽",
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
    crumb: "Restaurant orders and fulfilment",
    collection: "orders",
    icon: "🧾",
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
    crumb: "Patient directory and clinic records",
    collection: "patients",
    icon: "🩺",
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
    crumb: "Prescription notes and follow-up",
    collection: "prescriptions",
    icon: "💊",
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
    crumb: "Student records and enrolment",
    collection: "students",
    icon: "🎓",
    fields: [
      ["name", "Student Name", "text", true],
      ["studentId", "Student ID", "text", false],
      ["className", "Class / Course", "text", true],
      ["email", "Student Email", "email", false],
      ["guardian", "Parent / Guardian", "text", false],
      ["phone", "Contact Number", "tel", false],
      ["enrolDate", "Enrolment Date", "date", false],
      ["fee", "Course Fee", "number", false],
      ["status", "Status", "select", true, ["Active", "On Hold", "Graduated", "Withdrawn"]]
    ]
  },

  staff: {
    title: "Staff & Teachers",
    crumb: "Staff directory and assigned email addresses",
    collection: "staff",
    icon: "🧑‍🏫",
    fields: [
      ["name", "Staff / Teacher Name", "text", true],
      ["email", "Staff Login Email", "email", true],
      ["staffRole", "Role", "select", true, ["Teacher", "Staff", "Coordinator", "Assistant"]],
      ["department", "Department / Class", "text", false],
      ["phone", "Phone", "tel", false],
      ["status", "Status", "select", true, ["Invited", "Active", "Inactive"]],
      ["notes", "Notes", "textarea", false]
    ]
  },

  tasks: {
    title: "Assigned Tasks",
    crumb: "Assign tasks to staff by their account email",
    collection: "tasks",
    icon: "✓",
    fields: [
      ["title", "Task Title", "text", true],
      ["description", "Task Details", "textarea", false],
      ["assigneeEmail", "Assigned Staff Email", "email", true],
      ["assignedBy", "Assigned By", "text", false],
      ["assignedDate", "Assigned Date", "date", true],
      ["dueDate", "Due Date", "date", false],
      ["priority", "Priority", "select", true, ["Low", "Medium", "High", "Urgent"]],
      ["status", "Task Status", "select", true, ["Pending", "In Progress", "Completed"]]
    ]
  },

  attendance: {
    title: "Daily Attendance",
    crumb: "Date-wise student attendance register",
    collection: "attendance",
    icon: "🗓",
    fields: [
      ["studentId", "Student ID", "text", false],
      ["studentName", "Student Name", "text", true],
      ["className", "Class / Course", "text", true],
      ["date", "Attendance Date", "date", true],
      ["status", "Attendance Status", "select", true, ["Present", "Absent", "Leave"]],
      ["markedBy", "Marked By (Teacher)", "text", false],
      ["notes", "Notes", "textarea", false]
    ]
  },

  classes: {
    title: "Classes & Courses",
    crumb: "Class lists and course schedules",
    collection: "classes",
    icon: "📚",
    fields: [
      ["name", "Class / Course Name", "text", true],
      ["teacher", "Teacher Name", "text", false],
      ["room", "Room / Location", "text", false],
      ["schedule", "Schedule", "text", false],
      ["status", "Status", "select", true, ["Active", "Inactive", "Completed"]],
      ["notes", "Notes", "textarea", false]
    ]
  }
};

/* ---------------- BUSINESS TYPES ---------------- */

const BUSINESS_TYPES = {
  general: {
    label: "General Business",
    accent: "#5794ff",
    accent2: "#8e78ff",
    accent3: "#45d6e8"
  },
  retail: {
    label: "Retail & Shop",
    accent: "#43a5ff",
    accent2: "#7e7bff",
    accent3: "#45d6e8"
  },
  restaurant: {
    label: "Restaurant & Cafe",
    accent: "#ff9b55",
    accent2: "#ff6c8b",
    accent3: "#ffd36d"
  },
  services: {
    label: "Services & Freelance",
    accent: "#a47aff",
    accent2: "#6b91ff",
    accent3: "#45d6e8"
  },
  healthcare: {
    label: "Healthcare & Clinic",
    accent: "#39d6a2",
    accent2: "#5794ff",
    accent3: "#6ce9d5"
  },
  education: {
    label: "Education & Institute",
    accent: "#a47aff",
    accent2: "#5794ff",
    accent3: "#45d6e8"
  },
  construction: {
    label: "Construction",
    accent: "#ffb84d",
    accent2: "#ff795e",
    accent3: "#e9d36c"
  },
  manufacturing: {
    label: "Manufacturing",
    accent: "#5794ff",
    accent2: "#45d6e8",
    accent3: "#8e78ff"
  },
  realestate: {
    label: "Real Estate",
    accent: "#45d6e8",
    accent2: "#5794ff",
    accent3: "#8e78ff"
  },
  transport: {
    label: "Transport & Logistics",
    accent: "#ffb84d",
    accent2: "#5794ff",
    accent3: "#45d6e8"
  },
  agriculture: {
    label: "Agriculture",
    accent: "#39d6a2",
    accent2: "#a4d65e",
    accent3: "#45d6e8"
  }
};

/* ---------------- NAVIGATION & ACCOUNT ---------------- */

const CATEGORY_NAV = {
  general: ["transactions", "customers", "suppliers", "inventory", "projects", "invoices", "bills", "appointments", "branches"],
  retail: ["transactions", "inventory", "customers", "suppliers", "invoices", "bills"],
  restaurant: ["menuItems", "orders", "inventory", "customers", "suppliers", "transactions", "appointments"],
  services: ["customers", "projects", "appointments", "invoices", "transactions", "staff", "tasks"],
  healthcare: ["patients", "prescriptions", "appointments", "transactions", "staff"],
  education: ["students", "staff", "tasks", "attendance", "classes", "appointments", "invoices", "customers", "transactions", "projects"],
  construction: ["projects", "inventory", "suppliers", "transactions", "invoices", "bills", "staff"],
  manufacturing: ["inventory", "suppliers", "transactions", "projects", "invoices", "bills"],
  realestate: ["customers", "projects", "appointments", "transactions", "invoices"],
  transport: ["inventory", "customers", "suppliers", "appointments", "transactions", "projects"],
  agriculture: ["inventory", "suppliers", "transactions", "projects", "customers"]
};

function renderCategoryNav() {
  const main = $("#mainNav");
  if (!main) return;

  const type = businessTypeForWorkspace();
  const keys = CATEGORY_NAV[type] || CATEGORY_NAV.general;

  const items = [
    { key: "dashboard", label: "Command Center", icon: "◈" },
    ...keys.filter(key => modules[key]).map(key => ({
      key,
      label: modules[key].title,
      icon: modules[key].icon || "◈"
    })),
    { key: "reports", label: "Reports & Data", icon: "▥" }
  ];

  main.innerHTML = items.map(item => `
    <button class="nav-item ${state.page === item.key ? "active" : ""}"
      data-page="${item.key}">
      <span class="nav-ico">${item.icon}</span>
      ${esc(item.label)}
    </button>
  `).join("");
}

function businessTypeForWorkspace(id = state.workspaceId) {
  const workspace = (state.workspaces || []).find(item => item.id === id);
  const candidate = id === "default"
    ? (workspace?.businessType || state.profile?.defaultBusinessType || "general")
    : workspace?.businessType;

  return BUSINESS_TYPES[candidate] ? candidate : "general";
}

function applyBusinessTheme() {
  const config = BUSINESS_TYPES[businessTypeForWorkspace()] || BUSINESS_TYPES.general;

  document.documentElement.style.setProperty("--blue", config.accent);
  document.documentElement.style.setProperty("--purple", config.accent2);
  document.documentElement.style.setProperty("--cyan", config.accent3);
}

function notify(message, error = false) {
  const element = document.createElement("div");
  element.className = "toast" + (error ? " error" : "");
  element.textContent = message;
  $("#toastRoot").append(element);
  setTimeout(() => element.remove(), 3600);
}

function userCollection(name) {
  if (!state.user) throw Error("Please sign in first.");
  return collection(db, "users", state.user.uid, name);
}

function userDoc() {
  if (!state.user) throw Error("Please sign in first.");
  return doc(db, "users", state.user.uid);
}

function activeCollection(name) {
  return userCollection(name);
}

function belongsHere(record) {
  return (record.workspaceId || "default") === state.workspaceId;
}

async function getRecords(name, allWorkspaces = false) {
  const collectionName = modules[name]?.collection || name;
  const snapshot = await getDocs(activeCollection(collectionName));

  let rows = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  if (name !== "workspaces" && !allWorkspaces) {
    rows = rows.filter(belongsHere);
  }

  rows.sort((a, b) =>
    String(b.date || b.issueDate || b.createdAt?.seconds || "")
      .localeCompare(String(a.date || a.issueDate || a.createdAt?.seconds || ""))
  );

  state.records[name] = rows;
  return rows;
}

async function ensureProfile(user) {
  const reference = userDoc();
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    const profile = {
      uid: user.uid,
      name: user.displayName || user.email?.split("@")[0] || "NEXORA User",
      email: user.email || "",
      role: "user",
      plan: "free",
      businessName: "My Business",
      defaultBusinessType: "general",
      currency: "PKR",
      taxRate: 0,
      dateFormat: "local",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(reference, profile);
    state.profile = { ...profile };
  } else {
    const oldProfile = snapshot.data();

    const profile = {
      uid: user.uid,
      email: user.email || oldProfile.email || "",
      name: oldProfile.name || user.displayName || user.email?.split("@")[0] || "NEXORA User",
      role: oldProfile.role || "user",
      plan: oldProfile.plan || "free",
      businessName: oldProfile.businessName || "My Business",
      currency: oldProfile.currency || "PKR",
      taxRate: Number(oldProfile.taxRate) || 0,
      dateFormat: oldProfile.dateFormat || "local",
      defaultBusinessType: BUSINESS_TYPES[oldProfile.defaultBusinessType]
        ? oldProfile.defaultBusinessType
        : "general",
      updatedAt: serverTimestamp()
    };

    await setDoc(reference, profile, { merge: true });
    state.profile = { ...oldProfile, ...profile };
  }

  state.settings = {
    businessName: state.profile.businessName,
    currency: state.profile.currency || "PKR",
    taxRate: Number(state.profile.taxRate) || 0,
    dateFormat: state.profile.dateFormat || "local"
  };
}

async function loadAll() {
  for (const name of [...Object.keys(modules), "workspaces"]) {
    await getRecords(name, name === "workspaces");
  }

  const records = state.records.workspaces || [];

  state.workspaces = [
    {
      id: "default",
      name: state.profile?.businessName || "Main Workspace",
      description: "Your primary business workspace",
      businessType: BUSINESS_TYPES[state.profile?.defaultBusinessType]
        ? state.profile.defaultBusinessType
        : "general"
    },
    ...records.map(workspace => ({
      id: workspace.id,
      name: workspace.name || "Untitled Workspace",
      description: workspace.description || "",
      businessType: BUSINESS_TYPES[workspace.businessType]
        ? workspace.businessType
        : "general"
    })).filter(workspace => workspace.id !== "default")
  ];

  if (!state.workspaces.some(workspace => workspace.id === state.workspaceId)) {
    state.workspaceId = "default";
  }

  renderWorkspaceSelect();
}

function renderWorkspaceSelect() {
  const element = $("#workspaceSelect");
  if (!element) return;

  element.innerHTML = state.workspaces.map(workspace => `
    <option value="${esc(workspace.id)}"
      ${workspace.id === state.workspaceId ? "selected" : ""}>
      ${esc(workspace.name)}
    </option>
  `).join("");
}

function setAuthMode(mode) {
  state.authMode = mode;
  const registering = mode === "register";

  $("#authHeading").textContent = registering
    ? "Create your NEXORA account"
    : "Welcome back";

  $("#authDescription").textContent = registering
    ? "Create your secure business workspace in minutes."
    : "Sign in to manage your business from one command center.";

  $("#nameField").classList.toggle("hidden", !registering);
  $("#forgotPassword").classList.toggle("hidden", registering);
  $("#authSubmit").textContent = registering ? "Create Account" : "Sign In";

  $("#showLogin").className = "btn" + (!registering ? " primary" : "");
  $("#showRegister").className = "btn" + (registering ? " primary" : "");
  $("#authMessage").classList.add("hidden");
}

function showAuthMessage(message, error = false) {
  const element = $("#authMessage");
  element.textContent = message;
  element.classList.remove("hidden");
  element.style.background = error ? "#3a1d2a" : "#18243b";
}

async function handleAuth(event) {
  event.preventDefault();

  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const name = $("#authName").value.trim();
  const button = $("#authSubmit");

  button.disabled = true;
  button.textContent = "Please wait…";

  try {
    if (state.authMode === "register") {
      if (!name) throw Error("Please enter your full name.");

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
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

function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use": "This email already has an account. Please sign in.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account was found for this email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "permission-denied": "Firestore permission denied. Please check your Firebase rules.",
    "unavailable": "Network unavailable. Check your internet connection."
  };

  return messages[error?.code] || error?.message || "Something went wrong. Please try again.";
}

const pageMeta = {
  dashboard: ["Command Center", "Your business at a glance"],
  reports: ["Reports & Data", "Business performance and data tools"],
  workspaces: ["Business Workspaces", "Manage separate work areas"],
  settings: ["Business Settings", "Configure your business profile"]
};

function navTo(page) {
  applyBusinessTheme();
  state.page = page;

  renderCategoryNav();

  $$(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const meta = modules[page]
    ? [modules[page].title, modules[page].crumb]
    : pageMeta[page] || [page, "NEXORA Workspace"];

  $("#topTitle").textContent = meta[0];
  $("#topCrumb").textContent = meta[1];
  $("#sidebar").classList.remove("open");

  renderPage();
}

/* ---------------- SHARED UI HELPERS ---------------- */

function statCard(label, value, icon, color, foot = "Current workspace") {
  return `
    <div class="stat" style="--glow:${color}">
      <div class="stat-top">
        <div class="stat-label">${esc(label)}</div>
        <div class="stat-icon">${icon}</div>
      </div>
      <div class="stat-value">${esc(value)}</div>
      <div class="stat-foot">${esc(foot)}</div>
    </div>
  `;
}

function tableFor(name, rows) {
  const module = modules[name];
  if (!module) return "";

  const columns = module.fields
    .filter(field => !["notes", "ingredients", "medicines", "items", "allergies"].includes(field[0]))
    .slice(0, 5);

  if (!rows.length) {
    return `<div class="empty">No records yet. Use <b>＋ Add New</b> to create your first record.</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${columns.map(field => `<th>${esc(field[1])}</th>`).join("")}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(record => `
            <tr>
              ${columns.map(field => `
                <td>${cellValue(field[0], record[field[0]], record)}</td>
              `).join("")}
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${esc(name)}:${esc(record.id)}" title="Edit">✎</button>
                  <button class="icon-btn" data-delete="${esc(name)}:${esc(record.id)}" title="Delete">×</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function cellValue(key, value, record) {
  if (value === undefined || value === null || value === "") {
    return '<span class="muted">—</span>';
  }

  if (["amount", "price", "cost", "budget", "value", "total", "fee", "revenue", "commission", "unitCost", "spent", "fuelCost"].includes(key)) {
    return `<span class="${key === "amount" && record.type === "Expense" ? "negative" : ""}">${money(value)}</span>`;
  }

  if (["date", "dueDate", "issueDate", "startDate", "expiry", "birthDate", "enrolDate", "followUp", "plantDate", "expectedHarvest", "lastService", "nextService", "endDate"].includes(key)) {
    return esc(dateFmt(value));
  }

  if (key === "status") {
    const css = /paid|completed|won|active|confirmed/i.test(value)
      ? "good"
      : /overdue|lost|cancelled|urgent/i.test(value)
        ? "bad"
        : /progress|sent|qualified|contacted/i.test(value)
          ? "warn"
          : "";

    return `<span class="status ${css}">${esc(value)}</span>`;
  }

  if (key === "quantity") {
    return `<span class="${Number(value) <= Number(record.minStock || 0) ? "negative" : ""}">${esc(value)}</span>`;
  }

  if (key === "progress") return `${esc(value)}%`;

  return esc(value);
}

function pageToolbar(name) {
  return `
    <div class="page-toolbar">
      <div class="toolbar-left">
        <input class="filter" id="moduleSearch" placeholder="Filter records…" value="${esc(state.search)}">
      </div>
      <div class="toolbar-right">
        <button class="btn" data-export="${name}">Export CSV</button>
        <button class="btn primary" data-add="${name}">＋ Add New</button>
      </div>
    </div>
  `;
}

/* ---------------- DASHBOARD & CHARTS ---------------- */

function currentRecords(name) {
  return (state.records[name] || []).filter(belongsHere);
}

function sumField(rows, key) {
  return rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
}

function chartMarkup(series) {
  const maxValue = Math.max(1, ...series.map(item => Number(item.value) || 0));

  return `
    <div class="chart">
      ${series.map(item => {
        const height = Math.max(3, (Number(item.value || 0) / maxValue) * 100);
        return `
          <div class="bar-wrap" title="${esc(item.label)}: ${esc(item.value)}">
            <div class="bar" style="height:${height}%;background:linear-gradient(180deg,${esc(item.color || "var(--blue)")},#3f7ef5)"></div>
            <div class="bar-label">${esc(item.label)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function recentTransactions() {
  const rows = currentRecords("transactions")
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 5);

  if (!rows.length) {
    return '<div class="empty">Your latest transactions will appear here.</div>';
  }

  return `<div class="list">${rows.map(row => `
    <div class="list-row">
      <div class="list-main">
        <div class="list-name">${esc(row.description || row.category || "Transaction")}</div>
        <div class="list-meta">${esc(row.date || "No date")} · ${esc(row.category || row.type || "General")}</div>
      </div>
      <div class="amount ${row.type === "Expense" ? "negative" : "positive"}">
        ${row.type === "Expense" ? "−" : "+"}${money(row.amount)}
      </div>
    </div>
  `).join("")}</div>`;
}

function renderDashboard() {
  const type = businessTypeForWorkspace();
  const transactions = currentRecords("transactions");
  const customers = currentRecords("customers");
  const inventory = currentRecords("inventory");
  const projects = currentRecords("projects");
  const invoices = currentRecords("invoices");
  const students = currentRecords("students");
  const staff = currentRecords("staff");
  const tasks = currentRecords("tasks");
  const attendance = currentRecords("attendance");

  const income = transactions
    .filter(row => row.type === "Income")
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const expenses = transactions
    .filter(row => row.type === "Expense")
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const stockAlerts = inventory.filter(row =>
    Number(row.quantity || 0) <= Number(row.minStock || 0)
  ).length;

  const todayAttendance = attendance.filter(row => row.date === isoToday());
  const present = todayAttendance.filter(row => row.status === "Present").length;
  const absent = todayAttendance.filter(row => row.status === "Absent").length;
  const pendingTasks = tasks.filter(row => row.status !== "Completed").length;
  const completedTasks = tasks.filter(row => row.status === "Completed").length;

  let stats;
  let chartSeries;
  let chartTitle = "Business Activity";
  let chartSubtitle = "A snapshot of your current workspace";

  if (type === "education") {
    stats = [
      statCard("Total Students", students.length, "🎓", "#a47aff", "Student records"),
      statCard("Present Today", present, "✓", "#39d6a2", `${todayAttendance.length} attendance entries today`),
      statCard("Absent Today", absent, "!", "#ff6b82", "Today's marked absences"),
      statCard("Pending Tasks", pendingTasks, "◷", "#5794ff", `${completedTasks} completed`)
    ];

    chartTitle = "Attendance Overview";
    chartSubtitle = "Present and absent records over the last 7 days";

    chartSeries = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const rows = attendance.filter(row => row.date === key);

      return {
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        value: rows.filter(row => row.status === "Present").length,
        color: "#39d6a2"
      };
    });
  } else if (type === "healthcare") {
    const patients = currentRecords("patients");
    const appointments = currentRecords("appointments");

    stats = [
      statCard("Patients", patients.length, "🩺", "#39d6a2", "Patient records"),
      statCard("Appointments", appointments.length, "▣", "#5794ff", "All appointments"),
      statCard("Income", money(income), "↗", "#45d6e8", "Recorded income"),
      statCard("Expenses", money(expenses), "↘", "#ff6b82", "Recorded expenses")
    ];

    chartSeries = transactions.slice(-7).map((row, index) => ({
      label: row.date || `#${index + 1}`,
      value: Number(row.amount) || 0
    }));
  } else if (type === "restaurant") {
    const orders = currentRecords("orders");

    stats = [
      statCard("Orders", orders.length, "🧾", "#ff9b55", "Recorded orders"),
      statCard("Menu Items", currentRecords("menuItems").length, "🍽", "#ff6b82", "Menu catalogue"),
      statCard("Income", money(income), "↗", "#39d6a2", "Recorded income"),
      statCard("Open Orders", orders.filter(row => !["Completed", "Cancelled"].includes(row.status)).length, "◷", "#5794ff", "Not yet completed")
    ];

    chartSeries = orders.slice(-7).map((row, index) => ({
      label: row.date || `#${index + 1}`,
      value: Number(row.total) || 0,
      color: "#ff9b55"
    }));
  } else if (type === "retail" || type === "manufacturing" || type === "agriculture") {
    stats = [
      statCard("Products", inventory.length, "▦", "#5794ff", "Inventory records"),
      statCard("Low Stock", stockAlerts, "!", "#ffb84d", "At or below minimum"),
      statCard("Income", money(income), "↗", "#39d6a2", "Recorded income"),
      statCard("Expenses", money(expenses), "↘", "#ff6b82", "Recorded expenses")
    ];

    chartSeries = inventory.slice(-7).map((row, index) => ({
      label: row.name || `#${index + 1}`,
      value: Number(row.quantity) || 0
    }));
  } else {
    stats = [
      statCard("Revenue", money(income), "↗", "#39d6a2", "Recorded income"),
      statCard("Expenses", money(expenses), "↘", "#ff6b82", "Recorded expenses"),
      statCard("Customers", customers.length, "♙", "#5794ff", "Customer and lead records"),
      statCard("Active Projects", projects.filter(row => row.status !== "Completed").length, "◷", "#a47aff", "Not completed")
    ];

    chartSeries = transactions.slice(-7).map((row, index) => ({
      label: row.date || `#${index + 1}`,
      value: Number(row.amount) || 0,
      color: row.type === "Expense" ? "#ff6b82" : "#5794ff"
    }));
  }

  if (!chartSeries.length) {
    chartSeries = [
      { label: "Mon", value: 0 },
      { label: "Tue", value: 0 },
      { label: "Wed", value: 0 },
      { label: "Thu", value: 0 },
      { label: "Fri", value: 0 },
      { label: "Sat", value: 0 },
      { label: "Sun", value: 0 }
    ];
  }

  const business = BUSINESS_TYPES[type] || BUSINESS_TYPES.general;

  $("#pageContent").innerHTML = `
    <div class="welcome">
      <div>
        <div class="eyebrow">${esc(business.label)} · VERSION ${VERSION}</div>
        <h1>Good to see you, ${esc(state.profile?.name?.split(" ")[0] || "there")}.</h1>
        <p>Here is your ${esc(state.profile?.businessName || "business")} workspace at a glance.</p>
      </div>
      <button class="btn primary" data-add="transactions">＋ Add Transaction</button>
    </div>

    <div class="grid stats">${stats.join("")}</div>

    <div class="grid two-col">
      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">${esc(chartTitle)}</div>
            <div class="panel-sub">${esc(chartSubtitle)}</div>
          </div>
          <span class="status">LIVE DATA</span>
        </div>
        ${chartMarkup(chartSeries)}
        <div class="legend">
          <span><span class="dot" style="background:var(--blue)"></span>Recorded activity</span>
          <span><span class="dot" style="background:var(--green)"></span>Positive status</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Quick Actions</div>
            <div class="panel-sub">Jump straight into your workflow</div>
          </div>
        </div>
        <div class="list">
          <div class="list-row">
            <div class="list-main">
              <div class="list-name">Record a transaction</div>
              <div class="list-meta">Track income or expenses</div>
            </div>
            <button class="btn" data-add="transactions">Add</button>
          </div>
          <div class="list-row">
            <div class="list-main">
              <div class="list-name">Create a task</div>
              <div class="list-meta">Record work to complete</div>
            </div>
            <button class="btn" data-add="tasks">Add</button>
          </div>
          <div class="list-row">
            <div class="list-main">
              <div class="list-name">Mark attendance</div>
              <div class="list-meta">Enter today's attendance</div>
            </div>
            <button class="btn" data-add="attendance">Add</button>
          </div>
          <div class="list-row">
            <div class="list-main">
              <div class="list-name">Add a customer</div>
              <div class="list-meta">Save a customer or lead</div>
            </div>
            <button class="btn" data-add="customers">Add</button>
          </div>
        </div>
      </section>
    </div>

    <section class="panel" style="margin-top:18px">
      <div class="panel-head">
        <div>
          <div class="panel-title">Recent Transactions</div>
          <div class="panel-sub">Your latest recorded financial activity</div>
        </div>
        <button class="btn" data-page="transactions">View All</button>
      </div>
      ${recentTransactions()}
    </section>
  `;
}

function renderModulePage(name) {
  const module = modules[name];
  if (!module) return renderDashboard();

  let rows = currentRecords(name);
  const filter = state.search.trim().toLowerCase();

  if (filter) {
    rows = rows.filter(row =>
      Object.values(row).some(value =>
        String(value ?? "").toLowerCase().includes(filter)
      )
    );
  }

  let extra = "";

  if (name === "attendance") {
    const date = $("#attendanceDateFilter")?.value || isoToday();
    const dateRows = currentRecords("attendance").filter(row => row.date === date);
    const present = dateRows.filter(row => row.status === "Present").length;
    const absent = dateRows.filter(row => row.status === "Absent").length;
    const leaves = dateRows.filter(row => row.status === "Leave").length;

    extra = `
      <div class="grid stats">
        ${statCard("Present", present, "✓", "#39d6a2", date)}
        ${statCard("Absent", absent, "!", "#ff6b82", date)}
        ${statCard("Leave", leaves, "◷", "#ffb84d", date)}
        ${statCard("Marked", dateRows.length, "▦", "#5794ff", "Selected date")}
      </div>
      <div class="page-toolbar">
        <div class="toolbar-left">
          <label class="muted small" for="attendanceDateFilter">Attendance date</label>
          <input class="filter" id="attendanceDateFilter" type="date" value="${esc(date)}">
        </div>
        <div class="toolbar-right">
          <button class="btn primary" data-add="attendance">＋ Mark Attendance</button>
        </div>
      </div>
    `;
  }

  $("#pageContent").innerHTML = `
    <div class="welcome">
      <div>
        <div class="eyebrow">${esc(businessTypeForWorkspace())} WORKSPACE</div>
        <h1>${esc(module.title)}</h1>
        <p>${esc(module.crumb)}</p>
      </div>
    </div>
    ${extra}
    ${pageToolbar(name)}
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">${esc(module.title)} Register</div>
          <div class="panel-sub">${rows.length} record${rows.length === 1 ? "" : "s"}</div>
        </div>
      </div>
      ${tableFor(name, rows)}
    </section>
  `;
}

function renderReports() {
  const transactions = currentRecords("transactions");
  const income = sumField(transactions.filter(row => row.type === "Income"), "amount");
  const expenses = sumField(transactions.filter(row => row.type === "Expense"), "amount");
  const profit = income - expenses;
  const attendance = currentRecords("attendance");
  const students = currentRecords("students");
  const tasks = currentRecords("tasks");

  $("#pageContent").innerHTML = `
    <div class="welcome">
      <div>
        <div class="eyebrow">ANALYTICS</div>
        <h1>Reports & Data</h1>
        <p>Summary of records stored in the selected workspace.</p>
      </div>
    </div>

    <div class="grid stats">
      ${statCard("Total Income", money(income), "↗", "#39d6a2", "All recorded income")}
      ${statCard("Total Expenses", money(expenses), "↘", "#ff6b82", "All recorded expenses")}
      ${statCard("Net Difference", money(profit), "∑", "#5794ff", "Income minus expenses")}
      ${statCard("Records", Object.keys(modules).reduce((total, key) => total + currentRecords(key).length, 0), "▦", "#a47aff", "Across enabled modules")}
    </div>

    <div class="grid two-col">
      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Financial Summary</div>
            <div class="panel-sub">Based on transactions you have recorded</div>
          </div>
        </div>
        <div class="list">
          <div class="list-row"><span class="muted">Income</span><strong class="positive">${money(income)}</strong></div>
          <div class="list-row"><span class="muted">Expenses</span><strong class="negative">${money(expenses)}</strong></div>
          <div class="list-row"><span class="muted">Net difference</span><strong>${money(profit)}</strong></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Education Summary</div>
            <div class="panel-sub">Student, task and attendance totals</div>
          </div>
        </div>
        <div class="list">
          <div class="list-row"><span class="muted">Students</span><strong>${students.length}</strong></div>
          <div class="list-row"><span class="muted">Attendance entries</span><strong>${attendance.length}</strong></div>
          <div class="list-row"><span class="muted">Pending tasks</span><strong>${tasks.filter(row => row.status !== "Completed").length}</strong></div>
        </div>
      </section>
    </div>

    <section class="panel" style="margin-top:18px">
      <div class="panel-head">
        <div>
          <div class="panel-title">Export your data</div>
          <div class="panel-sub">Download CSV records from an individual module.</div>
        </div>
      </div>
      <div class="grid section-grid">
        ${Object.keys(modules).map(name => `
          <div class="feature-card">
            <div class="stat-icon">${modules[name].icon || "▦"}</div>
            <h3>${esc(modules[name].title)}</h3>
            <p>${currentRecords(name).length} records</p>
            <button class="btn" style="margin-top:12px" data-export="${name}">Export CSV</button>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderWorkspaces() {
  $("#pageContent").innerHTML = `
    <div class="welcome">
      <div>
        <div class="eyebrow">ORGANIZATION</div>
        <h1>Business Workspaces</h1>
        <p>Separate the records and theme for each business category.</p>
      </div>
      <button class="btn primary" data-add="workspaces">＋ New Workspace</button>
    </div>

    <div class="notice" style="margin-bottom:18px">
      Each workspace separates its module records in this account. A workspace is not a separate staff account or a permission boundary.
    </div>

    <div class="grid section-grid">
      ${state.workspaces.map(workspace => `
        <div class="panel">
          <div class="stat-icon">◈</div>
          <h3 style="font-family:Manrope">${esc(workspace.name)}</h3>
          <p class="muted small">${esc(BUSINESS_TYPES[workspace.businessType]?.label || "General Business")}</p>
          <p class="muted small">${esc(workspace.description || "Business workspace")}</p>
          <button class="btn ${state.workspaceId === workspace.id ? "primary" : ""}" data-switch-workspace="${esc(workspace.id)}">
            ${state.workspaceId === workspace.id ? "Current Workspace" : "Open Workspace"}
          </button>
          ${workspace.id !== "default" ? `<button class="btn" style="margin-left:6px" data-edit="workspaces:${esc(workspace.id)}">Edit</button>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderSettings() {
  const profile = state.profile || {};

  $("#pageContent").innerHTML = `
    <div class="welcome">
      <div>
        <div class="eyebrow">PREFERENCES</div>
        <h1>Business Settings</h1>
        <p>Update the display settings for your business workspace.</p>
      </div>
    </div>

    <section class="panel">
      <form id="settingsForm">
        <div class="form-grid">
          <div class="field">
            <label>BUSINESS NAME</label>
            <input name="businessName" required maxlength="100" value="${esc(profile.businessName || "")}">
          </div>
          <div class="field">
            <label>BUSINESS CATEGORY</label>
            <select name="defaultBusinessType">
              ${Object.entries(BUSINESS_TYPES).map(([key, value]) => `
                <option value="${key}" ${key === (profile.defaultBusinessType || "general") ? "selected" : ""}>
                  ${esc(value.label)}
                </option>
              `).join("")}
            </select>
          </div>
          <div class="field">
            <label>CURRENCY</label>
            <select name="currency">
              ${["PKR", "USD", "GBP", "EUR", "AED", "SAR", "INR", "BDT", "CAD", "AUD"].map(currency => `
                <option value="${currency}" ${currency === (profile.currency || "PKR") ? "selected" : ""}>${currency}</option>
              `).join("")}
            </select>
          </div>
          <div class="field">
            <label>TAX RATE (%)</label>
            <input name="taxRate" type="number" min="0" max="100" step="0.01" value="${Number(profile.taxRate) || 0}">
          </div>
        </div>
        <button class="btn primary" type="submit">Save Settings</button>
      </form>
      <div class="notice" style="margin-top:20px">
        Signed in as <strong>${esc(state.user?.email || "")}</strong>. Plan: <strong>${esc(profile.plan || "free")}</strong>.
        Account roles and subscription upgrades must be managed securely through a trusted backend.
      </div>
    </section>
  `;
}

function renderPage() {
  if (!state.user) return;

  if (state.page === "dashboard") return renderDashboard();
  if (state.page === "reports") return renderReports();
  if (state.page === "workspaces") return renderWorkspaces();
  if (state.page === "settings") return renderSettings();

  if (modules[state.page]) return renderModulePage(state.page);

  state.page = "dashboard";
  renderDashboard();
}

/* ---------------- FORMS, SAVE & DELETE ---------------- */

function fieldMarkup(field, value = "") {
  const [key, label, type, required, options] = field;
  const safeValue = value ?? "";
  const requiredAttr = required ? "required" : "";

  if (type === "select") {
    return `
      <div class="field">
        <label>${esc(label.toUpperCase())}</label>
        <select name="${esc(key)}" ${requiredAttr}>
          <option value="">Choose…</option>
          ${(options || []).map(option => `
            <option value="${esc(option)}" ${String(safeValue) === option ? "selected" : ""}>
              ${esc(option)}
            </option>
          `).join("")}
        </select>
      </div>
    `;
  }

  if (type === "textarea") {
    return `
      <div class="field span-2">
        <label>${esc(label.toUpperCase())}</label>
        <textarea name="${esc(key)}" ${requiredAttr}>${esc(safeValue)}</textarea>
      </div>
    `;
  }

  return `
    <div class="field">
      <label>${esc(label.toUpperCase())}</label>
      <input name="${esc(key)}"
        type="${esc(type)}"
        value="${esc(safeValue)}"
        ${requiredAttr}
        ${type === "number" ? 'min="0" step="any"' : ""}
        ${key === "date" && !safeValue && state.page === "attendance" ? `value="${isoToday()}"` : ""}>
    </div>
  `;
}

function closeModal() {
  $("#modalRoot").innerHTML = "";
}

function openModal(name, record = null) {
  const isWorkspace = name === "workspaces";
  const module = modules[name];

  if (!isWorkspace && !module) {
    notify("This module is not available.", true);
    return;
  }

  const fields = isWorkspace
    ? [
        ["name", "Workspace Name", "text", true],
        ["businessType", "Business Category", "select", true, Object.entries(BUSINESS_TYPES).map(([key, item]) => key)],
        ["description", "Description", "textarea", false]
      ]
    : module.fields;

  const data = record || {};
  const title = record ? `Edit ${isWorkspace ? "Workspace" : module.title}` : `Add ${isWorkspace ? "Workspace" : module.title}`;

  $("#modalRoot").innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" type="button" id="modalClose">✕</button>
        </div>
        <form id="recordForm">
          <div class="modal-body">
            <div class="form-grid">
              ${fields.map(field => {
                if (isWorkspace && field[0] === "businessType") {
                  const options = Object.entries(BUSINESS_TYPES).map(([key, item]) => [key, item.label]);
                  return `
                    <div class="field">
                      <label>BUSINESS CATEGORY</label>
                      <select name="businessType" required>
                        ${options.map(([key, label]) => `
                          <option value="${esc(key)}" ${data.businessType === key ? "selected" : ""}>
                            ${esc(label)}
                          </option>
                        `).join("")}
                      </select>
                    </div>
                  `;
                }

                let value = data[field[0]] ?? "";

                if (field[0] === "date" && name === "attendance" && !value) {
                  value = isoToday();
                }

                if (field[0] === "assignedDate" && !value) {
                  value = isoToday();
                }

                if (field[0] === "markedBy" && !value) {
                  value = state.profile?.name || "";
                }

                if (field[0] === "assignedBy" && !value) {
                  value = state.user?.email || "";
                }

                if (field[0] === "status" && !value) {
                  if (name === "attendance") value = "Present";
                  else if (name === "tasks") value = "Pending";
                  else if (name === "staff") value = "Invited";
                  else if (name === "inventory") value = "";
                }

                if (field[0] === "type" && !value && name === "transactions") {
                  value = "Income";
                }

                if (field[0] === "type" && !value && name === "projects") {
                  value = "Task";
                }

                if (field[0] === "priority" && !value) {
                  value = "Medium";
                }

                return fieldMarkup(field, value);
              }).join("")}
            </div>
            ${name === "tasks" ? `
              <div class="notice">
                The email is stored with this task, but this frontend does not send an invitation or share the task with another account.
              </div>
            ` : ""}
          </div>
          <div class="modal-foot">
            <button class="btn" type="button" id="modalCancel">Cancel</button>
            <button class="btn primary" type="submit" id="modalSave">Save Record</button>
          </div>
        </form>
      </section>
    </div>
  `;

  $("#modalClose").addEventListener("click", closeModal);
  $("#modalCancel").addEventListener("click", closeModal);

  $("#modalBackdrop").addEventListener("click", event => {
    if (event.target.id === "modalBackdrop") closeModal();
  });

  $("#recordForm").addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const saveButton = $("#modalSave");
    if (!form.reportValidity()) return;

    saveButton.disabled = true;
    saveButton.textContent = "Saving…";

    try {
      const formData = new FormData(form);
      const payload = {};

      for (const [key, value] of formData.entries()) {
        payload[key] = typeof value === "string" ? value.trim() : value;
      }

      for (const field of fields) {
        if (field[2] === "number" && payload[field[0]] !== "") {
          payload[field[0]] = Number(payload[field[0]]);
        }
      }

      if (isWorkspace) {
        await saveWorkspace(payload, record);
      } else {
        await saveRecord(name, payload, record);
      }

      closeModal();
      await loadAll();
      renderPage();
      notify("Record saved successfully.");
    } catch (error) {
      console.error(error);
      notify(friendlyError(error), true);
      saveButton.disabled = false;
      saveButton.textContent = "Save Record";
    }
  });
}

async function saveRecord(name, payload, existing) {
  if (!modules[name]) throw Error("Invalid module.");

  if (name === "attendance") {
    const all = await getRecords("attendance", true);

    const duplicate = all.find(row =>
      row.id !== existing?.id &&
      belongsHere(row) &&
      String(row.studentName || "").trim().toLowerCase() ===
        String(payload.studentName || "").trim().toLowerCase() &&
      row.date === payload.date
    );

    if (duplicate) {
      throw Error("Attendance is already recorded for this student on this date. Edit the existing record instead.");
    }
  }

  if (name === "inventory") {
    if (payload.quantity < 0) throw Error("Stock quantity cannot be negative.");
    if (payload.cost < 0 || payload.price < 0) throw Error("Prices cannot be negative.");
  }

  if (name === "transactions" && payload.amount < 0) {
    throw Error("Amount cannot be negative. Choose Income or Expense as the transaction type.");
  }

  if (name === "tasks" && payload.assigneeEmail) {
    payload.assigneeEmail = payload.assigneeEmail.toLowerCase();
  }

  payload.workspaceId = state.workspaceId;
  payload.updatedAt = serverTimestamp();

  if (existing) {
    await updateDoc(
      doc(db, "users", state.user.uid, modules[name].collection, existing.id),
      payload
    );
  } else {
    payload.createdAt = serverTimestamp();
    await addDoc(activeCollection(modules[name].collection), payload);
  }
}

async function saveWorkspace(payload, existing) {
  const validType = BUSINESS_TYPES[payload.businessType]
    ? payload.businessType
    : "general";

  const workspace = {
    name: payload.name,
    description: payload.description || "",
    businessType: validType,
    updatedAt: serverTimestamp()
  };

  if (existing) {
    if (existing.id === "default") {
      throw Error("The primary workspace is managed through Business Settings.");
    }

    await updateDoc(
      doc(db, "users", state.user.uid, "workspaces", existing.id),
      workspace
    );
  } else {
    workspace.createdAt = serverTimestamp();
    const reference = await addDoc(activeCollection("workspaces"), workspace);
    state.workspaceId = reference.id;
  }
}

async function removeRecord(name, id) {
  const isWorkspace = name === "workspaces";

  if (!confirm("Are you sure you want to delete this record? This cannot be undone.")) {
    return;
  }

  try {
    if (isWorkspace) {
      if (id === "default") throw Error("The primary workspace cannot be deleted.");

      await deleteDoc(doc(db, "users", state.user.uid, "workspaces", id));

      if (state.workspaceId === id) state.workspaceId = "default";
    } else {
      const module = modules[name];
      if (!module) throw Error("Invalid module.");

      await deleteDoc(doc(db, "users", state.user.uid, module.collection, id));
    }

    await loadAll();
    renderPage();
    notify("Record deleted.");
  } catch (error) {
    console.error(error);
    notify(friendlyError(error), true);
  }
}

/* ---------------- CSV EXPORT ---------------- */

function exportCSV(name) {
  const rows = name === "workspaces"
    ? state.workspaces
    : currentRecords(name);

  if (!rows || !rows.length) {
    notify("There are no records to export.", true);
    return;
  }

  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const escapeCSV = value => {
    if (value?.toDate) value = value.toDate().toISOString();
    if (value && typeof value === "object") value = JSON.stringify(value);

    const string = String(value ?? "");
    return `"${string.replace(/"/g, '""')}"`;
  };

  const csv = [
    columns.map(escapeCSV).join(","),
    ...rows.map(row => columns.map(key => escapeCSV(row[key])).join(","))
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `nexora-${slug(name)}-${isoToday()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  notify("CSV export created.");
}

/* ---------------- SETTINGS SAVE ---------------- */

async function saveSettings(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const businessName = String(data.get("businessName") || "").trim();
  const defaultBusinessType = String(data.get("defaultBusinessType") || "general");
  const currency = String(data.get("currency") || "PKR");
  const taxRate = Number(data.get("taxRate") || 0);

  if (!businessName) {
    notify("Business name is required.", true);
    return;
  }

  if (!BUSINESS_TYPES[defaultBusinessType]) {
    notify("Please choose a valid business category.", true);
    return;
  }

  if (taxRate < 0 || taxRate > 100) {
    notify("Tax rate must be between 0 and 100.", true);
    return;
  }

  try {
    await updateDoc(userDoc(), {
      businessName,
      defaultBusinessType,
      currency,
      taxRate,
      updatedAt: serverTimestamp()
    });

    state.profile = {
      ...state.profile,
      businessName,
      defaultBusinessType,
      currency,
      taxRate
    };

    state.settings = {
      businessName,
      currency,
      taxRate,
      dateFormat: state.profile.dateFormat || "local"
    };

    await loadAll();
    applyBusinessTheme();
    renderWorkspaceSelect();
    notify("Business settings updated.");
  } catch (error) {
    console.error(error);
    notify(friendlyError(error), true);
  }
}

/* ---------------- AUTHENTICATED APP ---------------- */

async function showApp(user) {
  state.user = user;

  $("#authView").classList.add("hidden");
  $("#appView").classList.remove("hidden");

  $("#userName").textContent = user.displayName || user.email?.split("@")[0] || "NEXORA User";
  $("#userEmail").textContent = user.email || "";
  $("#userAvatar").textContent = ($("#userName").textContent[0] || "N").toUpperCase();

  try {
    await ensureProfile(user);
    await loadAll();

    renderCategoryNav();
    applyBusinessTheme();
    navTo(state.page || "dashboard");
  } catch (error) {
    console.error(error);
    notify("Unable to load your workspace: " + friendlyError(error), true);
  }
}

async function signOutUser() {
  try {
    await signOut(auth);

    state.user = null;
    state.profile = null;
    state.records = {};
    state.workspaces = [];
    state.workspaceId = "default";
    state.page = "dashboard";

    $("#appView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
    $("#authForm").reset();
    setAuthMode("login");
    closeModal();
  } catch (error) {
    notify(friendlyError(error), true);
  }
}

async function resetPassword() {
  const email = $("#authEmail").value.trim();

  if (!email) {
    showAuthMessage("Enter your email address first, then select Forgot password.");
    $("#authEmail").focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showAuthMessage("If an account exists for this email, a password-reset email has been sent.");
  } catch (error) {
    showAuthMessage(friendlyError(error), true);
  }
}

/* ---------------- EVENT LISTENERS ---------------- */

$("#showLogin").addEventListener("click", () => setAuthMode("login"));
$("#showRegister").addEventListener("click", () => setAuthMode("register"));
$("#authForm").addEventListener("submit", handleAuth);
$("#forgotPassword").addEventListener("click", resetPassword);
$("#signOutBtn").addEventListener("click", signOutUser);

$("#menuToggle").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

$("#workspaceSelect").addEventListener("change", async event => {
  state.workspaceId = event.target.value;
  state.search = "";

  try {
    await loadAll();
    applyBusinessTheme();
    renderCategoryNav();
    navTo("dashboard");
  } catch (error) {
    notify(friendlyError(error), true);
  }
});

$("#globalSearch").addEventListener("input", event => {
  state.search = event.target.value;
  if (modules[state.page]) renderModulePage(state.page);
});

document.addEventListener("click", async event => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.page) {
    navTo(target.dataset.page);
    return;
  }

  if (target.dataset.add) {
    openModal(target.dataset.add);
    return;
  }

  if (target.dataset.edit) {
    const [name, ...idParts] = target.dataset.edit.split(":");
    const id = idParts.join(":");

    if (name === "workspaces") {
      const workspace = state.workspaces.find(item => item.id === id);
      if (workspace) openModal("workspaces", workspace);
      return;
    }

    const record = currentRecords(name).find(item => item.id === id);
    if (record) openModal(name, record);
    return;
  }

  if (target.dataset.delete) {
    const [name, ...idParts] = target.dataset.delete.split(":");
    await removeRecord(name, idParts.join(":"));
    return;
  }

  if (target.dataset.export) {
    exportCSV(target.dataset.export);
    return;
  }

  if (target.dataset.switchWorkspace) {
    state.workspaceId = target.dataset.switchWorkspace;

    try {
      await loadAll();
      renderWorkspaceSelect();
      applyBusinessTheme();
      navTo("dashboard");
    } catch (error) {
      notify(friendlyError(error), true);
    }
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "moduleSearch") {
    state.search = event.target.value;
    const cursor = event.target.selectionStart;
    renderModulePage(state.page);

    const next = $("#moduleSearch");
    if (next) {
      next.focus();
      next.setSelectionRange(cursor, cursor);
    }
  }
});

document.addEventListener("change", event => {
  if (event.target.id === "attendanceDateFilter") {
    renderModulePage("attendance");
  }
});

document.addEventListener("submit", event => {
  if (event.target.id === "settingsForm") {
    saveSettings(event);
  }
});

/* ---------------- INITIALIZE ---------------- */

setAuthMode("login");

onAuthStateChanged(auth, async user => {
  if (user) {
    await showApp(user);
  } else {
    state.user = null;
    state.profile = null;

    $("#appView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
  }
});
