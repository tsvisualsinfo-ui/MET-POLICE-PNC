let me=null, officers=[], arrests=[], bolos=[], alerts=[], radio=[], audit=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ref=p=>`${p}-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(10000+Math.random()*90000)}`;
const pill=p=>p==="CRITICAL"||p==="HIGH"?"red":p==="MEDIUM"?"orange":"blue";

async function init(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){location.href="index.html";return;}
 const {data,error}=await sb.from("officers").select("*").eq("id",session.user.id).maybeSingle();
 if(error||!data||!data.active){await sb.auth.signOut();location.href="index.html";return;}
 me=data;
 document.getElementById("userCallsign").textContent=`${me.callsign} • ${me.rank}`;
 document.querySelectorAll(".admin-only").forEach(x=>x.style.display=me.role==="admin"?"block":"none");
 await loadAll(); subscribe();
}
async function loadAll(){
 const [o,a,b,f,r,l]=await Promise.all([
  sb.from("officers").select("*").order("callsign"),
  sb.from("arrests").select("*, officers(callsign)").order("created_at",{ascending:false}).limit(100),
  sb.from("bolos").select("*, officers(callsign)").order("created_at",{ascending:false}).limit(100),
  sb.from("alerts").select("*, officers(callsign)").order("created_at",{ascending:false}).limit(100),
  sb.from("radio_messages").select("*").order("created_at",{ascending:false}).limit(100),
  sb.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(200)
 ]);
 officers=o.data||[]; arrests=a.data||[]; bolos=b.data||[]; alerts=f.data||[]; radio=r.data||[]; audit=l.data||[];
 render();
}
function subscribe(){
 sb.channel("prc-live")
 .on("postgres_changes",{event:"*",schema:"public",table:"bolos"},loadAll)
 .on("postgres_changes",{event:"*",schema:"public",table:"alerts"},loadAll)
 .on("postgres_changes",{event:"*",schema:"public",table:"radio_messages"},loadAll)
 .on("postgres_changes",{event:"*",schema:"public",table:"arrests"},loadAll)
 .subscribe();
}
async function logAudit(action,reference){await sb.from("audit_logs").insert({officer_id:me.id,callsign:me.callsign,action,reference});}
async function transmit(type,message){await sb.from("radio_messages").insert({message_type:type,message,callsign:me.callsign,officer_id:me.id});}

document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",()=>{
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 document.getElementById(btn.dataset.page).classList.add("active");
}));

document.getElementById("arrestForm").addEventListener("submit",async e=>{
 e.preventDefault(); const reference=ref("ARREST");
 const {error}=await sb.from("arrests").insert({
  reference,subject:aSubject.value.trim(),case_reference:aCase.value.trim()||null,
  offence:aOffence.value.trim(),location:aLocation.value.trim(),custody_status:aStatus.value,
  notes:aNotes.value.trim()||null,officer_id:me.id});
 if(error){alert(error.message);return;} await logAudit("ARREST CREATED",reference);e.target.reset();loadAll();
});
document.getElementById("boloForm").addEventListener("submit",async e=>{
 e.preventDefault();const reference=ref("BOLO"), priority=bPriority.value;
 const {error}=await sb.from("bolos").insert({reference,bolo_type:bType.value,priority,subject:bSubject.value.trim(),identifier:bIdentifier.value.trim()||null,location:bLocation.value.trim(),incident_reference:bIncident.value.trim()||null,description:bDescription.value.trim(),officer_id:me.id});
 if(error){alert(error.message);return;}
 await transmit("BOLO",`${priority} BOLO — ${bType.value}. ${bSubject.value.trim()}. ${bIdentifier.value.trim()?`Identifier ${bIdentifier.value.trim()}. `:""}Last known location ${bLocation.value.trim()}. Issued by ${me.callsign}.`);
 await logAudit("BOLO CREATED",reference);e.target.reset();loadAll();
});
document.getElementById("alertForm").addEventListener("submit",async e=>{
 e.preventDefault();const reference=ref("ALERT"),priority=fPriority.value;
 const {error}=await sb.from("alerts").insert({reference,alert_type:fType.value,priority,message:fMessage.value.trim(),officer_id:me.id});
 if(error){alert(error.message);return;}
 await transmit("ALERT",`${priority} ${fType.value} ALERT — ${fMessage.value.trim()} Issued by ${me.callsign}.`);
 await logAudit("ALERT CREATED",reference);e.target.reset();loadAll();
});
document.getElementById("radioForm").addEventListener("submit",async e=>{
 e.preventDefault();await transmit(rType.value,rMessage.value.trim());await logAudit("RADIO TRANSMISSION","RADIO");e.target.reset();loadAll();
});
document.getElementById("searchBox").addEventListener("input",()=>{
 const q=searchBox.value.toLowerCase().trim();if(!q){searchResults.textContent="Enter a search term.";return;}
 const all=[...arrests.map(x=>({k:"ARREST",r:x.reference,t:`${x.subject} ${x.offence} ${x.location} ${x.officers?.callsign||""}`})),...bolos.map(x=>({k:"BOLO",r:x.reference,t:`${x.subject} ${x.description} ${x.location} ${x.officers?.callsign||""}`})),...alerts.map(x=>({k:"ALERT",r:x.reference,t:`${x.message} ${x.officers?.callsign||""}`}))];
 const hit=all.filter(x=>(x.r+" "+x.t).toLowerCase().includes(q));
 searchResults.innerHTML=hit.map(x=>`<div class="record"><b>${esc(x.k)} • ${esc(x.r)}</b><p>${esc(x.t)}</p></div>`).join("")||"No matching records.";
});
async function closeBolo(id,reference){
 const item=bolos.find(x=>x.id===id);if(!item)return;
 if(!(me.role==="admin"||me.role==="supervisor"||item.officer_id===me.id)){alert("You do not have permission to close this BOLO.");return;}
 const {error}=await sb.from("bolos").update({status:"CLOSED",closed_at:new Date().toISOString()}).eq("id",id);
 if(error){alert(error.message);return;}await transmit("BOLO UPDATE",`BOLO ${reference} closed by ${me.callsign}.`);await logAudit("BOLO CLOSED",reference);loadAll();
}
function render(){
 statBolos.textContent=bolos.filter(x=>x.status==="ACTIVE").length;statAlerts.textContent=alerts.filter(x=>x.status==="ACTIVE").length;statArrests.textContent=arrests.length;statOfficers.textContent=officers.length;
 arrestRows.innerHTML=arrests.map(x=>`<tr><td>${esc(x.reference)}</td><td>${esc(x.subject)}</td><td>${esc(x.offence)}</td><td>${esc(x.officers?.callsign||"")}</td><td>${esc(x.custody_status)}</td><td>${esc(new Date(x.created_at).toLocaleString("en-GB"))}</td></tr>`).join("");
 boloList.innerHTML=bolos.filter(x=>x.status==="ACTIVE").map(x=>`<div class="record"><span class="tag ${pill(x.priority)}">${esc(x.priority)}</span> <b>${esc(x.reference)}</b><h3>${esc(x.subject)}</h3><p>${esc(x.description)}</p><small>Location: ${esc(x.location)} • ${esc(x.officers?.callsign||"")} • ${esc(new Date(x.created_at).toLocaleString("en-GB"))}</small><br><button class="secondary" onclick="closeBolo('${x.id}','${esc(x.reference)}')">CLOSE</button></div>`).join("")||"No active BOLOs.";
 alertList.innerHTML=alerts.filter(x=>x.status==="ACTIVE").map(x=>`<div class="record"><span class="tag ${pill(x.priority)}">${esc(x.priority)}</span> <b>${esc(x.alert_type)}</b><p>${esc(x.message)}</p><small>${esc(x.officers?.callsign||"")} • ${esc(new Date(x.created_at).toLocaleString("en-GB"))}</small></div>`).join("")||"No active alerts.";
 const rf=radio.map(x=>`<div class="radio"><small>${esc(new Date(x.created_at).toLocaleString("en-GB"))} • <b>${esc(x.callsign)}</b> • ${esc(x.message_type)}</small><p>${esc(x.message)}</p></div>`).join("")||"No radio traffic.";
 radioFeed.innerHTML=rf;homeRadio.innerHTML=rf;
 homeAlerts.innerHTML=alerts.slice(0,5).map(x=>`<div class="record"><span class="tag ${pill(x.priority)}">${esc(x.priority)}</span> ${esc(x.message)}</div>`).join("")||"No alerts.";
 officerRows.innerHTML=officers.map(x=>`<tr><td>${esc(x.full_name)}</td><td><b>${esc(x.callsign)}</b></td><td>${esc(x.rank)}</td><td>${esc(x.department)}</td><td>${esc(x.duty_status)}</td></tr>`).join("");
 auditRows.innerHTML=audit.map(x=>`<tr><td>${esc(new Date(x.created_at).toLocaleString("en-GB"))}</td><td>${esc(x.callsign||"")}</td><td>${esc(x.action)}</td><td>${esc(x.reference||"")}</td></tr>`).join("");
 adminStatus.innerHTML=me.role==="admin"?`<div class="success">ADMIN ACCESS ENABLED — ${esc(me.callsign)}</div>`:`<div class="error">Administrator access required.</div>`;
}
async function logout(){await sb.auth.signOut();location.href="index.html";}
init();
