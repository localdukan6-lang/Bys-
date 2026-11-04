const API = "";
const jobList = document.getElementById("jobList");
const resultList = document.getElementById("resultList");
document.getElementById("year").textContent = new Date().getFullYear();

function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function jobCard(job){
  return `<div class="job-link"><a href="job.html?id=${encodeURIComponent(job._id)}"><strong>${esc(job.title)}</strong></a><span class="job-meta"><span class="badge">${esc(job.category)}</span><span class="badge">${esc(job.status)}</span>${job.lastDate ? "Last Date: "+esc(job.lastDate):""}</span></div>`;
}
async function loadJobs(){
  const q=document.getElementById("searchInput").value.trim();
  const category=document.getElementById("categoryFilter").value;
  const params=new URLSearchParams(); if(q)params.set("q",q);if(category)params.set("category",category);
  jobList.innerHTML="<p>Loading...</p>";resultList.innerHTML="<p>Loading...</p>";
  try{
    const res=await fetch(`${API}/api/jobs?${params}`);const jobs=await res.json();
    if(!res.ok)throw new Error(jobs.message||"Could not load jobs");
    const current=jobs.filter(j=>!["Result Declared","Answer Key Released","Admit Card Released"].includes(j.status));
    const updates=jobs.filter(j=>["Result Declared","Answer Key Released","Admit Card Released","Exam Date Announced"].includes(j.status));
    jobList.innerHTML=current.length?current.map(jobCard).join(""):'<p class="empty">No jobs available right now.</p>';
    resultList.innerHTML=updates.length?updates.map(jobCard).join(""):'<p class="empty">No result or exam updates available.</p>';
  }catch(e){jobList.innerHTML=`<p class="empty">${esc(e.message)}</p>`;resultList.innerHTML='<p class="empty">Please try again later.</p>';}
}
document.getElementById("searchBtn").addEventListener("click",loadJobs);
document.getElementById("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")loadJobs();});
document.getElementById("categoryFilter").addEventListener("change",loadJobs);
loadJobs();
