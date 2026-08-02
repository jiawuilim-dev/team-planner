const firebaseConfig={apiKey:"AIzaSyB2BiCD0Va9TxY9KYtCEh8o4oV5PMiayYU",authDomain:"team-planner-3b86d.firebaseapp.com",projectId:"team-planner-3b86d",storageBucket:"team-planner-3b86d.firebasestorage.app",messagingSenderId:"984036405194",appId:"1:984036405194:web:3ce489ab14e808df726933"};
firebase.initializeApp(firebaseConfig);
const db=firebase.firestore();
db.settings({ignoreUndefinedProperties:true});
const stateRef=db.collection("planner").doc("v2");

const state={projects:{},employees:{},assignments:{},team:"all",country:"",month:new Date()};
const defaultProjects={
  alpha:{id:"alpha",name:"Alpha Site Expansion",country:"Malaysia",active:true},
  beta:{id:"beta",name:"Beta Maintenance",country:"Malaysia",active:true},
  gamma:{id:"gamma",name:"Gamma Commissioning",country:"Thailand",active:true},
  delta:{id:"delta",name:"Delta Retrofit",country:"Indonesia",active:true}
};
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid=prefix=>prefix+"_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const employeeValues=()=>Object.values(state.employees).filter(x=>x&&x.active!==false);
const projectValues=()=>Object.values(state.projects).filter(x=>x&&x.active!==false&&x.country===state.country);
const assignmentValues=()=>Object.values(state.assignments).filter(Boolean);
let applyingRemote=false,saveTimer=null,lastSerialized="";

function setSync(text,type=""){ $("syncText").textContent=text;$("syncDot").className="sync-dot "+type; }
function serialize(){return JSON.stringify({projects:state.projects,employees:state.employees,assignments:state.assignments});}
function scheduleSave(){if(applyingRemote)return;clearTimeout(saveTimer);setSync("Saving…");saveTimer=setTimeout(saveState,350);}
async function saveState(){const data={version:2,projects:state.projects,employees:state.employees,assignments:state.assignments,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};await stateRef.set(data,{merge:false});lastSerialized=serialize();setSync("Saved online","ok");}

function mergeSeedEmployees(){
  const existingNames=new Set(employeeValues().map(e=>e.name.toLowerCase()));
  window.SEED_EMPLOYEES.forEach(emp=>{
    if(!existingNames.has(emp.name.toLowerCase())) state.employees[emp.id]=emp;
  });
}
async function initialise(){
  try{
    setSync("Loading…");
    const snap=await stateRef.get();
    if(snap.exists){
      const d=snap.data();
      state.projects=d.projects||{};
      state.employees=d.employees||{};
      state.assignments=d.assignments||{};
    }else{
      state.projects=structuredClone(defaultProjects);
      state.employees=Object.fromEntries(window.SEED_EMPLOYEES.map(e=>[e.id,e]));
      state.assignments={};
    }
    if(!Object.keys(state.projects).length) state.projects=structuredClone(defaultProjects);
    Object.values(state.projects).forEach(project=>{if(!project.country)project.country="Malaysia"});
    mergeSeedEmployees();
    ensureSelectedCountry();
    await saveState();
    stateRef.onSnapshot(s=>{
      if(!s.exists)return;
      const d=s.data();
      const incoming=JSON.stringify({projects:d.projects||{},employees:d.employees||{},assignments:d.assignments||{}});
      if(incoming===lastSerialized)return;
      applyingRemote=true;
      state.projects=d.projects||{};
      state.employees=d.employees||{};
      state.assignments=d.assignments||{};
      lastSerialized=serialize();
      applyingRemote=false;
      renderAll();
      setSync("Updated online","ok");
    },e=>setSync(e.code||"Sync error","error"));
    renderAll();
  }catch(e){console.error(e);setSync(`${e.code||""} ${e.message||e}`,"error");}
}

function countryOptions(){
  return [...new Set(employeeValues().map(e=>e.country).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
function ensureSelectedCountry(){
  const countries=countryOptions();
  if(!state.country || !countries.includes(state.country)) state.country=countries[0]||"Malaysia";
}
function renderCountryNavigation(){
  ensureSelectedCountry();
  $("sidebarCountryList").innerHTML=countryOptions().map(country=>
    `<button class="country-nav-btn ${state.country===country?"active":""}" data-country="${esc(country)}">${esc(country)}</button>`
  ).join("");
  document.querySelectorAll("[data-country]").forEach(button=>{
    button.onclick=()=>{
      state.country=button.dataset.country;
      renderAll();
    };
  });
  $("activeCountryLabel").textContent=state.country;
  const activeView=document.querySelector(".nav-btn.active")?.dataset.view||"calendar";
  $("viewSub").textContent=activeView==="calendar"?`${state.country} manpower assignments`:activeView==="manpower"?`${state.country} employee directory`:`${state.country} projects`;
}
function filteredEmployees(){
  return employeeValues().filter(e=>
    e.country===state.country &&
    (state.team==="all"||e.team===state.team)
  );
}
function manpowerEmployees(){
  return filteredEmployees();
}
function filteredAssignments(){const allowed=new Set(filteredEmployees().map(e=>e.id));return assignmentValues().filter(a=>allowed.has(a.employeeId));}
function renderAll(){renderCountryNavigation();renderCalendar();renderEmployees();renderProjects();populateSelects();populateProjectCountry();}

function renderCalendar(){
  const y=state.month.getFullYear(),m=state.month.getMonth();
  $("monthLabel").textContent=state.month.toLocaleString("en",{month:"long",year:"numeric"});
  const monthAssignments=filteredAssignments().filter(a=>a.date.startsWith(`${y}-${pad(m+1)}`));
  $("metricAssignments").textContent=monthAssignments.length;
  $("metricManpower").textContent=filteredEmployees().length;
  $("metricHours").textContent=monthAssignments.reduce((t,a)=>t+Number(a.hours||0),0)+"h";
  const first=new Date(y,m,1),start=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate(),prior=new Date(y,m,0).getDate();
  let html="";
  for(let i=0;i<42;i++){
    let d,muted=false;
    if(i<start){d=new Date(y,m-1,prior-start+i+1);muted=true}
    else if(i>=start+total){d=new Date(y,m+1,i-start-total+1);muted=true}
    else d=new Date(y,m,i-start+1);
    const key=dateKey(d),today=key===dateKey(new Date());
    const events=filteredAssignments().filter(a=>a.date===key);
    html+=`<div class="day ${muted?"muted":""} ${today?"today":""}" data-date="${key}">
      <div class="day-num">${d.getDate()}</div>
      ${events.map(a=>{const p=state.projects[a.projectId],e=state.employees[a.employeeId];return `<button class="event ${a.status==="Pending"?"pending":""}" data-assignment="${a.id}"><b>${esc(p?.name||"Unknown project")}</b><small>${esc(e?.name||"Unknown")} · ${a.hours}h</small></button>`}).join("")}
    </div>`;
  }
  $("calendarGrid").innerHTML=html;
  document.querySelectorAll(".event").forEach(b=>b.onclick=()=>openAssignment(b.dataset.assignment));
  document.querySelectorAll(".day").forEach(cell=>cell.ondblclick=()=>openAssignment(null,cell.dataset.date));
}

function renderEmployees(){
  const q=$("employeeSearch").value.trim().toLowerCase();
  const rows=manpowerEmployees().filter(e=>[e.name,e.position,e.country,e.department,e.company].join(" ").toLowerCase().includes(q));
  $("employeeList").innerHTML=rows.length?`<table class="data-table"><thead><tr><th>Employee</th><th>Position</th><th>Team</th><th>Country</th><th>Department</th><th>Actions</th></tr></thead><tbody>${rows.map(e=>`<tr><td><span class="person-cell"><span class="avatar">${esc(e.initials)}</span>${esc(e.name)}</span></td><td>${esc(e.position)}</td><td>${esc(e.team)}</td><td>${esc(e.country)}</td><td>${esc(e.department)}</td><td><div class="row-actions"><button class="small-btn" data-edit-employee="${e.id}">Edit</button><button class="small-btn delete" data-delete-employee="${e.id}">Delete</button></div></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No matching manpower.</div>`;
  document.querySelectorAll("[data-edit-employee]").forEach(b=>b.onclick=()=>openEmployee(b.dataset.editEmployee));
  document.querySelectorAll("[data-delete-employee]").forEach(b=>b.onclick=()=>deleteEmployee(b.dataset.deleteEmployee));
}

function renderProjects(){
  $("projectList").innerHTML=projectValues().map(p=>{
    const count=assignmentValues().filter(a=>a.projectId===p.id).length;
    return `<article class="project-card"><header><strong>${esc(p.name)}</strong></header><p>${esc(p.country)} · ${count} assignment${count===1?"":"s"}</p></article>`;
  }).join("")||`<div class="empty">No projects.</div>`;
}

function populateProjectCountry(){
  $("projectCountry").innerHTML=countryOptions().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  $("projectCountry").value=state.country;
}
function populateSelects(){
  $("assignmentProject").innerHTML=projectValues().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  $("assignmentEmployee").innerHTML=filteredEmployees().map(e=>`<option value="${e.id}">${esc(e.name)} — ${esc(e.position)}</option>`).join("");
}

function openAssignment(id=null,date=null){
  populateSelects();
  const a=id?state.assignments[id]:null;
  $("assignmentTitle").textContent=a?"Edit Assignment":"New Assignment";
  $("assignmentId").value=a?.id||"";
  $("assignmentProject").value=a?.projectId||projectValues()[0]?.id||"";
  $("assignmentEmployee").value=a?.employeeId||filteredEmployees()[0]?.id||"";
  $("assignmentStart").value=a?.date||date||dateKey(new Date());
  $("assignmentEnd").value=a?.date||date||dateKey(new Date());
  $("assignmentHours").value=a?.hours||8;
  $("assignmentStatus").value=a?.status||"Confirmed";
  $("deleteAssignmentBtn").hidden=!a;
  $("assignmentDialog").showModal();
}
function openEmployee(id=null){
  const e=id?state.employees[id]:null;
  $("employeeTitle").textContent=e?"Edit Manpower":"Add Manpower";
  $("employeeId").value=e?.id||"";
  $("employeeName").value=e?.name||"";
  $("employeePosition").value=e?.position||"";
  $("employeeTeam").value=e?.team||"project";
  $("employeeCountry").value=e?.country||"";
  $("employeeDepartment").value=e?.department||"";
  $("employeeCompany").value=e?.company||"";
  $("employeeDialog").showModal();
}
function deleteEmployee(id){
  const e=state.employees[id];if(!e)return;
  const linked=assignmentValues().filter(a=>a.employeeId===id);
  if(!confirm(`Delete ${e.name}${linked.length?` and ${linked.length} linked assignment(s)`:""}?`))return;
  linked.forEach(a=>delete state.assignments[a.id]);
  delete state.employees[id];scheduleSave();renderAll();
}
function deleteProject(id){
  const p=state.projects[id];if(!p)return;
  const linked=assignmentValues().filter(a=>a.projectId===id);
  if(!confirm(`Delete ${p.name}${linked.length?` and ${linked.length} linked assignment(s)`:""}?`))return;
  linked.forEach(a=>delete state.assignments[a.id]);
  delete state.projects[id];scheduleSave();renderAll();
}

$("assignmentForm").onsubmit=e=>{
  e.preventDefault();
  const start=$("assignmentStart").value,end=$("assignmentEnd").value;
  if(end<start){alert("End date must be on or after start date.");return}
  const existing=$("assignmentId").value;
  if(existing) delete state.assignments[existing];
  let d=new Date(start+"T00:00"),last=new Date(end+"T00:00");
  while(d<=last){
    const id=existing&&start===end?existing:uid("asg");
    state.assignments[id]={id,projectId:$("assignmentProject").value,employeeId:$("assignmentEmployee").value,date:dateKey(d),hours:Number($("assignmentHours").value),status:$("assignmentStatus").value};
    d.setDate(d.getDate()+1);
  }
  $("assignmentDialog").close();scheduleSave();renderAll();
};
$("deleteAssignmentBtn").onclick=()=>{
  const id=$("assignmentId").value;if(!id)return;
  if(confirm("Delete this assignment?")){delete state.assignments[id];$("assignmentDialog").close();scheduleSave();renderAll()}
};
$("employeeForm").onsubmit=e=>{
  e.preventDefault();
  const id=$("employeeId").value||uid("emp"),name=$("employeeName").value.trim();
  const initials=name.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  state.employees[id]={id,name,initials,position:$("employeePosition").value.trim(),team:$("employeeTeam").value,country:$("employeeCountry").value.trim(),department:$("employeeDepartment").value.trim(),company:$("employeeCompany").value.trim(),active:true};
  $("employeeDialog").close();scheduleSave();renderAll();
};
$("projectForm").onsubmit=e=>{
  e.preventDefault();const id=uid("project");
  state.projects[id]={id,name:$("projectName").value.trim(),country:$("projectCountry").value,active:true};
  $("projectName").value="";$("projectDialog").close();scheduleSave();renderAll();
};

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$("addAssignmentBtn").onclick=()=>openAssignment();
$("addEmployeeBtn").onclick=()=>openEmployee();
$("addProjectBtn").onclick=()=>{populateProjectCountry();$("projectDialog").showModal()};
$("employeeSearch").oninput=renderEmployees;
$("prevMonth").onclick=()=>{state.month.setMonth(state.month.getMonth()-1);renderCalendar()};
$("nextMonth").onclick=()=>{state.month.setMonth(state.month.getMonth()+1);renderCalendar()};
$("todayBtn").onclick=()=>{state.month=new Date();renderCalendar()};
document.querySelectorAll(".team-btn").forEach(b=>b.onclick=()=>{state.team=b.dataset.team;document.querySelectorAll(".team-btn").forEach(x=>x.classList.toggle("active",x===b));renderAll()});
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".nav-btn").forEach(x=>x.classList.toggle("active",x===b));
  const v=b.dataset.view;
  $("calendarView").hidden=v!=="calendar";$("manpowerView").hidden=v!=="manpower";$("projectsView").hidden=v!=="projects";
  $("viewTitle").textContent=v==="calendar"?"Team Calendar":v==="manpower"?"Manpower":"Projects";
  $("viewSub").textContent=v==="calendar"?`${state.country} manpower assignments`:v==="manpower"?`${state.country} employee directory`:`${state.country} projects`;
  $("activeCountryLabel").textContent=state.country;
  $("addAssignmentBtn").hidden=v!=="calendar";
});
initialise();