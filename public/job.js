const API="";
const box=document.getElementById("jobDetails");
document.getElementById("year").textContent=new Date().getFullYear();
const id=new URLSearchParams(location.search).get("id");
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function row(label,value){return value?`<tr><th>${label}</th><td>${esc(value)}</td></tr>`:"";}
function section(title,content){return content?`<section class="detail-section"><h3>${title}</h3><div class="content">${esc(content)}</div></section>`:"";}
function link(label,url){if(!url)return"";try{const u=new URL(url);if(!["http:","https:"].includes(u.protocol))return"";return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;}catch{return"";}}
async function load(){
 if(!id){box.innerHTML="<h2>Job not selected</h2><p>Please return to the home page and select a job.</p>";return;}
 try{
  const r=await fetch(`${API}/api/jobs/${encodeURIComponent(id)}`);const j=await r.json();if(!r.ok)throw new Error(j.message);
  const closed=["Application Closed","Result Declared"].includes(j.status);
  box.innerHTML=`<h2>${esc(j.title)}</h2><p><b>${esc(j.organization)}</b> &nbsp; <span class="badge">${esc(j.category)}</span><span class="badge">${esc(j.status)}</span></p>
  <table class="detail-table">${row("Organization",j.organization)}${row("Category",j.category)}${row("Location",j.location)}${row("Total Vacancies",j.vacancies)}${row("Qualification",j.qualification)}${row("Age Limit",j.ageLimit)}${row("Salary",j.salary)}${row("Application Fee",j.applicationFee)}${row("Selection Process",j.selectionProcess)}${row("Application Start",j.startDate)}${row("Last Date",j.lastDate)}${row("Exam Date",j.examDate)}${row("Current Status",j.status)}</table>
  ${section("Job Description",j.description)}${section("How to Apply",j.howToApply)}
  <section class="detail-section"><h3>Important Links</h3><div class="important-links">${link("Apply Online",j.applyLink)}${link("Download Notification",j.notificationLink)}${link("Official Website",j.officialLink)}${link("Syllabus",j.syllabusLink)}</div></section>
  ${closed?'<p class="message">Applications are currently closed for this job.</p>':`<section class="apply-box"><h3>Submit Your Interest / Application</h3><p>Fill this form to register your interest with BYS ASSOCIATE JOB. If the employer has a separate official application link, use the Apply Online button above as well.</p><form id="applyForm"><label>Full Name *<input name="applicantName" required maxlength="100"></label><label>Mobile Number *<input name="mobile" required inputmode="tel" maxlength="15"></label><label>Email<input name="email" type="email"></label><label>Qualification<input name="qualification"></label><label class="wide">Message<textarea name="message" rows="3"></textarea></label><div class="wide"><button class="primary">Submit Application</button></div></form><p id="applyMessage" class="message"></p></section>`}`;
  const form=document.getElementById("applyForm");if(form)form.addEventListener("submit",submitApplication);
 }catch(e){box.innerHTML=`<h2>Unable to load job</h2><p>${esc(e.message||"Please try again later.")}</p>`;}
}
async function submitApplication(e){
 e.preventDefault();const form=e.currentTarget;const msg=document.getElementById("applyMessage");const data=Object.fromEntries(new FormData(form).entries());
 try{const r=await fetch(`${API}/api/jobs/${encodeURIComponent(id)}/apply`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const out=await r.json();if(!r.ok)throw new Error(out.message);msg.textContent=`${out.message} Your Application ID: ${out.applicationId}`;form.reset();}
 catch(err){msg.textContent=err.message||"Submission failed.";}
}
load();
