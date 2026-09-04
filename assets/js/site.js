/* ════════════════════════════════════════════════════════════
   SITE ENGINE — interactivity only. All nav/links are static HTML.
   ════════════════════════════════════════════════════════════ */
const SITE = { phone:'+918942954415', whatsapp:'918942954415' };

/* ───── MEGA MENU (panels are static HTML, we just show/hide) ───── */
let activeMega = null;
function openMega(key, trigger){
  document.querySelectorAll('.mega-wrap').forEach(p=>p.classList.remove('open'));
  document.querySelectorAll('.nav-trigger[data-mega]').forEach(t=>t.classList.remove('open'));
  if(activeMega===key){ activeMega=null; return; }
  activeMega=key;
  const panel=document.getElementById('mega-'+key);
  if(panel) panel.classList.add('open');
  if(trigger) trigger.classList.add('open');
}
function closeMega(){
  activeMega=null;
  document.querySelectorAll('.mega-wrap').forEach(p=>p.classList.remove('open'));
  document.querySelectorAll('.nav-trigger[data-mega]').forEach(t=>t.classList.remove('open'));
}

/* ───── MOBILE DRAWER ───── */
function openDrawer(){ document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeDrawer(){ const d=document.getElementById('drawer'); if(d)d.classList.remove('open'); const o=document.getElementById('drawerOverlay'); if(o)o.classList.remove('open'); document.body.style.overflow=''; }
function toggleAcc(btn){ btn.parentElement.classList.toggle('open'); }

/* ───── LEAD FORM ───── */
const API_ENDPOINT='https://mbbsadmissionguide-in.wahidiqubal9.workers.dev/api/lead';
let currentPath='india';
function setPath(p){
  currentPath=p;
  const i=document.getElementById('pathIndia'),a=document.getElementById('pathAbroad');
  if(i&&a){ i.classList.remove('active'); a.classList.remove('active'); }
  const iF=document.getElementById('indiaFields'),aF=document.getElementById('abroadFields');
  if(p==='india'){ if(i)i.classList.add('active'); if(iF)iF.style.display='block'; if(aF)aF.style.display='none'; }
  else{ if(a)a.classList.add('active'); if(iF)iF.style.display='none'; if(aF)aF.style.display='block'; }
}
async function submitLead(e){
  e.preventDefault();
  const btn=document.getElementById('leadSubmitBtn'); const orig=btn.innerHTML;
  btn.disabled=true; btn.style.opacity='.7'; btn.innerHTML='Sending…';
  const get=id=>{const el=document.getElementById(id);return el?el.value:'';};
  const details={name:get('leadName').trim(),phone:get('leadPhone').trim(),neet:get('leadNeet'),path:get('leadPath')||currentPath};
  if(details.path==='india'){details.indiaPath=get('indiaPath');details.neetScore=get('indiaScore');}
  else{details.country=get('countrySelect');details.budget=get('leadBudget');}
  try{
    const res=await fetch(API_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(details)});
    const data=await res.json().catch(()=>({}));
    if(res.ok&&data.ok){showLeadSuccess();}else throw new Error(data.error||'API error');
  }catch(err){btn.disabled=false;btn.style.opacity='1';btn.innerHTML=orig;showLeadError(details);}
}
function showLeadSuccess(){
  const wrap=document.getElementById('lead');
  if(wrap)wrap.innerHTML='<div class="success-box"><div class="success-icon">✓</div><h3 class="serif">Thank you.</h3><p>Your request has been received.<br/>A doctor-founder will call you within <b>15 minutes</b>.</p></div>';
}
function showLeadError(d){
  let box=document.getElementById('leadErrorBox');const form=document.getElementById('leadFormEl');
  if(!box&&form){box=document.createElement('div');box.id='leadErrorBox';box.style.cssText='background:#FBF1E7;border:1px solid #EBD3AE;color:#6B4A17;border-radius:10px;padding:12px;font-size:12.5px;margin-bottom:10px;line-height:1.6';form.prepend(box);}
  const extra=d.path==='india'?`\nIndia path: ${d.indiaPath}\nNEET Score: ${d.neetScore}`:`\nCountry: ${d.country}\nBudget: ${d.budget}`;
  const waText=encodeURIComponent(`Hi, I want MBBS ${d.path} counseling.\nName: ${d.name}\nPhone: ${d.phone}\nNEET: ${d.neet}${extra}`);
  if(box)box.innerHTML=`⚠️ <b>Couldn't send just now.</b> Try again, or:<br/><a href="https://wa.me/${SITE.whatsapp}?text=${waText}" target="_blank" rel="noopener" style="color:#0E7C5B;font-weight:700;text-decoration:underline">Continue on WhatsApp →</a>`;
}

/* ───── HELPERS ───── */
function scrollToId(id){const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
function toggleFaq(el){const item=el.parentElement;const was=item.classList.contains('open');document.querySelectorAll('.faq-item').forEach(i=>i.classList.remove('open'));if(!was)item.classList.add('open');}

/* ───── INIT ───── */
document.addEventListener('DOMContentLoaded',()=>{
  // mega menu triggers
  document.querySelectorAll('.nav-trigger[data-mega]').forEach(btn=>{
    btn.addEventListener('click',e=>{e.stopPropagation();openMega(btn.dataset.mega,btn);});
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.mega-wrap')&&!e.target.closest('.nav-trigger'))closeMega(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeMega();closeDrawer();} });
  // drawer
  const dOpen=document.getElementById('drawerOpen'),dClose=document.getElementById('drawerClose'),dOv=document.getElementById('drawerOverlay');
  if(dOpen)dOpen.addEventListener('click',openDrawer);
  if(dClose)dClose.addEventListener('click',closeDrawer);
  if(dOv)dOv.addEventListener('click',closeDrawer);
  // scroll reveal
  const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}}),{threshold:.1});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  // header shadow
  addEventListener('scroll',()=>{const h=document.querySelector('.top-header');if(h)h.classList.toggle('scrolled',scrollY>8);});
});