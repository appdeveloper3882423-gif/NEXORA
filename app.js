
/* =========================================================
   NEXORA — BUSINESS MANAGEMENT PLATFORM
   Version 1.1.0
   Firebase Authentication + Firestore
   ========================================================= */

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
  doc, getDoc, setDoc, collection, addDoc, getDocs,
  updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "1.1.0";
const $ = id => document.getElementById(id);

let user = null;
let profile = {};
let workspaceId = "default";
let workspaceName = "My Business";
let page = "dashboard";
let records = {};
let noticeTimer;

const modules = {
  transactions: "Transactions",
  customers: "Customers",
  suppliers: "Suppliers",
  inventory: "Inventory",
  projects: "Projects",
  tasks: "Tasks",
  invoices: "Invoices",
  bills: "Bills",
  appointments: "Appointments",
  branches: "Branches"
};

const menu = [
  ["dashboard", "⌂", "Dashboard"],
  ["transactions", "↔", "Transactions"],
  ["customers", "♙", "Customers"],
  ["suppliers", "♧", "Suppliers"],
  ["inventory", "▦", "Inventory"],
  ["projects", "◈", "Projects"],
  ["tasks", "☷", "Tasks"],
  ["invoices", "▤", "Invoices"],
  ["bills", "▧", "Bills"],
  ["reports", "▥", "Reports"],
  ["appointments", "◷", "Appointments"],
  ["branches", "⌖", "Branches"],
  ["settings", "⚙", "Settings"]
];

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const today = () => new Date().toISOString().slice(0, 10);
const money = value => {
  const currency = profile.currency || "PKR";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency", currency, maximumFractionDigits: 2
    }).format(Number(value) || 0);
  } catch {
    return `${currency} ${(Number(value) || 0).toFixed(2)}`;
  }
};

function notify(message, type = "success") {
  let box = $("nxToast");
  if (!box) return;
  box.textContent = message;
  box.dataset.type = type;
  box.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => box.classList.remove("show"), 3500);
}

function iconText(text) {
  return `<span class="nx-icon">${text}</span>`;
}

function installUI() {
  document.body.innerHTML = `
    <div id="nxApp">
      <section id="nxAuth" class="nx-auth">
        <div class="nx-auth-art">
          <div class="nx-brand"><span class="nx-logo">N</span> NEXORA</div>
          <div class="nx-hero-copy">
            <span class="nx-eyebrow">YOUR BUSINESS. ONE PLATFORM.</span>
            <h1>Make every<br><span>move count.</span></h1>
            <p>Manage your finances, customers, inventory and work in one clear workspace.</p>
            <div class="nx-hero-pills"><span>Finance</span><span>Operations</span><span>Growth</span></div>
          </div>
          <div class="nx-orbit nx-orbit-a"></div><div class="nx-orbit nx-orbit-b"></div>
          <div class="nx-art-foot">NEXORA · BUSINESS COMMAND CENTER</div>
        </div>
        <div class="nx-auth-panel">
          <div class="nx-auth-mobile-brand"><span class="nx-logo">N</span> NEXORA</div>
          <div class="nx-auth-card">
            <span class="nx-eyebrow" id="nxAuthEyebrow">WELCOME BACK</span>
            <h2 id="nxAuthTitle">Sign in to NEXORA</h2>
            <p id="nxAuthSubtitle" class="nx-muted">Your business workspace is waiting.</p>
            <form id="nxAuthForm">
              <div id="nxNameWrap" class="nx-field nx-hidden">
                <label for="nxName">Full name</label>
                <input id="nxName" autocomplete="name" placeholder="Your name">
              </div>
              <div class="nx-field">
                <label for="nxEmail">Email address</label>
                <input id="nxEmail" type="email" autocomplete="email" required placeholder="you@company.com">
              </div>
              <div class="nx-field">
                <label for="nxPassword">Password</label>
                <input id="nxPassword" type="password" autocomplete="current-password" required minlength="6" placeholder="At least 6 characters">
              </div>
              <div id="nxAuthMessage" class="nx-auth-message" role="status"></div>
              <button id="nxAuthSubmit" class="nx-btn nx-primary nx-wide" type="submit">Sign in</button>
            </form>
            <button id="nxGoogle" class="nx-btn nx-google nx-wide" type="button">Continue with Google</button>
            <div class="nx-auth-links">
              <button id="nxForgot" class="nx-link" type="button">Forgot password?</button>
              <span id="nxSwitchText">New to NEXORA?</span>
              <button id="nxSwitch" class="nx-link" type="button">Create account</button>
            </div>
            <p class="nx-terms">By continuing, you agree to use this platform responsibly.</p>
          </div>
        </div>
      </section>

      <section id="nxWorkspace" class="nx-layout nx-hidden">
        <aside id="nxSidebar" class="nx-sidebar">
          <div class="nx-brand"><span class="nx-logo">N</span><span>NEXORA</span></div>
          <button id="nxWorkspaceButton" class="nx-workspace-switch">
            <span class="nx-workspace-avatar">B</span>
            <span class="nx-workspace-label"><b id="nxWorkspaceName">My Business</b><small>Business workspace</small></span>
            <span>⌄</span>
          </button>
          <div id="nxWorkspaceMenu" class="nx-workspace-menu nx-hidden">
            <div id="nxWorkspaceList"></div>
            <button id="nxAddWorkspace" class="nx-menu-add">＋ Create workspace</button>
          </div>
          <div class="nx-nav-label">WORKSPACE</div>
          <nav id="nxNav"></nav>
          <div class="nx-sidebar-bottom">
            <div class="nx-plan-card"><span class="nx-plan-dot"></span><div><b>Free plan</b><small>Core business tools</small></div></div>
            <button id="nxSidebarProfile" class="nx-user-button">
              <span id="nxAvatar" class="nx-avatar">U</span>
              <span class="nx-user-info"><b id="nxUserName">Account</b><small id="nxUserEmail"></small></span>
              <span>⋯</span>
            </button>
          </div>
        </aside>

        <main class="nx-main">
          <header class="nx-topbar">
            <button id="nxMobileMenu" class="nx-icon-btn" aria-label="Open navigation">☰</button>
            <div class="nx-breadcrumb"><span>Workspace</span><span>/</span><b id="nxCrumb">Dashboard</b></div>
            <div class="nx-top-actions">
              <div class="nx-search"><span>⌕</span><input id="nxSearch" placeholder="Search this workspace..." aria-label="Search workspace"><kbd>Enter</kbd></div>
              <button id="nxAlerts" class="nx-icon-btn" title="Notifications">♧</button>
              <button id="nxTopAvatar" class="nx-avatar">U</button>
            </div>
          </header>
          <div id="nxSearchResults" class="nx-search-results nx-hidden"></div>
          <section id="nxContent" class="nx-content"></section>
          <footer class="nx-footer"><span>© ${new Date().getFullYear()} NEXORA</span><span>One Platform. Every Profession.</span><span>Version ${VERSION}</span></footer>
        </main>
      </section>
      <div id="nxToast" class="nx-toast" role="status"></div>
      <div id="nxModalRoot"></div>
    </div>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
      :root{color-scheme:dark;--bg:#080b16;--panel:#101629;--panel2:#131c31;--line:#202b43;--text:#f2f5ff;--muted:#8e9ab5;--blue:#5794ff;--purple:#a47aff;--cyan:#45d6e8;--green:#49d9a0;--red:#ff718b;--radius:17px}
      *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.nx-hidden{display:none!important}#nxApp{min-height:100vh;background:radial-gradient(ellipse at 70% -15%,#18244a 0,transparent 42%),var(--bg);font-size:14px}
      .nx-auth{min-height:100vh;display:grid;grid-template-columns:1.05fr .95fr}.nx-auth-art{position:relative;overflow:hidden;padding:42px 7%;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(145deg,#101a37,#111329 65%,#1a1534)}.nx-brand{display:flex;align-items:center;gap:11px;font-family:Manrope,sans-serif;font-weight:800;font-size:18px;letter-spacing:2px;position:relative;z-index:2}.nx-logo{width:35px;height:35px;display:inline-grid;place-items:center;border-radius:12px;background:linear-gradient(135deg,var(--blue),var(--purple));color:white;font-weight:800;box-shadow:0 5px 24px #5794ff45}.nx-hero-copy{max-width:530px;position:relative;z-index:2;margin:45px 0}.nx-eyebrow{color:#8daeff;font-size:10px;font-weight:700;letter-spacing:2px}.nx-hero-copy h1{font:800 clamp(44px,5.4vw,76px)/1.08 Manrope,sans-serif;margin:20px 0}.nx-hero-copy h1 span{background:linear-gradient(90deg,#6da5ff,#b69aff,#56dce8);color:transparent;background-clip:text}.nx-hero-copy p{color:#a6b2ce;line-height:1.8;max-width:390px;font-size:15px}.nx-hero-pills{display:flex;gap:9px;margin-top:28px;flex-wrap:wrap}.nx-hero-pills span{border:1px solid #ffffff1c;padding:9px 14px;border-radius:40px;background:#ffffff08;color:#cbd6f1}.nx-art-foot{font-size:10px;color:#7786a7;letter-spacing:2px;z-index:2}.nx-orbit{position:absolute;border:1px solid #7c91ff20;border-radius:50%;width:430px;height:430px;right:-80px;top:23%;box-shadow:0 0 100px #6d74ff0a,inset 0 0 90px #6d74ff0b}.nx-orbit-b{width:280px;height:280px;right:-5px;top:33%;border-color:#63d6ff20}.nx-auth-panel{display:grid;place-items:center;padding:35px 25px}.nx-auth-card{width:min(100%,410px)}.nx-auth-card h2{font:800 30px Manrope,sans-serif;margin:13px 0 8px}.nx-muted{color:var(--muted);line-height:1.6}.nx-field{display:grid;gap:8px;margin:20px 0}.nx-field label{color:#c9d2e8;font-size:12px;font-weight:600}.nx-field input,.nx-field select,.nx-field textarea,.nx-search input{width:100%;background:#0b1020;border:1px solid #29344e;color:var(--text);padding:13px 14px;border-radius:10px;outline:none;min-width:0}.nx-field input:focus,.nx-field select:focus,.nx-field textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px #5794ff18}.nx-btn{border:1px solid var(--line);background:#18213a;color:var(--text);padding:12px 16px;border-radius:10px;font-weight:700;transition:.2s}.nx-btn:hover{filter:brightness(1.13);transform:translateY(-1px)}.nx-primary{background:linear-gradient(100deg,#387ef2,#765de8);border:0}.nx-wide{width:100%;margin-top:9px}.nx-google{background:#11182b}.nx-auth-links{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:23px;color:var(--muted);font-size:12px}.nx-link{border:0;background:none;color:#83aaff;padding:2px;font-size:12px}.nx-terms{color:#65718e;text-align:center;font-size:10px;margin-top:28px}.nx-auth-message{color:var(--red);font-size:12px;line-height:1.6}.nx-auth-mobile-brand{display:none}
      .nx-layout{display:flex;min-height:100vh}.nx-sidebar{width:248px;flex-shrink:0;border-right:1px solid #1c263b;background:#0b1020;padding:24px 15px 14px;display:flex;flex-direction:column;position:relative;z-index:10}.nx-sidebar>.nx-brand{padding:0 10px 28px}.nx-workspace-switch{width:100%;display:flex;align-items:center;gap:10px;padding:10px;background:#131c30;border:1px solid #27324a;border-radius:12px;color:var(--text);text-align:left}.nx-workspace-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#2c8df5,#8866ef);font-weight:800}.nx-workspace-label{flex:1;min-width:0}.nx-workspace-label b,.nx-workspace-label small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nx-workspace-label b{font-size:12px}.nx-workspace-label small{font-size:10px;color:var(--muted);margin-top:4px}.nx-workspace-menu{margin:6px 0 8px;padding:7px;background:#111a2d;border:1px solid var(--line);border-radius:12px}.nx-workspace-option,.nx-menu-add{width:100%;border:0;background:transparent;color:#cdd7ef;text-align:left;padding:10px;border-radius:8px;font-size:12px}.nx-workspace-option:hover,.nx-menu-add:hover{background:#202c47}.nx-workspace-option.active{color:#8eb3ff;background:#1a2a4a}.nx-nav-label{font-size:9px;letter-spacing:1.8px;color:#64718e;font-weight:700;margin:27px 11px 11px}#nxNav{display:grid;gap:4px}.nx-nav-item{border:0;background:transparent;color:#8e9ab5;display:flex;gap:12px;align-items:center;padding:11px 12px;text-align:left;border-radius:10px;font-size:12px;width:100%}.nx-nav-item:hover{background:#141e34;color:#eaf0ff}.nx-nav-item.active{background:linear-gradient(100deg,#1a2d50,#1b2240);color:#9dbdff;box-shadow:inset 2px 0 #5794ff}.nx-icon{display:inline-grid;place-items:center;width:20px;font-size:16px}.nx-sidebar-bottom{margin-top:auto;padding-top:20px}.nx-plan-card{display:flex;gap:10px;align-items:center;padding:12px;background:#111a2c;border:1px solid #222d45;border-radius:11px;margin-bottom:14px}.nx-plan-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 10px #49d9a066}.nx-plan-card b,.nx-plan-card small{display:block}.nx-plan-card b{font-size:11px}.nx-plan-card small{font-size:10px;color:var(--muted);margin-top:3px}.nx-user-button{display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;text-align:left;color:var(--text);padding:8px 3px}.nx-avatar{width:32px;height:32px;display:grid;place-items:center;border:1px solid #34435f;border-radius:50%;background:#1a2944;color:#a9c4ff;font-weight:700}.nx-user-info{flex:1;min-width:0}.nx-user-info b,.nx-user-info small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nx-user-info b{font-size:11px}.nx-user-info small{font-size:10px;color:var(--muted);margin-top:4px}
      .nx-main{min-width:0;flex:1;display:flex;flex-direction:column}.nx-topbar{height:76px;border-bottom:1px solid #1c263b;display:flex;align-items:center;justify-content:space-between;padding:0 30px;gap:15px;background:#0a0e1bd9;position:sticky;top:0;z-index:5;backdrop-filter:blur(15px)}.nx-breadcrumb{display:flex;gap:11px;align-items:center;color:#71809e;font-size:12px}.nx-breadcrumb b{color:#e4eaff;font-weight:600}.nx-top-actions{display:flex;gap:10px;align-items:center}.nx-search{display:flex;gap:8px;align-items:center;background:#10182a;border:1px solid #24304a;padding:0 10px;border-radius:10px;width:min(32vw,300px);color:#91a0bf}.nx-search input{border:0;background:transparent;padding:10px 0;font-size:11px}.nx-search kbd{font-size:9px;border:1px solid #35415a;border-radius:4px;padding:3px;color:#7584a3;white-space:nowrap}.nx-icon-btn{width:36px;height:36px;display:grid;place-items:center;border:1px solid #25314b;background:#11192b;border-radius:10px;color:#c7d3ee}.nx-content{padding:30px;flex:1;width:100%;max-width:1600px;margin:0 auto}.nx-footer{display:flex;justify-content:space-between;gap:10px;color:#5e6a86;font-size:10px;padding:16px 30px;border-top:1px solid #1b2438}.nx-page-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:25px;flex-wrap:wrap}.nx-page-head h1{font:800 27px Manrope,sans-serif;margin:0 0 8px}.nx-page-head p{color:var(--muted);margin:0;line-height:1.6;font-size:12px}.nx-head-actions{display:flex;gap:9px;flex-wrap:wrap}.nx-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin-bottom:20px}.nx-card{min-width:0;background:linear-gradient(145deg,#121a2d,#0f1526);border:1px solid #222e47;border-radius:var(--radius);padding:19px;box-shadow:0 8px 30px #0000000b}.nx-stat-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.nx-stat-label{font-size:11px;color:#9aa7c3}.nx-stat-icon{width:35px;height:35px;display:grid;place-items:center;border-radius:11px;background:#20345b;color:#8eb6ff}.nx-stat-value{font:800 25px Manrope,sans-serif;margin:17px 0 7px;overflow-wrap:anywhere}.nx-stat-note{font-size:10px;color:#7383a2}.nx-positive{color:var(--green)}.nx-negative{color:var(--red)}.nx-section-title{font:700 15px Manrope,sans-serif;margin:0}.nx-section-sub{font-size:11px;color:var(--muted);margin-top:6px}.nx-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap}.nx-two-col{display:grid;grid-template-columns:1.35fr 1fr;gap:16px;margin-bottom:18px}.nx-chart{height:220px;display:flex;align-items:flex-end;gap:9px;padding:16px 4px 0;border-bottom:1px solid #27334b}.nx-chart-col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:8px;min-width:0}.nx-chart-bar{width:min(28px,70%);min-height:3px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#8a7cff,#478df7);box-shadow:0 0 16px #5794ff1b}.nx-chart-label{font-size:9px;color:#7785a1}.nx-empty{padding:35px 15px;text-align:center;color:#8190ae;font-size:12px;line-height:1.7}.nx-empty strong{display:block;color:#d6dff4;font-size:13px;margin-bottom:7px}.nx-table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:580px}th{text-align:left;color:#7f8dac;font-size:10px;font-weight:600;padding:12px 10px;border-bottom:1px solid #273149;white-space:nowrap}td{font-size:11px;padding:14px 10px;border-bottom:1px solid #202a40;color:#d4def2;vertical-align:middle}tbody tr:hover{background:#ffffff03}.nx-status{display:inline-flex;padding:5px 8px;border-radius:30px;background:#1b2b48;color:#9abaff;font-size:9px;white-space:nowrap}.nx-status.done,.nx-status.paid,.nx-status.completed{background:#15392f;color:#67e1b0}.nx-status.overdue,.nx-status.cancelled,.nx-status.low{background:#421f31;color:#ff94aa}.nx-status.pending,.nx-status.in-progress{background:#3b3020;color:#f0c783}.nx-table-actions{display:flex;gap:6px}.nx-small-btn{padding:6px 9px;border:1px solid #2a3854;background:#151e32;border-radius:7px;color:#c3d2f3;font-size:10px}.nx-danger{color:#ff92a7}.nx-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:17px}.nx-toolbar input,.nx-toolbar select{background:#0e1526;border:1px solid #29354e;border-radius:9px;padding:10px 12px;color:#dce6fa;font-size:11px;min-width:140px}.nx-toolbar input{flex:1}.nx-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}.nx-modal-backdrop{position:fixed;inset:0;background:#030610c9;z-index:100;display:grid;place-items:center;padding:18px;backdrop-filter:blur(8px)}.nx-modal{width:min(100%,570px);max-height:90vh;overflow:auto;background:#11192b;border:1px solid #33405c;border-radius:18px;padding:24px;box-shadow:0 25px 90px #0009}.nx-modal h2{font:800 21px Manrope,sans-serif;margin:0 0 7px}.nx-modal p{color:var(--muted);font-size:12px;line-height:1.6}.nx-modal-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.nx-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:15px}.nx-toast{position:fixed;right:22px;bottom:22px;z-index:200;max-width:min(420px,calc(100vw - 35px));padding:13px 18px;border:1px solid #344663;background:#15213a;color:#dce8ff;border-radius:12px;box-shadow:0 12px 40px #0007;opacity:0;pointer-events:none;transform:translateY(10px);transition:.2s;font-size:12px}.nx-toast.show{opacity:1;transform:translateY(0)}.nx-toast[data-type=error]{border-color:#81374d;color:#ffb1bf}.nx-search-results{position:fixed;z-index:50;right:110px;top:65px;width:min(400px,calc(100vw - 30px));background:#121b2e;border:1px solid #2a3853;border-radius:13px;padding:8px;box-shadow:0 18px 55px #0008;max-height:65vh;overflow:auto}.nx-search-result{display:block;padding:11px;border-radius:8px;color:#e1eaff;text-align:left;border:0;background:transparent;width:100%;font-size:12px}.nx-search-result:hover{background:#202d48}.nx-search-result small{display:block;color:#8292b1;margin-top:4px}.nx-notification{padding:13px 0;border-bottom:1px solid #25314a;font-size:12px}.nx-notification small{display:block;color:var(--muted);margin-top:5px}.nx-mobile-menu{display:none}.nx-auth-mobile-brand{align-items:center;gap:10px;font-weight:800;letter-spacing:2px}
      @media(max-width:1100px){.nx-sidebar{width:220px}.nx-content{padding:23px}.nx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nx-two-col{grid-template-columns:1fr}.nx-search{width:220px}}
      @media(max-width:760px){.nx-auth{grid-template-columns:1fr}.nx-auth-art{display:none}.nx-auth-panel{padding:26px 20px}.nx-auth-mobile-brand{display:flex;margin-bottom:45px}.nx-auth-card h2{font-size:26px}.nx-sidebar{position:fixed;left:-270px;top:0;bottom:0;width:250px;transition:left .25s;box-shadow:none}.nx-sidebar.open{left:0;box-shadow:20px 0 70px #0008}.nx-topbar{height:65px;padding:0 14px}.nx-mobile-menu{display:grid}.nx-breadcrumb{flex:1;gap:6px;font-size:10px}.nx-search{width:36px;height:36px;justify-content:center;padding:0}.nx-search input,.nx-search kbd{display:none}.nx-top-actions{gap:6px}.nx-content{padding:20px 14px}.nx-grid{gap:10px}.nx-card{padding:14px}.nx-stat-value{font-size:21px}.nx-page-head h1{font-size:23px}.nx-footer{padding:14px;flex-wrap:wrap}.nx-form-grid{grid-template-columns:1fr}.nx-search-results{right:12px;top:60px}.nx-two-col{gap:12px}}
      @media(max-width:390px){.nx-grid{grid-template-columns:1fr 1fr}.nx-stat-value{font-size:18px}.nx-stat-label{font-size:10px}.nx-top-actions #nxAlerts{display:none}.nx-page-head h1{font-size:21px}}
    </style>
  `;

  $("nxNav").innerHTML = menu.map(([id, ico, label]) =>
    `<button class="nx-nav-item ${id === page ? "active" : ""}" data-page="${id}">${iconText(ico)}<span>${label}</span></button>`
  ).join("");

  $("nxAuthForm").addEventListener("submit", handleAuth);
  $("nxSwitch").addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));
  $("nxGoogle").addEventListener("click", googleLogin);
  $("nxForgot").addEventListener("click", resetPassword);
  $("nxNav").addEventListener("click", e => {
    const btn = e.target.closest("[data-page]");
    if (btn) go(btn.dataset.page);
  });
  $("nxMobileMenu").addEventListener("click", () => $("nxSidebar").classList.toggle("open"));
  $("nxWorkspaceButton").addEventListener("click", () => $("nxWorkspaceMenu").classList.toggle("nx-hidden"));
  $("nxAddWorkspace").addEventListener("click", createWorkspace);
  $("nxSidebarProfile").addEventListener("click", () => go("settings"));
  $("nxTopAvatar").addEventListener("click", () => go("settings"));
  $("nxAlerts").addEventListener("click", () => go("notifications"));
  $("nxSearch").addEventListener("input", runSearch);
  $("nxSearch").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const first = $("nxSearchResults").querySelector("[data-result-page]");
      if (first) go(first.dataset.resultPage);
    }
    if (e.key === "Escape") $("nxSearchResults").classList.add("nx-hidden");
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".nx-workspace-switch") && !e.target.closest(".nx-workspace-menu")) {
      $("nxWorkspaceMenu").classList.add("nx-hidden");
    }
    if (!e.target.closest(".nx-search") && !e.target.closest(".nx-search-results")) {
      $("nxSearchResults").classList.add("nx-hidden");
    }
  });
  $("nxModalRoot").addEventListener("click", e => {
    if (e.target.classList.contains("nx-modal-backdrop") || e.target.closest("[data-close-modal]")) closeModal();
  });
}

let authMode = "login";

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  $("nxAuthTitle").textContent = registering ? "Create your account" : "Sign in to NEXORA";
  $("nxAuthEyebrow").textContent = registering ? "GET STARTED TODAY" : "WELCOME BACK";
  $("nxAuthSubtitle").textContent = registering ? "Create your personal business workspace." : "Your business workspace is waiting.";
  $("nxNameWrap").classList.toggle("nx-hidden", !registering);
  $("nxName").required = registering;
  $("nxAuthSubmit").textContent = registering ? "Create account" : "Sign in";
  $("nxSwitchText").textContent = registering ? "Already have an account?" : "New to NEXORA?";
  $("nxSwitch").textContent = registering ? "Sign in" : "Create account";
  $("nxForgot").classList.toggle("nx-hidden", registering);
  $("nxAuthMessage").textContent = "";
}

function authError(error) {
  const map = {
    "auth/email-already-in-use": "This email already has an account. Please sign in.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account found for this email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your internet connection."
  };
  return map[error.code] || error.message || "Something went wrong. Please try again.";
}

async function handleAuth(event) {
  event.preventDefault();
  const email = $("nxEmail").value.trim();
  const password = $("nxPassword").value;
  const name = $("nxName").value.trim();
  const button = $("nxAuthSubmit");
  button.disabled = true;
  $("nxAuthMessage").textContent = "Please wait…";

  try {
    if (authMode === "register") {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(result.user, { displayName: name });
      await ensureUserProfile(result.user, name);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    $("nxAuthMessage").textContent = authError(error);
  } finally {
    button.disabled = false;
  }
}

async function googleLogin() {
  $("nxAuthMessage").textContent = "Opening Google sign-in…";
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(result.user, result.user.displayName || "");
  } catch (error) {
    $("nxAuthMessage").textContent = authError(error);
  }
}

async function resetPassword() {
  const email = $("nxEmail").value.trim();
  if (!email) {
    $("nxAuthMessage").textContent = "Enter your email address first.";
    $("nxEmail").focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    $("nxAuthMessage").textContent = "Password reset email sent. Check your inbox.";
  } catch (error) {
    $("nxAuthMessage").textContent = authError(error);
  }
}

async function ensureUserProfile(firebaseUser, displayName = "") {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: firebaseUser.uid,
      name: displayName || firebaseUser.email?.split("@")[0] || "User",
      email: firebaseUser.email || "",
      role: "user",
      plan: "free",
      businessName: "",
      profession: "General Business",
      currency: "PKR",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

function userCollection(name) {
  return collection(db, "users", user.uid, name);
}

function recordBelongsHere(record) {
  return (record.workspaceId || "default") === workspaceId;
}

async function getRecords(name) {
  const snapshot = await getDocs(userCollection(name));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(recordBelongsHere);
}

async function saveRecord(name, data, id = null) {
  const payload = {
    ...data,
    workspaceId,
    updatedAt: serverTimestamp()
  };
  if (id) {
    await updateDoc(doc(db, "users", user.uid, name, id), payload);
    return id;
  }
  payload.createdAt = serverTimestamp();
  const ref = await addDoc(userCollection(name), payload);
  return ref.id;
}

async function removeRecord(name, id) {
  await deleteDoc(doc(db, "users", user.uid, name, id));
}

async function loadWorkspaceList() {
  const list = await getRecords("workspaces");
  if (!list.some(w => w.id === "default")) {
    list.unshift({ id: "default", name: profile.businessName || "My Business" });
  }
  const saved = list.find(w => w.id === workspaceId);
  workspaceName = saved?.name || "My Business";
  $("nxWorkspaceName").textContent = workspaceName;
  $("nxWorkspaceList").innerHTML = list.map(w => `
    <button class="nx-workspace-option ${w.id === workspaceId ? "active" : ""}" data-workspace="${esc(w.id)}">
      ${esc(w.name || "My Business")} ${w.id === workspaceId ? "✓" : ""}
    </button>`).join("");

  $("nxWorkspaceList").onclick = async e => {
    const btn = e.target.closest("[data-workspace]");
    if (!btn) return;
    workspaceId = btn.dataset.workspace;
    workspaceName = list.find(w => w.id === workspaceId)?.name || "My Business";
    $("nxWorkspaceMenu").classList.add("nx-hidden");
    await loadRecords();
    render();
    await loadWorkspaceList();
  };
}

async function createWorkspace() {
  const name = prompt("Enter a name for the new workspace:");
  if (!name?.trim()) return;
  try {
    const ref = await addDoc(userCollection("workspaces"), {
      name: name.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    workspaceId = ref.id;
    workspaceName = name.trim();
    await loadRecords();
    await loadWorkspaceList();
    render();
    notify("Workspace created.");
  } catch (error) {
    notify(authError(error), "error");
  }
}

async function loadRecords() {
  const names = [...Object.keys(modules), "workspaces", "categories", "notifications"];
  const results = await Promise.all(names.map(async name => {
    try { return [name, await getRecords(name)]; }
    catch (error) { console.error("Load failed:", name, error); return [name, []]; }
  }));
  records = Object.fromEntries(results);
}

async function loadAccount(firebaseUser) {
  user = firebaseUser;
  await ensureUserProfile(user, user.displayName || "");
  const snap = await getDoc(doc(db, "users", user.uid));
  profile = snap.exists() ? snap.data() : {};
  if (!profile.name && user.displayName) profile.name = user.displayName;

  workspaceId = "default";
  workspaceName = profile.businessName || "My Business";
  $("nxAuth").classList.add("nx-hidden");
  $("nxWorkspace").classList.remove("nx-hidden");
  $("nxUserName").textContent = profile.name || user.displayName || "Account";
  $("nxUserEmail").textContent = user.email || "";
  $("nxAvatar").textContent = ($("nxUserName").textContent[0] || "U").toUpperCase();
  $("nxTopAvatar").textContent = $("nxAvatar").textContent;
  $("nxWorkspaceName").textContent = workspaceName;
  await loadRecords();
  await loadWorkspaceList();
  render();
}

function go(nextPage) {
  page = nextPage;
  $("nxSidebar").classList.remove("open");
  $("nxSearchResults").classList.add("nx-hidden");
  render();
  document.querySelectorAll(".nx-nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
}

function pageHead(title, subtitle, action = "") {
  return `<div class="nx-page-head"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="nx-head-actions">${action}</div></div>`;
}

function button(label, action, style = "") {
  return `<button class="nx-btn ${style}" data-action="${esc(action)}">${label}</button>`;
}

function stat(label, value, ico, note = "") {
  return `<article class="nx-card"><div class="nx-stat-top"><span class="nx-stat-label">${esc(label)}</span><span class="nx-stat-icon">${ico}</span></div><div class="nx-stat-value">${value}</div><div class="nx-stat-note">${note}</div></article>`;
}

function getNum(item, ...keys) {
  for (const key of keys) if (item[key] != null && item[key] !== "") return Number(item[key]) || 0;
  return 0;
}

function txTotals() {
  const tx = records.transactions || [];
  const income = tx.filter(x => x.type === "income").reduce((s, x) => s + getNum(x, "amount"), 0);
  const expense = tx.filter(x => x.type === "expense").reduce((s, x) => s + getNum(x, "amount"), 0);
  return { income, expense, profit: income - expense };
}

function statusPill(status = "pending") {
  const normalized = String(status).toLowerCase().replace(/_/g, "-");
  return `<span class="nx-status ${esc(normalized)}">${esc(status.replace(/_/g, " "))}</span>`;
}

function emptyState(title, message) {
  return `<div class="nx-empty"><strong>${esc(title)}</strong>${esc(message)}</div>`;
}

function table(headers, rows) {
  if (!rows.length) return emptyState("Nothing here yet", "Create your first record to start building your workspace.");
  return `<div class="nx-table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function chartCard() {
  const tx = records.transactions || [];
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: date.toLocaleString("en", { month: "short" }), income: 0, expense: 0 });
  }
  tx.forEach(t => {
    const key = String(t.date || t.createdAt?.toDate?.().toISOString?.() || "").slice(0, 7);
    const m = months.find(x => x.key === key);
    if (m) m[t.type === "expense" ? "expense" : "income"] += getNum(t, "amount");
  });
  const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
  return `<article class="nx-card"><div class="nx-card-head"><div><h3 class="nx-section-title">Cash flow overview</h3><div class="nx-section-sub">Income and expenses · last 6 months</div></div><span class="nx-status">Live data</span></div>
    <div class="nx-chart">${months.map(m => `<div class="nx-chart-col" title="${esc(m.label)}: ${esc(money(m.income))} income / ${esc(money(m.expense))} expenses">
      <div style="display:flex;align-items:flex-end;gap:3px;height:100%;width:100%;justify-content:center">
        <div class="nx-chart-bar" style="height:${Math.max(2, m.income / max * 100)}%;background:linear-gradient(#54d9bc,#248d9b)"></div>
        <div class="nx-chart-bar" style="height:${Math.max(2, m.expense / max * 100)}%;background:linear-gradient(#b18cff,#6753d9)"></div>
      </div><span class="nx-chart-label">${esc(m.label)}</span></div>`).join("")}</div>
    <div class="nx-section-sub" style="margin-top:13px">● Income &nbsp; <span style="color:#b18cff">● Expenses</span></div>
  </article>`;
}

function dashboardPage() {
  const totals = txTotals();
  const customers = records.customers || [];
  const projects = records.projects || [];
  const inventory = records.inventory || [];
  const low = inventory.filter(x => getNum(x, "quantity", "stock") <= getNum(x, "minStock") && getNum(x, "minStock") > 0);
  const recent = [...(records.transactions || [])].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);
  const recentRows = recent.map(t => `<tr><td>${esc(t.description || t.title || "Transaction")}</td><td>${esc(t.date || "—")}</td><td>${statusPill(t.type || "income")}</td><td class="${t.type === "expense" ? "nx-negative" : "nx-positive"}">${t.type === "expense" ? "−" : "+"}${esc(money(t.amount))}</td></tr>`);
  const greetings = profile.name ? `Welcome back, ${profile.name}. Here's what's happening with your business.` : "Here's what's happening with your business today.";
  return `${pageHead("Business overview", greetings, button("＋ Add transaction", "new:transactions", "nx-primary"))}
    <div class="nx-grid">
      ${stat("Total income", money(totals.income), "↗", "Recorded income")}
      ${stat("Total expenses", money(totals.expense), "↘", "Recorded expenses")}
      ${stat("Net balance", money(totals.profit), "◈", totals.profit >= 0 ? '<span class="nx-positive">Positive balance</span>' : '<span class="nx-negative">Expenses exceed income</span>')}
      ${stat("Customers", customers.length, "♙", `${projects.length} projects · ${inventory.length} inventory items`)}
    </div>
    <div class="nx-two-col">${chartCard()}
      <article class="nx-card"><div class="nx-card-head"><div><h3 class="nx-section-title">Quick actions</h3><div class="nx-section-sub">Shortcuts to common tasks</div></div></div>
        <div class="nx-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:0;gap:9px">
          <button class="nx-btn" data-action="new:transactions">＋ Transaction</button>
          <button class="nx-btn" data-action="new:customers">＋ Customer</button>
          <button class="nx-btn" data-action="new:inventory">＋ Inventory item</button>
          <button class="nx-btn" data-action="new:tasks">＋ Task</button>
          <button class="nx-btn" data-action="new:invoices">＋ Invoice</button>
          <button class="nx-btn" data-page="reports">▥ View reports</button>
        </div>
        <div style="margin-top:18px;padding:14px;border-radius:12px;background:#101d30;border:1px solid #24334b"><div class="nx-stat-label">Inventory attention</div><div style="font:700 20px Manrope;margin-top:8px">${low.length} low-stock item${low.length === 1 ? "" : "s"}</div><div class="nx-section-sub">Based on the minimum stock levels you set.</div></div>
      </article>
    </div>
    <article class="nx-card"><div class="nx-card-head"><div><h3 class="nx-section-title">Recent transactions</h3><div class="nx-section-sub">Latest financial activity</div></div>${button("View all", "page:transactions")}</div>
      ${table(["Description","Date","Type","Amount"], recentRows)}
    </article>`;
}

const fields = {
  transactions: [
    ["description", "Description", "text", true],
    ["type", "Type", "select", true, ["income", "expense"]],
    ["amount", "Amount", "number", true],
    ["date", "Date", "date", true],
    ["category", "Category", "text", false],
    ["reference", "Reference / note", "text", false]
  ],
  customers: [
    ["name", "Customer name", "text", true],
    ["email", "Email", "email", false],
    ["phone", "Phone", "tel", false],
    ["company", "Company", "text", false],
    ["address", "Address", "text", false],
    ["notes", "Notes", "textarea", false]
  ],
  suppliers: [
    ["name", "Supplier name", "text", true],
    ["email", "Email", "email", false],
    ["phone", "Phone", "tel", false],
    ["company", "Company", "text", false],
    ["address", "Address", "text", false]
  ],
  inventory: [
    ["name", "Item name", "text", true],
    ["sku", "SKU / barcode", "text", false],
    ["category", "Category", "text", false],
    ["quantity", "Quantity in stock", "number", true],
    ["minStock", "Minimum stock alert", "number", false],
    ["cost", "Unit cost", "number", false],
    ["price", "Selling price", "number", false],
    ["expiry", "Expiry date", "date", false]
  ],
  projects: [
    ["name", "Project name", "text", true],
    ["client", "Client", "text", false],
    ["deadline", "Deadline", "date", false],
    ["budget", "Budget", "number", false],
    ["status", "Status", "select", true, ["planned", "in_progress", "completed", "on_hold"]],
    ["description", "Description", "textarea", false]
  ],
  tasks: [
    ["title", "Task title", "text", true],
    ["assignedTo", "Assigned to", "text", false],
    ["dueDate", "Due date", "date", false],
    ["priority", "Priority", "select", true, ["low", "medium", "high"]],
    ["status", "Status", "select", true, ["pending", "in_progress", "completed"]],
    ["description", "Description", "textarea", false]
  ],
  invoices: [
    ["invoiceNo", "Invoice number", "text", true],
    ["customer", "Customer", "text", true],
    ["date", "Invoice date", "date", true],
    ["dueDate", "Due date", "date", false],
    ["amount", "Total amount", "number", true],
    ["status", "Status", "select", true, ["draft", "sent", "paid", "overdue", "cancelled"]],
    ["notes", "Notes", "textarea", false]
  ],
  bills: [
    ["billNo", "Bill number", "text", true],
    ["supplier", "Supplier", "text", true],
    ["date", "Bill date", "date", true],
    ["dueDate", "Due date", "date", false],
    ["amount", "Total amount", "number", true],
    ["status", "Status", "select", true, ["unpaid", "paid", "overdue"]],
    ["notes", "Notes", "textarea", false]
  ],
  appointments: [
    ["title", "Appointment title", "text", true],
    ["contact", "Customer / contact", "text", false],
    ["date", "Date", "date", true],
    ["time", "Time", "time", false],
    ["status", "Status", "select", true, ["scheduled", "completed", "cancelled"]],
    ["notes", "Notes", "textarea", false]
  ],
  branches: [
    ["name", "Branch name", "text", true],
    ["manager", "Manager", "text", false],
    ["phone", "Phone", "tel", false],
    ["address", "Address", "text", false],
    ["status", "Status", "select", true, ["active", "inactive"]]
  ]
};

const labels = {
  transactions: ["Transactions", "Track income, expenses and your business cash flow."],
  customers: ["Customers", "Keep customer contacts and relationship details organized."],
  suppliers: ["Suppliers", "Manage supplier contact information."],
  inventory: ["Inventory", "Track quantities, prices, stock thresholds and expiry dates."],
  projects: ["Projects", "Organize project budgets, deadlines and progress."],
  tasks: ["Tasks", "Keep work, priorities and deadlines in one place."],
  invoices: ["Invoices", "Track invoice amounts, due dates and payment status."],
  bills: ["Bills & Payables", "Track supplier bills and due dates."],
  appointments: ["Appointments", "Organize appointments and follow-ups."],
  branches: ["Branches", "Maintain a directory of business branches."]
};

function fieldControl(f, value = "") {
  const [key, label, type, required, options] = f;
  const req = required ? "required" : "";
  const val = esc(value ?? "");
  if (type === "select") {
    return `<div class="nx-field"><label for="f_${key}">${esc(label)}</label><select id="f_${key}" name="${key}" ${req}>${(options || []).map(o => `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(o.replace(/_/g, " "))}</option>`).join("")}</select></div>`;
  }
  if (type === "textarea") return `<div class="nx-field"><label for="f_${key}">${esc(label)}</label><textarea id="f_${key}" name="${key}" rows="3">${val}</textarea></div>`;
  return `<div class="nx-field"><label for="f_${key}">${esc(label)}</label><input id="f_${key}" name="${key}" type="${type}" ${req} ${type === "number" ? 'step="any"' : ""} value="${val}" ${type === "date" && !value && key === "date" ? `value="${today()}"` : ""}></div>`;
}

function openModal(name, record = null) {
  const defs = fields[name];
  if (!defs) return;
  const title = record ? "Edit record" : `Add ${labels[name][0].replace(/s$/, "")}`;
  $("nxModalRoot").innerHTML = `<div class="nx-modal-backdrop"><div class="nx-modal" role="dialog" aria-modal="true">
    <div class="nx-modal-head"><div><h2>${esc(title)}</h2><p>Changes are saved to your personal Firebase account.</p></div><button class="nx-icon-btn" data-close-modal aria-label="Close">×</button></div>
    <form id="nxRecordForm"><div class="nx-form-grid">${defs.map(f => fieldControl(f, record?.[f[0]] ?? (f[0] === "date" ? today() : ""))).join("")}</div>
      <div class="nx-modal-actions"><button type="button" class="nx-btn" data-close-modal>Cancel</button><button class="nx-btn nx-primary" type="submit">Save record</button></div>
    </form></div></div>`;
  $("nxRecordForm").onsubmit = async e => {
    e.preventDefault();
    const data = {};
    for (const f of defs) {
      const el = e.currentTarget.elements.namedItem(f[0]);
      if (!el) continue;
      data[f[0]] = f[2] === "number" ? (el.value === "" ? 0 : Number(el.value)) : el.value.trim();
    }
    try {
      await saveRecord(name, data, record?.id || null);
      closeModal();
      await loadRecords();
      render();
      notify(record ? "Record updated." : "Record created.");
    } catch (error) {
      notify(authError(error), "error");
    }
  };
}

function closeModal() {
  $("nxModalRoot").innerHTML = "";
}

function renderCollection(name) {
  const [title, subtitle] = labels[name] || [name, ""];
  const action = button("＋ Add new", `new:${name}`, "nx-primary") +
    button("Export CSV", `export:${name}`);
  const list = records[name] || [];
  const rowCells = item => {
    if (name === "transactions") return `<td>${esc(item.description || "—")}</td><td>${esc(item.date || "—")}</td><td>${statusPill(item.type)}</td><td>${esc(money(item.amount))}</td>`;
    if (name === "customers" || name === "suppliers") return `<td><b>${esc(item.name || "—")}</b></td><td>${esc(item.company || "—")}</td><td>${esc(item.email || "—")}</td><td>${esc(item.phone || "—")}</td>`;
    if (name === "inventory") {
      const qty = getNum(item, "quantity", "stock");
      const low = getNum(item, "minStock") > 0 && qty <= getNum(item, "minStock");
      return `<td><b>${esc(item.name || "—")}</b><div class="nx-section-sub">${esc(item.sku || item.category || "")}</div></td><td>${qty}</td><td>${esc(money(item.cost))}</td><td>${esc(money(item.price))}</td><td>${low ? statusPill("low") : statusPill("available")}</td>`;
    }
    if (name === "projects") return `<td><b>${esc(item.name || "—")}</b></td><td>${esc(item.client || "—")}</td><td>${esc(item.deadline || "—")}</td><td>${esc(money(item.budget))}</td><td>${statusPill(item.status || "planned")}</td>`;
    if (name === "tasks") return `<td><b>${esc(item.title || "—")}</b></td><td>${esc(item.assignedTo || "—")}</td><td>${esc(item.dueDate || "—")}</td><td>${statusPill(item.priority || "medium")}</td><td>${statusPill(item.status || "pending")}</td>`;
    if (name === "invoices") return `<td><b>${esc(item.invoiceNo || "—")}</b></td><td>${esc(item.customer || "—")}</td><td>${esc(item.date || "—")}</td><td>${esc(item.dueDate || "—")}</td><td>${esc(money(item.amount))}</td><td>${statusPill(item.status || "draft")}</td>`;
    if (name === "bills") return `<td><b>${esc(item.billNo || "—")}</b></td><td>${esc(item.supplier || "—")}</td><td>${esc(item.date || "—")}</td><td>${esc(item.dueDate || "—")}</td><td>${esc(money(item.amount))}</td><td>${statusPill(item.status || "unpaid")}</td>`;
    if (name === "appointments") return `<td><b>${esc(item.title || "—")}</b></td><td>${esc(item.contact || "—")}</td><td>${esc(item.date || "—")} ${esc(item.time || "")}</td><td>${statusPill(item.status || "scheduled")}</td>`;
    return `<td><b>${esc(item.name || "—")}</b></td><td>${esc(item.manager || "—")}</td><td>${esc(item.phone || "—")}</td><td>${esc(item.address || "—")}</td><td>${statusPill(item.status || "active")}</td>`;
  };
  const cols = {
    transactions: ["Description", "Date", "Type", "Amount"],
    customers: ["Customer", "Company", "Email", "Phone"],
    suppliers: ["Supplier", "Company", "Email", "Phone"],
    inventory: ["Item", "Quantity", "Unit cost", "Selling price", "Stock status"],
    projects: ["Project", "Client", "Deadline", "Budget", "Status"],
    tasks: ["Task", "Assigned to", "Due date", "Priority", "Status"],
    invoices: ["Invoice", "Customer", "Date", "Due date", "Amount", "Status"],
    bills: ["Bill", "Supplier", "Date", "Due date", "Amount", "Status"],
    appointments: ["Appointment", "Contact", "Date & time", "Status"],
    branches: ["Branch", "Manager", "Phone", "Address", "Status"]
  }[name];
  const rows = list.map(item => `<tr>${rowCells(item)}<td><div class="nx-table-actions"><button class="nx-small-btn" data-edit="${name}" data-id="${esc(item.id)}">Edit</button><button class="nx-small-btn nx-danger" data-delete="${name}" data-id="${esc(item.id)}">Delete</button></div></td></tr>`);
  const totals = name === "transactions" ? `<div class="nx-grid" style="margin-bottom:16px">${stat("Income", money(txTotals().income), "↗")}${stat("Expenses", money(txTotals().expense), "↘")}${stat("Net balance", money(txTotals().profit), "◈")}${stat("Records", list.length, "▤")}</div>` : "";
  return `${pageHead(title, subtitle, action)}${totals}
    <div class="nx-toolbar"><input id="nxTableFilter" placeholder="Filter ${esc(title.toLowerCase())}..." aria-label="Filter records"><span class="nx-status">${list.length} record${list.length === 1 ? "" : "s"}</span></div>
    <article class="nx-card"><div id="nxCollectionTable">${table([...cols, "Actions"], rows)}</div></article>`;
}

function reportsPage() {
  const t = txTotals();
  const tx = records.transactions || [];
  const months = {};
  tx.forEach(item => {
    const key = String(item.date || "Undated").slice(0, 7);
    if (!months[key]) months[key] = { income: 0, expense: 0, count: 0 };
    months[key][item.type === "expense" ? "expense" : "income"] += getNum(item, "amount");
    months[key].count++;
  });
  const rows = Object.keys(months).sort().reverse().map(m => `<tr><td>${esc(m)}</td><td>${esc(money(months[m].income))}</td><td>${esc(money(months[m].expense))}</td><td>${esc(money(months[m].income - months[m].expense))}</td><td>${months[m].count}</td></tr>`);
  return `${pageHead("Reports & analytics", "Review your recorded financial activity and export data.", button("Export transactions", "export:transactions", "nx-primary"))}
    <div class="nx-grid">${stat("Total income", money(t.income), "↗")}${stat("Total expenses", money(t.expense), "↘")}${stat("Net result", money(t.profit), "◈")}${stat("Transactions", tx.length, "▤")}</div>
    <article class="nx-card"><div class="nx-card-head"><div><h3 class="nx-section-title">Monthly financial summary</h3><div class="nx-section-sub">Calculated from saved transactions</div></div><button class="nx-btn" data-action="import:transactions">Import CSV</button></div>
      ${table(["Month","Income","Expenses","Net","Entries"], rows)}
    </article>
    <article class="nx-card" style="margin-top:16px"><h3 class="nx-section-title">Data tools</h3><p class="nx-muted">Export records for backup or use the CSV importer to add transaction rows. Review your exported file before sharing it.</p>
      <div class="nx-head-actions">${Object.keys(modules).map(name => `<button class="nx-btn" data-action="export:${name}">Export ${esc(labels[name][0])}</button>`).join("")}</div>
    </article>`;
}

function settingsPage() {
  return `${pageHead("Business settings", "Manage your profile, business details and workspace preferences.")}
    <div class="nx-two-col">
      <article class="nx-card"><h3 class="nx-section-title">Business profile</h3><p class="nx-muted">These details are stored in your Firebase user profile.</p>
        <form id="nxProfileForm">
          <div class="nx-field"><label>Display name</label><input name="name" value="${esc(profile.name || user.displayName || "")}" required></div>
          <div class="nx-field"><label>Business name</label><input name="businessName" value="${esc(profile.businessName || "")}" placeholder="Your business"></div>
          <div class="nx-field"><label>Business type / profession</label><input name="profession" value="${esc(profile.profession || "General Business")}"></div>
          <div class="nx-field"><label>Currency</label><select name="currency">${["PKR","USD","GBP","EUR","AED","SAR","INR","CAD","AUD"].map(c => `<option ${c === (profile.currency || "PKR") ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <button class="nx-btn nx-primary" type="submit">Save settings</button>
        </form>
      </article>
      <article class="nx-card"><h3 class="nx-section-title">Account & security</h3>
        <div class="nx-notification"><b>Signed-in account</b><small>${esc(user.email || "")}</small></div>
        <div class="nx-notification"><b>Subscription</b><small>${esc(profile.plan || "free")} plan. Online billing is not connected.</small></div>
        <div class="nx-notification"><b>Data storage</b><small>Firebase Firestore · account-isolated records</small></div>
        <div class="nx-notification"><b>App version</b><small>NEXORA ${VERSION}</small></div>
        <button id="nxSignOut" class="nx-btn nx-danger" style="margin-top:15px">Sign out</button>
      </article>
    </div>
    <article class="nx-card"><h3 class="nx-section-title">Workspace data</h3><p class="nx-muted">Each workspace filters records using its workspace ID. Your older records without a workspace ID remain in the default workspace.</p>
      <div class="nx-head-actions"><button class="nx-btn" data-action="export:transactions">Export transactions</button><button class="nx-btn" data-action="export:customers">Export customers</button><button class="nx-btn" data-action="export:inventory">Export inventory</button></div>
    </article>`;
}

function notificationsPage() {
  const low = (records.inventory || []).filter(x => getNum(x, "minStock") > 0 && getNum(x, "quantity", "stock") <= getNum(x, "minStock"));
  const overdueTasks = (records.tasks || []).filter(x => x.dueDate && x.dueDate < today() && x.status !== "completed");
  const overdueInvoices = (records.invoices || []).filter(x => x.dueDate && x.dueDate < today() && x.status !== "paid");
  const items = [
    ...low.map(x => ({ title: `Low stock: ${x.name}`, note: `Remaining quantity: ${getNum(x, "quantity", "stock")}` })),
    ...overdueTasks.map(x => ({ title: `Overdue task: ${x.title}`, note: `Due date: ${x.dueDate}` })),
    ...overdueInvoices.map(x => ({ title: `Invoice overdue: ${x.invoiceNo}`, note: `Due date: ${x.dueDate}` }))
  ];
  return `${pageHead("Notifications", "Important items calculated from your saved workspace data.")}
    <article class="nx-card"><div class="nx-card-head"><h3 class="nx-section-title">Business alerts</h3><span class="nx-status ${items.length ? "pending" : "done"}">${items.length} alert${items.length === 1 ? "" : "s"}</span></div>
      ${items.length ? items.map(x => `<div class="nx-notification"><b>${esc(x.title)}</b><small>${esc(x.note)}</small></div>`).join("") : emptyState("All caught up", "No low-stock items, overdue tasks or overdue invoices were found.")}</article>`;
}

function render() {
  $("nxWorkspaceName").textContent = workspaceName;
  $("nxCrumb").textContent = menu.find(x => x[0] === page)?.[2] || (page === "notifications" ? "Notifications" : page);
  document.querySelectorAll(".nx-nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  let html = "";
  if (page === "dashboard") html = dashboardPage();
  else if (page === "reports") html = reportsPage();
  else if (page === "settings") html = settingsPage();
  else if (page === "notifications") html = notificationsPage();
  else if (modules[page]) html = renderCollection(page);
  else html = `${pageHead("Coming soon", "This module is not enabled in this version.")}<article class="nx-card">${emptyState("Not available yet", "Connect and configure the required service before using this module.")}</article>`;
  $("nxContent").innerHTML = html;
  bindPageEvents();
}

function bindPageEvents() {
  $("nxContent").onclick = async e => {
    const nav = e.target.closest("[data-page]");
    if (nav) return go(nav.dataset.page);

    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      if (action.startsWith("new:")) return openModal(action.split(":")[1]);
      if (action.startsWith("page:")) return go(action.split(":")[1]);
      if (action.startsWith("export:")) return exportCSV(action.split(":")[1]);
      if (action.startsWith("import:")) return importCSV(action.split(":")[1]);
    }

    const edit = e.target.closest("[data-edit]");
    if (edit) {
      const item = (records[edit.dataset.edit] || []).find(x => x.id === edit.dataset.id);
      if (item) openModal(edit.dataset.edit, item);
      return;
    }

    const del = e.target.closest("[data-delete]");
    if (del) {
      const { delete: unused } = del.dataset;
      if (!confirm("Delete this record permanently?")) return;
      try {
        await removeRecord(del.dataset.delete, del.dataset.id);
        await loadRecords();
        render();
        notify("Record deleted.");
      } catch (error) { notify(authError(error), "error"); }
    }
  };

  const filter = $("nxTableFilter");
  if (filter) filter.addEventListener("input", () => {
    const query = filter.value.toLowerCase();
    document.querySelectorAll("#nxCollectionTable tbody tr").forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(query) ? "" : "none";
    });
  });

  const profileForm = $("nxProfileForm");
  if (profileForm) profileForm.onsubmit = async e => {
    e.preventDefault();
    const data = new FormData(profileForm);
    const name = String(data.get("name") || "").trim();
    const businessName = String(data.get("businessName") || "").trim();
    const profession = String(data.get("profession") || "General Business").trim();
    const currency = String(data.get("currency") || "PKR");
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name,
        email: user.email || "",
        role: profile.role || "user",
        plan: profile.plan || "free",
        businessName,
        profession,
        currency,
        updatedAt: serverTimestamp()
      }, { merge: true });
      profile = { ...profile, name, businessName, profession, currency };
      $("nxUserName").textContent = name;
      $("nxAvatar").textContent = (name[0] || "U").toUpperCase();
      workspaceName = businessName || "My Business";
      await loadWorkspaceList();
      notify("Business settings saved.");
      render();
    } catch (error) {
      notify(authError(error), "error");
    }
  };

  const signout = $("nxSignOut");
  if (signout) signout.onclick = async () => {
    try { await signOut(auth); } catch (error) { notify(authError(error), "error"); }
  };
}

function csvCell(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCSV(name) {
  const list = records[name] || [];
  if (!list.length) {
    notify("There are no records to export.", "error");
    return;
  }
  const keys = [...new Set(list.flatMap(item => Object.keys(item).filter(k => !["id", "workspaceId", "createdAt", "updatedAt"].includes(k))))];
  const csv = [keys.map(csvCell).join(","), ...list.map(item => keys.map(k => csvCell(item[k])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nexora-${name}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notify("CSV export ready.");
}

function parseCSV(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (quoted && c === '"' && next === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(value); value = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += c;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

function importCSV(name) {
  if (!fields[name]) {
    notify("CSV import is currently supported for editable modules only.", "error");
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = parseCSV(await file.text());
      if (parsed.length < 2) throw new Error("The CSV file has no data rows.");
      const headers = parsed[0].map(h => h.trim().toLowerCase());
      const allowed = new Set(fields[name].map(f => f[0]));
      const mapped = headers.map(h => h.replace(/[\s/-]+/g, "").replace(/^name$/, name === "customers" || name === "suppliers" ? "name" : "name"));
      const usable = mapped.filter(h => allowed.has(h));
      if (!usable.length) throw new Error("No matching column names found. Export a sample CSV first to see supported headers.");
      if (!confirm(`Import ${parsed.length - 1} row(s) into ${labels[name][0]}?`)) return;
      let count = 0;
      for (const row of parsed.slice(1)) {
        const item = {};
        mapped.forEach((key, i) => {
          if (!allowed.has(key) || row[i] == null) return;
          const def = fields[name].find(f => f[0] === key);
          item[key] = def?.[2] === "number" ? Number(row[i]) || 0 : row[i].trim();
        });
        if (Object.keys(item).length) {
          for (const f of fields[name]) if (f[3] && (item[f[0]] == null || item[f[0]] === "")) item[f[0]] = f[2] === "number" ? 0 : "";
          await saveRecord(name, item);
          count++;
        }
      }
      await loadRecords();
      render();
      notify(`${count} row(s) imported.`);
    } catch (error) {
      notify(error.message || authError(error), "error");
    }
  };
  input.click();
}

function runSearch() {
  const q = $("nxSearch").value.trim().toLowerCase();
  const box = $("nxSearchResults");
  if (!q) {
    box.classList.add("nx-hidden");
    box.innerHTML = "";
    return;
  }
  const found = [];
  for (const [name, list] of Object.entries(records)) {
    if (!modules[name]) continue;
    for (const item of list) {
      const text = Object.values(item).filter(v => typeof v === "string" || typeof v === "number").join(" ");
      if (text.toLowerCase().includes(q)) {
        found.push({ name, item, title: item.name || item.title || item.description || item.invoiceNo || item.billNo || name });
        if (found.length >= 15) break;
      }
    }
    if (found.length >= 15) break;
  }
  box.innerHTML = found.length ? found.map(x =>
    `<button class="nx-search-result" data-result-page="${esc(x.name)}">${esc(x.title)}<small>${esc(labels[x.name]?.[0] || x.name)} · ${esc(x.item.date || x.item.status || "")}</small></button>`
  ).join("") : `<div class="nx-empty">No matching records found.</div>`;
  box.classList.remove("nx-hidden");
}

installUI();

onAuthStateChanged(auth, async firebaseUser => {
  if (!firebaseUser) {
    user = null;
    $("nxWorkspace").classList.add("nx-hidden");
    $("nxAuth").classList.remove("nx-hidden");
    return;
  }
  try {
    await loadAccount(firebaseUser);
  } catch (error) {
    console.error("NEXORA startup error:", error);
    notify("Could not load workspace data. Check Firestore rules and connection.", "error");
  }
});
