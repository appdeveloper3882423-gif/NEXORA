// NEXORA — Business Command Center
// Version 2.0.0
import { auth, db, googleProvider } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail, updateProfile, signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "2.0.0";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => new Intl.NumberFormat("en-US",{style:"currency",currency:state.settings?.currency||"USD",maximumFractionDigits:2}).format(Number(n)||0);
const dateFmt = v => { if(!v)return "—"; let d=v?.toDate?v.toDate():new Date(v); return Number.isNaN(d.getTime())?"—":d.toLocaleDateString(); };
const isoToday = () => new Date().toISOString().slice(0,10);
const esc = v => String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = v => String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const state = { user:null, profile:null, page:"dashboard", authMode:"login", records:{}, settings:{businessName:"My Business",currency:"USD",taxRate:0,dateFormat:"local"}, workspaceId:"default", workspaces:[], search:"", busy:false };
const modules = {
 transactions:{title:"Transactions",crumb:"Income, expenses and transfers",collection:"transactions",icon:"↔",fields:[
  ["description","Description","text",true],["type","Type","select",true,["Income","Expense","Transfer"]],["category","Category","text",true],["amount","Amount","number",true],["date","Date","date",true],["paymentMethod","Payment Method","select",false,["Cash","Bank Transfer","Card","Online","Other"]],["reference","Reference","text",false],["notes","Notes","textarea",false]]},
 customers:{title:"Customers & Leads",crumb:"Customer relationships and sales pipeline",collection:"customers",icon:"♙",fields:[
  ["name","Customer / Lead Name","text",true],["type","Type","select",true,["Customer","Lead"]],["email","Email","email",false],["phone","Phone","tel",false],["company","Company","text",false],["status","Status","select",true,["New","Contacted","Qualified","Proposal","Won","Lost","Active"]],["value","Potential Value","number",false],["notes","Notes","textarea",false]]},
 suppliers:{title:"Suppliers",crumb:"Supplier directory and contact records",collection:"suppliers",icon:"♧",fields:[
  ["name","Supplier Name","text",true],["company","Company","text",false],["email","Email","email",false],["phone","Phone","tel",false],["address","Address","text",false],["status","Status","select",true,["Active","Inactive"]],["notes","Notes","textarea",false]]},
 inventory:{title:"Inventory",crumb:"Products, stock levels and reorder alerts",collection:"inventory",icon:"▦",fields:[
  ["name","Product Name","text",true],["sku","SKU / Barcode","text",false],["category","Category","text",true],["quantity","Stock Quantity","number",true],["minStock","Minimum Stock","number",false],["cost","Unit Cost","number",true],["price","Selling Price","number",true],["supplier","Supplier","text",false],["expiry","Expiry Date","date",false],["notes","Notes","textarea",false]]},
 projects:{title:"Projects & Tasks",crumb:"Projects, milestones and task tracking",collection:"projects",icon:"◷",fields:[
  ["name","Project / Task Name","text",true],["type","Record Type","select",true,["Project","Task"]],["status","Status","select",true,["Not Started","In Progress","On Hold","Completed"]],["priority","Priority","select",true,["Low","Medium","High","Urgent"]],["startDate","Start Date","date",false],["dueDate","Due Date","date",false],["assignee","Assigned To","text",false],["progress","Progress (%)","number",false],["budget","Budget","number",false],["notes","Notes","textarea",false]]},
 invoices:{title:"Invoices & Quotes",crumb:"Sales documents and payment status",collection:"invoices",icon:"▤",fields:[
  ["number","Invoice / Quote Number","text",true],["type","Document Type","select",true,["Invoice","Quote","Estimate","Receipt","Credit Note"]],["customer","Customer","text",true],["issueDate","Issue Date","date",true],["dueDate","Due Date","date",false],["amount","Total Amount","number",true],["tax","Tax Amount","number",false],["status","Status","select",true,["Draft","Sent","Partially Paid","Paid","Overdue","Cancelled"]],["notes","Notes","textarea",false]]},
 bills:{title:"Bills & Purchases",crumb:"Supplier bills and outgoing payments",collection:"bills",icon:"▧",fields:[
  ["number","Bill Number","text",true],["supplier","Supplier","text",true],["date","Bill Date","date",true],["dueDate","Due Date","date",false],["amount","Amount","number",true],["status","Status","select",true,["Unpaid","Partially Paid","Paid","Overdue"]],["category","Category","text",false],["notes","Notes","textarea",false]]},
 appointments:{title:"Appointments",crumb:"Bookings, visits and reminders",collection:"appointments",icon:"▣",fields:[
  ["title","Appointment Title","text",true],["person","Customer / Person","text",false],["date","Date","date",true],["time","Time","time",false],["status","Status","select",true,["Scheduled","Confirmed","Completed","Cancelled","No Show"]],["location","Location","text",false],["notes","Notes","textarea",false]]},
 branches:{title:"Branches",crumb:"Locations, branches and warehouses",collection:"branches",icon:"⌂",fields:[
  ["name","Branch / Warehouse Name","text",true],["code","Branch Code","text",false],["manager","Manager","text",false],["phone","Phone","tel",false],["address","Address","text",false],["status","Status","select",true,["Active","Inactive"]],["notes","Notes","textarea",false]]}
};
function notify(msg,error=false){const el=document.createElement("div");el.className="toast"+(error?" error":"");el.textContent=msg;$("#toastRoot").append(el);setTimeout(()=>el.remove(),3600)}
function userCollection(name){if(!state.user)throw Error("Please sign in first.");return collection(db,"users",state.user.uid,name)}
function userDoc(){return doc(db,"users",state.user.uid)}
function activeCollection(name){return userCollection(name)}
function belongsHere(r){return (r.workspaceId||"default")===state.workspaceId}
async function getRecords(name, allWorkspaces=false){
 const snap=await getDocs(activeCollection(name));
 let rows=snap.docs.map(d=>({id:d.id,...d.data()}));
 if(name!=="workspaces"&&!allWorkspaces)rows=rows.filter(belongsHere);
 rows.sort((a,b)=>String(b.date||b.issueDate||b.createdAt?.seconds||"").localeCompare(String(a.date||a.issueDate||a.createdAt?.seconds||"")));
 state.records[name]=rows;return rows;
}
async function ensureProfile(user){
 const ref=userDoc(),snap=await getDoc(ref);
 if(!snap.exists()){
  const profile={uid:user.uid,name:user.displayName||user.email?.split("@")[0]||"NEXORA User",email:user.email||"",role:"user",plan:"free",businessName:"My Business",currency:"USD",taxRate:0,dateFormat:"local",createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  await setDoc(ref,profile);state.profile={...profile};
 }else{
  const p=snap.data();
  const patch={uid:user.uid,email:user.email||p.email||"",name:p.name||user.displayName||user.email?.split("@")[0]||"NEXORA User",role:p.role||"user",plan:p.plan||"free",businessName:p.businessName||"My Business",currency:p.currency||"USD",taxRate:Number(p.taxRate)||0,dateFormat:p.dateFormat||"local",updatedAt:serverTimestamp()};
  await setDoc(ref,patch,{merge:true});state.profile={...p,...patch};
 }
 state.settings={businessName:state.profile.businessName,currency:state.profile.currency||"USD",taxRate:Number(state.profile.taxRate)||0,dateFormat:state.profile.dateFormat||"local"};
}
async function loadAll(){
 for(const name of [...Object.keys(modules),"workspaces"])await getRecords(name,name==="workspaces");
 const ws=state.records.workspaces||[];
 state.workspaces=[{id:"default",name:"Main Workspace",description:"Your primary business workspace"},...ws.map(w=>({id:w.id,name:w.name||"Untitled Workspace",description:w.description||""})).filter(w=>w.id!=="default")];
 if(!state.workspaces.some(w=>w.id===state.workspaceId))state.workspaceId="default";
 renderWorkspaceSelect();
}
function renderWorkspaceSelect(){
 const el=$("#workspaceSelect");if(!el)return;
 el.innerHTML=state.workspaces.map(w=>`<option value="${esc(w.id)}"${w.id===state.workspaceId?" selected":""}>${esc(w.name)}</option>`).join("");
}
function setAuthMode(mode){
 state.authMode=mode;const reg=mode==="register";
 $("#authHeading").textContent=reg?"Create your NEXORA account":"Welcome back";
 $("#authDescription").textContent=reg?"Create your secure business workspace in minutes.":"Sign in to manage your business from one command center.";
 $("#nameField").classList.toggle("hidden",!reg);$("#forgotPassword").classList.toggle("hidden",reg);
 $("#authSubmit").textContent=reg?"Create Account":"Sign In";$("#showLogin").className="btn"+(!reg?" primary":"");$("#showRegister").className="btn"+(reg?" primary":"");
 $("#authMessage").classList.add("hidden");
}
function showAuthMessage(msg,error=false){const el=$("#authMessage");el.textContent=msg;el.classList.remove("hidden");el.style.background=error?"#3a1d2a":"#18243b"}
async function handleAuth(e){
 e.preventDefault();const email=$("#authEmail").value.trim(),password=$("#authPassword").value,name=$("#authName").value.trim();
 const btn=$("#authSubmit");btn.disabled=true;btn.textContent="Please wait…";
 try{
  if(state.authMode==="register"){
   if(!name)throw Error("Please enter your full name.");
   const cred=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(cred.user,{displayName:name});
  }else await signInWithEmailAndPassword(auth,email,password);
 }catch(err){showAuthMessage(friendlyError(err),true)}finally{btn.disabled=false;btn.textContent=state.authMode==="register"?"Create Account":"Sign In"}
}
function friendlyError(err){
 const code=err?.code||"";
 const map={"auth/email-already-in-use":"This email already has an account. Please sign in.","auth/invalid-email":"Please enter a valid email address.","auth/weak-password":"Use a password with at least 6 characters.","auth/invalid-credential":"Email or password is incorrect.","auth/user-not-found":"No account was found for this email.","auth/wrong-password":"Email or password is incorrect.","auth/too-many-requests":"Too many attempts. Please try again later.","permission-denied":"Firestore permission denied. Please check your Firebase rules.","unavailable":"Network unavailable. Check your internet connection."};
 return map[code]||err?.message||"Something went wrong. Please try again.";
}
const pageMeta={dashboard:["Command Center","Your business at a glance"],reports:["Reports & Data","Business performance and data tools"],workspaces:["Business Workspaces","Manage separate work areas"],settings:["Business Settings","Configure your business profile"]};
function navTo(page){
 state.page=page;$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 const meta=modules[page]? [modules[page].title,modules[page].crumb] : pageMeta[page]||[page,"NEXORA Workspace"];
 $("#topTitle").textContent=meta[0];$("#topCrumb").textContent=meta[1];$("#sidebar").classList.remove("open");renderPage();
}
function statCard(label,value,icon,color,foot="Current workspace"){
 return `<div class="stat" style="--glow:${color}"><div class="stat-top"><div class="stat-label">${esc(label)}</div><div class="stat-icon">${icon}</div></div><div class="stat-value">${esc(value)}</div><div class="stat-foot">${esc(foot)}</div></div>`;
}
function tableFor(name,rows){
 const m=modules[name];if(!m)return "";
 const cols=m.fields.filter(f=>["name","description","type","category","amount","date","status","quantity","price","customer","supplier","dueDate","priority","number","title","progress"].includes(f[0])).slice(0,5);
 if(!rows.length)return `<div class="empty">No records yet. Use <b>＋ Add New</b> to create your first record.</div>`;
 return `<div class="table-wrap"><table><thead><tr>${cols.map(f=>`<th>${esc(f[1])}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(f=>`<td>${cellValue(f[0],r[f[0]],r)}</td>`).join("")}<td><div class="table-actions"><button class="icon-btn" data-edit="${esc(name)}:${esc(r.id)}" title="Edit">✎</button><button class="icon-btn" data-delete="${esc(name)}:${esc(r.id)}" title="Delete">×</button></div></td></tr>`).join("")}</tbody></table></div>`;
}
function cellValue(key,val,row){
 if(val===undefined||val===null||val==="")return '<span class="muted">—</span>';
 if(["amount","price","cost","budget","value"].includes(key))return `<span class="${key==="amount"&&row.type==="Expense"?"negative":""}">${money(val)}</span>`;
 if(["date","dueDate","issueDate","startDate","expiry"].includes(key))return esc(dateFmt(val));
 if(key==="status")return `<span class="status ${/paid|completed|won|active|confirmed/i.test(val)?"good":/overdue|lost|cancelled|urgent/i.test(val)?"bad":/progress|sent|qualified|contacted/i.test(val)?"warn":""}">${esc(val)}</span>`;
 if(key==="quantity")return `<span class="${Number(val)<=Number(row.minStock||0)?"negative":""}">${esc(val)}</span>`;
 if(key==="progress")return `${esc(val)}%`;
 return esc(val);
}
function pageToolbar(name){
 return `<div class="page-toolbar"><div class="toolbar-left"><input class="filter" id="moduleSearch" placeholder="Filter records…" value="${esc(state.search)}"></div><div class="toolbar-right"><button class="btn" data-export="${name}">Export CSV</button><button class="btn primary" data-add="${name}">＋ Add New</button></div></div>`;
}
function dashboardPage(){
 const tx=state.records.transactions||[],inv=state.records.inventory||[],customers=state.records.customers||[],projects=state.records.projects||[],invoices=state.records.invoices||[];
 const income=tx.filter(t=>t.type==="Income").reduce((s,t)=>s+Number(t.amount||0),0),expenses=tx.filter(t=>t.type==="Expense").reduce((s,t)=>s+Number(t.amount||0),0),profit=income-expenses;
 const low=inv.filter(i=>Number(i.quantity||0)<=Number(i.minStock||0)).length;
 const openTasks=projects.filter(p=>p.status!=="Completed").length;
 const recent=[...tx].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,6);
 const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-5+i);return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,label:d.toLocaleString("en-US",{month:"short"}),income:0,expense:0}});
 tx.forEach(t=>{const key=String(t.date||"").slice(0,7),m=months.find(x=>x.key===key);if(m){if(t.type==="Income")m.income+=Number(t.amount||0);if(t.type==="Expense")m.expense+=Number(t.amount||0)}});
 const max=Math.max(1,...months.flatMap(m=>[m.income,m.expense]));
 return `<div class="welcome"><div><div class="eyebrow">BUSINESS INTELLIGENCE · V${VERSION}</div><h1>Good to see you, ${esc(state.profile?.name?.split(" ")[0]||"there")}.</h1><p>Here is what is happening across ${esc(state.settings.businessName||"your business")}.</p></div><button class="btn primary" data-add="transactions">＋ Record Transaction</button></div>
 <div class="grid stats">${statCard("Total Income",money(income),"↗","var(--green)",`${tx.filter(t=>t.type==="Income").length} income entries`)}${statCard("Total Expenses",money(expenses),"↘","var(--red)",`${tx.filter(t=>t.type==="Expense").length} expense entries`)}${statCard("Net Profit / Loss",money(profit),"◈","var(--blue)",profit>=0?"Income exceeds expenses":"Expenses exceed income")}${statCard("Inventory Alerts",String(low),"▦","var(--amber)",`${inv.length} products tracked`)}</div>
 <div class="grid two-col"><section class="panel"><div class="panel-head"><div><div class="panel-title">Cash Flow Overview</div><div class="panel-sub">Income and expenses · last 6 months</div></div><span class="status">LIVE DATA</span></div><div class="chart">${months.map(m=>`<div class="bar-wrap" title="${m.label}: ${money(m.income)} income / ${money(m.expense)} expense"><div style="display:flex;align-items:flex-end;justify-content:center;gap:4px;height:100%;width:100%"><div class="bar" style="height:${Math.max(2,m.income/max*100)}%;background:linear-gradient(180deg,#43ddb3,#1c8f83)"></div><div class="bar" style="height:${Math.max(2,m.expense/max*100)}%;background:linear-gradient(180deg,#a47aff,#5d59d9)"></div></div><div class="bar-label">${m.label}</div></div>`).join("")}</div><div class="legend"><span><i class="dot" style="background:#43ddb3"></i>Income</span><span><i class="dot" style="background:#8a73f3"></i>Expenses</span></div></section>
 <section class="panel"><div class="panel-head"><div><div class="panel-title">Operations Snapshot</div><div class="panel-sub">Key activity indicators</div></div></div><div class="list">${[['Customers & Leads',customers.length,'♙'],['Active Projects / Tasks',openTasks,'◷'],['Invoices Issued',invoices.length,'▤'],['Products in Inventory',inv.length,'▦']].map(x=>`<div class="list-row"><div style="display:flex;gap:10px;align-items:center"><div class="stat-icon">${x[2]}</div><div class="list-main"><div class="list-name">${x[0]}</div><div class="list-meta">Current workspace</div></div></div><div class="amount">${x[1]}</div></div>`).join("")}</div></section></div>
 <section class="panel" style="margin-top:18px"><div class="panel-head"><div><div class="panel-title">Recent Transactions</div><div class="panel-sub">Latest income and expenses</div></div><button class="btn" data-goto="transactions">View All →</button></div>${tableFor("transactions",recent)}</section>
 <div class="footer-note">NEXORA v${VERSION} · One Platform. Every Profession.</div>`;
}
function modulePage(name){
 let rows=(state.records[name]||[]);const q=state.search.trim().toLowerCase();
 if(q)rows=rows.filter(r=>Object.values(r).some(v=>String(v??"").toLowerCase().includes(q)));
 return `<div class="welcome"><div><div class="eyebrow">NEXORA WORKSPACE</div><h1>${esc(modules[name].title)}</h1><p>${esc(modules[name].crumb)}</p></div></div>${pageToolbar(name)}<section class="panel"><div class="panel-head"><div><div class="panel-title">${rows.length} Records</div><div class="panel-sub">Stored securely under your account and workspace.</div></div></div>${tableFor(name,rows)}</section>`;
}
function workspacesPage(){
 const rows=state.workspaces;
 return `<div class="welcome"><div><div class="eyebrow">MULTI-BUSINESS MANAGEMENT</div><h1>Business Workspaces</h1><p>Keep each business workspace logically separate within your account.</p></div><button class="btn primary" data-add="workspaces">＋ New Workspace</button></div><div class="notice" style="margin-bottom:18px">Workspace data is separated by workspace ID in the app. This is a personal account feature, not shared team access. Team membership requires a separate permission model.</div><div class="grid section-grid">${rows.map(w=>`<div class="panel"><div class="stat-icon">▣</div><h3 style="font:800 15px Manrope;margin:14px 0 6px">${esc(w.name)}</h3><p class="muted small">${esc(w.description||"Business workspace")}</p><div style="display:flex;gap:8px;margin-top:18px"><button class="btn ${state.workspaceId===w.id?"good":"primary"}" data-switch-workspace="${esc(w.id)}">${state.workspaceId===w.id?"Current Workspace":"Switch Workspace"}</button>${w.id!=="default"?`<button class="btn" data-edit="workspaces:${esc(w.id)}">Edit</button>`:""}</div></div>`).join("")}</div>`;
}
function reportsPage(){
 const tx=state.records.transactions||[],income=tx.filter(t=>t.type==="Income").reduce((a,t)=>a+Number(t.amount||0),0),expense=tx.filter(t=>t.type==="Expense").reduce((a,t)=>a+Number(t.amount||0),0);
 return `<div class="welcome"><div><div class="eyebrow">INSIGHTS & DATA TOOLS</div><h1>Reports & Data</h1><p>Review performance and export your workspace data.</p></div></div><div class="grid stats">${statCard("Income",money(income),"↗","var(--green)")}${statCard("Expenses",money(expense),"↘","var(--red)")}${statCard("Net Result",money(income-expense),"◈","var(--blue)")}${statCard("Transactions",String(tx.length),"↔","var(--purple)")}</div><div class="grid section-grid">${Object.keys(modules).map(n=>`<div class="feature-card"><div class="stat-icon">${modules[n].icon}</div><h3>${modules[n].title}</h3><p>Export current workspace records to CSV for backup, analysis or migration.</p><button class="btn" style="margin-top:14px" data-export="${n}">Export CSV</button></div>`).join("")}</div><section class="panel" style="margin-top:18px"><div class="panel-head"><div><div class="panel-title">CSV Import</div><div class="panel-sub">Import simple records into a selected module. Existing data is not overwritten.</div></div></div><div class="field"><label>DESTINATION MODULE</label><select id="importModule" class="filter">${Object.keys(modules).map(n=>`<option value="${n}">${modules[n].title}</option>`).join("")}</select></div><div class="field"><label>CSV FILE</label><input id="importFile" type="file" accept=".csv,text/csv"></div><button class="btn primary" id="runImport">Import CSV</button><p class="small muted">Use a header row. Import is best-effort and supports plain text fields, numbers and dates. Review records after import.</p></section>`;
}
function settingsPage(){
 return `<div class="welcome"><div><div class="eyebrow">YOUR BUSINESS PROFILE</div><h1>Business Settings</h1><p>Personalize the command center for your business.</p></div></div><div class="grid settings-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">Business Preferences</div><div class="panel-sub">These settings apply to your account.</div></div></div><form id="settingsForm"><div class="field"><label>BUSINESS NAME</label><input name="businessName" required value="${esc(state.settings.businessName)}"></div><div class="field"><label>REPORTING CURRENCY</label><select name="currency">${["USD","PKR","GBP","EUR","AED","SAR","INR","CAD","AUD"].map(c=>`<option ${state.settings.currency===c?"selected":""}>${c}</option>`).join("")}</select></div><div class="field"><label>DEFAULT TAX RATE (%)</label><input name="taxRate" type="number" min="0" max="100" step=".01" value="${Number(state.settings.taxRate)||0}"></div><div class="field"><label>DATE FORMAT</label><select name="dateFormat"><option value="local" ${state.settings.dateFormat==="local"?"selected":""}>Local format</option><option value="iso" ${state.settings.dateFormat==="iso"?"selected":""}>YYYY-MM-DD</option></select></div><button class="btn primary">Save Preferences</button></form></section><section class="panel"><div class="panel-head"><div><div class="panel-title">Account & Security</div><div class="panel-sub">Signed-in Firebase account details</div></div></div><div class="list"><div class="list-row"><div><div class="list-name">Name</div><div class="list-meta">${esc(state.profile?.name||"NEXORA User")}</div></div></div><div class="list-row"><div><div class="list-name">Email</div><div class="list-meta">${esc(state.user?.email||"")}</div></div></div><div class="list-row"><div><div class="list-name">Plan</div><div class="list-meta">${esc(state.profile?.plan||"free").toUpperCase()} · plan display only; billing is not connected</div></div></div><div class="list-row"><div><div class="list-name">App Version</div><div class="list-meta">NEXORA ${VERSION}</div></div></div></div><div class="notice" style="margin-top:16px">Never share your Firebase service-account key. The web configuration key is intended for client apps; secure access depends on Firestore rules and Firebase Authentication.</div><button class="btn" id="exportBackup" style="margin-top:14px">Export Workspace Backup (JSON)</button></section></div>`;
}
function renderPage(){
 if(!state.user)return;
 if(state.page==="dashboard")$("#pageContent").innerHTML=dashboardPage();
 else if(modules[state.page])$("#pageContent").innerHTML=modulePage(state.page);
 else if(state.page==="workspaces")$("#pageContent").innerHTML=workspacesPage();
 else if(state.page==="reports")$("#pageContent").innerHTML=reportsPage();
 else if(state.page==="settings")$("#pageContent").innerHTML=settingsPage();
 else $("#pageContent").innerHTML=`<section class="panel"><h2>Module unavailable</h2><p class="muted">Choose a module from the navigation.</p></section>`;
}
function fieldControl(f,record={}){
 const [key,label,type,required,options]=f;let val=record[key]??"";
 if(type==="date"&&!val&&["date","issueDate","startDate"].includes(key))val=isoToday();
 const req=required?"required":"";
 if(type==="select")return `<div class="field"><label>${esc(label.toUpperCase())}${required?" *":""}</label><select name="${esc(key)}" ${req}>${(options||[]).map(o=>`<option value="${esc(o)}" ${String(val)===o?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`;
 if(type==="textarea")return `<div class="field span-2"><label>${esc(label.toUpperCase())}</label><textarea name="${esc(key)}" ${req}>${esc(val)}</textarea></div>`;
 return `<div class="field"><label>${esc(label.toUpperCase())}${required?" *":""}</label><input name="${esc(key)}" type="${esc(type)}" value="${esc(val)}" ${type==="number"?'step="any"':''} ${req}></div>`;
}
function openRecordModal(name,id=null){
 if(name==="workspaces"){
  const record=id?state.workspaces.find(w=>w.id===id)||{}:{};
  modal(`Workspace ${id?"Settings":"Creation"}`,`<form id="recordForm"><div class="field"><label>WORKSPACE NAME</label><input name="name" required value="${esc(record.name||"")}" placeholder="e.g. Retail Business"></div><div class="field"><label>DESCRIPTION</label><textarea name="description">${esc(record.description||"")}</textarea></div></form>`,async form=>{
   const data=Object.fromEntries(new FormData(form));if(!data.name.trim())throw Error("Workspace name is required.");
   if(id){await updateDoc(doc(db,"users",state.user.uid,"workspaces",id),{name:data.name.trim(),description:data.description,updatedAt:serverTimestamp()})}
   else{const ref=await addDoc(userCollection("workspaces"),{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});state.workspaceId=ref.id}
   await loadAll();navTo("workspaces");notify("Workspace saved.");
  });return;
 }
 const m=modules[name];if(!m)return;
 const record=id?(state.records[name]||[]).find(r=>r.id===id)||{}:{};
 modal(`${id?"Edit":"Add"} ${m.title}`,`<form id="recordForm"><div class="form-grid">${m.fields.map(f=>fieldControl(f,record)).join("")}</div></form>`,async form=>{
  const fd=new FormData(form),data={};
  for(const f of m.fields){const k=f[0],v=fd.get(k);if(v!==null&&v!=="")data[k]=f[2]==="number"?Number(v):String(v).trim();else data[k]=f[2]==="number"?0:""}
  for(const f of m.fields)if(f[3]&&!String(data[f[0]]??"").trim())throw Error(`${f[1]} is required.`);
  data.workspaceId=state.workspaceId;data.updatedAt=serverTimestamp();
  if(id)await updateDoc(doc(db,"users",state.user.uid,m.collection,id),data);
  else await addDoc(userCollection(m.collection),{...data,createdAt:serverTimestamp()});
  await getRecords(name);closeModal();renderPage();notify(id?"Record updated.":"Record created.");
 });
}
function modal(title,body,onSave){
 $("#modalRoot").innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><section class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" id="modalClose">×</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn" id="modalCancel">Cancel</button><button class="btn primary" id="modalSave">Save Record</button></div></section></div>`;
 const close=()=>closeModal();$("#modalClose").onclick=close;$("#modalCancel").onclick=close;
 $("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")close()});
 $("#modalSave").onclick=async()=>{const form=$("#recordForm");if(form&&!form.reportValidity())return;const b=$("#modalSave");b.disabled=true;b.textContent="Saving…";try{await onSave(form);if($("#modalRoot").innerHTML)closeModal()}catch(err){notify(friendlyError(err),true)}finally{b.disabled=false;b.textContent="Save Record"}};
}
function closeModal(){$("#modalRoot").innerHTML=""}
async function deleteRecord(name,id){
 if(!confirm("Delete this record permanently? This action cannot be undone."))return;
 try{await deleteDoc(doc(db,"users",state.user.uid,name,id));await getRecords(name);renderPage();notify("Record deleted.")}catch(e){notify(friendlyError(e),true)}
}
function csvEscape(v){const s=String(v??"");return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function exportCSV(name){
 const rows=state.records[name]||[];if(!rows.length){notify("There are no records to export.");return}
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k=>!["id","workspaceId"].includes(k));
 const csv=[keys.map(csvEscape).join(","),...rows.map(r=>keys.map(k=>csvEscape(r[k]?.toDate?r[k].toDate().toISOString():r[k])).join(","))].join("\r\n");
 download(`${name}-${state.workspaceId}-${isoToday()}.csv`,csv,"text/csv;charset=utf-8");notify("CSV export ready.");
}
function download(name,content,type){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function parseCSV(text){
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){cell+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===","&&!quoted){row.push(cell);cell=""}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&n==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=""}else cell+=c}
 if(cell.length||row.length){row.push(cell);rows.push(row)}return rows;
}
function normalizeKey(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
async function importCSV(){
 const file=$("#importFile")?.files?.[0],name=$("#importModule")?.value;if(!file)return notify("Choose a CSV file first.",true);
 const m=modules[name];if(!m)return;
 try{
  const raw=parseCSV(await file.text());if(raw.length<2)throw Error("CSV must contain a header row and at least one data row.");
  const fields=m.fields,lookup={};fields.forEach(f=>{lookup[normalizeKey(f[0])]=f[0];lookup[normalizeKey(f[1])]=f[0]});
  const headers=raw[0].map(h=>lookup[normalizeKey(h)]||null);let count=0;
  for(const row of raw.slice(1)){const data={workspaceId:state.workspaceId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
   headers.forEach((key,i)=>{if(!key)return;const f=fields.find(x=>x[0]===key);let v=(row[i]||"").trim();if(!v)return;data[key]=f?.[2]==="number"?Number(v):v});
   if(!fields.some(f=>f[3]&&!String(data[f[0]]??"").trim())){await addDoc(userCollection(m.collection),data);count++}
  }
  await getRecords(name);notify(`Imported ${count} record(s). ${raw.length-1-count} row(s) skipped.`);renderPage();
 }catch(e){notify(friendlyError(e),true)}
}
async function saveSettings(e){
 e.preventDefault();const fd=new FormData(e.currentTarget);const patch={businessName:String(fd.get("businessName")||"My Business").trim(),currency:String(fd.get("currency")||"USD"),taxRate:Number(fd.get("taxRate")||0),dateFormat:String(fd.get("dateFormat")||"local"),updatedAt:serverTimestamp()};
 try{await setDoc(userDoc(),{uid:state.user.uid,email:state.user.email||"",name:state.profile?.name||state.user.displayName||"NEXORA User",role:state.profile?.role||"user",plan:state.profile?.plan||"free",...patch},{merge:true});state.settings={...state.settings,...patch};state.profile={...state.profile,...patch};notify("Business preferences saved.");renderPage()}catch(err){notify(friendlyError(err),true)}
}
function exportBackup(){
 const payload={app:"NEXORA",version:VERSION,exportedAt:new Date().toISOString(),workspace:state.workspaceId,settings:state.settings,records:Object.fromEntries(Object.entries(state.records).filter(([k])=>k!=="workspaces"))};
 download(`nexora-backup-${isoToday()}.json`,JSON.stringify(payload,(k,v)=>v?.toDate?v.toDate().toISOString():v,2),"application/json");notify("JSON backup exported.");
}
function bindDynamicEvents(){
 $("#pageContent").onclick=async e=>{
  const btn=e.target.closest("button");if(!btn)return;
  if(btn.dataset.add){openRecordModal(btn.dataset.add);return}
  if(btn.dataset.edit){const [n,id]=btn.dataset.edit.split(":");openRecordModal(n,id);return}
  if(btn.dataset.delete){const [n,id]=btn.dataset.delete.split(":");deleteRecord(n,id);return}
  if(btn.dataset.export){exportCSV(btn.dataset.export);return}
  if(btn.dataset.goto){navTo(btn.dataset.goto);return}
  if(btn.dataset.switchWorkspace){state.workspaceId=btn.dataset.switchWorkspace;await loadAll();navTo("dashboard");notify("Workspace switched.");return}
  if(btn.id==="runImport"){importCSV();return}
 };
 $("#pageContent").oninput=e=>{if(e.target.id==="moduleSearch"){state.search=e.target.value;const pos=e.target.selectionStart;renderPage();const input=$("#moduleSearch");if(input){input.focus();input.setSelectionRange(pos,pos)}}};
 $("#pageContent").onsubmit=e=>{if(e.target.id==="settingsForm")saveSettings(e)};
 $("#pageContent").onclick=async e=>{
  const btn=e.target.closest("button");if(!btn)return;
  if(btn.dataset.add){openRecordModal(btn.dataset.add);return}
  if(btn.dataset.edit){const [n,id]=btn.dataset.edit.split(":");openRecordModal(n,id);return}
  if(btn.dataset.delete){const [n,id]=btn.dataset.delete.split(":");deleteRecord(n,id);return}
  if(btn.dataset.export){exportCSV(btn.dataset.export);return}
  if(btn.dataset.goto){navTo(btn.dataset.goto);return}
  if(btn.dataset.switchWorkspace){state.workspaceId=btn.dataset.switchWorkspace;await loadAll();navTo("dashboard");notify("Workspace switched.");return}
  if(btn.id==="runImport"){importCSV();return}
  if(btn.id==="exportBackup")exportBackup();
 };
}
function installAppEvents(){
 $("#authForm").addEventListener("submit",handleAuth);
 $("#showLogin").onclick=()=>setAuthMode("login");$("#showRegister").onclick=()=>setAuthMode("register");
 $("#forgotPassword").onclick=async()=>{const email=$("#authEmail").value.trim();if(!email)return showAuthMessage("Enter your email address first.",true);try{await sendPasswordResetEmail(auth,email);showAuthMessage("Password reset email sent. Check your inbox.")}catch(e){showAuthMessage(friendlyError(e),true)}};
 $("#signOutBtn").onclick=()=>signOut(auth);
 $("#menuToggle").onclick=()=>$("#sidebar").classList.toggle("open");
 $("#quickAddBtn").onclick=()=>openRecordModal(state.page in modules?state.page:"transactions");
 $("#workspaceSelect").onchange=async e=>{state.workspaceId=e.target.value;await loadAll();navTo("dashboard")};
 $("#globalSearch").oninput=e=>{state.search=e.target.value;if(modules[state.page])renderPage()};
 $("#mainNav").onclick=e=>{const b=e.target.closest("[data-page]");if(b)navTo(b.dataset.page)};
 $$(".sidebar [data-page]").forEach(b=>b.addEventListener("click",()=>navTo(b.dataset.page)));
 $("#pageContent").addEventListener("click",e=>{if(e.target.id==="exportBackup")exportBackup()});
}
async function showApp(){
 $("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");
 $("#userName").textContent=state.profile?.name||"NEXORA User";$("#userEmail").textContent=state.user.email||"";$("#userAvatar").textContent=(state.profile?.name||state.user.email||"N").charAt(0).toUpperCase();
 await loadAll();navTo("dashboard");
}
onAuthStateChanged(auth,async user=>{
 state.user=user;
 if(!user){$("#appView").classList.add("hidden");$("#authView").classList.remove("hidden");return}
 try{await ensureProfile(user);await showApp()}catch(e){notify(friendlyError(e),true);$("#authView").classList.remove("hidden");$("#appView").classList.add("hidden")}
});
installAppEvents();bindDynamicEvents();setAuthMode("login");
