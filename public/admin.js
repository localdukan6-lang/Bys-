const API="";
let token=localStorage.getItem("bysAdminToken")||"";
const $=s=>document.querySelector(s);
const loginBox=$("#loginBox"),dashboard=$("#dashboard"),jobForm=$("#jobForm");
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function api(path,options={}){
 const headers={...(options.headers||{})};if(token)headers.Authorization="Bearer "+token;
 if(options.body && typeof options.body!=="string"){headers["Content-Type"]="application/json";options.body=JSON.stringify(options.body);}
 const r=await fetch(API+path,{...options,headers});const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.message||"Request failed");return data;
}
function showDashboard(){loginBox.hidden=true;dashboard.hidden=false;loadAdminJobs();}
function logout(){token="";localStorage.removeItem("bysAdminToken");dashboard.hidden=true;loginBox.hidden=false;}
$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("#loginMessage").textContent="Checking...";
 const data=Object.fromEntries(new FormData(e.currentTarget).entries());
 try{const out=await api("/api/admin/login",{method:"POST",body:data});token=out.token;localStorage.setItem("bysAdminToken",token);$("#loginMessage").textContent="";showDashboard();}
 catch(err){$("#loginMessage").textContent=err.message;}
});
$("#logoutBtn").addEventListener("click",logout);
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));
 $("#jobsTab").hidden=btn.dataset.tab!=="jobsTab";$("#appsTab").hidden=btn.dataset.tab!=="appsTab";
 if(btn.dataset.tab==="appsTab")loadApplications();
}));
function formData(){const o=Object.fromEntries(new FormData(jobForm).entries());o.featured=jobForm.elements.featured.checked;delete o.jobId;return o;}
function resetJobForm(){jobForm.reset();jobForm.elements.jobId.value="";$("#formHeading").textContent="Add New Job";}
$("#resetForm").addEventListener("click",resetJobForm);
jobForm.addEventListener("submit",async e=>{
 e.preventDefault();const id=jobForm.elements.jobId.value;const msg=$("#jobMessage");msg.textContent="Saving...";
 try{await api(id?`/api/admin/jobs/${id}`:"/api/admin/jobs",{method:id?"PUT":"POST",body:formData()});msg.textContent="Job saved successfully.";resetJobForm();loadAdminJobs();}
 catch(err){msg.textContent=err.message;}
});
async function loadAdminJobs(){
 try{const jobs=await api("/api/admin/jobs");$("#adminJobs").innerHTML=jobs.length?`<table><thead><tr><th>Job</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>${jobs.map(j=>`<tr><td>${esc(j.title)}</td><td>${esc(j.category)}</td><td>${esc(j.status)}</td><td><button class="small-btn" data-edit="${j._id}">Edit</button><button class="small-btn" data-delete="${j._id}">Delete</button><a class="small-btn" href="job.html?id=${j._id}" target="_blank">View</a></td></tr>`).join("")}</tbody></table>`:'<p class="empty">No jobs added yet.</p>';
  $("#adminJobs").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editJob(jobs.find(j=>j._id===b.dataset.edit))));
  $("#adminJobs").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteJob(b.dataset.delete)));
 }catch(e){$("#adminJobs").textContent=e.message;if(e.message.includes("Session"))logout();}
}
function editJob(j){
 const fields=["title","organization","category","location","vacancies","qualification","ageLimit","salary","applicationFee","selectionProcess","startDate","lastDate","examDate","status","applyLink","notificationLink","officialLink","syllabusLink","description","howToApply"];
 fields.forEach(k=>{if(jobForm.elements[k])jobForm.elements[k].value=j[k]||"";});
 jobForm.elements.jobId.value=j._id;jobForm.elements.featured.checked=!!j.featured;$("#formHeading").textContent="Edit Job";window.scrollTo({top:0,behavior:"smooth"});
}
async function deleteJob(id){if(!confirm("Delete this job and its applications?"))return;try{await api(`/api/admin/jobs/${id}`,{method:"DELETE"});loadAdminJobs();}catch(e){alert(e.message);}}
async function loadApplications(){
 try{const apps=await api("/api/admin/applications");$("#applications").innerHTML=apps.length?`<table><thead><tr><th>Application ID</th><th>Applicant</th><th>Mobile</th><th>Job</th><th>Date</th><th>Status</th></tr></thead><tbody>${apps.map(a=>`<tr><td>${esc(a.applicationId)}</td><td>${esc(a.applicantName)}<br>${esc(a.email)}</td><td>${esc(a.mobile)}</td><td>${esc(a.job?.title||"Deleted job")}</td><td>${new Date(a.createdAt).toLocaleDateString()}</td><td><select class="status-select" data-app="${a._id}">${["Pending","Under Review","Approved","Rejected"].map(s=>`<option ${a.status===s?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>`:'<p class="empty">No applications received yet.</p>';
  $("#applications").querySelectorAll("[data-app]").forEach(sel=>sel.addEventListener("change",async()=>{try{await api(`/api/admin/applications/${sel.dataset.app}/status`,{method:"PATCH",body:{status:sel.value}});}catch(e){alert(e.message);}}));
 }catch(e){$("#applications").textContent=e.message;}
}
if(token)showDashboard();
