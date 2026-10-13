```javascript
import { auth, db, googleProvider } from "./firebase.js";

import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, sendPasswordResetEmail, signOut,
  onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "2.3.0";
const CATEGORIES = {
  general:"General Business", retail:"Retail / Shop", restaurant:"Restaurant",
  services:"Services / Freelancer", healthcare:"Healthcare", education:"Education",
  construction:"Construction", manufacturing:"Manufacturing",
  realestate:"Real Estate", transport:"Transport / Logistics",
  agriculture:"Agriculture", custom:"Custom Business"
};

const MODULES = {
  transactions:{title:"Transactions",fields:[
    ["title","Description","text",true],["type","Type","select",true,["Income","Expense"]],
    ["amount","Amount","number",true],["date","Date","date",true],["category","Category","text",false]
  ]},
  customers:{title:"Customers",fields:[
    ["name","Customer name","text",true],["email","Email","email",false],
    ["phone","Phone","tel",false],["company","Company","text",false],["notes","Notes","textarea",false]
  ]},
  suppliers:{title:"Suppliers",fields:[
    ["name","Supplier name","text",true],["email","Email","email",false],
    ["phone","Phone","tel",false],["company","Company","text",false],["notes","Notes","textarea",false]
  ]},
  inventory:{title:"Inventory",fields:[
    ["name","Item name","text",true],["sku","SKU / Code","text",false],
    ["quantity","Quantity","number",true],["price","Unit price","number",true],
    ["category","Category","text",false],["expiry","Expiry date","date",false]
  ]},
  projects:{title:"Projects",fields:[
    ["name","Project name","text",true],["client","Client","text",false],
    ["status","Status","select",true,["Pending","In progress","Completed"]],
    ["dueDate","Due date","date",false],["budget","Budget","number",false],["notes","Notes","textarea",false]
  ]},
  invoices:{title:"Invoices",fields:[
    ["title","Invoice title","text",true],["customer","Customer","text",true],
    ["amount","Amount","number",true],["date","Invoice date","date",true],
    ["dueDate","Due date","date",false],
    ["status","Status","select",true,["Draft","Sent","Paid","Overdue"]]
  ]},
  appointments:{title:"Appointments",fields:[
    ["title","Appointment","text",true],["person","Person / Client","text",true],
    ["date","Date","date",true],["time","Time","time",false],
    ["status","Status","select",true,["Scheduled","Completed","Cancelled"]],["notes","Notes","textarea",false]
  ]}
};

const $ = id => document.getElementById(id);
const state = {
  user:null, profile:null, page:"dashboard", records:[],
  tasks:[], team:[], currentModule:null, editing:null, unsubscribers:[],
  customCategory:""
};

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

const money = value => new Intl.NumberFormat(undefined,{
  style:"currency",currency:state.profile?.currency || "USD",maximumFractionDigits:2
}).format(Number(value || 0));

const userRef = () => doc(db,"users",state.user.uid);
const recordsRef = moduleName => collection(db,"users",state.user.uid,"records",moduleName,"items");
const workspaceId = () => state.profile?.workspaceId || state.user.uid;
const wsRef = () => doc(db,"workspaces",workspaceId());
const tasksRef = () => collection(db,"workspaces",workspaceId(),"tasks");
const membersRef = () => collection(db,"workspaces",workspaceId(),"members");
const invitesRef = () => collection(db,"workspaces",workspaceId(),"invites");

function setMessage(id, text, error=false){
  const el=$(id); if(!el)return;
  el.textContent=text; el.style.color=error?"var(--red)":"var(--cyan)";
}
function friendlyError(error){
  const map={
    "auth/invalid-credential":"Email ya password sahi nahi.",
    "auth/email-already-in-use":"Is email ka account pehle se hai.",
    "auth/weak-password":"Password kam az kam 6 characters ka hona chahiye.",
    "auth/invalid-email":"Email address check karein.",
    "auth/popup-closed-by-user":"Google sign-in cancel ho gaya.",
    "permission-denied":"Firebase security rules ne access rok diya. Rules check karein."
  };
  return map[error?.code] || error?.message || "Kuch ghalat ho gaya.";
}

$("authBusiness").addEventListener("change",()=>{
  $("customCategoryField").classList.toggle("hidden",$("authBusiness").value!=="custom");
});

async function saveProfile(user, category, customCategory){
  const ref=doc(db,"users",user.uid);
  const existing=await getDoc(ref);
  const old=existing.exists()?existing.data():{};
  const workspace=old.workspaceId || user.uid;
  const profile={
    uid:user.uid, email:user.email || "", name:user.displayName || user.email || "User",
    category:category || old.category || "general",
    customCategory:customCategory || old.customCategory || "",
    workspaceId:workspace,
    role:old.role || "owner", plan:old.plan || "free",
    currency:old.currency || "USD", updatedAt:serverTimestamp()
  };
  if(!existing.exists()) profile.createdAt=serverTimestamp();
  await setDoc(ref,profile,{merge:true});
  state.profile={...old,...profile,workspaceId:workspace};
  if(!old.workspaceId){
    await setDoc(doc(db,"workspaces",workspace),{
      ownerUid:user.uid, name:`${profile.name}'s Workspace`,
      createdAt:serverTimestamp()
    },{merge:true});
    await setDoc(doc(db,"workspaces",workspace,"members",user.uid),{
      uid:user.uid,email:user.email || "",name:profile.name,role:"owner",status:"active",
      joinedAt:serverTimestamp()
    },{merge:true});
  }
}

async function authAction(action){
  const email=$("authEmail").value.trim();
  const password=$("authPassword").value;
  const name=$("authName").value.trim();
  const category=$("authBusiness").value;
  const custom=$("authCustomCategory").value.trim();

  if(!email || !password){setMessage("authMessage","Email aur password dono enter karein.",true);return;}
  if(action==="register" && password.length<6){setMessage("authMessage","Password kam az kam 6 characters ka hona chahiye.",true);return;}
  if(action==="register" && !name){setMessage("authMessage","Registration ke liye naam enter karein.",true);return;}
  if(action==="register" && category==="custom" && !custom){setMessage("authMessage","Apni business category enter karein.",true);return;}

  try{
    setMessage("authMessage","Please wait...");
    if(action==="login") await signInWithEmailAndPassword(auth,email,password);
    else{
      const cred=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(cred.user,{displayName:name});
      await saveProfile(cred.user,category,custom);
    }
  }catch(error){setMessage("authMessage",friendlyError(error),true);}
}

$("loginBtn").addEventListener("click",()=>authAction("login"));
$("registerBtn").addEventListener("click",()=>authAction("register"));
$("googleBtn").addEventListener("click",async()=>{
  try{
    const result=await signInWithPopup(auth,googleProvider);
    const existing=await getDoc(doc(db,"users",result.user.uid));
    if(!existing.exists()){
      const category=$("authBusiness").value;
      await saveProfile(result.user,category,$("authCustomCategory").value.trim());
    }
  }catch(error){setMessage("authMessage",friendlyError(error),true);}
});
$("resetBtn").addEventListener("click",async()=>{
  const email=$("authEmail").value.trim();
  if(!email){setMessage("authMessage","Pehle email enter karein.",true);return;}
  try{await sendPasswordResetEmail(auth,email);setMessage("authMessage","Password reset email bhej di gayi.");}
  catch(error){setMessage("authMessage",friendlyError(error),true);}
});
$("logoutBtn").addEventListener("click",()=>signOut(auth));

function stopListeners(){
  state.unsubscribers.forEach(fn=>{try{fn();}catch{}});
  state.unsubscribers=[];
}
async function loadProfile(user){
  const snap=await getDoc(doc(db,"users",user.uid));
  if(!snap.exists()){
    await saveProfile(user,$("authBusiness").value || "general","");
  }else state.profile=snap.data();

  if(!state.profile.workspaceId) {
    await updateDoc(doc(db,"users",user.uid),{workspaceId:user.uid});
    state.profile.workspaceId=user.uid;
  }
  $("userName").textContent=state.profile.name || user.displayName || "User";
  $("userEmail").textContent=user.email || "";
  $("userAvatar").textContent=(state.profile.name || "N").charAt(0).toUpperCase();
  $("categoryBadge").textContent=state.profile.category==="custom"
    ? state.profile.customCategory || "Custom Business"
    : CATEGORIES[state.profile.category] || "General Business";

  $("authScreen").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  subscribeRecords();
  subscribeTasks();
  subscribeMembers();
  render();
}

function subscribeRecords(){
  for(const [moduleName] of Object.entries(MODULES)){
    const unsub=onSnapshot(recordsRef(moduleName),snap=>{
      state.records=state.records.filter(r=>r.module!==moduleName);
      snap.forEach(d=>state.records.push({id:d.id,module:moduleName,...d.data()}));
      render();
    },err=>console.error("Records:",err));
    state.unsubscribers.push(unsub);
  }
}
function subscribeTasks(){
  const unsub=onSnapshot(tasksRef(),snap=>{
    state.tasks=snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  },err=>console.error("Tasks:",err));
  state.unsubscribers.push(unsub);
}
function subscribeMembers(){
  const unsub=onSnapshot(membersRef(),snap=>{
    state.team=snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  },err=>console.error("Team:",err));
  state.unsubscribers.push(unsub);
}

const PAGE_TITLES={
  dashboard:"Dashboard",transactions:"Transactions",customers:"Customers",
  suppliers:"Suppliers",inventory:"Inventory",projects:"Projects",invoices:"Invoices",
  appointments:"Appointments",team:"Team & Tasks",reports:"Reports",settings:"Settings"
};

function render(){
  if(!state.user || !state.profile)return;
  $("pageTitle").textContent=PAGE_TITLES[state.page] || state.page;
  $("pageEyebrow").textContent=state.page==="dashboard"?"BUSINESS OVERVIEW":"NEXORA WORKSPACE";
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===state.page));
  if(state.page==="dashboard")renderDashboard();
  else if(MODULES[state.page])renderModule(state.page);
  else if(state.page==="team")renderTeam();
  else if(state.page==="reports")renderReports();
  else if(state.page==="settings")renderSettings();
}

function statCard(label,value,foot="Live workspace data"){
  return `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div><div class="stat-foot">${esc(foot)}</div></div>`;
}
function renderDashboard(){
  const tx=state.records.filter(r=>r.module==="transactions");
  const income=tx.filter(r=>r.type==="Income").reduce((s,r)=>s+Number(r.amount||0),0);
  const expenses=tx.filter(r=>r.type==="Expense").reduce((s,r)=>s+Number(r.amount||0),0);
  const pendingTasks=state.tasks.filter(t=>t.status!=="Completed").length;
  const inv=state.records.filter(r=>r.module==="inventory");
  const stock=inv.reduce((s,r)=>s+Number(r.quantity||0),0);
  const monthly=Array.from({length:6},(_,i)=>{
    const date=new Date();date.setMonth(date.getMonth()-(5-i));
    const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
    const val=tx.filter(r=>String(r.date||"").startsWith(key)&&r.type==="Income")
      .reduce((s,r)=>s+Number(r.amount||0),0);
    return {label:date.toLocaleString(undefined,{month:"short"}),value:val};
  });
  const max=Math.max(1,...monthly.map(m=>m.value));
  const bars=monthly.map(m=>`<div class="bar-col"><div class="bar" style="height:${Math.max(3,m.value/max*100)}%"></div><span>${esc(m.label)}</span></div>`).join("");
  const category=CATEGORIES[state.profile.category] || state.profile.customCategory || "Your business";
  $("pageContent").innerHTML=`
    <section class="hero"><div><p class="eyebrow">YOUR WORKSPACE IS READY</p><h3>Welcome back, ${esc(state.profile.name||"there")}</h3><p>${esc(category)} · Your business overview at a glance.</p></div><button class="btn primary" data-action="add" data-module="transactions">+ Add transaction</button></section>
    <div class="stats-grid">
      ${statCard("Total income",money(income))}
      ${statCard("Total expenses",money(expenses))}
      ${statCard("Net balance",money(income-expenses))}
      ${statCard("Open tasks",String(pendingTasks))}
    </div>
    <div class="content-grid">
      <section class="panel"><div class="panel-head"><div><h3>Income overview</h3><p>Last six calendar months</p></div><span class="pill">Income</span></div><div class="chart-bars">${bars}</div></section>
      <section class="panel"><div class="panel-head"><div><h3>Quick actions</h3><p>Common business operations</p></div></div><div class="quick-grid">
        <button class="quick-btn" data-action="add" data-module="customers"><strong>＋ Customer</strong><small>Add customer record</small></button>
        <button class="quick-btn" data-action="add" data-module="inventory"><strong>＋ Inventory</strong><small>Add stock item</small></button>
        <button class="quick-btn" data-action="add" data-module="projects"><strong>＋ Project</strong><small>Track a project</small></button>
        <button class="quick-btn" data-page="team"><strong>♙ Team tasks</strong><small>Manage assigned work</small></button>
      </div></section>
    </div>
    <section class="panel"><div class="panel-head"><div><h3>Recent transactions</h3><p>Latest income and expenses</p></div><button class="btn" data-page="transactions">View all</button></div>${tableHTML("transactions",tx.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5))}</section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>Inventory snapshot</h3><p>${inv.length} items · ${stock} total units</p></div><button class="btn" data-page="inventory">View inventory</button></div>${tableHTML("inventory",inv.slice(0,5))}</section>`;
}

function tableHTML(moduleName,rows){
  const mod=MODULES[moduleName];
  if(!rows.length)return `<div class="empty">No records yet. Use “Add record” to get started.</div>`;
  const fields=mod.fields.slice(0,4);
  return `<div class="table-wrap"><table><thead><tr>${fields.map(f=>`<th>${esc(f[1])}</th>`).join("")}<th>Actions</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>${fields.map(f=>`<td>${esc(r[f[0]]??"—")}</td>`).join("")}<td><div class="table-actions"><button class="mini-btn" data-action="edit" data-module="${moduleName}" data-id="${esc(r.id)}">Edit</button><button class="mini-btn" data-action="delete" data-module="${moduleName}" data-id="${esc(r.id)}">Delete</button></div></td></tr>`).join("")}
  </tbody></table></div>`;
}
function renderModule(moduleName){
  const mod=MODULES[moduleName];
  const all=state.records.filter(r=>r.module===moduleName);
  $("pageContent").innerHTML=`<section class="panel">
    <div class="panel-head"><div><h3>${esc(mod.title)}</h3><p>${all.length} records in your workspace</p></div><button class="btn primary" data-action="add" data-module="${moduleName}">+ Add record</button></div>
    <div class="toolbar"><input id="recordSearch" placeholder="Search ${esc(mod.title.toLowerCase())}..."><button class="btn" data-action="export" data-module="${moduleName}">Export CSV</button></div>
    <div id="moduleTable">${tableHTML(moduleName,all)}</div>
  </section>`;
  $("recordSearch").addEventListener("input",e=>{
    const q=e.target.value.toLowerCase();
    const filtered=all.filter(r=>Object.values(r).some(v=>String(v??"").toLowerCase().includes(q)));
    $("moduleTable").innerHTML=tableHTML(moduleName,filtered);
  });
}
function fieldHTML(field,value=""){
  const [key,label,type,required,options]=field;
  const safe=esc(value);
  if(type==="select")return `<div class="field"><label>${esc(label)}</label><select name="${esc(key)}" ${required?"required":""}>${options.map(o=>`<option ${String(value)===o?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`;
  if(type==="textarea")return `<div class="field"><label>${esc(label)}</label><textarea name="${esc(key)}" ${required?"required":""}>${safe}</textarea></div>`;
  return `<div class="field"><label>${esc(label)}</label><input name="${esc(key)}" type="${esc(type)}" value="${safe}" ${required?"required":""} ${type==="number"?'min="0" step="any"':""}></div>`;
}
function openRecordDialog(moduleName,id=null){
  state.currentModule=moduleName;state.editing=id;
  const old=id?state.records.find(r=>r.id===id):{};
  $("dialogTitle").textContent=`${id?"Edit":"New"} ${MODULES[moduleName].title}`;
  $("recordFields").innerHTML=MODULES[moduleName].fields.map(f=>fieldHTML(f,old?.[f[0]]??(f[0]==="date"?new Date().toISOString().slice(0,10):""))).join("");
  setMessage("recordMessage","");
  $("recordDialog").showModal();
}
async function saveRecord(event){
  event.preventDefault();
  const moduleName=state.currentModule;
  const data=Object.fromEntries(new FormData(event.currentTarget).entries());
  for(const field of MODULES[moduleName].fields){
    if(field[2]==="number")data[field[0]]=Number(data[field[0]]||0);
  }
  data.updatedAt=serverTimestamp();
  try{
    if(state.editing)await updateDoc(doc(recordsRef(moduleName),state.editing),data);
    else await addDoc(recordsRef(moduleName),{...data,createdAt:serverTimestamp(),createdBy:state.user.uid});
    $("recordDialog").close();
  }catch(error){setMessage("recordMessage",friendlyError(error),true);}
}
$("recordForm").addEventListener("submit",saveRecord);
$("closeDialog").addEventListener("click",()=>$("recordDialog").close());
$("cancelRecord").addEventListener("click",()=>$("recordDialog").close());

async function removeRecord(moduleName,id){
  if(!confirm("Kya aap ye record delete karna chahte hain?"))return;
  try{await deleteDoc(doc(recordsRef(moduleName),id));}
  catch(error){alert(friendlyError(error));}
}
function exportCSV(moduleName){
  const rows=state.records.filter(r=>r.module===moduleName);
  const fields=MODULES[moduleName].fields.map(f=>f[0]);
  const quote=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv=[fields.map(quote).join(","),...rows.map(r=>fields.map(k=>quote(r[k])).join(","))].join("\r\n");
  download(`${moduleName}.csv`,csv,"text/csv;charset=utf-8");
}
function download(filename,content,type){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

function renderReports(){
  const tx=state.records.filter(r=>r.module==="transactions");
  const income=tx.filter(r=>r.type==="Income").reduce((s,r)=>s+Number(r.amount||0),0);
  const expense=tx.filter(r=>r.type==="Expense").reduce((s,r)=>s+Number(r.amount||0),0);
  $("pageContent").innerHTML=`<div class="stats-grid">${statCard("Income",money(income))}${statCard("Expenses",money(expense))}${statCard("Net",money(income-expense))}${statCard("Transactions",String(tx.length))}</div>
  <section class="panel"><div class="panel-head"><div><h3>Export your data</h3><p>Download records belonging to your account</p></div></div>
  <div class="quick-grid">${Object.entries(MODULES).map(([key,m])=>`<button class="quick-btn" data-action="export" data-module="${key}"><strong>${esc(m.title)}</strong><small>Download CSV</small></button>`).join("")}
  <button class="quick-btn" data-action="backup"><strong>JSON backup</strong><small>Download all personal records</small></button></div></section>`;
}
async function exportBackup(){
  const data={version:VERSION,exportedAt:new Date().toISOString(),profile:{
    name:state.profile.name,category:state.profile.category,customCategory:state.profile.customCategory
  },records:state.records.map(({id,module,...r})=>({id,module,...r}))};
  download("nexora-backup.json",JSON.stringify(data,null,2),"application/json");
}
function renderSettings(){
  $("pageContent").innerHTML=`<div class="settings-grid">
  <section class="panel"><h3>Business profile</h3><p class="muted">Workspace information</p>
  <div class="field"><label>Display name</label><input id="settingName" value="${esc(state.profile.name||"")}"></div>
  <div class="field"><label>Business category</label><select id="settingCategory">${Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}" ${state.profile.category===k?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
  <div class="field"><label>Custom category name</label><input id="settingCustom" value="${esc(state.profile.customCategory||"")}"></div>
  <div class="field"><label>Currency code (e.g. USD, PKR, GBP)</label><input id="settingCurrency" maxlength="3" value="${esc(state.profile.currency||"USD")}"></div>
  <button class="btn primary" id="saveSettings">Save settings</button><p id="settingsMessage" class="message"></p></section>
  <section class="panel"><h3>Account & backup</h3><p class="muted">${esc(state.user.email||"")}</p>
  <div class="notice">Your personal records are stored in Firestore under your account. Keep downloaded backups somewhere secure.</div>
  <button class="btn" style="margin-top:14px" data-action="backup">Download JSON backup</button></section></div>`;
  $("saveSettings").addEventListener("click",async()=>{
    try{
      const name=$("settingName").value.trim();
      const category=$("settingCategory").value;
      const customCategory=$("settingCustom").value.trim();
      const currency=$("settingCurrency").value.trim().toUpperCase();
      if(!name)throw new Error("Name required.");
      if(currency.length!==3)throw new Error("Currency code 3 letters ka hona chahiye.");
      await updateDoc(userRef(),{name,category,customCategory,currency,updatedAt:serverTimestamp()});
      state.profile={...state.profile,name,category,customCategory,currency};
      $("userName").textContent=name;$("categoryBadge").textContent=category==="custom"?customCategory:CATEGORIES[category];
      setMessage("settingsMessage","Settings save ho gayi.");
      render();
    }catch(e){setMessage("settingsMessage",friendlyError(e),true);}
  });
}

/* Team: workspace owner invites an email by creating an invitation record.
   The invited person must sign in using the same email and accept it.
   Sending an email notification requires a trusted email/backend integration. */
function renderTeam(){
  const isOwner=state.profile.role==="owner" || state.profile.role==="admin";
  const visibleTasks=isOwner?state.tasks:state.tasks.filter(t=>t.assignedUid===state.user.uid);
  $("pageContent").innerHTML=`
    <section class="hero"><div><p class="eyebrow">COLLABORATION</p><h3>Team & Tasks</h3><p>Assign work and track progress in your workspace.</p></div>${isOwner?'<button class="btn primary" data-action="newtask">+ Assign task</button>':""}</section>
    ${isOwner?`<section class="panel" style="margin-bottom:16px"><div class="panel-head"><div><h3>Invite a team member</h3><p>Create an invitation for an existing or new NEXORA account</p></div></div>
      <div class="toolbar"><input id="inviteEmail" type="email" placeholder="Team member's sign-in email"><select id="inviteRole"><option value="member">Staff / Member</option><option value="admin">Admin</option></select><button class="btn primary" id="inviteBtn">Create invitation</button></div><p class="message" id="inviteMessage"></p></section>`:""}
    <section class="panel" style="margin-bottom:16px"><div class="panel-head"><div><h3>Tasks</h3><p>${visibleTasks.length} tasks visible to your account</p></div></div>${taskTable(visibleTasks)}</section>
    <section class="panel"><div class="panel-head"><div><h3>Workspace members</h3><p>People connected to this workspace</p></div></div>${memberTable()}</section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>Accept an invitation</h3><p>Use this if a workspace owner invited your account</p></div></div>
      <div class="toolbar"><input id="acceptWorkspaceId" placeholder="Workspace ID provided by owner"><button class="btn primary" id="acceptInviteBtn">Find invitation</button></div><p id="acceptMessage" class="message"></p></section>`;
  if(isOwner)$("inviteBtn").addEventListener("click",createInvite);
  $("acceptInviteBtn").addEventListener("click",acceptInvite);
}
function taskTable(tasks){
  if(!tasks.length)return '<div class="empty">No tasks yet.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Task</th><th>Assignee</th><th>Due date</th><th>Status</th><th>Action</th></tr></thead><tbody>${tasks.map(t=>{
    const editable=t.assignedUid===state.user.uid || ["owner","admin"].includes(state.profile.role);
    return `<tr><td>${esc(t.title)}</td><td>${esc(t.assignedEmail||"Unassigned")}</td><td>${esc(t.dueDate||"—")}</td><td><span class="pill ${t.status==="Completed"?"completed":t.status==="Pending"?"pending":""}">${esc(t.status||"Pending")}</span></td><td>${editable?`<select data-task-status="${esc(t.id)}" class="task-status"><option ${t.status==="Pending"?"selected":""}>Pending</option><option ${t.status==="Accepted"?"selected":""}>Accepted</option><option ${t.status==="In progress"?"selected":""}>In progress</option><option ${t.status==="Completed"?"selected":""}>Completed</option></select>`:"—"}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function memberTable(){
  if(!state.team.length)return '<div class="empty">No workspace members loaded.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>${state.team.map(m=>`<tr><td>${esc(m.name||"Member")}</td><td>${esc(m.email||"")}</td><td>${esc(m.role||"member")}</td><td>${esc(m.status||"active")}</td></tr>`).join("")}</tbody></table></div>`;
}
async function createInvite(){
  const email=$("inviteEmail").value.trim().toLowerCase();
  const role=$("inviteRole").value;
  if(!email.includes("@")){setMessage("inviteMessage","Valid email enter karein.",true);return;}
  try{
    const existing=await getDocs(query(invitesRef(),where("email","==",email),where("status","==","pending")));
    if(!existing.empty){setMessage("inviteMessage","Is email ki pending invitation pehle se maujood hai.",true);return;}
    await addDoc(invitesRef(),{
      email,role,status:"pending",workspaceId:workspaceId(),
      workspaceName:state.profile.name+"'s Workspace",
      invitedBy:state.user.uid,createdAt:serverTimestamp()
    });
    setMessage("inviteMessage",`Invitation record ban gaya. Workspace ID: ${workspaceId()}. Email notification automatic nahi bheji gayi.`);
  }catch(error){setMessage("inviteMessage",friendlyError(error),true);}
}
async function acceptInvite(){
  const wid=$("acceptWorkspaceId").value.trim();
  if(!wid){setMessage("acceptMessage","Workspace ID enter karein.",true);return;}
  try{
    const invs=await getDocs(query(collection(db,"workspaces",wid,"invites"),
      where("email","==",(state.user.email||"").toLowerCase()),where("status","==","pending")));
    if(invs.empty){setMessage("acceptMessage","Is account ke email ke liye pending invitation nahi mili.",true);return;}
    const invitation=invs.docs[0];
    const invite=invitation.data();
    await setDoc(doc(db,"workspaces",wid,"members",state.user.uid),{
      uid:state.user.uid,email:state.user.email.toLowerCase(),
      name:state.user.displayName||state.user.email,role:"member",status:"active",
      joinedAt:serverTimestamp()
    });
    await updateDoc(doc(db,"users",state.user.uid),{workspaceId:wid,role:"member"});
    await updateDoc(invitation.ref,{status:"accepted",acceptedBy:state.user.uid,acceptedAt:serverTimestamp()});
    state.profile.workspaceId=wid;state.profile.role="member";
    stopListeners();subscribeRecords();subscribeTasks();subscribeMembers();
    setMessage("acceptMessage","Invitation accept ho gayi. Workspace reload ho raha hai.");
    render();
  }catch(error){setMessage("acceptMessage",friendlyError(error),true);}
}
async function createTask(){
  const title=prompt("Task title:");
  if(!title?.trim())return;
  const assignedEmail=prompt("Assignee ka exact sign-in email:");
  if(!assignedEmail?.trim())return;
  const dueDate=prompt("Due date (YYYY-MM-DD), optional:")||"";
  try{
    const snap=await getDocs(query(membersRef(),where("email","==",assignedEmail.trim().toLowerCase())));
    if(snap.empty){alert("Is email ka active workspace member nahi mila. Pehle invitation accept karwaein.");return;}
    const member=snap.docs[0].data();
    await addDoc(tasksRef(),{
      title:title.trim(),assignedUid:member.uid,assignedEmail:member.email,
      dueDate,status:"Pending",createdBy:state.user.uid,createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
  }catch(error){alert(friendlyError(error));}
}
document.addEventListener("change",async e=>{
  const id=e.target.dataset.taskStatus;
  if(!id)return;
  const task=state.tasks.find(t=>t.id===id);
  if(!task)return;
  try{
    await updateDoc(doc(tasksRef(),id),{status:e.target.value,updatedAt:serverTimestamp()});
  }catch(error){alert(friendlyError(error));render();}
});

document.addEventListener("click",async e=>{
  const button=e.target.closest("[data-page],[data-action]");
  if(!button)return;
  if(button.dataset.page){
    state.page=button.dataset.page;
    $("sidebar").classList.remove("open");
    render();return;
  }
  const action=button.dataset.action;
  const moduleName=button.dataset.module;
  if(action==="add")openRecordDialog(moduleName);
  else if(action==="edit")openRecordDialog(moduleName,button.dataset.id);
  else if(action==="delete")removeRecord(moduleName,button.dataset.id);
  else if(action==="export")exportCSV(moduleName);
  else if(action==="backup")exportBackup();
  else if(action==="newtask")createTask();
});

$("navigation").addEventListener("click",e=>{
  const btn=e.target.closest("[data-page]");
  if(btn){state.page=btn.dataset.page;render();}
});
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("themeBtn").addEventListener("click",()=>{
  document.documentElement.classList.toggle("light");
  localStorage.setItem("nexora-theme",document.documentElement.classList.contains("light")?"light":"dark");
});
if(localStorage.getItem("nexora-theme")==="light")document.documentElement.classList.add("light");
$("appVersion").textContent="v"+VERSION;

onAuthStateChanged(auth,async user=>{
  stopListeners();state.user=user;
  if(!user){
    state.profile=null;state.records=[];state.tasks=[];state.team=[];
    $("appShell").classList.add("hidden");$("authScreen").classList.remove("hidden");
    return;
  }
  try{await loadProfile(user);}
  catch(error){
    console.error(error);
    alert("NEXORA data load nahi kar saka: "+friendlyError(error));
  }
});
```
