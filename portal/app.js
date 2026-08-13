const seed=[
 {id:'JNIT-2608-001',customer:'Namgola Logistics',file:'NLG86472240.pdf',status:'incoming',contact:'Anna Mokoena',email:'anna@namgola.example',agent:null,time:'08:42',border:'Lebombo'},
 {id:'JNIT-2608-002',customer:'ABC Logistics',file:'Commercial-Invoice.pdf',status:'in_progress',contact:'Peter Dlamini',email:'ops@abclogistics.example',agent:"Jacques O'Connell",time:'09:05',border:'Beitbridge'},
 {id:'JNIT-2608-003',customer:'Namgola Logistics',file:'Supporting-Pack.pdf',status:'awaiting_documents',contact:'Anna Mokoena',email:'anna@namgola.example',agent:"Jacques O'Connell",time:'09:28',border:'Lebombo'},
 {id:'JNIT-2608-004',customer:'Namgola Logistics',file:'Completed-Clearance.pdf',status:'completed',contact:'Anna Mokoena',email:'anna@namgola.example',agent:'Sarah Nkosi',time:'10:11',border:'Skilpadshek'},
 {id:'JNIT-2608-005',customer:'ABC Logistics',file:'Review-Pack.pdf',status:'in_review',contact:'Peter Dlamini',email:'ops@abclogistics.example',agent:"Jacques O'Connell",time:'09:46',border:'Beitbridge'},
 {id:'JNIT-2608-006',customer:'Namgola Logistics',file:'Release-Notice.pdf',status:'ready_to_send',contact:'Anna Mokoena',email:'anna@namgola.example',agent:'Sarah Nkosi',time:'10:02',border:'Lebombo'}
];
let jobs=JSON.parse(localStorage.getItem('jnitJobs')||'null')||seed;
let audit=JSON.parse(localStorage.getItem('jnitAudit')||'null')||[{text:'POC workspace opened',time:'Today, 08:30'}];
const $=s=>document.querySelector(s); const $$=s=>document.querySelectorAll(s);
const API=(window.APP_CONFIG&&window.APP_CONFIG.apiUrl)||'';
const legacyStatuses={received:'incoming',progress:'in_progress',requested:'awaiting_documents'};
const statusInfo={incoming:['Incoming','red'],in_progress:['In Progress','blue'],in_review:['In Review','purple'],awaiting_documents:['Awaiting Documents','amber'],ready_to_send:['Ready to Send','teal'],completed:['Completed','green']};
const normalizeStatus=status=>legacyStatuses[status]||status;
jobs=jobs.map(job=>({...job,status:normalizeStatus(job.status)}));

async function api(path,options={}){if(!API)return null;let r=await fetch(API+path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});if(!r.ok)throw new Error((await r.json()).message||'Request failed');return r.json()}
function save(){localStorage.setItem('jnitJobs',JSON.stringify(jobs));localStorage.setItem('jnitAudit',JSON.stringify(audit));render()}
function log(text){audit.unshift({text,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});audit=audit.slice(0,12)}
function card(j,actions=''){let [label,color]=statusInfo[j.status];return `<article class="job-card ${color}"><div class="ref">${j.id}</div><div class="customer">${j.customer}</div><div class="meta">${j.file}<br>${j.border} · ${j.time}${j.agent?`<br>Agent: ${j.agent}`:''}</div>${actions}</article>`}
function workflowActions(j){
 const next={in_progress:['in_review','Send to review'],in_review:['ready_to_send','Approve'],ready_to_send:['completed','Mark completed']};
 const action=next[j.status];
 return `${['in_progress','in_review'].includes(j.status)?`<button class="outline small" onclick="requestDocs('${j.id}')">Request files</button>`:''}${action?`<button class="primary small" onclick="setJobStatus('${j.id}','${action[0]}')">${action[1]}</button>`:''}`;
}
function render(){
 const counts=s=>jobs.filter(j=>j.status===s).length;
 $('#metrics').innerHTML=Object.entries(statusInfo).map(([status,[label]])=>`<article><span>${label}</span><strong>${counts(status)}</strong><small>Workflow queue</small></article>`).join('');
 $('#trackingBoard').innerHTML=Object.entries(statusInfo).map(([status,[label]])=>`<div class="lane"><div class="lane-head">${label}<span>${counts(status)}</span></div>${jobs.filter(j=>j.status===status).map(j=>card(j)).join('')||'<p class="muted">No jobs</p>'}</div>`).join('');
 $('#incomingList').innerHTML=jobs.filter(j=>j.status==='incoming').map(j=>`<div class="list-card"><div><h3>${j.id} · ${j.customer}</h3><p>${j.file} · Received ${j.time}</p></div><button class="primary small" onclick="acceptJob('${j.id}')">Accept job</button></div>`).join('')||'<div class="list-card"><p>Incoming queue is clear.</p></div>';
 $('#activeList').innerHTML=jobs.filter(j=>j.agent==="Jacques O'Connell"&&j.status!=='completed').map(j=>`<div class="list-card"><div><h3>${j.id} · ${statusInfo[j.status][0]}</h3><p>${j.customer} · ${j.file}</p></div><div class="list-actions">${workflowActions(j)}</div></div>`).join('')||'<div class="list-card"><p>No active work assigned.</p></div>';
 $('#customerJobs').innerHTML=jobs.filter(j=>j.customer==='Namgola Logistics').map(j=>`<div class="list-card"><div><h3>${j.id}</h3><p>${j.file} · ${statusInfo[j.status][0]}${j.agent?` · ${j.agent}`:''}</p></div>${j.status==='awaiting_documents'?`<button class="primary small" onclick="uploadRequested('${j.id}')">Upload requested file</button>`:''}</div>`).join('');
 $('#customerMessages').innerHTML=jobs.filter(j=>j.status==='awaiting_documents').map(j=>`<div class="message"><strong>Additional document required</strong><br>Please upload the certificate of origin against ${j.id}.<small>${j.agent} · Today</small></div>`).join('')||'<p class="muted">No outstanding requests.</p>';
 $('#auditLog').innerHTML=audit.map(a=>`<div class="audit-item">${a.text}<small>${a.time}</small></div>`).join(''); $('#auditCount').textContent=audit.length; $('#updatedAt').textContent='Updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
async function updateJob(id,changes){if(API)await api('/jobs/'+id,{method:'PATCH',body:JSON.stringify(changes)});let j=jobs.find(x=>x.id===id);Object.assign(j,changes);if(changes.agent_name)j.agent=changes.agent_name;save()}
window.acceptJob=async id=>{await updateJob(id,{status:'in_progress',agent_name:"Jacques O'Connell",agent_id:'EMP-014'});log(`${id} accepted by Jacques O'Connell (EMP-014)`);save();toast('Job moved to In Progress')};
window.requestDocs=async id=>{await updateJob(id,{status:'awaiting_documents'});log(`Additional documents requested for ${id}`);save();toast('Job moved to Awaiting Documents')};
window.setJobStatus=async(id,status)=>{await updateJob(id,{status});log(`${id} moved to ${statusInfo[status][0]}`);save();toast(`Job moved to ${statusInfo[status][0]}`)};
window.uploadRequested=async id=>{await updateJob(id,{status:'in_progress'});log(`Requested document uploaded to existing job ${id}`);save();toast(`Upload attached to ${id}; job returned to In Progress`)};
function toast(t){let e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600)}
$$('.nav').forEach(b=>b.onclick=()=>{$$('.nav,.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.view).classList.add('active');let names={tracking:['LIVE OPERATIONS','Document tracking board'],agent:['AGENT WORKSPACE','My document queue'],customer:['CUSTOMER SELF-SERVICE','Track and upload documents'],admin:['MANAGEMENT & CONTROL','Administration portal']};$('#eyebrow').textContent=names[b.dataset.view][0];$('#pageTitle').textContent=names[b.dataset.view][1]});
const dlg=$('#uploadDialog');$('#openUpload').onclick=()=>dlg.showModal();$('#closeUpload').onclick=$('#cancelUpload').onclick=()=>dlg.close();
$('#uploadForm').onsubmit=async e=>{e.preventDefault();let fd=new FormData(e.target),file=fd.get('document'),created;if(API){created=await api('/jobs',{method:'POST',body:JSON.stringify({customer:fd.get('customer'),contact:fd.get('contact'),email:fd.get('email'),filename:file.name,content_type:file.type||'application/octet-stream',border:fd.get('border'),origin:fd.get('origin'),notes:fd.get('notes')})});let put=await fetch(created.upload_url,{method:'PUT',headers:{'content-type':file.type||'application/octet-stream'},body:file});if(!put.ok)throw new Error('Document upload failed')}let id=created?created.job.job_id:'JNIT-2608-'+String(Math.max(...jobs.map(j=>+j.id.split('-').pop()))+1).padStart(3,'0');jobs.unshift({id,customer:fd.get('customer'),file:file.name,status:'incoming',contact:fd.get('contact'),email:fd.get('email'),agent:null,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),border:fd.get('border')});log(`${id} created by customer portal upload`);save();dlg.close();toast(`Upload received — tracking reference ${id}`)};
$('#resetDemo').onclick=()=>{jobs=structuredClone(seed);audit=[{text:'Demo data reset',time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}];save();toast('Demo restored')};
async function start(){if(API){try{let data=await api('/jobs');if(data.items.length)jobs=data.items.map(j=>({...j,status:normalizeStatus(j.status),id:j.job_id,file:j.filename,agent:j.agent_name||null,time:new Date(j.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}))}catch(e){toast('AWS API unavailable — showing demo data')}}render()}start();
