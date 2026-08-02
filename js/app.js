import { SEED_EMPLOYEES } from "./data.js";
import { firebaseConfig, FIRESTORE_PATH } from "./firebase.js";

firebase.initializeApp(firebaseConfig);
const auth=firebase.auth();
const db=firebase.firestore();
db.settings({ignoreUndefinedProperties:true});
const stateRef=db.collection(FIRESTORE_PATH[0]).doc(FIRESTORE_PATH[1]);

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const pad=n=>String(n).padStart(2,"0");
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const normCountry=v=>{const t=String(v||"").trim(),l=t.toLowerCase();if(l.includes("malaysia"))return"Malaysia";if(l.includes("thailand"))return"Thailand";if(l.includes("indonesia"))return"Indonesia";if(l.includes("finland"))return"Finland";return t||"Unassigned"};

const defaultProjects={
  malaysia_demo:{id:"malaysia_demo",name:"Malaysia Project",country:"Malaysia",active:true},
  thailand_demo:{id:"thailand_demo",name:"Thailand Project",country:"Thailand",active:true},
  indonesia_demo:{id:"indonesia_demo",name:"Indonesia Project",country:"Indonesia",active:true},
  finland_demo:{id:"finland_demo",name:"Finland Project",country:"Finland",active:true}
};

const state={
  projects:{},employees:{},assignments:{},issues:{},customCountries:{},
  country:"",view:"calendar",team:"all",calendarMode:"month",date:new Date()
};
let lastSaved="",saveTimer=null,appStarted=false,applyingRemote=false;

const employees=()=>Object.values(state.employees).filter(x=>x&&x.active!==false);
const projects=()=>Object.values(state.projects).filter(x=>x&&x.active!==false&&normCountry(x.country)===state.country);
const assignments=()=>Object.values(state.assignments).filter(Boolean);
const issues=()=>Object.values(state.issues||{}).filter(Boolean);
const countryIssues=()=>issues().filter(i=>normCountry(state.projects[i.projectId]?.country)===state.country);
const filteredEmployees=()=>employees().filter(e=>normCountry(e.country)===state.country&&(state.team==="all"||e.team===state.team));
const filteredAssignments=()=>{const ids=new Set(filteredEmployees().map(e=>e.id));return assignments().filter(a=>ids.has(a.employeeId))};

function countries(){return [...new Set([...employees().map(e=>normCountry(e.country)),...Object.values(state.projects).filter(Boolean).map(p=>normCountry(p.country)),...Object.values(state.customCountries||{}).filter(Boolean)])].filter(Boolean).sort()}
function seedLocal(){state.customCountries=state.customCountries||{};state.issues=state.issues||{};if(!Object.keys(state.employees).length)state.employees=Object.fromEntries(SEED_EMPLOYEES.map(e=>[e.id,{...e,country:normCountry(e.country)}]));if(!Object.keys(state.projects).length)state.projects=structuredClone(defaultProjects);if(!state.country||!countries().includes(state.country))state.country=countries()[0]||"Malaysia"}
function serialise(){return JSON.stringify({projects:state.projects,employees:state.employees,assignments:state.assignments,issues:state.issues,customCountries:state.customCountries})}
function setSync(t,type=""){$("syncText").textContent=t;$("syncDot").className=`sync-dot ${type}`}
function scheduleSave(){if(applyingRemote)return;clearTimeout(saveTimer);setSync("Saving…");saveTimer=setTimeout(saveState,350)}
async function saveState(){const payload={version:3,projects:state.projects,employees:state.employees,assignments:state.assignments,issues:state.issues,customCountries:state.customCountries,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};await stateRef.set(payload,{merge:false});lastSaved=serialise();setSync("Saved online","ok")}

async function initialiseFirestore(){
  renderAll();
  try{
    setSync("Connecting…");
    const snap=await stateRef.get();
    if(snap.exists){
      const d=snap.data();applyingRemote=true;
      state.projects=d.projects||state.projects;state.employees=d.employees||state.employees;state.assignments=d.assignments||state.assignments;state.issues=d.issues||state.issues;state.customCountries=d.customCountries||state.customCountries;
      applyingRemote=false;
    }
    Object.values(state.projects).forEach(p=>{if(p)p.country=normCountry(p.country)});
    Object.values(state.employees).forEach(e=>{if(e)e.country=normCountry(e.country)});
    const names=new Set(employees().map(e=>e.name.toLowerCase()));SEED_EMPLOYEES.forEach(e=>{if(!names.has(e.name.toLowerCase()))state.employees[e.id]=e});
    seedLocal();renderAll();await saveState();
    stateRef.onSnapshot(s=>{if(!s.exists)return;const d=s.data(),incoming=JSON.stringify({projects:d.projects||{},employees:d.employees||{},assignments:d.assignments||{},issues:d.issues||{},customCountries:d.customCountries||{}});if(incoming===lastSaved)return;applyingRemote=true;state.projects=d.projects||{};state.employees=d.employees||{};state.assignments=d.assignments||{};state.issues=d.issues||{};state.customCountries=d.customCountries||{};lastSaved=serialise();applyingRemote=false;seedLocal();renderAll();setSync("Updated online","ok")},e=>setSync(e.code||"Sync error","error"));
  }catch(e){console.error(e);setSync(e.code||"Offline","error")}
}

function metric(label,value){return `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`}
function renderCountryTree(){
  $("countryTree").innerHTML=countries().map(c=>{const open=state.country===c,count=employees().filter(e=>normCountry(e.country)===c).length;return `<div class="country-group ${open?"open":""}"><button class="country-toggle" data-country-toggle="${esc(c)}"><span>${esc(c)}</span><small>${count}</small></button><div class="country-menu">${["calendar","manpower","projects","issues"].map(v=>`<button data-country="${esc(c)}" data-view="${v}" class="${open&&state.view===v?"active":""}">${v==="calendar"?"Team Calendar":v==="issues"?"Project Issues":v[0].toUpperCase()+v.slice(1)}</button>`).join("")}</div></div>`}).join("");
}
function updateHeader(){
  const labels={calendar:"Team Calendar",manpower:"Manpower",projects:"Projects",issues:"Project Issues"};
  $("pageTitle").textContent=labels[state.view];$("pageSubtitle").textContent=`${state.country} ${labels[state.view].toLowerCase()}`;$("countryBadge").textContent=state.country;$("mobileContext").textContent=`${state.country} · ${labels[state.view]}`;
  $("primaryActionBtn").hidden=state.view!=="calendar";$("primaryActionBtn").textContent="+ Assignment";
  ["calendar","manpower","projects","issues"].forEach(v=>$(v+"View").hidden=state.view!==v);
}
function renderAll(){seedLocal();renderCountryTree();updateHeader();renderCalendar();renderManpower();renderProjects();renderIssues();populateAssignmentSelects();populateIssueSelects()}
function renderCalendar(){
  $("monthModeBtn").classList.toggle("active",state.calendarMode==="month");$("dayModeBtn").classList.toggle("active",state.calendarMode==="day");
  if(state.calendarMode==="day")return renderDay();
  const y=state.date.getFullYear(),m=state.date.getMonth(),prefix=`${y}-${pad(m+1)}`,monthItems=filteredAssignments().filter(a=>a.date.startsWith(prefix));
  $("calendarMetrics").innerHTML=metric("Assignments",monthItems.length)+metric("Manpower",filteredEmployees().length)+metric("Booked hours",monthItems.reduce((t,a)=>t+Number(a.hours||0),0)+"h");
  $("periodLabel").textContent=state.date.toLocaleString("en",{month:"long",year:"numeric"});
  const first=new Date(y,m,1),start=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate(),prior=new Date(y,m,0).getDate();let cells="";
  for(let i=0;i<42;i++){let d,muted=false;if(i<start){d=new Date(y,m-1,prior-start+i+1);muted=true}else if(i>=start+total){d=new Date(y,m+1,i-start-total+1);muted=true}else d=new Date(y,m,i-start+1);const key=dateKey(d),items=filteredAssignments().filter(a=>a.date===key),groups=Object.values(items.reduce((o,a)=>{(o[a.projectId]||(o[a.projectId]={projectId:a.projectId,items:[]})).items.push(a);return o},{}));cells+=`<div class="day ${muted?"muted":""} ${key===dateKey(new Date())?"today":""}" data-date="${key}"><button class="day-number" data-open-day="${key}">${d.getDate()}</button>${groups.map(g=>{const p=state.projects[g.projectId],pending=g.items.some(a=>a.status==="Pending"),hours=g.items.reduce((t,a)=>t+Number(a.hours||0),0);return `<button class="event ${pending?"pending":""}" data-open-group="${key}"><b>${esc(p?.name||"Unknown")}</b><small>${g.items.length} manpower · ${hours}h</small></button>`}).join("")}</div>`}
  $("calendarContainer").innerHTML=`<div class="weekdays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="calendar-grid">${cells}</div>`;
}
function renderDay(){const key=dateKey(state.date),items=filteredAssignments().filter(a=>a.date===key),groups=Object.values(items.reduce((o,a)=>{(o[a.projectId]||(o[a.projectId]={projectId:a.projectId,items:[]})).items.push(a);return o},{}));$("periodLabel").textContent=state.date.toLocaleDateString("en",{weekday:"long",day:"numeric",month:"long",year:"numeric"});$("calendarMetrics").innerHTML=metric("Assignments",items.length)+metric("Manpower",new Set(items.map(a=>a.employeeId)).size)+metric("Booked hours",items.reduce((t,a)=>t+Number(a.hours||0),0)+"h");$("calendarContainer").innerHTML=`<div class="daily-view"><div class="daily-summary"><span class="daily-pill">${items.length} assignments</span><span class="daily-pill">${groups.length} projects</span></div><div class="daily-list">${groups.map((g,i)=>{const p=state.projects[g.projectId],hours=g.items.reduce((t,a)=>t+Number(a.hours||0),0),pending=g.items.some(a=>a.status==="Pending");return `<div class="daily-card ${pending?"pending":""}"><strong>${pad(8+i)}:00</strong><div><h3>${esc(p?.name||"Unknown")}</h3><p>${g.items.length} manpower · ${hours}h</p><p>${g.items.map(a=>esc(state.employees[a.employeeId]?.name||"Unknown")).join(", ")}</p></div><div class="row-actions">${g.items.map(a=>`<button class="small-btn" data-edit-assignment="${a.id}">${esc(state.employees[a.employeeId]?.initials||"Edit")}</button>`).join("")}</div></div>`}).join("")||"<p>No assignments for this day.</p>"}</div></div>`}
function renderManpower(){const q=$("employeeSearch").value.trim().toLowerCase(),rows=filteredEmployees().filter(e=>[e.name,e.position,e.department,e.company].join(" ").toLowerCase().includes(q));$("employeeTable").innerHTML=rows.length?`<table class="data-table"><thead><tr><th>Employee</th><th>Position</th><th>Team</th><th>Department</th><th>Actions</th></tr></thead><tbody>${rows.map(e=>`<tr><td><span class="person-cell"><span class="avatar">${esc(e.initials)}</span>${esc(e.name)}</span></td><td>${esc(e.position)}</td><td>${esc(e.team)}</td><td>${esc(e.department)}</td><td><div class="row-actions"><button class="small-btn" data-edit-employee="${e.id}">Edit</button><button class="small-btn delete" data-delete-employee="${e.id}">Delete</button></div></td></tr>`).join("")}</tbody></table>`:"<p>No matching manpower.</p>"}
function renderProjects(){$("projectGrid").innerHTML=projects().map(p=>{const count=assignments().filter(a=>a.projectId===p.id).length;return `<article class="project-card"><header><strong>${esc(p.name)}</strong><div class="row-actions"><button class="small-btn" data-edit-project="${p.id}">Edit</button><button class="small-btn delete" data-delete-project="${p.id}">Delete</button></div></header><p>${count} assignment${count===1?"":"s"}</p></article>`}).join("")||"<p>No projects.</p>"}

function issueClass(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-")}
function populateIssueSelects(){
  const projectOptions=projects().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  $("issueProject").innerHTML=projectOptions;
  $("issueOwner").innerHTML=`<option value="">Unassigned</option>`+employees().filter(e=>normCountry(e.country)===state.country).map(e=>`<option value="${e.id}">${esc(e.name)} — ${esc(e.position)}</option>`).join("");
  const selected=$("issueProjectFilter").value||"all";
  $("issueProjectFilter").innerHTML=`<option value="all">All projects</option>`+projectOptions;
  if([...$("issueProjectFilter").options].some(o=>o.value===selected))$("issueProjectFilter").value=selected;
  const statuses=["Open","Assigned","In Progress","Waiting Vendor","Waiting Client","Rectified","Closed"], priorities=["Critical","High","Medium","Low"];
  if($("issueStatusFilter").options.length===1)$("issueStatusFilter").innerHTML=`<option value="all">All statuses</option>`+statuses.map(x=>`<option>${x}</option>`).join("");
  if($("issuePriorityFilter").options.length===1)$("issuePriorityFilter").innerHTML=`<option value="all">All priorities</option>`+priorities.map(x=>`<option>${x}</option>`).join("");
}
function renderIssues(){
  populateIssueSelects();
  const today=dateKey(new Date()), all=countryIssues(), q=$("issueSearch").value.trim().toLowerCase(), pf=$("issueProjectFilter").value, sf=$("issueStatusFilter").value, rf=$("issuePriorityFilter").value;
  const rows=all.filter(i=>{const owner=state.employees[i.ownerId]?.name||"";return (!q||[i.number,i.title,i.description,i.location,owner].join(" ").toLowerCase().includes(q))&&(pf==="all"||i.projectId===pf)&&(sf==="all"||i.status===sf)&&(rf==="all"||i.priority===rf)}).sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  const open=all.filter(i=>i.status!=="Closed").length, critical=all.filter(i=>i.priority==="Critical"&&i.status!=="Closed").length, overdue=all.filter(i=>i.dueDate&&i.dueDate<today&&!['Closed','Rectified'].includes(i.status)).length, closed=all.filter(i=>i.status==="Closed").length;
  $("issueMetrics").innerHTML=metric("Open issues",open)+metric("Critical",critical)+metric("Overdue",overdue)+metric("Closed",closed);
  $("issueTable").innerHTML=rows.length?`<table class="data-table"><thead><tr><th>Issue</th><th>Project</th><th>Category</th><th>Priority</th><th>Status</th><th>Owner</th><th>Due date</th><th>Actions</th></tr></thead><tbody>${rows.map(i=>{const p=state.projects[i.projectId],owner=state.employees[i.ownerId],isOver=i.dueDate&&i.dueDate<today&&!['Closed','Rectified'].includes(i.status);return `<tr><td><div class="issue-title-cell"><span class="issue-number">${esc(i.number)}</span><strong>${esc(i.title)}</strong><small>${esc(i.location||i.description||'No details')}</small></div></td><td>${esc(p?.name||'Unknown')}</td><td>${esc(i.category)}</td><td><span class="priority-chip priority-${issueClass(i.priority)}">${esc(i.priority)}</span></td><td><span class="status-chip status-${issueClass(i.status)}">${esc(i.status)}</span></td><td>${esc(owner?.name||'Unassigned')}</td><td class="${isOver?'overdue-text':''}">${esc(i.dueDate||'—')}</td><td><div class="row-actions"><button class="small-btn" data-edit-issue="${i.id}">Edit</button><button class="small-btn delete" data-delete-issue="${i.id}">Delete</button></div></td></tr>`}).join("")}</tbody></table>`:"<p>No matching project issues.</p>";
}
function nextIssueNumber(){const nums=issues().map(i=>Number(String(i.number||"").match(/\d+/)?.[0]||0));return `ISS-${String(Math.max(0,...nums)+1).padStart(3,"0")}`}
function openIssue(id=null){populateIssueSelects();const i=id?state.issues[id]:null;$("issueDialogTitle").textContent=i?"Edit Project Issue":"Add Project Issue";$("issueId").value=i?.id||"";$("issueProject").value=i?.projectId||projects()[0]?.id||"";$("issueNumber").value=i?.number||nextIssueNumber();$("issueTitle").value=i?.title||"";$("issueDescription").value=i?.description||"";$("issueCategory").value=i?.category||"Quality";$("issuePriority").value=i?.priority||"Medium";$("issueStatus").value=i?.status||"Open";$("issueOwner").value=i?.ownerId||"";$("issueLocation").value=i?.location||"";$("issueDueDate").value=i?.dueDate||"";$("issueAction").value=i?.action||"";$("deleteIssueBtn").hidden=!i;$("issueDialog").showModal()}

function populateAssignmentSelects(){$("assignmentProject").innerHTML=projects().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");$("assignmentEmployee").innerHTML=filteredEmployees().map(e=>`<option value="${e.id}">${esc(e.name)} — ${esc(e.position)}</option>`).join("")}
function openAssignment(id=null,date=null){populateAssignmentSelects();const a=id?state.assignments[id]:null;$("assignmentDialogTitle").textContent=a?"Edit Assignment":"New Assignment";$("assignmentId").value=a?.id||"";$("assignmentProject").value=a?.projectId||projects()[0]?.id||"";$("assignmentEmployee").value=a?.employeeId||filteredEmployees()[0]?.id||"";$("assignmentStart").value=a?.date||date||dateKey(new Date());$("assignmentEnd").value=a?.date||date||dateKey(new Date());$("assignmentHours").value=a?.hours||8;$("assignmentStatus").value=a?.status||"Confirmed";$("deleteAssignmentBtn").hidden=!a;$("assignmentDialog").showModal()}
function openEmployee(id=null){const e=id?state.employees[id]:null;$("employeeDialogTitle").textContent=e?"Edit Manpower":"Add Manpower";$("employeeId").value=e?.id||"";$("employeeName").value=e?.name||"";$("employeePosition").value=e?.position||"";$("employeeTeam").value=e?.team||"project";$("employeeDepartment").value=e?.department||"";$("employeeCountry").value=state.country;$("employeeCompany").value=e?.company||"";$("employeeDialog").showModal()}
function openProject(id=null){const p=id?state.projects[id]:null;$("projectDialogTitle").textContent=p?"Edit Project":"Add Project";$("projectId").value=p?.id||"";$("projectName").value=p?.name||"";$("projectCountry").value=state.country;$("projectDialog").showModal()}

$("countryTree").onclick=e=>{const t=e.target.closest("[data-country-toggle]"),w=e.target.closest("[data-view]");if(t){state.country=t.dataset.countryToggle;renderAll()}if(w){state.country=w.dataset.country;state.view=w.dataset.view;renderAll();closeMenu()}}
$("calendarContainer").onclick=e=>{const d=e.target.closest("[data-open-day],[data-open-group]"),a=e.target.closest("[data-edit-assignment]");if(a)openAssignment(a.dataset.editAssignment);else if(d){state.date=new Date((d.dataset.openDay||d.dataset.openGroup)+"T00:00");state.calendarMode="day";renderCalendar()}}
$("employeeTable").onclick=e=>{const ed=e.target.closest("[data-edit-employee]"),del=e.target.closest("[data-delete-employee]");if(ed)openEmployee(ed.dataset.editEmployee);if(del){const id=del.dataset.deleteEmployee,emp=state.employees[id],linked=assignments().filter(a=>a.employeeId===id);if(confirm(`Delete ${emp.name}${linked.length?` and ${linked.length} linked assignment(s)`:""}?`)){linked.forEach(a=>delete state.assignments[a.id]);delete state.employees[id];scheduleSave();renderAll()}}}
$("issueTable").onclick=e=>{const ed=e.target.closest("[data-edit-issue]"),del=e.target.closest("[data-delete-issue]");if(ed)openIssue(ed.dataset.editIssue);if(del){const id=del.dataset.deleteIssue;if(confirm(`Delete ${state.issues[id]?.number||"this issue"}?`)){delete state.issues[id];scheduleSave();renderIssues()}}}
$("projectGrid").onclick=e=>{const ed=e.target.closest("[data-edit-project]"),del=e.target.closest("[data-delete-project]");if(ed)openProject(ed.dataset.editProject);if(del){const id=del.dataset.deleteProject,p=state.projects[id],linked=assignments().filter(a=>a.projectId===id);if(confirm(`Delete ${p.name}${linked.length?` and ${linked.length} linked assignment(s)`:""}?`)){linked.forEach(a=>delete state.assignments[a.id]);delete state.projects[id];scheduleSave();renderAll()}}}

$("assignmentForm").onsubmit=e=>{e.preventDefault();const start=$("assignmentStart").value,end=$("assignmentEnd").value;if(end<start)return alert("End date must be on or after start date.");const existing=$("assignmentId").value;if(existing)delete state.assignments[existing];let d=new Date(start+"T00:00"),last=new Date(end+"T00:00");while(d<=last){const id=existing&&start===end?existing:uid("asg");state.assignments[id]={id,projectId:$("assignmentProject").value,employeeId:$("assignmentEmployee").value,date:dateKey(d),hours:Number($("assignmentHours").value),status:$("assignmentStatus").value};d.setDate(d.getDate()+1)}$("assignmentDialog").close();scheduleSave();renderAll()}
$("deleteAssignmentBtn").onclick=()=>{const id=$("assignmentId").value;if(id&&confirm("Delete this assignment?")){delete state.assignments[id];$("assignmentDialog").close();scheduleSave();renderAll()}}
$("employeeForm").onsubmit=e=>{e.preventDefault();const id=$("employeeId").value||uid("emp"),name=$("employeeName").value.trim(),initials=name.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();state.employees[id]={id,name,initials,position:$("employeePosition").value.trim(),team:$("employeeTeam").value,department:$("employeeDepartment").value.trim(),country:state.country,company:$("employeeCompany").value.trim(),active:true};$("employeeDialog").close();scheduleSave();renderAll()}
$("issueForm").onsubmit=e=>{e.preventDefault();const id=$("issueId").value||uid("issue"),old=state.issues[id]||{};state.issues[id]={...old,id,number:$("issueNumber").value,projectId:$("issueProject").value,title:$("issueTitle").value.trim(),description:$("issueDescription").value.trim(),category:$("issueCategory").value,priority:$("issuePriority").value,status:$("issueStatus").value,ownerId:$("issueOwner").value,location:$("issueLocation").value.trim(),dueDate:$("issueDueDate").value,action:$("issueAction").value.trim(),createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};$("issueDialog").close();scheduleSave();renderAll()}
$("deleteIssueBtn").onclick=()=>{const id=$("issueId").value;if(id&&confirm("Delete this issue?")){delete state.issues[id];$("issueDialog").close();scheduleSave();renderAll()}}
$("projectForm").onsubmit=e=>{e.preventDefault();const id=$("projectId").value||uid("project");state.projects[id]={id,name:$("projectName").value.trim(),country:state.country,active:true};$("projectDialog").close();scheduleSave();renderAll()}


$("addCountryBtn").onclick=()=>{$("countryName").value="";$("countryDialog").showModal()};
$("countryForm").onsubmit=e=>{
  e.preventDefault();
  const name=normCountry($("countryName").value.trim());
  if(!name)return;
  const key=name.toLowerCase().replace(/[^a-z0-9]+/g,"_");
  state.customCountries[key]=name;
  state.country=name;
  $("countryDialog").close();
  scheduleSave();
  renderAll();
};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$("primaryActionBtn").onclick=()=>openAssignment();$("quickAddBtn").onclick=()=>state.view==="calendar"?openAssignment():state.view==="manpower"?openEmployee():state.view==="issues"?openIssue():openProject();$("addEmployeeBtn").onclick=()=>openEmployee();$("addProjectBtn").onclick=()=>openProject();$("addIssueBtn").onclick=()=>openIssue();$("employeeSearch").oninput=renderManpower;$("issueSearch").oninput=renderIssues;$("issueProjectFilter").onchange=renderIssues;$("issueStatusFilter").onchange=renderIssues;$("issuePriorityFilter").onchange=renderIssues;
$("monthModeBtn").onclick=()=>{state.calendarMode="month";renderCalendar()};$("dayModeBtn").onclick=()=>{state.calendarMode="day";renderCalendar()};$("prevBtn").onclick=()=>{state.calendarMode==="day"?state.date.setDate(state.date.getDate()-1):state.date.setMonth(state.date.getMonth()-1);renderCalendar()};$("nextBtn").onclick=()=>{state.calendarMode==="day"?state.date.setDate(state.date.getDate()+1):state.date.setMonth(state.date.getMonth()+1);renderCalendar()};$("todayBtn").onclick=()=>{state.date=new Date();renderCalendar()};
$("teamFilter").onclick=e=>{const b=e.target.closest("[data-team]");if(!b)return;state.team=b.dataset.team;document.querySelectorAll("[data-team]").forEach(x=>x.classList.toggle("active",x===b));renderAll()}

function openMenu(){$("sidebar").classList.add("open");$("backdrop").classList.add("visible")}function closeMenu(){$("sidebar").classList.remove("open");$("backdrop").classList.remove("visible")}$("menuBtn").onclick=openMenu;$("closeMenuBtn").onclick=closeMenu;$("backdrop").onclick=closeMenu;
$("logoutBtn").onclick=()=>auth.signOut();
$("loginForm").onsubmit=async e=>{e.preventDefault();$("loginMessage").textContent="Signing in…";$("loginBtn").disabled=true;try{await auth.signInWithEmailAndPassword($("loginEmail").value.trim(),$("loginPassword").value)}catch(err){$("loginMessage").textContent=err.code==="auth/invalid-credential"?"Incorrect email or password.":`${err.code||""} ${err.message||err}`}finally{$("loginBtn").disabled=false}};
auth.onAuthStateChanged(async user=>{
  if(user){
    $("loginScreen").hidden=true;
    $("loginScreen").style.display="none";
    $("app").hidden=false;
    $("app").style.display="";
    document.body.classList.add("authenticated");
    document.body.classList.remove("signed-out");
    document.body.style.overflow="";
    $("userEmail").textContent=user.email||"";
    seedLocal();
    renderAll();
    if(!appStarted){
      appStarted=true;
      initialiseFirestore();
    }
  }else{
    $("app").hidden=true;
    $("app").style.display="none";
    $("loginScreen").hidden=false;
    $("loginScreen").style.display="grid";
    document.body.classList.remove("authenticated");
    document.body.classList.add("signed-out");
    document.body.style.overflow="hidden";
    $("loginMessage").textContent="";
    $("loginPassword").value="";
  }
});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.error));