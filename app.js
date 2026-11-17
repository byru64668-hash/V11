import { auth, db } from "./firebase.js";
import { signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { signInAdmin, checkAdmin } from "./admin.js";

const $ = (id) => document.getElementById(id);
let currentUser = null, isAdmin = false, items = [], reports = [], feedback = [], history = [];
let soundOn = true, deferredInstall = null, unsubscribe = [];
const pages = ["home","inventory","add","reports","feedback","history","account"];

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.add("hidden"), 2600);
}
function clickSound() {
  if (!soundOn) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = 620;
    gain.gain.setValueAtTime(0.045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.075);
    osc.onended = () => ctx.close();
  } catch {}
}
document.addEventListener("click", (e) => { if (e.target.closest("button")) clickSound(); });

function navigate(page) {
  if (!pages.includes(page)) return;
  if (page === "add" && !isAdmin) { toast("Admin access is required."); return; }
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  $(page + "Page").classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("selected", b.dataset.nav === page));
  $("topDropdown").classList.add("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.nav)));
$("menuButton").addEventListener("click", () => $("topDropdown").classList.toggle("hidden"));
$("themeButton").addEventListener("click", toggleTheme);
$("accountTheme").addEventListener("click", toggleTheme);
function toggleTheme(){document.body.classList.toggle("dark");localStorage.setItem("st-theme",document.body.classList.contains("dark")?"dark":"light");$("themeButton").textContent=document.body.classList.contains("dark")?"☀️":"🌙";}
if(localStorage.getItem("st-theme")==="dark") toggleTheme();
$("soundButton").addEventListener("click", toggleSound);
$("accountSound").addEventListener("click", toggleSound);
function toggleSound(){soundOn=!soundOn;$("soundButton").textContent=soundOn?"🔊":"🔇";localStorage.setItem("st-sound",soundOn?"on":"off");toast(soundOn?"Click sounds enabled":"Click sounds muted");}
if(localStorage.getItem("st-sound")==="off"){soundOn=false;$("soundButton").textContent="🔇";}

async function ensureGuest() {
  if (!auth.currentUser) await signInAnonymously(auth);
}
function setRoleUI() {
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden",!isAdmin));
  $("roleButton").textContent = isAdmin ? "A" : "G";
  $("accountStatus").textContent = isAdmin ? "Signed in as Admin" : "Guest access — read only";
  $("adminLogin").classList.toggle("hidden",isAdmin);
  $("adminEmail").classList.toggle("hidden",isAdmin);
  $("adminPassword").classList.toggle("hidden",isAdmin);
}
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) { isAdmin=false; await ensureGuest(); return; }
  isAdmin = await checkAdmin(db,user.uid).catch(()=>false);
  setRoleUI();
  startDataListeners();
});
$("roleButton").addEventListener("click",()=>navigate("account"));
$("guestButton").addEventListener("click",async()=>{await signOut(auth);await signInAnonymously(auth);toast("Guest access ready.");});
$("adminLogin").addEventListener("click",async()=>{
  const email=$("adminEmail").value.trim(), password=$("adminPassword").value;
  if(!email||!password){toast("Enter the Admin email and password.");return;}
  try { await signInAdmin(auth,db,email,password); isAdmin=true; setRoleUI(); toast("Admin access granted."); }
  catch(e){toast(e.message||"Admin sign-in failed.");}
});
$("signOutButton").addEventListener("click",async()=>{await signOut(auth);await signInAnonymously(auth);toast("Signed out.");});

function listen(name, setter, render) {
  const unsub=onSnapshot(query(collection(db,name),orderBy("createdAt","desc")),snap=>{
    setter(snap.docs.map(d=>({id:d.id,...d.data()}))); render();
  },err=>{console.warn(name,err);toast("Could not load "+name+". Check Firebase setup.");});
  unsubscribe.push(unsub);
}
let listening=false;
function startDataListeners(){
  if(listening)return; listening=true;
  listen("inventory",v=>items=v,renderAll);
  listen("reports",v=>reports=v,renderReports);
  listen("feedback",v=>feedback=v,renderFeedback);
  listen("activity",v=>history=v,renderHistory);
}
function totals(){
  const total=items.reduce((s,x)=>s+(Number(x.quantity)||0),0);
  const borrowed=items.reduce((s,x)=>s+(Number(x.borrowed)||0),0);
  const repair=items.reduce((s,x)=>s+(Number(x.repair)||0),0);
  const missing=items.reduce((s,x)=>s+(Number(x.missing)||0),0);
  return {total,borrowed,repair,missing,available:Math.max(0,total-borrowed-repair-missing)};
}
function renderAll(){
  const t=totals();
  $("totalCount").textContent=t.total;$("availableCount").textContent=t.available;$("borrowedCount").textContent=t.borrowed;$("repairCount").textContent=t.repair;$("missingCount").textContent=t.missing;
  $("stockNotice").innerHTML=t.available===0?'<b>⚠ Out of stock</b><span>No available items at the moment.</span>':t.available<=5?'<b>✓ Low stocks</b><span>Stock status updates automatically.</span>':'<b>✓ In stocks</b><span>Stock status updates automatically.</span>';
  $("reportSummary").innerHTML=Object.entries(t).map(([k,v])=>`<div><b>${k.toUpperCase()}</b><br>${v}</div>`).join("");
  renderInventory();
}
function safe(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderInventory(){
  const search=$("inventorySearch").value.toLowerCase(), cat=$("categoryFilter").value, cond=$("conditionFilter").value;
  const filtered=items.filter(x=>(x.name||"").toLowerCase().includes(search)&&(!cat||x.category===cat)&&(!cond||x.condition===cond));
  $("inventoryList").innerHTML=filtered.length?filtered.map(x=>`<article class="item-card"><h3>${safe(x.name)}</h3><span class="pill">${safe(x.condition||"Good")}</span><div class="item-meta">Category: ${safe(x.category)}<br>Quantity: ${Number(x.quantity)||0} · Borrowed: ${Number(x.borrowed)||0}<br>Location: ${safe(x.location||"Not specified")}<br>Person responsible: ${safe(x.responsible||"Not specified")}</div><div class="item-actions">${isAdmin?`<button data-action="borrow" data-id="${x.id}">Borrow +1</button><button data-action="return" data-id="${x.id}">Return -1</button><button data-action="repair" data-id="${x.id}">Send to repair</button><button data-action="edit" data-id="${x.id}">Edit</button><button data-action="delete" data-id="${x.id}">Delete</button>`:"<span class='hint'>Guest view only</span>"}</div></article>`).join(""):"<p class='hint'>No inventory items found.</p>";
}
$("inventorySearch").addEventListener("input",renderInventory);$("categoryFilter").addEventListener("change",renderInventory);$("conditionFilter").addEventListener("change",renderInventory);

async function logActivity(action,details){await addDoc(collection(db,"activity"),{action,details,by:currentUser?.uid||"guest",createdAt:serverTimestamp()});}
$("itemForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!isAdmin){toast("Admin only.");return;}
  const f=new FormData(e.target),data={name:f.get("name").trim(),category:f.get("category"),quantity:Number(f.get("quantity")),borrowed:0,repair:0,missing:0,condition:f.get("condition"),location:f.get("location").trim(),responsible:f.get("responsible").trim(),notes:f.get("notes").trim(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  try{const ref=await addDoc(collection(db,"inventory"),data);await logActivity("Added item",data.name);e.target.reset();toast("Item saved.");navigate("inventory");}
  catch(err){toast("Save failed: "+err.message);}
});
$("inventoryList").addEventListener("click",async e=>{
  const b=e.target.closest("button[data-action]");if(!b||!isAdmin)return;
  const x=items.find(i=>i.id===b.dataset.id);if(!x)return;
  const ref=doc(db,"inventory",x.id),a=b.dataset.action;
  try{
    if(a==="borrow"){if(totals().available<1){toast("No available stock.");return;}await updateDoc(ref,{borrowed:(x.borrowed||0)+1,updatedAt:serverTimestamp()});await logActivity("Borrowed item",x.name);}
    if(a==="return"){if(!(x.borrowed||0)){toast("No borrowed quantity.");return;}await updateDoc(ref,{borrowed:x.borrowed-1,updatedAt:serverTimestamp()});await logActivity("Returned item",x.name);}
    if(a==="repair"){if(totals().available<1){toast("No available stock.");return;}await updateDoc(ref,{repair:(x.repair||0)+1,updatedAt:serverTimestamp()});await logActivity("Sent to repair",x.name);}
    if(a==="edit"){const name=prompt("Item name:",x.name);if(name===null)return;const qty=Number(prompt("Total quantity:",x.quantity));if(!name.trim()||!Number.isFinite(qty)||qty<0)return;await updateDoc(ref,{name:name.trim(),quantity:qty,updatedAt:serverTimestamp()});await logActivity("Edited item",name);}
    if(a==="delete"){if(!confirm("Delete this item?"))return;await deleteDoc(ref);await logActivity("Deleted item",x.name);}
    toast("Inventory updated.");
  }catch(err){toast("Update failed: "+err.message);}
});

$("reportForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await addDoc(collection(db,"reports"),{category:f.get("category"),description:f.get("description"),status:"Pending",createdAt:serverTimestamp()});e.target.reset();toast("Report submitted.");});
function renderReports(){$("reportsList").innerHTML=reports.map(r=>`<article class="item-card"><b>${safe(r.category)}</b><p>${safe(r.description)}</p><span class="pill">${safe(r.status||"Pending")}</span>${isAdmin?`<div class="item-actions"><button data-report="${r.id}" data-status="Under Review">Under Review</button><button data-report="${r.id}" data-status="Resolved">Resolved</button></div>`:""}</article>`).join("")||"<p class='hint'>No reports yet.</p>";}
$("reportsList").addEventListener("click",async e=>{const b=e.target.closest("[data-report]");if(!b||!isAdmin)return;await updateDoc(doc(db,"reports",b.dataset.report),{status:b.dataset.status});toast("Report status updated.");});
$("feedbackForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);await addDoc(collection(db,"feedback"),{rating:Number(f.get("rating")),comments:f.get("comments"),createdAt:serverTimestamp()});e.target.reset();toast("Thank you for your feedback.");});
function renderFeedback(){$("feedbackList").innerHTML=feedback.slice(0,10).map(f=>`<article class="item-card"><b>Rating: ${f.rating}/5</b><p>${safe(f.comments)}</p></article>`).join("");}
function renderHistory(){$("historyList").innerHTML=history.slice(0,60).map(h=>`<article class="item-card"><b>${safe(h.action)}</b><div class="item-meta">${safe(h.details)}</div></article>`).join("")||"<p class='hint'>No activity yet.</p>";}

function exportBackup(){
  const data={app:"SchoolTrack EAPIHS",exportedAt:new Date().toISOString(),inventory:items,reports,feedback,activity:history};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="SchoolTrack-EAPIHS-backup.json";a.click();URL.revokeObjectURL(url);toast("Backup downloaded.");
}
$("exportButton").addEventListener("click",exportBackup);$("quickBackupButton").addEventListener("click",exportBackup);$("historyBackup").addEventListener("click",exportBackup);
$("reportExport").addEventListener("click",()=>{
  const rows=[["Name","Category","Quantity","Borrowed","Repair","Missing","Condition","Location"],...items.map(x=>[x.name,x.category,x.quantity,x.borrowed||0,x.repair||0,x.missing||0,x.condition,x.location])];
  const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="SchoolTrack-Inventory-Report.csv";a.click();URL.revokeObjectURL(a.href);
});
$("restoreFile").addEventListener("change",async e=>{
  if(!isAdmin){toast("Admin only.");return;}const file=e.target.files[0];if(!file)return;
  try{const data=JSON.parse(await file.text());if(!Array.isArray(data.inventory))throw new Error("Invalid backup file.");if(!confirm("Restore inventory items from this backup?"))return;
    const batch=writeBatch(db);data.inventory.forEach(x=>{const ref=doc(collection(db,"inventory"));const {id,...clean}=x;batch.set(ref,{...clean,createdAt:serverTimestamp()});});await batch.commit();toast("Inventory restored.");}
  catch(err){toast("Restore failed: "+err.message);}
});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;});
$("installButton").addEventListener("click",async()=>{if(!deferredInstall){toast("Use your browser menu and choose Install app / Add to Home screen.");return;}deferredInstall.prompt();deferredInstall=null;});
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
ensureGuest().catch(err=>{console.error(err);$("accountStatus").textContent="Firebase setup is incomplete. Check firebase.js and Authentication settings.";});
