(function(){
"use strict";
const S=window.SCENARIOS||[];const app=document.getElementById('app');
let sc,st,view;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=q=>app.querySelector(q),$$=q=>app.querySelectorAll(q);
function band(){return sc.vitals.find(b=>st.temp>=b.min);}
function fill(t){const b=band();return t.replace(/\{(\w+)\}/g,(m,k)=>b[k]!==undefined?b[k]:m);}
function severe(){return st.temp<sc.temp.severeBelow;}
function allSources(){return sc.heatSources.every(h=>st.addressed[h.id]);}
function cond(c){
 if(c==='always')return true;if(c==='mild')return!severe();if(c==='severe')return severe();if(c==='allSources')return allSources();
 if(c==='drinkOk')return!st.flags.drinkSevere;if(c==='resourcesOk')return resJudge().ok;
 if(c.startsWith('flag:'))return!!st.flags[c.slice(5)];if(c.startsWith('call:'))return!!st.calls[c.slice(5)];
 let m=c.match(/^hotspots>=(\d+)$/);if(m)return st.seen.length>=+m[1];
 m=c.match(/^olsena>=(\d+)$/);if(m)return Object.keys(st.flags).filter(k=>k.startsWith('olsena_')).length>=+m[1];
 console.warn('óþekkt skilyrði',c);return false;}
const all=a=>(a||[]).every(cond);const any=a=>(a||[]).some(cond);
function log(t,cls){st.log.push({t:'['+st.minute+' mín] '+t,cls:cls||''});st.last={t,cls:cls||''};}
function tick(min){for(let i=0;i<min;i++){const open=sc.heatSources.filter(h=>!st.addressed[h.id]).length;
 const was=severe();st.temp-=open*sc.temp.ratePerSource;if(open===0&&st.flags.t_drykkur&&!severe())st.temp+=sc.temp.warmRate;
 st.temp=Math.min(st.temp,36.5);st.minute++;
 if(!was&&severe()){log('Ástand versnar! Skjálftinn hættir og hún svarar varla. Alvarleg ofkæling.','bad');st.flags.becameSevere=true;}
 sc.resources.forEach(r=>{const c=st.calls[r.id];if(c&&!c.arrived&&st.minute>=c.at+r.eta){c.arrived=st.minute;st.flags['arrived_'+r.id]=true;log(r.icon+' '+r.arriveText,'info');}});}}
/* ---- skjámynd: mynd í fullri stærð + yfirlög ---- */
function screen(img,hots,hud,sheet,extra){
 app.innerHTML=`<img class="bg" id="bg" src="${img}" alt="">${hots?`<div class="hots">${hots}</div>`:''}${hud||''}${sheet||''}${extra||''}${st&&st.radio?radioHtml():''}${st&&st.showLog?logHtml():''}`;
 const bg=$('#bg');if(hots){bg.complete?place():bg.onload=place;}
 bindCommon();}
function place(){const bg=$('#bg');if(!bg||!bg.naturalWidth)return;const W=app.clientWidth,H=app.clientHeight,iw=bg.naturalWidth,ih=bg.naturalHeight;
 const k=Math.max(W/iw,H/ih),dw=iw*k,dh=ih*k,ox=(W-dw)/2,oy=(H-dh)/2;
 $$('.hot').forEach(h=>{let x=ox+dw*h.dataset.x/100,y=oy+dh*h.dataset.y/100;x=Math.min(W-28,Math.max(28,x));y=Math.min(H-28,Math.max(96,y));h.style.left=x+'px';h.style.top=y+'px';});}
window.addEventListener('resize',place);
function hudHtml(){const b=band();const n=sc.heatSources.filter(h=>st.addressed[h.id]).length;
 const pend=sc.resources.filter(r=>st.calls[r.id]).map(r=>{const c=st.calls[r.id];return `<span class="glass">${r.icon} ${c.arrived?'á staðnum':'~'+Math.max(0,c.at+r.eta-st.minute)+' mín'}</span>`;}).join('');
 return `<div class="hud"><div class="pill glass">⏱ <b>${st.minute} mín</b></div><div class="pill glass grow" title="Ástand">${view==='distance'?'🔭 '+esc(sc.patient.name)+' liggur á hrauninu':(severe()?'⚠️ ':'🥶 ')+esc(b.shiver)}</div>
 <button class="glass" id="logBtn" aria-label="Atburðaskrá">📜</button><button class="glass radio" id="radioBtn" aria-label="Kalla eftir aðstoð">📻</button></div>
 <div class="status">${view!=='distance'?`<span class="glass">Hitatap stöðvað ${n}/${sc.heatSources.length}</span>`:''}${pend}</div>`;}
function sheetHtml(body){return `<div class="sheet glass ${st.min?'min':''}"><button class="handle" id="handle">${st.min?'Sýna valmynd':'Fela valmynd – sjá mynd'}</button><div class="body" id="body">${body}</div></div>`;}
function msgHtml(){return st.last?`<div class="msg ${st.last.cls}">${esc(st.last.t)}</div>`:'';}
function radioHtml(){return `<div class="overlay" id="ov"><div class="panel glass"><h1>📻 Kalla eftir aðstoð</h1><p class="muted">Þú ert björgunarsveitarmaður á vettvangi. Staðsetning: ${esc(sc.location.label)}. Hvert kall tekur 1 mín.</p>
 ${sc.resources.map(r=>{const c=st.calls[r.id];return `<button data-call="${r.id}" ${c?'disabled class="done"':''}><div class="res"><span class="ic">${r.icon}</span><div><b>${esc(r.label)}</b>${c?` ✓ ${c.arrived?'á staðnum':'kemur eftir ~'+Math.max(0,c.at+r.eta-st.minute)+' mín'}`:` <span class="m">· áætl. ${r.eta} mín</span>`}<small>${esc(r.role)}</small></div></div></button>`;}).join('')}
 <button class="primary" id="ovClose">Loka</button></div></div>`;}
function logHtml(){return `<div class="overlay" id="lov"><div class="panel glass"><h1>📜 Atburðaskrá</h1><div class="log">${st.log.map(l=>`<p class="${l.cls}">${esc(l.t)}</p>`).join('')||'<p class="muted">Ekkert enn.</p>'}</div><button class="primary" id="lovClose">Loka</button></div></div>`;}
function bindCommon(){const on=(id,f)=>{const e=$('#'+id);if(e)e.onclick=f;};
 on('radioBtn',()=>{st.radio=true;render();});on('ovClose',()=>{st.radio=false;render();});
 on('logBtn',()=>{st.showLog=true;render();});on('lovClose',()=>{st.showLog=false;render();});
 on('handle',()=>{st.min=!st.min;render();});
 $$('[data-call]').forEach(b=>b.onclick=()=>{const r=sc.resources.find(x=>x.id===b.dataset.call);st.calls[r.id]={at:st.minute+1,phase:view};
  log('📻 Kallað eftir: '+r.label+'. „'+sc.location.callText+'“ Áætlaður komutími ~'+r.eta+' mín.','info');tick(1);render();});}
function render(){({distance,close,report,debrief})[view]();}
/* ---- valmynd ---- */
function menu(){st=null;view='menu';const img=S[0]?S[0].images.wide:'';
 app.innerHTML=`<img class="bg" src="${img}" alt=""><div class="sheet glass"><div class="body" style="padding-top:14px"><h1>Fyrsta hjálp</h1><p class="muted">Þú ert björgunarsveitarmaður. Þjálfunarleikur byggður á glærum Landsbjargar.</p>
 <h3>Braut 1 – Fyrsta hjálp 1</h3>${S.filter(s=>s.track===1).map(s=>`<button class="primary" data-s="${s.id}">${esc(s.title)}</button>`).join('')}
 <h3>Braut 2 – Óbyggðagrunnur</h3><button disabled>Væntanlegt</button><h3>Braut 3 – WFR</h3><button disabled>Væntanlegt</button></div></div>`;
 $$('[data-s]').forEach(b=>b.onclick=()=>start(b.dataset.s));}
function start(id){sc=S.find(s=>s.id===id);st={minute:0,temp:sc.temp.start,flags:{},addressed:{},seen:[],calls:{},log:[],score:[],report:null,tab:sc.close.groups[0].id,clue:null,last:{t:sc.intro,cls:''}};view='distance';render();}
/* ---- fjarlægð ---- */
function distance(){const d=sc.distance;
 const hots=d.hotspots.map((h,i)=>`<button class="hot ${st.seen.includes(h.id)?'seen':''}" data-x="${h.x}" data-y="${h.y}" data-h="${h.id}" aria-label="${esc(h.label)}">${i+1}</button>`).join('');
 screen(sc.images.wide,hots,hudHtml()+(st.clue?`<div class="toast glass" id="toast">${esc(st.clue)}<span class="m"> · pikkaðu til að loka</span></div>`:''),sheetHtml(`${msgHtml()}<p class="muted">Pikkaðu á merkin á myndinni (${st.seen.length}/${d.hotspots.length} könnuð). 📻 = kalla eftir aðstoð.</p><h3>Hvað gerirðu?</h3>${d.approach.map(a=>`<button data-a="${a.id}">${esc(a.label)}</button>`).join('')}`));
 const t=$('#toast');if(t)t.onclick=()=>{st.clue=null;render();};
 $$('[data-h]').forEach(b=>b.onclick=()=>{const h=d.hotspots.find(x=>x.id===b.dataset.h);if(!st.seen.includes(h.id))st.seen.push(h.id);st.clue=h.label+': '+h.text;render();});
 $$('[data-a]').forEach(b=>b.onclick=()=>{const a=d.approach.find(x=>x.id===b.dataset.a);st.clue=null;st.min=false;st.flags[a.flag]=true;
  st.score.push({label:'Nálgun: '+a.label,points:a.score});log(a.text,a.score>0?'good':'bad');tick(a.minutes);view='close';render();});}
/* ---- nærmynd ---- */
function close(){const c=sc.close;const treated=st.flags.t_dyna&&st.flags.t_hylja;const tabs=c.groups.concat([{id:'tilkynna',label:'Ákvörðun'}]);
 const short=l=>l.replace(/^\d\.\s*/,'').replace('Sjúkrasaga og líkamsskoðun','Saga og skoðun').replace('Vettvangur kannaður','Vettvangur');
 const body=st.tab==='tilkynna'?`<p class="muted">Þegar skoðun og meðferð er lokið: ákveddu flutning og tilkynningu.</p><button class="primary" id="rep">Taka ákvörðun →</button>`:
  c.actions.filter(a=>a.group===st.tab).map(a=>`<button data-x="${a.id}" class="${st.flags[a.flag]?'done':''}" ${st.flags[a.flag]&&a.id!=='endurmat'?'disabled':''}>${st.flags[a.flag]?'✓ ':''}${esc(a.label)}${a.minutes?` <span class="m">· ${a.minutes} mín</span>`:''}</button>`).join('');
 screen(treated?sc.images.treated:sc.images.close,null,hudHtml(),sheetHtml(`${msgHtml()}<div class="tabs">${tabs.map(g=>`<button data-t="${g.id}" class="${st.tab===g.id?'on':''}">${esc(short(g.label))}</button>`).join('')}</div>${body}`));
 const on=$('.tabs .on');if(on)on.scrollIntoView({inline:'center',block:'nearest'});
 $$('[data-t]').forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;render();});
 $$('[data-x]').forEach(b=>b.onclick=()=>act(c.actions.find(a=>a.id===b.dataset.x)));
 const r=$('#rep');if(r)r.onclick=()=>{view='report';render();};}
function act(a){const sev=severe();st.flags[a.flag]=true;let txt=a.text,pts=a.score||0,cls='';
 if(a.rule){const r=sc.close[a.rule];const ok=all(r.goodWhen);txt=ok?r.goodText:r.badText;pts=ok?r.goodScore:r.badScore;}
 else if(a.requiresMild&&sev){txt=a.severeText;pts=a.severeScore;st.flags.drinkSevere=true;}
 else if(a.addresses)a.addresses.forEach(s=>st.addressed[s]=true);
 if(pts){st.score.push({label:'Aðgerð: '+a.label,points:pts});cls=pts>0?'good':'bad';}
 log(fill(txt),cls);tick(a.minutes);render();}
/* ---- ákvörðun ---- */
function report(){
 screen(sc.images.close,null,hudHtml(),sheetHtml(`${msgHtml()}<p class="muted">VÁSE: ${esc(band().VASE)}</p><h3>Hvað gerirðu núna?</h3>${sc.report.options.map(o=>`<button data-r="${o.id}">${esc(o.label)}</button>`).join('')}<button id="back">← Til baka</button>`));
 $('#back').onclick=()=>{view='close';render();};
 $$('[data-r]').forEach(b=>b.onclick=()=>{const o=sc.report.options.find(x=>x.id===b.dataset.r);let pts,txt;
  if(o.goodWhen&&all(o.goodWhen)){pts=15;txt=o.goodText;}else if(o.okWhen&&all(o.okWhen)){pts=8;txt=o.okText;}else{pts=-10;txt=o.badText;}
  st.report={label:o.label,pts,txt};view='debrief';render();});}
/* ---- mat á aðstoð ---- */
function resJudge(){const items=[];let ok=true;
 sc.resources.forEach(r=>{const c=st.calls[r.id];let pts=0,txt,cls='ok';
  if(all(r.needWhen)&&r.needWhen.length){if(!c){ok=false;cls='no';pts=-r.needPoints;txt='Ekki kallað. '+r.needText;}
   else if(c.at>r.callBy){ok=false;cls='no';pts=Math.round(r.needPoints/2);txt='Kallað of seint (mín '+c.at+', átti að vera fyrir mín '+r.callBy+'). '+r.needText;}
   else{pts=r.needPoints;txt='Kallað í tæka tíð (mín '+c.at+'). '+r.needText;}}
  else if(c&&any(r.unneededWhen)){ok=false;cls='no';pts=r.unneededPoints;txt='Kallað (mín '+c.at+'). '+r.unneededText;}
  else{txt=(c?'Kallað (mín '+c.at+'). ':'Ekki kallað. ')+(r.neutralText||'');}
  if(c)txt+=c.arrived?' Kom á mín '+c.arrived+'.':' Ekki komin(n) í lok leiks.';
  items.push({r,pts,txt,cls});});
 return{ok,items};}
function saga(){const b=band();const f=st.flags;const yes=k=>f[k];
 const S1=[];if(yes('askedPartner')||yes('olsena_a'))S1.push('34 ára kona, rann í læk fyrir u.þ.b. 2 klst, blaut og köld í slydduveðri á hrauni.');
 [['olsena_o','Ofnæmi: ekkert'],['olsena_l','Lyf: engin'],['olsena_s','Sjúkrasaga: heilbrigð'],['olsena_e','Einkenni: kuldi, þreyta, klaufskar hendur'],['olsena_n','Neysla: morgunmatur kl. 8, lítið síðan']].forEach(([k,t])=>{if(yes(k))S1.push(t+'.');});
 const A=[];if(yes('vase')||yes('vitals'))A.push('VÁSE: '+b.VASE+'.');if(yes('pulse')||yes('vitals'))A.push('P: '+b.P+'.');if(yes('breathing')||yes('vitals'))A.push('Ö: '+b.O+'.');if(yes('vitals'))A.push('H: '+b.H+'. '+b.shiver+'.');if(yes('bleeding'))A.push('Engar blæðingar.');if(yes('exam'))A.push('Blaut föt, húfulaus, engin meiðsli.');
 const G=[severe()?'Alvarleg ofkæling (<32°C). G\': hjartsláttaróregla, hjartastopp.':'Væg ofkæling (32–35°C). G\': alvarleg ofkæling.'];
 const Ap=[];sc.close.actions.filter(a=>a.group==='medferd'&&f[a.flag]&&a.id!=='endurmat').forEach(a=>Ap.push(a.label));
 sc.resources.forEach(r=>{if(st.calls[r.id])Ap.push('Kallað eftir: '+r.label);});if(st.report)Ap.push(st.report.label);
 return [['S – Saga sjúklings',S1.join(' ')||'Ekki skráð.'],['A – Athuganir',A.join(' ')||'Ekki skráð.'],['G – Greining',G.join(' ')],['A – Áætlun',Ap.join('; ')||'Ekki skráð.']];}
/* ---- samantekt ---- */
function debrief(){st.radio=false;st.showLog=false;
 const rows=sc.debrief.map(r=>{const ok=all(r.ok);return{r,ok,pts:ok?r.points:0};});const rj=resJudge();
 const extra=st.score.reduce((s,x)=>s+x.points,0)+st.report.pts+rj.items.reduce((s,x)=>s+x.pts,0);const max=sc.debrief.reduce((s,r)=>s+r.points,0);
 const raw=rows.reduce((s,x)=>s+x.pts,0);const total=Math.max(0,Math.min(100,Math.round(raw/max*80+Math.max(-20,Math.min(20,extra/4)))));
 screen(sc.images.wide,null,'','',`<div class="full"><div class="card glass"><h1>Samantekt</h1><div class="muted">${esc(sc.title)}</div><div class="score">${total}/100</div><p>Tími: ${st.minute} mín · ${severe()?'<span class="no">alvarleg ofkæling</span>':'<span class="ok">væg ofkæling</span>'} (áætl. kjarnhiti ${st.temp.toFixed(1)}°C)</p>
 <p><b>Ákvörðun:</b> ${esc(st.report.label)}<br><span class="${st.report.pts>0?'ok':'no'}">${esc(st.report.txt)}</span></p></div>
 <div class="card glass"><h3>📻 Aðstoð – val og tímasetning</h3>${rj.items.map(x=>`<div class="step"><b>${x.r.icon} ${esc(x.r.label)}</b> <span class="${x.cls}">${x.pts>0?'+':''}${x.pts}</span><div class="${x.cls}">${esc(x.txt)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>Mat eftir skrefum</h3>${rows.map(x=>`<div class="step"><div><b>${esc(x.r.label)}</b> <span class="${x.ok?'ok':'no'}">${x.pts}/${x.r.points}</span></div><div class="${x.ok?'ok':'no'}">${x.ok?'✓ ':'✗ '}${esc(x.ok?x.r.okText:x.r.badText)}</div><div class="r">${esc(x.r.rule)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>SAGA skráning</h3>${saga().map(([k,v])=>`<div class="step"><b>${k}</b><div>${esc(v)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>Einstakar ákvarðanir</h3><table>${st.score.map(s=>`<tr><td>${esc(s.label)}</td><td class="${s.points>0?'ok':'no'}">${s.points>0?'+':''}${s.points}</td></tr>`).join('')}</table><p class="muted">Heimild: ${esc(sc.source)}</p></div>
 <button class="primary" id="again">Aftur í valmynd</button></div>`);
 $('#again').onclick=menu;}
window.addEventListener('error',e=>{console.error(e.message)});
menu();
})();
