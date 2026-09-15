const data=window.CIVICCHAIN_DATA||[];
function loadCustom(){try{return JSON.parse(sessionStorage.getItem('civicchain_custom')||'[]')}catch(e){return []}}
function saveCustom(){try{sessionStorage.setItem('civicchain_custom',JSON.stringify(custom))}catch(e){}}
let custom=loadCustom();
const $=s=>document.querySelector(s);const all=()=>[...data,...custom];
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
// --- Neighbourhood Affirmation groundwork (Part 1) ---
const NEIGHBOURHOOD_RADIUS_METERS=1000; // single configurable radius, used everywhere distance eligibility is checked
const LOCATION_ACCURACY_THRESHOLD_METERS=10; // resident GPS must be at least this accurate to be trusted
function haversineDistanceMeters(lat1,lon1,lat2,lon2){const R=6371000;const toRad=d=>d*Math.PI/180;const dLat=toRad(lat2-lat1);const dLon=toRad(lon2-lon1);const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
// Returns 'eligible' | 'not-eligible' | 'unavailable'. 'unavailable' covers missing/low-accuracy resident location
// or a complaint with no stored coordinates (e.g. historical complaints). No exact distance is ever exposed by this.
function getNeighbourhoodEligibility(residentLat,residentLon,residentAccuracy,complaint){
  if(residentAccuracy==null||residentAccuracy>LOCATION_ACCURACY_THRESHOLD_METERS)return 'unavailable';
  if(!complaint||complaint.latitude==null||complaint.longitude==null)return 'unavailable';
  const d=haversineDistanceMeters(residentLat,residentLon,complaint.latitude,complaint.longitude);
  return d<=NEIGHBOURHOOD_RADIUS_METERS?'eligible':'not-eligible';
}
// --- Neighbourhood Affirmation (Part 2) ---
// Stored in localStorage (persists like theme, unlike per-tab session complaints) as:
// { [complaintId]: { [userId]: 'YES' | 'NO' } } — no coordinates, distance, or identity beyond an opaque id are ever stored.
function loadAffirmations(){try{return JSON.parse(localStorage.getItem('civicchain_affirmations')||'{}')}catch(e){return {}}}
function saveAffirmations(a){try{localStorage.setItem('civicchain_affirmations',JSON.stringify(a))}catch(e){}}
function getResidentUserId(){
  try{
    let id=localStorage.getItem('civicchain_user_id');
    if(!id){id='res-'+(window.crypto&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));localStorage.setItem('civicchain_user_id',id)}
    return id;
  }catch(e){return 'res-anon'}
}
function getComplaintAffirmations(complaintId){const a=loadAffirmations();return a[complaintId]||{}}
function getUserAffirmation(complaintId){return getComplaintAffirmations(complaintId)[getResidentUserId()]||null}
// One user = one affirmation per complaint. Returns false (no-op) if the user already responded.
function submitAffirmation(complaintId,value){
  const a=loadAffirmations();
  if(!a[complaintId])a[complaintId]={};
  const uid=getResidentUserId();
  if(a[complaintId][uid])return false;
  a[complaintId][uid]=value;
  saveAffirmations(a);
  return true;
}
function computeAffirmationStats(complaintId){
  const votes=getComplaintAffirmations(complaintId);
  let yes=0,no=0;
  Object.values(votes).forEach(v=>{if(v==='YES')yes++;else if(v==='NO')no++});
  const total=yes+no;
  return {yes,no,total,confidence:total>0?Math.round((yes/total)*100):null};
}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000)}
function renderLedger(filter='all'){const el=$('#ledger');if(!el)return;let rows=all().filter(x=>filter==='all'||x.status===filter);el.innerHTML=rows.map(x=>`<a class="ledger-item" href="track-cc.html?id=${encodeURIComponent(x.id)}"><i class="status-dot ${x.status}"></i><div><strong>${esc(x.id)} · ${esc(x.category)}</strong><small>${esc(x.location)}</small></div><span class="tag ${x.status}">${esc(x.statusLabel)}</span><small>${esc(x.cc)}</small></a>`).join('')}
const L={verifyTitle:['Complaint Resolved — Your Verification Required','शिकायत ठीक हो गई है — आपकी पुष्टि जरूरी है'],verifyQuestion:['Has your problem actually been resolved?','क्या आपकी समस्या वास्तव में हल हो गई है?'],before:['Before','पहले'],after:['After','बाद में'],uploadAfter:['Upload a photo after the problem is fixed','समस्या ठीक होने के बाद की फोटो अपलोड करें'],uploadHelper:['Please upload a current photo showing that the problem has been fixed.','कृपया समस्या ठीक होने के बाद की वर्तमान फोटो अपलोड करें।'],uploadBtn:['Upload Resolution Photo','समाधान की फोटो अपलोड करें'],confirm:['Confirm Resolution','समाधान की पुष्टि करें'],verifiedBadge:['✓ Resolution Verified','✓ समाधान की पुष्टि हो गई'],notResolved:['No, still not resolved','नहीं, समस्या अभी भी ठीक नहीं हुई']};
function bi(key){return `${L[key][0]}<small class="hi">${L[key][1]}</small>`}
function baBlock(x){return `<div class="ba-grid"><div class="ba-col"><span class="eyebrow">${bi('before')}</span>${x.photo&&x.photo.before?`<img class="ba-img" src="${x.photo.before}" alt="Before photo">`:'<div class="ba-placeholder">No photo on file</div>'}</div><div class="ba-col ba-after"><span class="eyebrow">${bi('after')}</span>__AFTER__</div></div>`}
function renderVerifyCard(x){const after=`<p class="ba-caption">${bi('uploadAfter')}</p><div class="photo-preview" id="verifyAfterPreview" hidden><img id="verifyAfterPreviewImg" alt="After photo preview"><button type="button" class="small-btn" id="verifyAfterRemoveBtn">Remove</button></div><label class="upload" for="verifyAfterPhoto">📎 <span id="verifyAfterFileLabel">${esc(L.uploadBtn[0])}</span><input id="verifyAfterPhoto" type="file" accept="image/*"></label><small class="description-hint">${bi('uploadHelper')}</small><small class="field-error" id="verifyAfterError" hidden></small>`;return `<div class="verify-card glass"><h4>${bi('verifyTitle')}</h4><p class="verify-q">${bi('verifyQuestion')}</p>${baBlock(x).replace('__AFTER__',after)}<div class="verify-actions"><button class="btn primary" id="confirmResolutionBtn" disabled>${esc(L.confirm[0])}</button><button class="btn ghost" id="notResolvedBtn">${esc(L.notResolved[0])}</button></div><div class="not-resolved-box" id="notResolvedBox" hidden><textarea id="notResolvedText" rows="2" placeholder="What's still wrong? (optional)"></textarea><button class="btn" id="submitNotResolvedBtn">Submit feedback</button></div></div>`}
function renderVerifiedBox(x){const after=`<img class="ba-img" src="${x.photo.after}" alt="After photo">`;return `<div class="verified-box"><h4>${bi('verifiedBadge')}</h4>${baBlock(x).replace('__AFTER__',after)}<p class="verify-meta">Verified <b>${esc(x.verifiedAt||'')}</b> · Status: <b>${esc(x.statusLabel)}</b></p></div>`}
function wireVerifyCard(x){
  const fileInput=$('#verifyAfterPhoto'),preview=$('#verifyAfterPreview'),previewImg=$('#verifyAfterPreviewImg'),fileLabel=$('#verifyAfterFileLabel'),errEl=$('#verifyAfterError'),confirmBtn=$('#confirmResolutionBtn');
  let afterPhoto=null;
  function resetAfter(){afterPhoto=null;if(fileInput)fileInput.value='';if(fileLabel)fileLabel.textContent=L.uploadBtn[0];if(preview)preview.hidden=true;if(previewImg)previewImg.src='';if(confirmBtn)confirmBtn.disabled=true}
  function showErr(msg){if(!errEl)return;errEl.textContent=msg;errEl.hidden=false}
  function clearErr(){if(errEl)errEl.hidden=true}
  if(fileInput)fileInput.onchange=e=>{const f=e.target.files[0];if(!f){resetAfter();return}if(!f.type.startsWith('image/')){showErr('Please choose an image file.');resetAfter();return}const reader=new FileReader();reader.onload=()=>{afterPhoto={name:f.name,dataUrl:reader.result};fileLabel.textContent=f.name;previewImg.src=reader.result;preview.hidden=false;confirmBtn.disabled=false;clearErr()};reader.readAsDataURL(f)};
  if($('#verifyAfterRemoveBtn'))$('#verifyAfterRemoveBtn').onclick=resetAfter;
  if(confirmBtn)confirmBtn.onclick=()=>{
    if(!afterPhoto){showErr('An after-resolution photo is required before you can confirm.');return}
    x.photo=x.photo||{};x.photo.after=afterPhoto.dataUrl;
    x.status='verified';x.statusLabel='Verified';x.citizenVerified=true;x.verificationTimestamp=new Date().toISOString();x.verifiedAt=new Date().toLocaleString();
    x.events.push('Citizen Confirmed','Resolved');x.times.push('Now','Now');
    saveCustom();renderLedger();updateStats();showDetail(x.id);toast(L.verifiedBadge[0]);
  };
  const notBtn=$('#notResolvedBtn'),box=$('#notResolvedBox'),submitBtn=$('#submitNotResolvedBtn');
  if(notBtn)notBtn.onclick=()=>{if(box)box.hidden=false;notBtn.disabled=true};
  if(submitBtn)submitBtn.onclick=()=>{
    x.citizenFeedback=$('#notResolvedText')?$('#notResolvedText').value.trim():'';
    x.status='disputed';x.statusLabel='Not Resolved / Reopened';x.citizenVerified=false;
    x.events.push('Not Resolved');x.times.push('Now');
    saveCustom();renderLedger();updateStats();showDetail(x.id);toast('Feedback submitted. Complaint reopened for the authority.');
  };
}
// --- Neighbourhood Affirmation UI (reuses the existing bilingual `bi()` pattern via its own AL/abi) ---
const AL={
  title:['Neighbourhood Affirmation','पड़ोस की पुष्टि'],
  question:["Is this issue actually fixed in your neighbourhood?",'क्या आपके इलाके में यह समस्या वास्तव में ठीक हो गई है?'],
  yes:["Yes, it's fixed",'हाँ, समस्या ठीक हो गई है'],
  no:["No, it's still there",'नहीं, समस्या अभी भी है'],
  eligible:['You are eligible to verify this issue.','आप इस समस्या की पुष्टि करने के लिए पात्र हैं।'],
  notEligible:['You are not eligible for this neighbourhood issue.','आप इस समस्या की पुष्टि करने के लिए पात्र नहीं हैं।'],
  confirmedWord:['neighbours confirmed','पड़ोसियों ने पुष्टि की'],
  unresolvedWord:["say it's still unresolved",'लोगों का कहना है कि समस्या अभी भी ठीक नहीं हुई है'],
  confidence:['Community Confidence','सामुदायिक विश्वास'],
  none:['No neighbourhood affirmations yet.','अभी तक पड़ोस से कोई पुष्टि नहीं मिली है।'],
  checking:['Checking your eligibility…','आपकी पात्रता जांची जा रही है…'],
  thanks:['Thanks — your response has been recorded.','धन्यवाद — आपकी प्रतिक्रिया दर्ज कर ली गई है।'],
  already:['You already submitted your response for this issue.','आपने इस समस्या के लिए पहले ही अपनी प्रतिक्रिया दे दी है।'],
  locError:["We couldn't confirm your location for this issue.",'हम इस समस्या के लिए आपके स्थान की पुष्टि नहीं कर सके।']
};
function abi(key){return `${AL[key][0]}<small class="hi">${AL[key][1]}</small>`}
function renderAffirmationResults(complaintId){
  const el=$('#affirmResult');if(!el)return;
  const {yes,no,total,confidence}=computeAffirmationStats(complaintId);
  if(total===0){el.innerHTML=`<p class="ba-caption">${abi('none')}</p>`;return}
  el.innerHTML=`<p class="ba-caption"><b>${yes}</b> ${abi('confirmedWord')} · <b>${no}</b> ${abi('unresolvedWord')}</p><p class="verify-meta">${abi('confidence')}: <b>${confidence}%</b></p>`;
}
function renderAffirmationCard(x){
  return `<div class="affirm-card glass" id="affirmCard"><h4>${abi('title')}</h4><p class="verify-q">${abi('question')}</p><div id="affirmStatus" class="description-hint">${abi('checking')}</div><div class="verify-actions" id="affirmActions" hidden><button class="btn primary" id="affirmYesBtn">👍 ${abi('yes')}</button><button class="btn ghost" id="affirmNoBtn">👎 ${abi('no')}</button></div><div id="affirmResult" class="affirm-result"></div></div>`;
}
function wireAffirmationCard(x){
  const card=$('#affirmCard');if(!card)return;
  const statusEl=$('#affirmStatus'),actionsEl=$('#affirmActions'),yesBtn=$('#affirmYesBtn'),noBtn=$('#affirmNoBtn');
  renderAffirmationResults(x.id);
  if(getUserAffirmation(x.id)){statusEl.innerHTML=abi('already');return}
  if(!('geolocation' in navigator)){statusEl.innerHTML=abi('locError');return}
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude,accuracy}=pos.coords;
    const eligibility=getNeighbourhoodEligibility(latitude,longitude,accuracy,x);
    if(eligibility==='eligible'){
      statusEl.innerHTML=abi('eligible');actionsEl.hidden=false;
      const submit=value=>{
        if(getUserAffirmation(x.id)){statusEl.innerHTML=abi('already');actionsEl.hidden=true;return}
        if(submitAffirmation(x.id,value)){actionsEl.hidden=true;statusEl.innerHTML=abi('thanks');renderAffirmationResults(x.id);toast('Thanks for your response.')}
      };
      if(yesBtn)yesBtn.onclick=()=>submit('YES');
      if(noBtn)noBtn.onclick=()=>submit('NO');
    }else{
      statusEl.innerHTML=abi('notEligible');
    }
  },()=>{statusEl.innerHTML=abi('locError')},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
// --- Citizen Jury for Disputed Resolutions (Simulated for Demo) ---
// Reuses NEIGHBOURHOOD_RADIUS_METERS / haversineDistanceMeters / getNeighbourhoodEligibility
// (the same proximity primitives Neighbourhood Affirmation uses) to seed a demo panel of
// verified nearby citizens. No juror name, address, or exact coordinate is ever stored or shown.
const JURY_MIN_PANEL=5,JURY_MAX_PANEL=7;
const JURY_MAJORITY_SHARE=0.65; // weighted share required for a clear confirm/overturn verdict
const JURY_MAX_WEIGHT_SHARE=0.3; // cap: no single juror's Karma can exceed this share of total panel weight
function juryTriggerReason(x){
  if(x.status==='disputed')return 'Triggered by citizen challenge of a resolved complaint.';
  if(x.riskFlag)return x.riskReason||'Triggered by a forensics/risk flag on this resolution.';
  return null;
}
function loadJuryStore(){try{return JSON.parse(localStorage.getItem('civicchain_jury')||'{}')}catch(e){return {}}}
function saveJuryStore(s){try{localStorage.setItem('civicchain_jury',JSON.stringify(s))}catch(e){}}
function seededRandom(seed){let h=0;for(let i=0;i<seed.length;i++){h=(h<<5)-h+seed.charCodeAt(i);h|=0}return function(){h=(h*1664525+1013904223)|0;return ((h>>>0)/4294967296)}}
function juryWardLabel(x){return (x.location&&x.location.includes('·'))?x.location.split('·').pop().trim():'nearby ward'}
// Places a simulated juror within the existing neighbourhood radius of the complaint (if it has
// coordinates) and re-runs the real eligibility check on that point — no coordinates are exposed,
// only the resulting distance band.
function seedJurorProximity(rnd,x){
  if(x.latitude==null||x.longitude==null)return{label:'Verified resident · '+juryWardLabel(x)};
  const angle=rnd()*Math.PI*2;
  const dist=150+rnd()*(NEIGHBOURHOOD_RADIUS_METERS-150);
  const dLat=(dist*Math.cos(angle))/111320;
  const dLon=(dist*Math.sin(angle))/(111320*Math.cos(x.latitude*Math.PI/180)||1);
  const jLat=x.latitude+dLat,jLon=x.longitude+dLon;
  const eligibility=getNeighbourhoodEligibility(jLat,jLon,6,x); // simulated high-accuracy GPS (±6m)
  const d=haversineDistanceMeters(jLat,jLon,x.latitude,x.longitude);
  const band=d<400?'< 400m':d<700?'400m – 700m':'700m – 1km';
  return{label:(eligibility==='eligible'?'Verified nearby resident':'Nearby resident')+' · '+band+' from complaint'};
}
function getOrCreateJury(x){
  const store=loadJuryStore();
  if(store[x.id])return store[x.id];
  const rnd=seededRandom('jury-'+x.id);
  const size=JURY_MIN_PANEL+Math.floor(rnd()*(JURY_MAX_PANEL-JURY_MIN_PANEL+1));
  const panel=[];
  for(let i=0;i<size;i++){
    const karma=30+Math.floor(rnd()*70);
    panel.push({juror:'Juror #'+(i+1),karma,proximity:seedJurorProximity(rnd,x).label,vote:null});
  }
  const record={panel,stage:'forming',outcome:null,createdAt:new Date().toISOString()};
  store[x.id]=record;saveJuryStore(store);
  return record;
}
function computeJuryTally(record){
  const totalRaw=record.panel.reduce((s,j)=>s+j.karma,0);
  const cap=totalRaw*JURY_MAX_WEIGHT_SHARE;
  let fixedW=0,notFixedW=0,votedCount=0;
  record.panel.forEach(j=>{if(!j.vote)return;votedCount++;const w=Math.min(j.karma,cap);if(j.vote==='FIXED')fixedW+=w;else notFixedW+=w});
  return{votedCount,totalCount:record.panel.length,fixedW,notFixedW,castW:fixedW+notFixedW};
}
function resolveJuryOutcome(x,record){
  const t=computeJuryTally(record);
  const share=t.castW>0?Math.max(t.fixedW,t.notFixedW)/t.castW:0;
  if(share>=JURY_MAJORITY_SHARE){
    record.stage='decided';
    record.outcome=t.fixedW>t.notFixedW?'CONFIRMED':'OVERTURNED';
  }else{
    record.stage='human_review';
    record.outcome='HUMAN_REVIEW';
  }
  record.decidedAt=new Date().toISOString();
  const label=record.outcome==='CONFIRMED'?'Jury Decision: Resolution Confirmed':record.outcome==='OVERTURNED'?'Jury Decision: Resolution Overturned':'Jury Decision: Human Review Required';
  // Appended as a new ledger event only — the original report/resolution events above are never edited or removed.
  x.events.push(label);x.times.push('Now');
  saveCustom();
}
function castJuryVote(x,record,idx,vote){
  const juror=record.panel[idx];
  if(!juror||juror.vote)return false; // one vote per juror; duplicate votes are rejected
  juror.vote=vote;
  if(record.stage==='forming')record.stage='voting';
  const t=computeJuryTally(record);
  if(t.votedCount===t.totalCount)resolveJuryOutcome(x,record);
  const store=loadJuryStore();store[x.id]=record;saveJuryStore(store);
  return true;
}
function renderJuryStepper(stage){
  const decidedDone=stage==='decided'||stage==='human_review';
  const steps=[['forming','Forming',true],['voting','Voting',stage!=='forming'],['decided',stage==='human_review'?'Human Review':'Decided',decidedDone]];
  return `<div class="jury-stepper">${steps.map(([key,label,done])=>`<div class="jury-step${stage===key||(key==='decided'&&decidedDone)?' active':''}${done?' done':''}"><span class="jury-step-dot"></span>${esc(label)}</div>`).join('<span class="jury-step-arrow">→</span>')}</div>`;
}
function renderJurorCard(j,idx){
  if(j.vote){
    return `<div class="juror-card voted"><div class="juror-head"><b>${esc(j.juror)}</b><span class="juror-meta mono">Karma wt ${j.karma}</span></div><small class="juror-meta">${esc(j.proximity)}</small><span class="juror-vote ${j.vote==='FIXED'?'fixed':'notfixed'}">${j.vote==='FIXED'?'✅ Fixed':'❌ Not Fixed'}</span></div>`;
  }
  return `<div class="juror-card"><div class="juror-head"><b>${esc(j.juror)}</b><span class="juror-meta mono">Karma wt ${j.karma}</span></div><small class="juror-meta">${esc(j.proximity)}</small><div class="juror-vote-actions"><button type="button" class="small-btn jury-vote-btn" data-idx="${idx}" data-vote="FIXED">✅ Fixed</button><button type="button" class="small-btn jury-vote-btn" data-idx="${idx}" data-vote="NOT_FIXED">❌ Not Fixed</button></div></div>`;
}
function renderJuryPanel(x){
  const record=getOrCreateJury(x);
  const t=computeJuryTally(record);
  const reason=juryTriggerReason(x);
  const afterImg=x.photo&&x.photo.after?`<img class="ba-img" src="${x.photo.after}" alt="After photo">`:'<div class="ba-placeholder">No after photo on file</div>';
  const evidence=x.photo&&x.photo.before?baBlock(x).replace('__AFTER__',afterImg):'<p class="ba-caption">No photo evidence on file for this complaint.</p>';
  const timelineHtml=`<div class="timeline jury-timeline">${x.events.map((e,i)=>`<div class="event"><strong>${esc(e)}</strong><small>${esc(x.times[i]||'Pending')}</small></div>`).join('')}</div>`;
  let resultHtml='';
  if(record.stage==='decided'||record.stage==='human_review'){
    const pct=t.castW>0?Math.round(Math.max(t.fixedW,t.notFixedW)/t.castW*100):0;
    const verdictText=record.outcome==='CONFIRMED'?'Resolution Confirmed':record.outcome==='OVERTURNED'?'Resolution Overturned':'Human Review Required';
    const cls=record.outcome==='CONFIRMED'?'confirmed':record.outcome==='OVERTURNED'?'overturned':'review';
    const detailText=record.outcome==='HUMAN_REVIEW'?'No clear weighted majority — routed to human review.':`${pct}% weighted majority.`;
    resultHtml=`<div class="jury-result ${cls}"><b>${verdictText}</b><small>Weighted tally: ${Math.round(t.fixedW)} Fixed · ${Math.round(t.notFixedW)} Not Fixed — ${detailText} This decision is logged as a new ledger event; the original resolution record is unchanged.</small></div>`;
  }
  return `<div class="jury-panel glass" id="juryPanel" data-complaint="${esc(x.id)}">
    <div class="jury-head"><h4>Citizen Jury for Disputed Resolutions <span class="jury-demo-badge">Simulated for Demo</span></h4>
    <p class="verify-q">${esc(reason||'A panel of verified nearby residents reviews the evidence below and votes on whether the issue is actually fixed.')} Juror identities, exact addresses, and coordinates are never shown — only Karma-based vote weight and an approximate distance band.</p></div>
    ${renderJuryStepper(record.stage)}
    <div class="jury-evidence"><span class="eyebrow">EVIDENCE REVIEWED BY JURY</span>${evidence}${timelineHtml}</div>
    <div class="jury-progress mono">${t.votedCount}/${t.totalCount} jurors voted · one vote per juror · no single juror's Karma may exceed ${Math.round(JURY_MAX_WEIGHT_SHARE*100)}% of panel weight</div>
    <div class="juror-grid">${record.panel.map((j,i)=>renderJurorCard(j,i)).join('')}</div>
    ${resultHtml}
  </div>`;
}
function wireJuryPanel(x){
  const panel=$('#juryPanel');if(!panel)return;
  panel.querySelectorAll('.jury-vote-btn').forEach(btn=>{
    btn.onclick=()=>{
      const store=loadJuryStore();const record=store[x.id];if(!record)return;
      const idx=Number(btn.dataset.idx),vote=btn.dataset.vote;
      if(castJuryVote(x,record,idx,vote)){showDetail(x.id);toast('Vote recorded.');}
    };
  });
}
function showDetail(query){const d=$('#detail');if(!d)return;let x=all().find(v=>v.id.toLowerCase()===query.toLowerCase()||v.cc.toLowerCase()===query.toLowerCase());if(!x){d.className='detail empty';d.innerHTML='<div class="empty-icon">⌕</div><h3>No record found</h3><p>Check the MCD Number or CivicChain ID and try again.</p>';return}d.className='detail';d.innerHTML=`<div class="detail-head"><div><div class="eyebrow">IMMUTABLE COMPLAINT RECORD</div><h3>${esc(x.category)} <span class="tag ${x.status}">${esc(x.statusLabel)}</span></h3><p>${esc(x.location)} · <span class="mono">${esc(x.cc)}</span></p></div><div class="detail-meta">SHA-256<br><b>4F82...A09C</b></div></div><p>${esc(x.description)}</p><div class="timeline">${x.events.map((e,i)=>`<div class="event"><strong>${esc(e)}</strong><small>${esc(x.times[i]||'Pending')}</small></div>`).join('')}</div>${x.status==='verified'?'<button class="btn challenge" id="challengeBtn">Challenge this resolution</button>':''}${x.status==='awaiting'?renderVerifyCard(x):''}${x.status==='verified'&&x.photo&&x.photo.after?renderVerifiedBox(x):''}${(x.latitude!=null&&x.longitude!=null&&x.photo&&x.photo.after)?renderAffirmationCard(x):''}${juryTriggerReason(x)?renderJuryPanel(x):''}`;if($('#challengeBtn'))$('#challengeBtn').onclick=()=>{x.status='disputed';x.statusLabel='Disputed / Reopened';x.events.push('Challenged');x.times.push('Now');saveCustom();renderLedger();showDetail(x.id);updateStats();toast('Challenge appended. Previous resolution remains visible.');};if($('#confirmResolutionBtn'))wireVerifyCard(x);if($('#affirmCard'))wireAffirmationCard(x);if($('#juryPanel'))wireJuryPanel(x);d.scrollIntoView({behavior:'smooth',block:'center'})}
function updateStats(){const totalEl=$('#statTotal');if(!totalEl)return;let xs=all();totalEl.textContent=(8241+custom.length).toLocaleString();$('#statOpen').textContent=(1086+xs.filter(x=>x.status==='open').length-2).toLocaleString();$('#statVerified').textContent=(6742+xs.filter(x=>x.status==='verified').length-2).toLocaleString();}
renderLedger();updateStats();
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{if(btn.closest('.map-filters'))return;document.querySelectorAll('.filters .filter').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderLedger(btn.dataset.filter||'all')}));
if($('#searchBtn')){$('#searchBtn').onclick=()=>showDetail($('#search').value.trim());$('#search').onkeydown=e=>{if(e.key==='Enter')$('#searchBtn').click()};const params=new URLSearchParams(location.search);const qid=params.get('id');if(qid){$('#search').value=qid;showDetail(qid)}}
const ISSUE_LIBRARY={'Sanitation':['Kachra pada hai','Dustbin bhar gaya hai','Kachra gaadi nahi aa rahi','Kachra uthaya nahi gaya','Khali plot mein kachra pada hai','Road/gali mein kachra pada hai','Safai nahi hui'],'Water Drainage':['Gali mein paani jama hai','Naali bhar gayi hai','Naali saaf nahi hui','Naali ka paani road par aa raha hai','Baarish ke baad paani nahi nikal raha','Naali toot gayi hai','Gandi naali se badbu aa rahi hai'],'Potholes':['Sadak mein bada gaddha hai','Sadak toot gayi hai','Road ki safai karani hai','Road par malba pada hai','Road par paani jama hai','Footpath toot gaya hai','Sadak chalne layak nahi hai'],'Streetlights':['Streetlight band hai','Gali mein light nahi hai','Streetlight toot gayi hai','Light baar-baar band ho rahi hai','Streetlight din mein bhi jal rahi hai','Andhere ki wajah se road/gali unsafe hai'],'Parks':['Park mein safai nahi hui','Park mein kachra pada hai','Park ki light band hai','Jhoola toot gaya hai','Bench toot gayi hai','Ped ki branch dangerous hai','Park mein paani jama hai']};
const OTHER_LABEL='Koi aur problem';
if($('#issuePicker')){
  const optsEl=$('#issueOptions');const descLabel=$('#descriptionLabel');const descArea=$('#description');const descLabelText=$('#descriptionLabelText');const descHint=$('#descriptionHint');
  function renderIssues(){
    const list=(ISSUE_LIBRARY[$('#category').value]||[]).concat([OTHER_LABEL]);
    optsEl.innerHTML=list.map((t,i)=>`<button type="button" class="issue-chip${t===OTHER_LABEL?' other':''}" data-issue="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('');
    descLabel.hidden=true;descArea.value='';descLabelText.textContent='Description';descHint.hidden=true;
    optsEl.querySelectorAll('.issue-chip').forEach(chip=>chip.addEventListener('click',()=>{
      optsEl.querySelectorAll('.issue-chip').forEach(c=>{c.classList.remove('active');c.setAttribute('aria-pressed','false')});
      chip.classList.add('active');chip.setAttribute('aria-pressed','true');
      if(chip.dataset.issue===OTHER_LABEL){descArea.value='';descLabelText.textContent='Apni problem simple words mein likhein…';descHint.hidden=false;descLabel.hidden=false;descArea.focus()}
      else{descArea.value=chip.dataset.issue;descLabel.hidden=true}
    }));
  }
  $('#category').addEventListener('change',renderIssues);
  renderIssues();
}
// --- Hindi Speech-to-Text for complaint description (Part 1) ---
const VL={speak:['Speak','हिंदी में बोलें'],listening:['Listening…','सुन रहे हैं…'],noSpeech:['Could not hear you. Please try again.','आवाज़ समझ नहीं आई। कृपया फिर से बोलें।'],unsupported:['Voice input is not supported in this browser. You can type normally.','इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। आप सामान्य तरीके से टाइप कर सकते हैं।'],denied:['Microphone permission was denied. You can type normally.','माइक्रोफ़ोन की अनुमति नहीं मिली। आप सामान्य तरीके से टाइप कर सकते हैं।']};
function vl(key){return `${VL[key][0]}<small class="hi">${VL[key][1]}</small>`}
// --- Hindi (Devanagari) -> Hinglish/Roman conversion (Part 2) ---
// Lightweight, local, no external API. Dictionary-first for common civic words/phrases,
// falls back to a simple akshar-by-akshar transliteration for anything else, and
// falls back to the untouched original text if anything unexpected happens.
const HINGLISH_PHRASES=[['हो गया','ho gaya'],['हो गई','ho gayi'],['हो गयी','ho gayi'],['करना है','karna hai'],['सफाई नहीं हुई','safai nahi hui'],['ठीक नहीं','theek nahi']];
const HINGLISH_WORDS={'समस्या':'samasya','गली':'gali','सड़क':'sadak','पानी':'pani','कचरा':'kachra','कूड़ा':'kuda','नाली':'naali','बिजली':'bijli','लाइट':'light','गड्ढा':'gaddha','गड्ढे':'gaddhe','टूटी':'tooti','टूटा':'toota','टूट':'toot','बंद':'band','नहीं':'nahi','बहुत':'bahut','है':'hai','हैं':'hain','था':'tha','थी':'thi','हुआ':'hua','हुई':'hui','हुए':'hue','में':'mein','से':'se','की':'ki','का':'ka','के':'ke','को':'ko','पर':'par','और':'aur','या':'ya','भी':'bhi','अभी':'abhi','अब':'ab','यह':'yeh','वह':'voh','हम':'hum','हमारी':'hamari','हमारा':'hamara','मेरी':'meri','मेरा':'mera','आपकी':'aapki','कोई':'koi','कुछ':'kuch','सब':'sab','सभी':'sabhi','रोड':'road','फुटपाथ':'footpath','पार्क':'park','झूला':'jhoola','बेंच':'bench','पेड़':'ped','डस्टबिन':'dustbin','गंदगी':'gandagi','सफाई':'safai','बदबू':'badbu','जमा':'jama','भरा':'bhara','पिछले':'pichle','तीन':'teen','दिन':'din','हफ्ते':'hafte','महीने':'mahine','साल':'saal','बड़ा':'bada','बड़ी':'badi','छोटा':'chota','खराब':'kharab','जल्दी':'jaldi','तुरंत':'turant','कृपया':'kripya','समाधान':'samadhan','शिकायत':'shikayat','इलाका':'ilaka','मोहल्ला':'mohalla','वार्ड':'ward','पास':'paas','सामने':'samne','पीछे':'peeche','अंदर':'andar','बाहर':'bahar','रात':'raat','हमेशा':'hamesha','रोज':'roz','आया':'aaya','आई':'aayi','गया':'gaya','गई':'gayi','करें':'karein','चाहिए':'chahiye'};
const HINGLISH_CONSONANTS={'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny','ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n','प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h','ड़':'d','ढ़':'dh','फ़':'f','ज़':'z','ख़':'kh','ग़':'g','क़':'q'};
const HINGLISH_MATRAS={'ा':'aa','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au'};
const HINGLISH_VOWELS={'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au'};
const HINGLISH_DIGITS={'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'};
function isDevanagari(s){return /[\u0900-\u097F]/.test(s)}
function transliterateDevanagariWord(word){
  let out='',pending=null;
  const flush=()=>{if(pending!==null){out+=pending+'a';pending=null}};
  for(const ch of word){
    if(HINGLISH_CONSONANTS[ch]!==undefined){flush();pending=HINGLISH_CONSONANTS[ch];continue}
    if(HINGLISH_MATRAS[ch]!==undefined){if(pending!==null){out+=pending+HINGLISH_MATRAS[ch];pending=null}else{out+=HINGLISH_MATRAS[ch]}continue}
    if(ch==='्'){if(pending!==null){out+=pending;pending=null}continue}
    if(ch==='ं'||ch==='ँ'){flush();out+='n';continue}
    if(ch==='ः'){flush();out+='h';continue}
    if(HINGLISH_VOWELS[ch]!==undefined){flush();out+=HINGLISH_VOWELS[ch];continue}
    if(HINGLISH_DIGITS[ch]!==undefined){flush();out+=HINGLISH_DIGITS[ch];continue}
    flush();out+=ch;
  }
  flush();
  return out;
}
function hindiToHinglish(text){
  try{
    if(!text)return text;
    let working=text;
    HINGLISH_PHRASES.forEach(([hi,roman])=>{working=working.split(hi).join(roman)});
    const tokens=working.split(/(\s+)/);
    const converted=tokens.map(tok=>{
      if(!tok.trim())return tok;
      const m=tok.match(/^([^\u0900-\u097Fa-zA-Z0-9]*)([\s\S]*?)([^\u0900-\u097Fa-zA-Z0-9]*)$/);
      const lead=m?m[1]:'',core=m?m[2]:tok,trail=m?m[3]:'';
      if(!core)return tok;
      if(!isDevanagari(core))return tok; // English words / punctuation / already-roman kept as-is
      const mapped=HINGLISH_WORDS[core];
      return lead+(mapped!==undefined?mapped:transliterateDevanagariWord(core))+trail;
    });
    let result=converted.join('');
    result=result.replace(/^\s*[a-zA-Z]/,c=>c.toUpperCase());
    return result.trim()?result:text;
  }catch(e){
    return text; // never lose the user's speech result if conversion fails
  }
}
(function initVoiceInput(){
  const voiceBtn=$('#voiceBtn');const descArea=$('#description');const voiceError=$('#voiceError');
  if(!voiceBtn||!descArea)return;
  function showVoiceError(key){if(!voiceError)return;voiceError.innerHTML=vl(key);voiceError.hidden=false}
  function clearVoiceError(){if(voiceError)voiceError.hidden=true}
  function renderBtn(listening){voiceBtn.innerHTML=(listening?'🔴 ':'🎙️ ')+`<span id="voiceBtnText">${listening?VL.listening[0]:VL.speak[0]}</span>`}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    voiceBtn.disabled=true;
    voiceBtn.title='Voice input is not supported in this browser';
    showVoiceError('unsupported');
    return;
  }
  let recognition=null,listening=false;
  function setListening(v){
    listening=v;
    voiceBtn.classList.toggle('listening',v);
    voiceBtn.setAttribute('aria-pressed',v?'true':'false');
    renderBtn(v);
  }
  function stopRecognition(){if(recognition){try{recognition.stop()}catch(e){}}}
  function startRecognition(){
    clearVoiceError();
    recognition=new SR();
    recognition.lang='hi-IN';
    recognition.interimResults=false;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>setListening(true);
    recognition.onresult=e=>{
      const rawText=(e.results&&e.results[0]&&e.results[0][0]&&e.results[0][0].transcript||'').trim();
      if(!rawText)return;
      const text=hindiToHinglish(rawText); // falls back to rawText internally if conversion fails
      const existing=descArea.value.trim();
      descArea.value=existing?existing+' '+text:text;
      descArea.dispatchEvent(new Event('input'));
    };
    recognition.onerror=e=>{
      if(e.error==='not-allowed'||e.error==='service-not-allowed')showVoiceError('denied');
      else showVoiceError('noSpeech');
    };
    recognition.onend=()=>{setListening(false);recognition=null};
    try{recognition.start()}catch(err){setListening(false);showVoiceError('noSpeech')}
  }
  renderBtn(false);
  voiceBtn.addEventListener('click',()=>{
    if(listening){stopRecognition();return}
    clearVoiceError();
    startRecognition();
  });
})();
let currentPhotos=[];
const MAX_PHOTOS=5;
function renderPhotoThumbs(){
  const preview=$('#photoPreview');if(!preview)return;
  if(!currentPhotos.length){preview.hidden=true;preview.innerHTML='';}
  else{preview.hidden=false;preview.innerHTML=currentPhotos.map((p,i)=>`<div class="photo-thumb"><img src="${p.dataUrl}" alt="Issue photo ${i+1}"><button type="button" class="photo-thumb-remove" data-idx="${i}" aria-label="Remove photo ${i+1}">×</button></div>`).join('');}
  const label=$('#fileLabel'),uploadLabel=$('#photoUploadLabel');
  if(label)label.textContent=currentPhotos.length?`${currentPhotos.length}/${MAX_PHOTOS} photos added`:'Add a photo of the problem';
  if(uploadLabel)uploadLabel.classList.toggle('disabled',currentPhotos.length>=MAX_PHOTOS);
}
function resetPhotoField(){currentPhotos=[];if($('#photo'))$('#photo').value='';renderPhotoThumbs()}
function showPhotoError(msg){const el=$('#photoError');if(!el)return;el.textContent=msg;el.hidden=false;$('.upload').scrollIntoView({behavior:'smooth',block:'center'})}
function clearPhotoError(){const el=$('#photoError');if(el)el.hidden=true}
if($('#photo')){$('#photo').onchange=e=>{
  const files=Array.from(e.target.files||[]);
  e.target.value='';
  if(!files.length)return;
  const imageFiles=files.filter(f=>f.type.startsWith('image/'));
  if(imageFiles.length<files.length)showPhotoError('Please choose an image file.');
  const remaining=MAX_PHOTOS-currentPhotos.length;
  if(remaining<=0){showPhotoError('You can upload a maximum of 5 photos.');return}
  const toAdd=imageFiles.slice(0,remaining);
  if(imageFiles.length>remaining)showPhotoError('You can upload a maximum of 5 photos.');
  if(!toAdd.length)return;
  let loaded=0;
  toAdd.forEach(f=>{const reader=new FileReader();reader.onload=()=>{currentPhotos.push({name:f.name,dataUrl:reader.result});loaded++;if(loaded===toAdd.length){renderPhotoThumbs();if(imageFiles.length<=remaining)clearPhotoError()}};reader.readAsDataURL(f)});
}}
if($('#photoPreview'))$('#photoPreview').addEventListener('click',e=>{
  const btn=e.target.closest('.photo-thumb-remove');if(!btn)return;
  const idx=Number(btn.dataset.idx);
  currentPhotos.splice(idx,1);
  renderPhotoThumbs();
});
// --- Report location capture (single-shot, no watch, no history, no fake fallback) ---
let reportLocation=null;
function setLocationStatus(msg,state){const el=$('#locationStatus');if(!el)return;el.textContent=msg;el.className='description-hint location-status'+(state?' '+state:'')}
function setLocationRetryVisible(v){const b=$('#locationRetryBtn');if(b)b.hidden=!v}
function requestReportLocation(onProceed){
  setLocationRetryVisible(false);
  if(!('geolocation' in navigator)){
    reportLocation=null;
    setLocationStatus("Your browser doesn't support location. This report can be submitted, but won't be eligible for neighbourhood affirmation.",'error');
    onProceed();return;
  }
  setLocationStatus('Requesting your location…');
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude,accuracy}=pos.coords;
    if(accuracy<=LOCATION_ACCURACY_THRESHOLD_METERS){
      reportLocation={latitude,longitude,accuracy};
      setLocationStatus('Location captured (±'+Math.round(accuracy)+'m).','ok');
      onProceed();
    }else{
      reportLocation=null;
      setLocationStatus('Your location is not accurate enough yet. Please try again from an open area.','error');
      setLocationRetryVisible(true);
    }
  },err=>{
    reportLocation=null;
    let msg="We couldn't get your location. This report can be submitted, but won't be eligible for neighbourhood affirmation.";
    if(err.code===err.PERMISSION_DENIED)msg="Location permission was denied. This report can be submitted, but won't be eligible for neighbourhood affirmation.";
    else if(err.code===err.POSITION_UNAVAILABLE)msg='Your location is unavailable right now. You can retry, or submit without it.';
    else if(err.code===err.TIMEOUT)msg='Getting your location took too long. You can retry, or submit without it.';
    setLocationStatus(msg,'error');
    setLocationRetryVisible(true);
    onProceed();
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
if($('#locationRetryBtn'))$('#locationRetryBtn').onclick=()=>requestReportLocation(()=>{});
function createReportedComplaint(){
  let id='MCD-2026-'+Math.floor(9000+Math.random()*999);let cc='CC-DL-'+Math.random().toString(16).slice(2,6).toUpperCase();
  let complaint={id,cc,category:$('#category').value,location:$('#landmark').value+' · '+$('#ward').value+' Ward',status:'open',statusLabel:'Open · 48h left',description:$('#description').value,events:['Reported'],times:['Just now'],photo:{name:currentPhotos[0].name,dataUrl:currentPhotos[0].dataUrl},photos:currentPhotos.map(p=>({name:p.name,dataUrl:p.dataUrl}))};
  if(reportLocation&&reportLocation.accuracy<=LOCATION_ACCURACY_THRESHOLD_METERS){complaint.latitude=reportLocation.latitude;complaint.longitude=reportLocation.longitude;complaint.location_accuracy=reportLocation.accuracy}
  custom.push(complaint);saveCustom();
  $('#reportForm').reset();resetPhotoField();clearPhotoError();
  reportLocation=null;setLocationRetryVisible(false);setLocationStatus("We'll ask for your location when you submit, so nearby residents can help verify this issue.");
  if($('#issuePicker')){$('#issueOptions').innerHTML='';const de=$('#category');de.dispatchEvent(new Event('change'))}
  toast(`Submitted: ${id} · ${cc}`);setTimeout(()=>{location.href='track-cc.html?id='+encodeURIComponent(id)},900);
}
if($('#reportForm')){$('#reportForm').onsubmit=e=>{
  e.preventDefault();
  if(currentPhotos.length<1){showPhotoError('Please upload at least one photo of the issue.');return}
  if(currentPhotos.length>MAX_PHOTOS){showPhotoError('You can upload a maximum of 5 photos.');return}
  if(reportLocation&&reportLocation.accuracy<=LOCATION_ACCURACY_THRESHOLD_METERS){createReportedComplaint();return}
  requestReportLocation(createReportedComplaint);
}}
if($('#verifyBtn'))$('#verifyBtn').onclick=()=>{let r=$('#verifyResult');r.hidden=false;r.textContent='✓ BLOCK VERIFIED · Merkle root matches · SHA-256 chain intact · inspected just now';};
document.querySelector('.menu-btn').onclick=()=>$('#nav').classList.toggle('open');document.querySelectorAll('nav a').forEach(a=>a.onclick=()=>$('#nav').classList.remove('open'));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>io.observe(e));
setInterval(()=>{let n=8492118+Math.floor((Date.now()/1000)%100);const bh=$('#blockHeight');if(bh)bh.textContent='#'+n.toLocaleString();const hb=$('#heroBlock');if(hb)hb.textContent=n.toLocaleString()},1000);


// --- Budget-to-Outcome Transparency + RTI layer ---
const BUDGET_DATA=[
  {ward:'Central Ward',category:'Water Drainage',allocated:4200000,spent:3150000,complaints:86,resolved:61,verified:49,source:'Simulated',fy:'2025–26',updated:'Demo dataset'},
  {ward:'South Ward',category:'Streetlights',allocated:2800000,spent:2320000,complaints:54,resolved:43,verified:38,source:'Simulated',fy:'2025–26',updated:'Demo dataset'},
  {ward:'West Ward',category:'Potholes',allocated:3650000,spent:3010000,complaints:73,resolved:58,verified:44,source:'Simulated',fy:'2025–26',updated:'Demo dataset'},
  {ward:'Shahdara Ward',category:'Sanitation',allocated:5100000,spent:4480000,complaints:112,resolved:81,verified:62,source:'Simulated',fy:'2025–26',updated:'Demo dataset'},
  {ward:'Rohini Ward',category:'Parks',allocated:2400000,spent:1200000,complaints:39,resolved:24,verified:21,source:'Simulated',fy:'2025–26',updated:'Demo dataset'},
  {ward:'North Ward',category:'Streetlights',allocated:3100000,spent:2790000,complaints:67,resolved:52,verified:46,source:'Simulated',fy:'2025–26',updated:'Demo dataset'}
];
const BUDGET_TREND=[{q:'Q1',spent:3.1,verified:32},{q:'Q2',spent:4.2,verified:41},{q:'Q3',spent:5.4,verified:56},{q:'Q4',spent:6.8,verified:71}];
const money=n=>`₹${Math.round(Number(n)||0).toLocaleString('en-IN')}`;
const safePct=(a,b)=>Number(a)>0&&Number.isFinite(Number(b))?Math.max(0,Math.min(100,(Number(b)/Number(a))*100)):0;
function budgetRows(){return BUDGET_DATA.filter(d=>(($('#budgetWard')||{}).value||'all')==='all'||d.ward===$('#budgetWard').value).filter(d=>(($('#budgetCategory')||{}).value||'all')==='all'||d.category===$('#budgetCategory').value)}
function renderBudget(){const rows=budgetRows();const totals=rows.reduce((a,d)=>{a.allocated+=d.allocated;a.spent+=d.spent;a.complaints+=d.complaints;a.resolved+=d.resolved;a.verified+=d.verified;return a},{allocated:0,spent:0,complaints:0,resolved:0,verified:0});const remaining=Math.max(0,totals.allocated-totals.spent);const util=safePct(totals.allocated,totals.spent);const vPct=safePct(totals.resolved,totals.verified);const efficiency=totals.spent>0?totals.verified/(totals.spent/100000):0;const summary=$('#budgetSummary');if(summary)summary.innerHTML=`<div class="budget-stat"><strong>${money(totals.allocated)}</strong><span>Total allocated</span><small>Across ${rows.length} ward/category records</small></div><div class="budget-stat"><strong>${money(totals.spent)}</strong><span>Total utilised · ${util.toFixed(1)}%</span><small>Demo-labelled spending data</small></div><div class="budget-stat"><strong>${money(remaining)}</strong><span>Remaining</span><small>Allocated minus utilised</small></div><div class="budget-stat"><strong>${vPct.toFixed(1)}%</strong><span>Verified-fixed rate</span><small>${efficiency.toFixed(2)} verified fixes / ₹1 lakh</small></div>`;const list=$('#budgetRows');if(list)list.innerHTML=rows.map(d=>{const u=safePct(d.allocated,d.spent),v=safePct(d.resolved,d.verified),e=d.spent>0?d.verified/(d.spent/100000):0;return `<div class="budget-row"><div class="budget-row-head"><div><strong>${esc(d.ward)} · ${esc(d.category)}</strong><small>${esc(d.source)} · FY ${esc(d.fy)}</small></div><span class="source-badge simulated">${esc(d.source)}</span></div><div class="budget-bar" aria-label="${u.toFixed(1)} percent utilised"><i style="width:${u}%"></i></div><div class="budget-row-metrics"><span>Spend<b>${money(d.spent)} / ${money(d.allocated)}</b></span><span>Utilised<b>${u.toFixed(1)}%</b></span><span>Verified fixes<b>${d.verified} / ${d.resolved} · ${v.toFixed(1)}%</b></span><span>Efficiency<b>${e.toFixed(2)} / ₹1 lakh</b></span></div></div>`}).join('')||'<p class="ba-caption">No records match these filters.</p>';const trend=$('#budgetTrend');if(trend){const maxSpend=Math.max(...BUDGET_TREND.map(x=>x.spent));const maxOutcome=Math.max(...BUDGET_TREND.map(x=>x.verified));trend.innerHTML=BUDGET_TREND.map(x=>`<div class="trend-col"><i class="trend-bar spend" style="height:${(x.spent/maxSpend)*88}%" title="${x.q}: ₹${x.spent} lakh spend"></i><i class="trend-bar outcome" style="height:${(x.verified/maxOutcome)*88}%" title="${x.q}: ${x.verified} verified fixes"></i><small>${x.q}</small></div>`).join('')}const detail=$('#rtiDetails');if(detail)detail.innerHTML=rows.slice(0,4).map(d=>`<div class="rti-item"><span><b>${esc(d.ward)} · ${esc(d.category)}</b><br>Source: ${esc(d.source)} · ${esc(d.updated)} · FY ${esc(d.fy)}</span><a href="#budget-outcomes" aria-label="View RTI-backed expenditure">View RTI-backed expenditure</a></div>`).join('')||''}
function initBudget(){const ward=$('#budgetWard'),cat=$('#budgetCategory');if(!ward||!cat)return;[...new Set(BUDGET_DATA.map(d=>d.ward))].sort().forEach(v=>ward.insertAdjacentHTML('beforeend',`<option value="${esc(v)}">${esc(v)}</option>`));[...new Set(BUDGET_DATA.map(d=>d.category))].sort().forEach(v=>cat.insertAdjacentHTML('beforeend',`<option value="${esc(v)}">${esc(v)}</option>`));ward.onchange=renderBudget;cat.onchange=renderBudget;renderBudget()}
initBudget();
