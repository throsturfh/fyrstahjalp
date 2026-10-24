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
function log(t,cls){st.log.push({t:'['+st.minute+' mín] '+t,cls:cls||''});st.last={t,cls:cls||''};if(st.drawer==='closed')st.unread++;}
function tick(min){for(let i=0;i<min;i++){const open=sc.heatSources.filter(h=>!st.addressed[h.id]).length;
 const was=severe();st.temp-=open*sc.temp.ratePerSource;if(open===0&&st.flags.t_drykkur&&!severe())st.temp+=sc.temp.warmRate;
 st.temp=Math.min(st.temp,36.5);st.minute++;
 if(!was&&severe()){log('Ástand versnar! Skjálftinn hættir og hún svarar varla. Alvarleg ofkæling.','bad');st.flags.becameSevere=true;}
 sc.resources.forEach(r=>{const c=st.calls[r.id];if(c&&!c.arrived&&st.minute>=c.at+r.eta){c.arrived=st.minute;st.flags['arrived_'+r.id]=true;log(r.icon+' '+r.arriveText,'info');}});}}

/* ---------- víðmynd sem er dregin til hliðar ---------- */
let pm=()=>{},pu=()=>{};
const pan={x:0,min:0,v:0,raf:0,down:null,moved:false,key:''};
function panHtml(img,hots){return `<div class="pano" id="pano"><div class="track" id="track"><img id="bg" src="${img}" alt="Víðmynd – strjúktu til hliðar">${hots||''}</div></div><div class="panbar"><i id="panI"></i></div>`;}
function panSetup(key,startPct){const p=$('#pano'),t=$('#track'),img=$('#bg');if(!p)return;pan.key=key;
 const init=()=>{const W=p.clientWidth,TW=t.offsetWidth;pan.min=Math.min(0,W-TW);
  if(st.pan[key]===undefined)st.pan[key]=Math.max(pan.min,Math.min(0,W/2-TW*startPct/100));pan.x=Math.max(pan.min,Math.min(0,st.pan[key]));apply();};
 img.complete&&img.naturalWidth?init():img.onload=init;
 p.addEventListener('pointerdown',e=>{cancelAnimationFrame(pan.raf);pan.down={x:e.clientX,y:e.clientY,px:pan.x,t:performance.now(),lx:e.clientX,lt:performance.now(),id:e.pointerId};pan.moved=false;pan.v=0;});
 pm=e=>{const d=pan.down;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x;
  if(!pan.moved&&Math.abs(dx)>10){pan.moved=true;try{p.setPointerCapture(e.pointerId);}catch(_){} }
  if(pan.moved){const now=performance.now(),dt=Math.max(1,now-d.lt);pan.v=0.8*((e.clientX-d.lx)/dt)+0.2*pan.v;d.lx=e.clientX;d.lt=now;
   let x=d.px+dx;if(x>0)x=x/3;if(x<pan.min)x=pan.min+(x-pan.min)/3;pan.x=x;apply();}};
 const up=e=>{const d=pan.down;if(!d)return;pan.down=null;if(!pan.moved)return;pan.just=performance.now();inertia();};
 pu=up;
 p.addEventListener('click',e=>{if(pan.just&&performance.now()-pan.just<350){e.stopPropagation();e.preventDefault();}},true);}
function inertia(){let last=performance.now();const step=now=>{const dt=now-last;last=now;
  pan.x+=pan.v*dt;pan.v*=Math.pow(0.994,dt);
  if(pan.x>0){pan.x+=(0-pan.x)*0.25;pan.v*=0.5;}if(pan.x<pan.min){pan.x+=(pan.min-pan.x)*0.25;pan.v*=0.5;}
  apply();if(Math.abs(pan.v)>0.02||pan.x>0.5||pan.x<pan.min-0.5)pan.raf=requestAnimationFrame(step);else{pan.x=Math.max(pan.min,Math.min(0,pan.x));apply();}};
 pan.raf=requestAnimationFrame(step);}
function apply(){const t=$('#track');if(!t)return;t.style.transform=`translate3d(${pan.x}px,0,0)`;if(st)st.pan[pan.key]=Math.max(pan.min,Math.min(0,pan.x));
 const i=$('#panI'),p=$('#pano');if(i&&p){const TW=t.offsetWidth||1,W=p.clientWidth,w=Math.max(10,W/TW*100);i.style.width=w+'%';i.style.left=Math.min(100-w,Math.max(0,-pan.x/TW*100))+'%';}}
window.__pan=pan;

/* ---------- skúffa sem er dregin upp ---------- */
const SNAP=['closed','half','full'];
function snapY(s){const d=$('#drawer');if(!d)return 0;const H=d.offsetHeight,A=app.clientHeight,g=$('#grab').offsetHeight;
 return s==='full'?0:s==='half'?Math.max(0,H-A*0.5):H-g;}
function drawerHtml(body){const lbl=st.drawer==='closed'?(st.unread&&st.last?`<span class="badge">${st.unread}</span>${esc(st.last.t)}`:'Dragðu upp – valmynd'):'Dragðu niður til að loka';
 return `<div class="drawer glass" id="drawer" data-state="${st.drawer}"><button class="grab" id="grab" aria-label="Valmynd – dragðu upp"><span class="bars"><b></b><b></b><b></b></span><span class="lbl">${lbl}</span></button><div class="dbody" id="dbody">${body}</div></div>`;}
function drawerSetup(){const d=$('#drawer'),g=$('#grab');if(!d)return;d.classList.add('drag');d.style.transform=`translate3d(0,${snapY(st.drawer)}px,0)`;d.offsetHeight;d.classList.remove('drag');
 let s=null;
 g.addEventListener('pointerdown',e=>{s={y:e.clientY,y0:snapY(st.drawer),t:performance.now(),ly:e.clientY,lt:performance.now(),v:0,moved:false,id:e.pointerId};});
 const gm=e=>{if(!s||e.pointerId!==s.id)return;const dy=e.clientY-s.y;if(!s.moved&&Math.abs(dy)>8){s.moved=true;d.classList.add('drag');try{g.setPointerCapture(e.pointerId);}catch(_){} }
  if(s.moved){const now=performance.now();s.v=0.8*((e.clientY-s.ly)/Math.max(1,now-s.lt))+0.2*s.v;s.ly=e.clientY;s.lt=now;
   const y=Math.max(0,Math.min(snapY('closed'),s.y0+dy));d.style.transform=`translate3d(0,${y}px,0)`;}};
 const up=e=>{if(!s)return;const was=s;s=null;d.classList.remove('drag');
  if(!was.moved){setDrawer(st.drawer==='closed'?'half':'closed');return;}
  const cur=Math.max(0,Math.min(snapY('closed'),was.y0+(e.clientY-was.y)));const proj=cur+was.v*150;
  let best='closed',bd=1e9;SNAP.forEach(k=>{const dd=Math.abs(snapY(k)-proj);if(dd<bd){bd=dd;best=k;}});setDrawer(best);};
 window.onpointermove=e=>{gm(e);pm(e);};window.onpointerup=e=>{up(e);pu(e);};window.onpointercancel=e=>{up(e);pu(e);};}
function setDrawer(s){st.drawer=s;if(s!=='closed')st.unread=0;const d=$('#drawer');if(d){d.dataset.state=s;d.style.transform=`translate3d(0,${snapY(s)}px,0)`;
 const l=$('#grab .lbl');if(l)l.innerHTML=s==='closed'?(st.unread&&st.last?`<span class="badge">${st.unread}</span>${esc(st.last.t)}`:'Dragðu upp – valmynd'):'Dragðu niður til að loka';}}
window.__setDrawer=s=>setDrawer(s);

/* ---------- sameiginlegt ---------- */
function hudHtml(){const pend=sc.resources.filter(r=>st.calls[r.id]).map(r=>{const c=st.calls[r.id];return `<span class="glass">${r.icon} ${c.arrived?'✓':Math.max(0,c.at+r.eta-st.minute)+'′'}</span>`;}).join('');
 return `<div class="hud"><span class="glass">⏱ ${st.minute} mín</span>${view!=='distance'?`<span class="glass">${severe()?'⚠️':'🥶'} ${sc.heatSources.filter(h=>st.addressed[h.id]).length}/${sc.heatSources.length}</span>`:''}${pend}</div>`;}
function msgs(){return st.log.slice(-2).map(l=>`<div class="msg ${l.cls}">${esc(l.t)}</div>`).join('')||(st.last?`<div class="msg">${esc(st.last.t)}</div>`:'');}
function radioBody(){return `<p class="muted">Þú ert björgunarsveitarmaður á vettvangi. Staðsetning: ${esc(sc.location.label)}. Hvert kall tekur 1 mín.</p>
 ${sc.resources.map(r=>{const c=st.calls[r.id];return `<button data-call="${r.id}" ${c?'disabled class="done"':''}><div class="res"><span class="ic">${r.icon}</span><div><b>${esc(r.label)}</b>${c?` ✓ ${c.arrived?'á staðnum':'kemur eftir ~'+Math.max(0,c.at+r.eta-st.minute)+' mín'}`:` <span class="m">· áætl. ${r.eta} mín</span>`}<small>${esc(r.role)}</small></div></div></button>`;}).join('')}`;}
function logBody(){return `<div class="log">${st.log.map(l=>`<p class="${l.cls}">${esc(l.t)}</p>`).join('')||'<p class="muted">Ekkert enn.</p>'}</div>`;}
function tabsHtml(tabs){return `<div class="tabs">${tabs.map(g=>`<button data-t="${g.id}" class="${st.tab===g.id?'on':''}">${esc(g.label)}</button>`).join('')}</div>`;}
function hotsHtml(list,seen){return list.map((h,i)=>`<button class="hot ${seen.includes(h.id)?'seen':''}" style="left:${h.x}%;top:${h.y}%" data-h="${h.id}" aria-label="${esc(h.label)}">${i+1}</button>`).join('');}
function screen(img,key,startPct,hots,body){
 app.innerHTML=panHtml(img,hots)+hudHtml()+(st.swipeHint?`<div class="swipehint">⟵ strjúktu til að líta í kringum þig ⟶</div>`:'')+drawerHtml(body);
 panSetup(key,startPct);drawerSetup();
 $$('[data-t]').forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;render();});
 $$('[data-call]').forEach(b=>b.onclick=()=>{const r=sc.resources.find(x=>x.id===b.dataset.call);st.calls[r.id]={at:st.minute+1,phase:view};
  log('📻 Kallað eftir: '+r.label+'. „'+sc.location.callText+'“ Áætlaður komutími ~'+r.eta+' mín.','info');tick(1);render();});}
function hotClick(list,seenArr){$$('[data-h]').forEach(b=>b.onclick=()=>{const h=list.find(x=>x.id===b.dataset.h);if(!seenArr.includes(h.id))seenArr.push(h.id);st.swipeHint=false;
 st.last={t:h.label+': '+h.text,cls:''};st.log.push({t:'['+st.minute+' mín] '+h.label+': '+h.text,cls:''});if(st.drawer==='closed')st.unread++;
 b.classList.add('seen');const l=$('#grab .lbl');if(l&&st.drawer==='closed')l.innerHTML=`<span class="badge">${st.unread}</span>${esc(st.last.t)}`;else render();});}
function render(){({distance,close,debrief})[view]();}

/* ---------- valmynd ---------- */
function menu(){st=null;view='menu';const s0=S[0];
 app.innerHTML=`<div class="pano"><div class="track" id="track"><img id="bg" src="${s0?s0.images.wide:''}" alt=""></div></div><div class="drawer glass" style="height:auto;max-height:80dvh"><div class="dbody" style="padding-top:16px"><h1>Fyrsta hjálp</h1><p class="muted">Þú ert björgunarsveitarmaður. Þjálfunarleikur byggður á glærum Landsbjargar.</p>
 <h3>Braut 1 – Fyrsta hjálp 1</h3>${S.filter(s=>s.track===1).map(s=>`<button class="primary" data-s="${s.id}">${esc(s.title)}</button>`).join('')}
 <h3>Braut 2 – Óbyggðagrunnur</h3><button disabled>Væntanlegt</button><h3>Braut 3 – WFR</h3><button disabled>Væntanlegt</button></div></div>`;
 const img=$('#bg'),t=$('#track');const c=()=>{t.style.transform=`translateX(${Math.min(0,app.clientWidth/2-t.offsetWidth*0.5)}px)`;};img.complete?c():img.onload=c;
 $$('[data-s]').forEach(b=>b.onclick=()=>start(b.dataset.s));}
function start(id){sc=S.find(s=>s.id===id);st={minute:0,temp:sc.temp.start,flags:{},addressed:{},seen:[],seenClose:[],calls:{},log:[],score:[],report:null,
 tab:'vettvangur_d',last:{t:sc.intro,cls:''},drawer:'closed',unread:1,pan:{},swipeHint:true};view='distance';render();}

/* ---------- fjarlægð ---------- */
function distance(){const d=sc.distance;
 const tabs=[{id:'vettvangur_d',label:'Vettvangur'},{id:'adstod',label:'📻 Aðstoð'},{id:'skra',label:'📜 Skrá'}];
 const body=st.tab==='adstod'?radioBody():st.tab==='skra'?logBody():
  `${msgs()}<p class="muted">Lokaðu skúffunni, strjúktu myndina til hliðar og pikkaðu á merkin (${st.seen.length}/${d.hotspots.length} könnuð).</p><h3>Hvað gerirðu?</h3>${d.approach.map(a=>`<button data-a="${a.id}">${esc(a.label)}</button>`).join('')}`;
 screen(sc.images.wide,'wide',sc.pan.wideStart,hotsHtml(d.hotspots,st.seen),tabsHtml(tabs)+body);
 hotClick(d.hotspots,st.seen);
 $$('[data-a]').forEach(b=>b.onclick=()=>{const a=d.approach.find(x=>x.id===b.dataset.a);st.flags[a.flag]=true;
  st.score.push({label:'Nálgun: '+a.label,points:a.score});log(a.text,a.score>0?'good':'bad');tick(a.minutes);view='close';st.tab=sc.close.groups[0].id;st.swipeHint=true;render();});}

/* ---------- nærmynd ---------- */
function close(){const c=sc.close;const treated=st.flags.t_dyna&&st.flags.t_hylja;
 const short=l=>l.replace(/^\d\.\s*/,'').replace('Sjúkrasaga og líkamsskoðun','Saga og skoðun').replace('Vettvangur kannaður','Vettvangur');
 const tabs=c.groups.map(g=>({id:g.id,label:short(g.label)})).concat([{id:'tilkynna',label:'Ákvörðun'},{id:'adstod',label:'📻 Aðstoð'},{id:'skra',label:'📜 Skrá'}]);
 let body;
 if(st.tab==='adstod')body=radioBody();else if(st.tab==='skra')body=logBody();
 else if(st.tab==='tilkynna')body=`${msgs()}<p class="muted">VÁSE: ${esc(band().VASE)}. Þegar skoðun og meðferð er lokið: ákveddu flutning.</p><h3>Hvað gerirðu núna?</h3>${sc.report.options.map(o=>`<button data-r="${o.id}">${esc(o.label)}</button>`).join('')}`;
 else body=msgs()+c.actions.filter(a=>a.group===st.tab).map(a=>`<button data-x="${a.id}" class="${st.flags[a.flag]?'done':''}" ${st.flags[a.flag]&&a.id!=='endurmat'?'disabled':''}>${st.flags[a.flag]?'✓ ':''}${esc(a.label)}${a.minutes?` <span class="m">· ${a.minutes} mín</span>`:''}</button>`).join('');
 screen(treated?sc.images.treated:sc.images.close,'close',sc.pan.closeStart,hotsHtml(c.hotspots||[],st.seenClose),tabsHtml(tabs)+body);
 hotClick(c.hotspots||[],st.seenClose);
 $$('[data-x]').forEach(b=>b.onclick=()=>act(c.actions.find(a=>a.id===b.dataset.x)));
 $$('[data-r]').forEach(b=>b.onclick=()=>{const o=sc.report.options.find(x=>x.id===b.dataset.r);let pts,txt;
  if(o.goodWhen&&all(o.goodWhen)){pts=15;txt=o.goodText;}else if(o.okWhen&&all(o.okWhen)){pts=8;txt=o.okText;}else{pts=-10;txt=o.badText;}
  st.report={label:o.label,pts,txt};view='debrief';render();});}
function act(a){const sev=severe();st.flags[a.flag]=true;let txt=a.text,pts=a.score||0,cls='';
 if(a.rule){const r=sc.close[a.rule];const ok=all(r.goodWhen);txt=ok?r.goodText:r.badText;pts=ok?r.goodScore:r.badScore;}
 else if(a.requiresMild&&sev){txt=a.severeText;pts=a.severeScore;st.flags.drinkSevere=true;}
 else if(a.addresses)a.addresses.forEach(s=>st.addressed[s]=true);
 if(pts){st.score.push({label:'Aðgerð: '+a.label,points:pts});cls=pts>0?'good':'bad';}
 log(fill(txt),cls);tick(a.minutes);render();}

/* ---------- mat á aðstoð ---------- */
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

/* ---------- samantekt ---------- */
function debrief(){
 const rows=sc.debrief.map(r=>{const ok=all(r.ok);return{r,ok,pts:ok?r.points:0};});const rj=resJudge();
 const extra=st.score.reduce((s,x)=>s+x.points,0)+st.report.pts+rj.items.reduce((s,x)=>s+x.pts,0);const max=sc.debrief.reduce((s,r)=>s+r.points,0);
 const raw=rows.reduce((s,x)=>s+x.pts,0);const total=Math.max(0,Math.min(100,Math.round(raw/max*80+Math.max(-20,Math.min(20,extra/4)))));
 app.innerHTML=panHtml(sc.images.wide,'')+`<div class="full"><div class="card glass"><h1>Samantekt</h1><div class="muted">${esc(sc.title)}</div><div class="score">${total}/100</div><p>Tími: ${st.minute} mín · ${severe()?'<span class="no">alvarleg ofkæling</span>':'<span class="ok">væg ofkæling</span>'} (áætl. kjarnhiti ${st.temp.toFixed(1)}°C)</p>
 <p><b>Ákvörðun:</b> ${esc(st.report.label)}<br><span class="${st.report.pts>0?'ok':'no'}">${esc(st.report.txt)}</span></p></div>
 <div class="card glass"><h3>📻 Aðstoð – val og tímasetning</h3>${rj.items.map(x=>`<div class="step"><b>${x.r.icon} ${esc(x.r.label)}</b> <span class="${x.cls}">${x.pts>0?'+':''}${x.pts}</span><div class="${x.cls}">${esc(x.txt)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>Mat eftir skrefum</h3>${rows.map(x=>`<div class="step"><div><b>${esc(x.r.label)}</b> <span class="${x.ok?'ok':'no'}">${x.pts}/${x.r.points}</span></div><div class="${x.ok?'ok':'no'}">${x.ok?'✓ ':'✗ '}${esc(x.ok?x.r.okText:x.r.badText)}</div><div class="r">${esc(x.r.rule)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>SAGA skráning</h3>${saga().map(([k,v])=>`<div class="step"><b>${k}</b><div>${esc(v)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>Einstakar ákvarðanir</h3><table>${st.score.map(s=>`<tr><td>${esc(s.label)}</td><td class="${s.points>0?'ok':'no'}">${s.points>0?'+':''}${s.points}</td></tr>`).join('')}</table><p class="muted">Heimild: ${esc(sc.source)}</p></div>
 <button class="primary" id="again">Aftur í valmynd</button></div>`;
 panSetup('debrief',50);$('#again').onclick=menu;}
window.addEventListener('resize',()=>{if(st&&view!=='debrief'&&view!=='menu')render();});
window.addEventListener('error',e=>{console.error(e.message)});
menu();
})();
