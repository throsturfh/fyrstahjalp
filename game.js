(function(){
"use strict";
const S=window.SCENARIOS||[];const app=document.getElementById('app');
let sc,st;
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function el(h){app.innerHTML=h;}
function band(){return sc.vitals.find(b=>st.temp>=b.min);}
function fill(t){const b=band();return t.replace(/\{(\w+)\}/g,(m,k)=>b[k]!==undefined?b[k]:m);}
function severe(){return st.temp<sc.temp.severeBelow;}
function allSources(){return sc.heatSources.every(h=>st.addressed[h.id]);}
function cond(c){
 if(c==='mild')return!severe(); if(c==='severe')return severe(); if(c==='allSources')return allSources();
 if(c==='drinkOk')return!st.flags.drinkSevere;
 if(c.startsWith('flag:'))return!!st.flags[c.slice(5)]; if(c.startsWith('call:'))return st.calls.includes(c.slice(5));
 let m=c.match(/^hotspots>=(\d+)$/);if(m)return st.seen.length>=+m[1];
 m=c.match(/^olsena>=(\d+)$/);if(m)return Object.keys(st.flags).filter(k=>k.startsWith('olsena_')).length>=+m[1];
 console.warn('óþekkt skilyrði',c);return false;}
const all=a=>(a||[]).every(cond);
function log(t,cls){st.log.push({t:'['+fmtT()+'] '+t,cls:cls||''});}
function fmtT(){return 'mín '+st.minute;}
function tick(min){for(let i=0;i<min;i++){const open=sc.heatSources.filter(h=>!st.addressed[h.id]).length;
 const wasSevere=severe();st.temp-=open*sc.temp.ratePerSource;if(open===0&&st.flags.t_drykkur&&!severe())st.temp+=sc.temp.warmRate;
 st.temp=Math.min(st.temp,36.5);st.minute++;
 if(!wasSevere&&severe()){log('Ástand versnar! Skjálftinn hættir og hún svarar varla. Alvarleg ofkæling.','bad');st.flags.becameSevere=true;}}}
function menu(){
 el(`<header><h1>Fyrsta hjálp</h1><div class="sub">Þjálfunarleikur byggður á glærum Landsbjargar</div></header><main>
 <div class="card"><h3>Braut 1 – Fyrsta hjálp 1</h3><p class="muted">Þríhyrningakerfið, VÁSE, OLSENA, lífsmörk, BROS.</p>${S.filter(s=>s.track===1).map(s=>`<button class="primary" data-s="${s.id}">${esc(s.title)}</button>`).join('')}</div>
 <div class="card"><h3>Braut 2 – Óbyggðagrunnur</h3><p class="muted">FH1 + áhættumat úr WFR.</p><button disabled>Væntanlegt</button></div>
 <div class="card"><h3>Braut 3 – WFR</h3><p class="muted">Óbyggðavinnureglur og lyf.</p><button disabled>Væntanlegt</button></div></main>`);
 app.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>start(b.dataset.s));}
function start(id){sc=S.find(s=>s.id===id);st={minute:0,temp:sc.temp.start,flags:{},addressed:{},seen:[],calls:[],log:[],score:[],report:null,tab:sc.close.groups[0].id,clue:null,intro:true};distance('');}
function distance(msg){
 const d=sc.distance;const cl=st.clue&&d.hotspots.find(h=>h.id===st.clue);
 el(`<header><h1>Fjarlægð</h1><div class="sub">Pikkaðu á merkin til að kanna vettvanginn (${st.seen.length}/${d.hotspots.length})</div></header>
 <main class="wideMain"><div class="scene wide"><img src="${sc.images.wide}" alt="Víð mynd af vettvangi">${d.hotspots.map((h,i)=>`<button class="hot ${st.seen.includes(h.id)?'seen':''}" style="left:${h.x}%;top:${h.y}%" data-h="${h.id}" aria-label="${esc(h.label)}">${i+1}</button>`).join('')}</div></main>
 <div class="sheet compact">${st.intro?`<div class="clue">${esc(sc.intro)}</div>`:''}${cl?`<div class="clue"><b>${esc(cl.label)}:</b> ${esc(cl.text)}</div>`:''}${msg?`<div class="clue">${esc(msg)}</div>`:''}
 <h3>Hringja í 112</h3><div class="row">${d.callOptions.map(c=>`<button data-c="${c.id}" class="${st.calls.includes(c.id)?'done':''}" ${st.calls.includes(c.id)?'disabled':''}>${esc(c.label)}${st.calls.includes(c.id)?' ✓':''}</button>`).join('')}</div>
 <h3>Hvað gerirðu?</h3>${d.approach.map(a=>`<button data-a="${a.id}">${esc(a.label)}</button>`).join('')}</div>`);
 app.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{if(!st.seen.includes(b.dataset.h))st.seen.push(b.dataset.h);st.clue=b.dataset.h;st.intro=false;distance('');});
 app.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{st.calls.push(b.dataset.c);const l=d.callOptions.find(c=>c.id===b.dataset.c).label;st.intro=false;
  log('Hringt í 112 – beðið um: '+l+'. Neyðarlínan: „Hvar eruð þið, hvað gerðist, hve margir?“');distance('112: '+l+' boðaður/boðuð.');});
 app.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const a=d.approach.find(x=>x.id===b.dataset.a);st.flags[a.flag]=true;tick(a.minutes);
  st.score.push({label:'Nálgun: '+a.label,points:a.score});log(a.text,a.score>0?'good':'bad');close();});}
function close(){
 const c=sc.close;const treated=st.flags.t_dyna&&st.flags.t_hylja;const tabs=c.groups.concat([{id:'tilkynna',label:'Tilkynna'}]);
 const short=l=>l.replace(/^\d\.\s*/,'').replace('Sjúkrasaga og líkamsskoðun','Saga og skoðun').replace('Vettvangur kannaður','Vettvangur');
 const body=st.tab==='tilkynna'?`<p class="muted">Þegar skoðun og meðferð er lokið: taktu ákvörðun um tilkynningu og flutning.</p><button class="primary" id="rep">Taka ákvörðun →</button>`:
  c.actions.filter(a=>a.group===st.tab).map(a=>`<button data-x="${a.id}" class="${st.flags[a.flag]?'done':''}" ${st.flags[a.flag]&&a.id!=='endurmat'?'disabled':''}>${st.flags[a.flag]?'✓ ':''}${esc(a.label)}${a.minutes?` <span class="m">· ${a.minutes} mín</span>`:''}</button>`).join('');
 el(`<header><h1>Nærmynd</h1><div class="hud"><span>⏱ <b>${st.minute} mín</b></span><span>${esc(band().shiver)}</span><span>Hitatap stöðvað <b>${sc.heatSources.filter(h=>st.addressed[h.id]).length}/${sc.heatSources.length}</b></span></div></header>
 <div class="banner"><div class="scene close"><img src="${treated?sc.images.treated:sc.images.close}" alt="Nærmynd af sjúklingi"></div></div><main id="main">
 <div class="log">${st.log.map(l=>`<p class="${l.cls}">${esc(l.t)}</p>`).join('')}</div></main>
 <div class="sheet"><div class="tabs">${tabs.map(g=>`<button data-t="${g.id}" class="${st.tab===g.id?'on':''}">${esc(short(g.label))}</button>`).join('')}</div>${body}</div>`);
 const m=document.getElementById('main');m.scrollTop=m.scrollHeight;const on=app.querySelector('.tabs .on');if(on)on.scrollIntoView({inline:'center',block:'nearest'});
 app.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;close();});
 app.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>act(c.actions.find(a=>a.id===b.dataset.x)));
 const r=document.getElementById('rep');if(r)r.onclick=report;}
function act(a){
 const sev=severe();st.flags[a.flag]=true;let txt=a.text,pts=a.score||0,cls='';
 if(a.rule){const r=sc.close[a.rule];const ok=all(r.goodWhen);txt=ok?r.goodText:r.badText;pts=ok?r.goodScore:r.badScore;}
 else if(a.requiresMild&&sev){txt=a.severeText;pts=a.severeScore;st.flags.drinkSevere=true;}
 else if(a.addresses)a.addresses.forEach(s=>st.addressed[s]=true);
 if(pts){st.score.push({label:'Aðgerð: '+a.label,points:pts});cls=pts>0?'good':'bad';}
 log(fill(txt),cls);tick(a.minutes);close();}
function report(){
 el(`<header><h1>Tilkynning og hjálp</h1><div class="hud"><span>⏱ <b>${st.minute} mín</b></span><span>VÁSE: ${esc(band().VASE)}</span></div></header>
 <main><div class="log">${st.log.slice(-3).map(l=>`<p class="${l.cls}">${esc(l.t)}</p>`).join('')}</div></main>
 <div class="sheet"><h3>Hvað gerirðu núna?</h3>${sc.report.options.map(o=>`<button data-r="${o.id}">${esc(o.label)}</button>`).join('')}<button id="back">← Til baka í nærmynd</button></div>`);
 document.getElementById('back').onclick=close;
 app.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const o=sc.report.options.find(x=>x.id===b.dataset.r);let pts,txt;
  if(o.goodWhen&&all(o.goodWhen)){pts=15;txt=o.goodText;}else if(o.okWhen&&all(o.okWhen)){pts=8;txt=o.okText;}else{pts=-10;txt=o.badText;}
  st.report={label:o.label,pts,txt};debrief();});}
function saga(){
 const b=band();const f=st.flags;const yes=k=>f[k];const parts=[];
 const S1=[];if(yes('askedPartner')||yes('olsena_a'))S1.push('34 ára kona, rann í læk fyrir u.þ.b. 2 klst, blaut og köld í slydduveðri á hrauni.');
 [['olsena_o','Ofnæmi: ekkert'],['olsena_l','Lyf: engin'],['olsena_s','Sjúkrasaga: heilbrigð'],['olsena_e','Einkenni: kuldi, þreyta, klaufskar hendur'],['olsena_n','Neysla: morgunmatur kl. 8, lítið síðan']].forEach(([k,t])=>{if(yes(k))S1.push(t+'.');});
 const A=[];if(yes('vase')||yes('vitals'))A.push('VÁSE: '+b.VASE+'.');if(yes('pulse')||yes('vitals'))A.push('P: '+b.P+'.');if(yes('breathing')||yes('vitals'))A.push('Ö: '+b.O+'.');if(yes('vitals'))A.push('H: '+b.H+'. '+b.shiver+'.');if(yes('bleeding'))A.push('Engar blæðingar.');if(yes('exam'))A.push('Blaut föt, húfulaus, engin meiðsli.');
 const G=[severe()?'Alvarleg ofkæling (<32°C). G\': hjartsláttaróregla, hjartastopp.':'Væg ofkæling (32–35°C). G\': alvarleg ofkæling.'];
 const Ap=[];sc.close.actions.filter(a=>a.group==='medferd'&&f[a.flag]&&a.id!=='endurmat').forEach(a=>Ap.push(a.label));if(st.report)Ap.push(st.report.label);
 return [['S – Saga sjúklings',S1.join(' ')||'Ekki skráð.'],['A – Athuganir',A.join(' ')||'Ekki skráð.'],['G – Greining',G.join(' ')],['A – Áætlun',Ap.join('; ')||'Ekki skráð.']];}
function debrief(){
 const rows=sc.debrief.map(r=>{const ok=all(r.ok);return{r,ok,pts:ok?r.points:0};});
 const extra=st.score.reduce((s,x)=>s+x.points,0)+st.report.pts;const max=sc.debrief.reduce((s,r)=>s+r.points,0);
 const raw=rows.reduce((s,x)=>s+x.pts,0);const total=Math.max(0,Math.min(100,Math.round(raw/max*80+Math.max(-20,Math.min(20,extra/4)))));
 el(`<header><h1>Samantekt</h1><div class="sub">${esc(sc.title)}</div></header><main>
 <div class="card"><div class="score">${total}/100</div><p>Tími: ${st.minute} mín · ${severe()?'<span class="no">alvarleg ofkæling</span>':'<span class="ok">væg ofkæling</span>'} (áætl. kjarnhiti ${st.temp.toFixed(1)}°C)</p>
 <p><b>Tilkynning:</b> ${esc(st.report.label)}<br><span class="${st.report.pts>0?'ok':'no'}">${esc(st.report.txt)}</span></p></div>
 <div class="card"><h3>Mat eftir skrefum</h3>${rows.map(x=>`<div class="step"><div><b>${esc(x.r.label)}</b> <span class="${x.ok?'ok':'no'}">${x.pts}/${x.r.points}</span></div><div class="${x.ok?'ok':'no'}">${x.ok?'✓ ':'✗ '}${esc(x.ok?x.r.okText:x.r.badText)}</div><div class="r">${esc(x.r.rule)}</div></div>`).join('')}</div>
 <div class="card"><h3>SAGA skráning</h3>${saga().map(([k,v])=>`<div class="step"><b>${k}</b><div>${esc(v)}</div></div>`).join('')}</div>
 <div class="card"><h3>Einstakar ákvarðanir</h3><table>${st.score.map(s=>`<tr><td>${esc(s.label)}</td><td class="${s.points>0?'ok':'no'}">${s.points>0?'+':''}${s.points}</td></tr>`).join('')}</table><p class="muted">Heimild: ${esc(sc.source)}</p></div></main>
 <div class="sheet"><button class="primary" id="again">Aftur í valmynd</button></div>`);
 document.getElementById('again').onclick=menu;}
window.addEventListener('error',e=>{console.error(e.message)});
menu();
})();
