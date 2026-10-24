(function(){
"use strict";
const VER='0.2';
const S=window.SCENARIOS||[];const app=document.getElementById('app');
let sc,st,view;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=q=>app.querySelector(q),$$=q=>app.querySelectorAll(q);
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v;}catch(_){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(_){}}};
const nafn=()=>store.get('fh-nafn','').trim()||'björgunarmaður';
const soundOn=()=>store.get('fh-hljod','af')==='a';
function band(){return sc.vitals.find(b=>st.temp>=b.min);}
function fill(t){const b=band();return String(t).replace(/\{(\w+)\}/g,(m,k)=>k==='nafn'?nafn():b[k]!==undefined?b[k]:m);}
function severe(){return st.temp<sc.temp.severeBelow;}
function allSources(){return sc.heatSources.every(h=>st.addressed[h.id]);}
function cond(c){
 if(c==='always')return true;if(c==='mild')return!severe();if(c==='severe')return severe();if(c==='allSources')return allSources();
 if(c==='drinkOk')return!st.flags.drinkSevere;if(c==='resourcesOk')return resJudge().ok;
 if(c==='stretcher')return severe()||!!(st.report&&st.report.id==='112_flutningur');
 if(c.startsWith('flag:'))return!!st.flags[c.slice(5)];if(c.startsWith('call:'))return!!st.calls[c.slice(5)];
 if(c.startsWith('decision:'))return!!(st.report&&st.report.id===c.slice(9));
 let m=c.match(/^hotspots>=(\d+)$/);if(m)return st.seen.length>=+m[1];
 m=c.match(/^reassess>=(\d+)$/);if(m)return st.reassess.filter(r=>r.kind==='vitals').length>=+m[1];
 m=c.match(/^olsena>=(\d+)$/);if(m)return Object.keys(st.flags).filter(k=>k.startsWith('olsena_')).length>=+m[1];
 console.warn('óþekkt skilyrði',c);return false;}
const all=a=>(a||[]).every(cond);const any=a=>(a||[]).some(cond);
/* log: allt fer í atburðaskrá; það sem gerist í einni aðgerð safnast í st.batch og birtist á myndinni */
function log(t,cls){st.log.push({t:'['+st.minute+' mín] '+t,cls:cls||''});if(st.batch)st.batch.push({t,cls:cls||''});}
function tick(min){for(let i=0;i<min;i++){const open=sc.heatSources.filter(h=>!st.addressed[h.id]).length;
 const was=severe();st.temp-=open*sc.temp.ratePerSource;if(open===0&&st.flags.t_drykkur&&!severe())st.temp+=sc.temp.warmRate;
 st.temp=Math.min(st.temp,36.5);st.minute++;
 if(!was&&severe()){log('Ástand versnar! Skjálftinn hættir og hún svarar varla. Alvarleg ofkæling.','bad');st.flags.becameSevere=true;st.severeAt=st.minute;}
 sc.resources.forEach(r=>{const c=st.calls[r.id];if(c&&!c.arrived&&st.minute>=c.at+r.eta){c.arrived=st.minute;st.flags['arrived_'+r.id]=true;log(r.icon+' '+r.arriveText,'info');}});}}

/* ---------- víðmynd sem er dregin til hliðar ---------- */
let pm=()=>{},pu=()=>{};
const pan={x:0,min:0,v:0,raf:0,down:null,moved:false,key:'',fit:false};
function panHtml(img,hots){return `<div class="pano" id="pano"><div class="track" id="track"><img id="bg" src="${img}" alt="Víðmynd – strjúktu til hliðar">${hots||''}</div></div><div class="panbar"><i id="panI"></i></div>`;}
function fitHtml(img,hots){return `<div class="pano fit" id="pano"><div class="fitbg" style="background-image:url('${img}')"></div><div class="stage" id="track"><img id="bg" src="${img}" alt="Vettvangur úr fjarlægð">${hots||''}</div></div>`;}
function fitSetup(){const p=$('#pano'),t=$('#track'),img=$('#bg');if(!p)return;pan.fit=true;pan.x=0;pan.min=0;pm=()=>{};pu=()=>{};
 const init=()=>{const r=(img.naturalWidth||9)/(img.naturalHeight||16);const g=$('#grab');const A=p.clientHeight-(g?g.offsetHeight:56)-safeBottom();
  const top=Math.max(0,Math.round(Math.min(48,(A-p.clientWidth/r)/2)));const H=A-top;
  let w=p.clientWidth,h=w/r;if(h>H){h=H;w=h*r;}
  t.style.width=Math.round(w)+'px';t.style.height=Math.round(h)+'px';t.style.left=Math.round((p.clientWidth-w)/2)+'px';t.style.top=Math.round(top+(H-h)/2)+'px';};
 img.complete&&img.naturalWidth?init():img.onload=init;}
function safeBottom(){const d=document.createElement('div');d.style.cssText='position:absolute;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden';app.appendChild(d);const v=d.offsetHeight;d.remove();return v;}
function panSetup(key,startPct){const p=$('#pano'),t=$('#track'),img=$('#bg');if(!p)return;pan.key=key;pan.fit=false;
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
function apply(){const t=$('#track');if(!t||pan.fit)return;t.style.transform=`translate3d(${pan.x}px,0,0)`;if(st)st.pan[pan.key]=Math.max(pan.min,Math.min(0,pan.x));
 const i=$('#panI'),p=$('#pano');if(i&&p){const TW=t.offsetWidth||1,W=p.clientWidth,w=Math.max(10,W/TW*100);i.style.width=w+'%';i.style.left=Math.min(100-w,Math.max(0,-pan.x/TW*100))+'%';}}
/* færir víðmynd þannig að staður (% af breidd) sé á miðjum skjá */
function panTo(pct,cb){const t=$('#track'),p=$('#pano');if(!t||!p||pan.fit){cb();return;}cancelAnimationFrame(pan.raf);
 const W=p.clientWidth,TW=t.offsetWidth,x0=pan.x,tgt=Math.max(pan.min,Math.min(0,W/2-TW*pct/100));
 const sx=TW*pct/100+x0;if(sx>W*0.22&&sx<W*0.78){cb();return;}
 const t0=performance.now(),D=380;const step=now=>{const k=Math.min(1,(now-t0)/D),e=1-Math.pow(1-k,3);pan.x=x0+(tgt-x0)*e;apply();if(k<1)pan.raf=requestAnimationFrame(step);else cb();};
 pan.raf=requestAnimationFrame(step);}
window.__pan=pan;

/* ---------- skúffa sem er dregin upp ---------- */
const SNAP=['closed','half','full'];
function snapY(s){const d=$('#drawer');if(!d)return 0;const H=d.offsetHeight,A=app.clientHeight,g=$('#grab').offsetHeight;
 return s==='full'?0:s==='half'?Math.max(0,H-A*0.5):H-g;}
const grabLbl=s=>s==='closed'?'Dragðu upp – aðgerðir':'Dragðu niður til að loka';
function drawerHtml(body){return `<div class="drawer glass" id="drawer" data-state="${st.drawer}"><button class="grab" id="grab" aria-label="Aðgerðir – dragðu upp"><span class="bars"><b></b><b></b><b></b></span><span class="lbl">${grabLbl(st.drawer)}</span></button><div class="dbody" id="dbody">${body}</div></div>`;}
function drawerSetup(){const d=$('#drawer'),g=$('#grab');if(!d)return;d.classList.add('drag');d.style.transform=`translate3d(0,${snapY(st.drawer)}px,0)`;d.offsetHeight;d.classList.remove('drag');
 const sb=$('#dbody');if(sb&&st.scroll&&st.scroll[st.tab])sb.scrollTop=st.scroll[st.tab];if(sb)sb.addEventListener('scroll',()=>{st.scroll[st.tab]=sb.scrollTop;},{passive:true});
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
function setDrawer(s){st.drawer=s;const d=$('#drawer');if(d){d.dataset.state=s;d.style.transform=`translate3d(0,${snapY(s)}px,0)`;
 const l=$('#grab .lbl');if(l)l.textContent=grabLbl(s);}}
window.__setDrawer=s=>setDrawer(s);

/* ---------- spjöld og talblöðrur á myndinni ---------- */
function closePop(){const o=$('#ov');if(o)o.innerHTML='';}
function popOpen(){const o=$('#ov');return!!(o&&o.firstChild);}
/* kind: 'card' (vísbending/niðurstaða) eða 'bubble' (talblaðra). ax,ay = skjáhnit staðarins sem bent er á (eða null = efst á mynd) */
function showPop(html,kind,ax,ay,gap){const o=$('#ov');if(!o)return;
 const el=document.createElement('div');el.className='pop '+kind;el.innerHTML=html+'<div class="close-hint">Pikkaðu til að loka</div><i class="tail"></i>';
 el.addEventListener('click',e=>{e.stopPropagation();closePop();});o.appendChild(el);
 const W=app.clientWidth,dr=$('#drawer'),bottom=(dr?dr.getBoundingClientRect().top-app.getBoundingClientRect().top:app.clientHeight)-8;
 const topMin=60;const w=el.offsetWidth,h=el.offsetHeight;const tail=el.querySelector('.tail');
 if(ax==null){el.style.left=Math.round((W-w)/2)+'px';el.style.top=topMin+'px';tail.remove();el.classList.add('top');return el;}
 gap=gap||18;let left=Math.max(10,Math.min(W-10-w,ax-w/2)),top,dir;
 if(ay-gap-h>=topMin){top=ay-gap-h;dir='down';}else if(ay+gap+h<=bottom){top=ay+gap;dir='up';}
 else{top=Math.max(topMin,Math.min(bottom-h,ay-gap-h));dir='none';}
 el.style.left=Math.round(left)+'px';el.style.top=Math.round(top)+'px';
 if(dir==='none')tail.remove();else{tail.classList.add(dir);tail.style.left=Math.round(Math.max(14,Math.min(w-30,ax-left-9)))+'px';}
 return el;}
function anchorXY(xp,yp){const t=$('#track'),a=app.getBoundingClientRect();if(!t)return[null,null];const r=t.getBoundingClientRect();return[r.left-a.left+r.width*xp/100,r.top-a.top+r.height*yp/100];}
function batchHtml(items){return items.map(i=>`<p class="ln ${i.cls}">${esc(i.t)}</p>`).join('');}
function flushBatch(){const b=st.batch||[];st.batch=null;if(b.length){closePop();showPop(batchHtml(b),'card',null,null);}}
/* talblaðra frá persónu; ef persónan er ekki á núverandi mynd birtist spjald */
function speak(speaker,say,reply,note,extra){const sp=(view==='close'&&sc.close.speakers)?sc.close.speakers[speaker]:null;
 const html=`${say?`<div class="say">Þú: „${esc(say)}“</div>`:''}<div class="who">${esc(sp?sp.name:speaker==='felagi'?'Félaginn':sc.patient.name)}</div><div class="reply">${esc(reply)}</div>${note?`<div class="note">${esc(note)}</div>`:''}${extra&&extra.length?`<div class="events">${batchHtml(extra)}</div>`:''}`;
 const go=()=>{closePop();
  if(sp){const[x,y]=anchorXY(sp.x,sp.y);showPop(html,'bubble',x,y,10);}else showPop(html,'bubble',null,null);};
 setDrawer('closed');if(sp)setTimeout(()=>panTo(sp.x,go),60);else go();}

/* ---------- sameiginlegt ---------- */
function hudHtml(){const pend=sc.resources.filter(r=>st.calls[r.id]).map(r=>{const c=st.calls[r.id];return `<span class="glass">${r.icon} ${c.arrived?'✓':Math.max(0,c.at+r.eta-st.minute)+'′'}</span>`;}).join('');
 return `<div class="hud"><span class="glass">⏱ ${st.minute} mín</span>${view!=='distance'?`<span class="glass">${severe()?'⚠️':'🥶'} ${sc.heatSources.filter(h=>st.addressed[h.id]).length}/${sc.heatSources.length}</span>`:''}${pend}</div><button class="pausebtn glass" id="pause" aria-label="Hlé – valmynd">⏸</button>`;}
function radioBody(){return `<p class="muted">Þú ert björgunarsveitarmaður á vettvangi. Staðsetning: ${esc(sc.location.label)}. Hvert kall tekur 1 mín.</p>
 ${sc.resources.map(r=>{const c=st.calls[r.id];return `<button data-call="${r.id}" ${c?'disabled class="done"':''}><div class="res"><span class="ic">${r.icon}</span><div><b>${esc(r.label)}</b>${c?` ✓ ${c.arrived?'á staðnum':'kemur eftir ~'+Math.max(0,c.at+r.eta-st.minute)+' mín'}`:` <span class="m">· áætl. ${r.eta} mín</span>`}<small>${esc(r.role)}</small></div></div></button>`;}).join('')}`;}
function logBody(){return `<div class="log">${st.log.slice().reverse().map(l=>`<p class="${l.cls}">${esc(l.t)}</p>`).join('')||'<p class="muted">Ekkert enn.</p>'}</div>`;}
function tabsHtml(tabs){return `<div class="tabs">${tabs.map(g=>`<button data-t="${g.id}" class="${st.tab===g.id?'on':''}">${esc(g.label)}</button>`).join('')}</div>`;}
function hotsHtml(list,seen){return list.map((h,i)=>`<button class="hot ${seen.includes(h.id)?'seen':''}" style="left:${h.x}%;top:${h.y}%" data-h="${h.id}" aria-label="${esc(h.label)}"><span>${i+1}</span></button>`).join('');}
function screen(img,key,startPct,hots,body,fit){
 app.innerHTML=(fit?fitHtml(img,hots):panHtml(img,hots))+hudHtml()+(st.swipeHint&&!fit?`<div class="swipehint">⟵ strjúktu til að líta í kringum þig ⟶</div>`:'')+drawerHtml(body)+'<div id="ov"></div>';
 if(fit)fitSetup();else panSetup(key,startPct);drawerSetup();
 $('#pause').onclick=e=>{e.stopPropagation();pauseMenu();};
 $$('[data-t]').forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;render();});
 $$('[data-call]').forEach(b=>b.onclick=()=>{const r=sc.resources.find(x=>x.id===b.dataset.call);st.calls[r.id]={at:st.minute+1,phase:view};
  st.batch=[];log('📻 Kallað eftir: '+r.label+'. „'+sc.location.callText+'“ Áætlaður komutími ~'+r.eta+' mín.','info');tick(1);result();});}
function result(){if(st.drawer==='full')st.drawer='half';render();flushBatch();}
function hotClick(list,seenArr){$$('[data-h]').forEach(b=>b.onclick=e=>{e.stopPropagation();const h=list.find(x=>x.id===b.dataset.h);if(!seenArr.includes(h.id))seenArr.push(h.id);
 if(st.swipeHint){st.swipeHint=false;const sh=$('.swipehint');if(sh)sh.remove();}
 st.log.push({t:'['+st.minute+' mín] '+h.label+': '+h.text,cls:''});b.classList.add('seen');
 const r=b.getBoundingClientRect(),a=app.getBoundingClientRect();closePop();
 showPop(`<div class="who">${esc(h.label)}</div><div>${esc(h.text)}</div>`,'card hotcard',r.left-a.left+r.width/2,r.top-a.top+r.height/2,30);
 const n=$('#seenN');if(n)n.textContent=st.seen.length;});}
/* pikk utan spjalds lokar því (en gleypir ekki pikkið) */
app.addEventListener('pointerdown',e=>{if(popOpen()&&!e.target.closest('.pop'))closePop();},true);
function render(){({distance,close,debrief})[view]();}

/* ---------- aðalvalmynd, nafn, val á aðstæðum ---------- */
function bgHtml(){const s0=S[0];return `<div class="pano"><div class="fitbg cover" style="background-image:url('${s0?s0.images.distance:''}')"></div></div>`;}
function sndLbl(){return soundOn()?'🔊 Hljóð: á':'🔇 Hljóð: af';}
function mainMenu(){view='menu';const name=store.get('fh-nafn','').trim();const inGame=st&&st.report===null&&sc;
 app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass"><h1>Fyrsta hjálp</h1><div class="muted">Þjálfunarleikur fyrir björgunarsveitarfólk · útgáfa ${VER}</div>${name?`<p>Hæ, ${esc(name)}!</p>`:''}
 <button class="primary" id="nyr">Nýr leikur</button>${inGame?`<button id="afram">Halda áfram: ${esc(sc.title)}</button>`:''}<button id="leid">Leiðbeiningar</button><button id="snd">${sndLbl()}</button></div></div>`;
 $('#nyr').onclick=nameScreen;if(inGame)$('#afram').onclick=()=>{view=st.view||'distance';render();};$('#leid').onclick=()=>help(mainMenu);
 $('#snd').onclick=()=>{store.set('fh-hljod',soundOn()?'af':'a');mainMenu();};}
function nameScreen(){view='name';
 app.innerHTML=bgHtml()+`<div class="full menu"><form class="card glass" id="nf"><h1>Hvað heitir þú?</h1><p class="muted">Nafnið er notað í leiknum og í samantektinni. Það er aðeins geymt í þessu tæki.</p>
 <input id="nafn" type="text" maxlength="24" autocomplete="given-name" autocapitalize="words" placeholder="Nafnið þitt" value="${esc(store.get('fh-nafn',''))}"><p class="no" id="nerr" hidden>Skrifaðu nafnið þitt.</p>
 <button class="primary" type="submit" id="nok">Áfram</button><button type="button" id="nback">← Til baka</button></form></div>`;
 $('#nf').onsubmit=e=>{e.preventDefault();const v=$('#nafn').value.trim();if(!v){$('#nerr').hidden=false;return;}store.set('fh-nafn',v);$('#nafn').blur();window.scrollTo(0,0);pickScreen();};
 $('#nback').onclick=mainMenu;}
function pickScreen(){view='pick';
 app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass"><h1>Veldu aðstæður</h1><p class="muted">${esc(nafn())}, þú ert björgunarsveitarmaður á vettvangi.</p>
 <h3>Braut 1 – Fyrsta hjálp 1</h3>${S.filter(s=>s.track===1).map(s=>`<button class="primary" data-s="${s.id}">${esc(s.title)}</button>`).join('')}
 <h3>Braut 2 – Óbyggðagrunnur</h3><button disabled>Væntanlegt</button><h3>Braut 3 – WFR</h3><button disabled>Væntanlegt</button><button id="pback">← Aðalvalmynd</button></div></div>`;
 $$('[data-s]').forEach(b=>b.onclick=()=>start(b.dataset.s));$('#pback').onclick=mainMenu;}
const HELP=[
 ['Markmið','Þú ert björgunarsveitarmaður á vettvangi. Vinndu eftir þríhyrningakerfinu: vettvangur kannaður, frumskoðun, sjúkrasaga og líkamsskoðun – og veittu svo rétta meðferð.'],
 ['Myndin','Pikkaðu á rauðu númeruðu merkin til að skoða vísbendingar. Textinn birtist við merkið; pikkaðu á skjáinn til að loka. Nærmyndir eru víðmyndir: strjúktu til hliðar til að líta í kringum þig.'],
 ['Skúffan ☰','Dragðu skúffuna upp eða pikkaðu á handfangið til að velja aðgerðir. Flipar fylgja þríhyrningakerfinu. Svör sjúklings og félaga birtast í talblöðrum á myndinni, niðurstöður sem spjöld.'],
 ['Tíminn ⏱','Hver aðgerð tekur tíma og ástand sjúklings breytist með tímanum. Bregstu hratt við og endurmettu reglulega (flipinn Endurmat birtist þegar meðferð hefst).'],
 ['📻 Aðstoð','Kallaðu eftir þeirri aðstoð sem ástandið og flutningurinn krefjast. Hvert kall tekur 1 mín og aðstoðin kemur eftir áætlaðan komutíma.'],
 ['Ákvörðun','Þegar skoðun og meðferð er lokið ákveður þú flutning. Þá færðu samantekt, stig og SAGA-skráningu. 📜 Skrá geymir allt sem hefur gerst.'],
 ['⏸ Hlé','Hnappurinn efst í horninu opnar valmynd: halda áfram, byrja upp á nýtt, velja aðrar aðstæður eða fara í aðalvalmynd.']];
function help(back){const prev=app.querySelector('.overlay');
 const html=`<div class="card glass"><h1>Leiðbeiningar</h1>${HELP.map(([k,v])=>`<div class="step"><b>${esc(k)}</b><div>${esc(v)}</div></div>`).join('')}<button class="primary" id="hback">Til baka</button></div>`;
 if(view==='menu'){app.innerHTML=bgHtml()+`<div class="full menu">${html}</div>`;$('#hback').onclick=back;return;}
 const o=document.createElement('div');o.className='overlay full';o.innerHTML=html;if(prev)prev.remove();app.appendChild(o);$('#hback').onclick=()=>{o.remove();back();};}
function pauseMenu(){closePop();const o=document.createElement('div');o.className='overlay full';o.id='pausem';
 o.innerHTML=`<div class="card glass"><h1>Hlé</h1><div class="muted">${esc(sc.title)} · ⏱ ${st.minute} mín</div>
 <button class="primary" id="p_cont">▶ Halda áfram</button><button id="p_restart">↺ Byrja upp á nýtt</button><button id="p_pick">Velja aðrar aðstæður</button><button id="p_main">Aðalvalmynd</button><button id="p_help">Leiðbeiningar</button><button id="p_snd">${sndLbl()} <span class="m">(hljóð koma síðar)</span></button></div>`;
 app.appendChild(o);const q=s=>o.querySelector(s);
 q('#p_cont').onclick=()=>o.remove();q('#p_restart').onclick=()=>start(sc.id);q('#p_pick').onclick=()=>{st=null;pickScreen();};
 q('#p_main').onclick=()=>{st.view=view;mainMenu();};q('#p_help').onclick=()=>{o.remove();help(pauseMenu);};
 q('#p_snd').onclick=()=>{store.set('fh-hljod',soundOn()?'af':'a');o.remove();pauseMenu();};}
function start(id){sc=S.find(s=>s.id===id);st={minute:0,temp:sc.temp.start,flags:{},addressed:{},seen:[],seenClose:[],calls:{},log:[],score:[],report:null,
 tab:'vettvangur_d',drawer:'closed',pan:{},scroll:{},swipeHint:true,reassess:[],lastVitals:null,treatStart:null,batch:null};view='distance';
 log(fill(sc.intro),'');render();showPop(`<div class="who">${esc(sc.title)}</div><div>${esc(fill(sc.intro))}</div><div class="note">Pikkaðu á merkin á myndinni og dragðu svo skúffuna upp til að velja hvað þú gerir.</div>`,'card',null,null);}

/* ---------- fjarlægð ---------- */
function distance(){const d=sc.distance;
 const tabs=[{id:'vettvangur_d',label:'Vettvangur'},{id:'adstod',label:'📻 Aðstoð'},{id:'skra',label:'📜 Skrá'}];
 const body=st.tab==='adstod'?radioBody():st.tab==='skra'?logBody():
  `<p class="muted">Pikkaðu á merkin á myndinni (<span id="seenN">${st.seen.length}</span>/${d.hotspots.length} könnuð).</p><h3>Hvað gerirðu?</h3>${d.approach.map(a=>`<button data-a="${a.id}">${esc(a.label)}</button>`).join('')}`;
 screen(sc.images.distance,'distance',50,hotsHtml(d.hotspots,st.seen),tabsHtml(tabs)+body,d.fit);
 hotClick(d.hotspots,st.seen);
 $$('[data-a]').forEach(b=>b.onclick=()=>{const a=d.approach.find(x=>x.id===b.dataset.a);st.flags[a.flag]=true;st.batch=[];
  st.score.push({label:'Nálgun: '+a.label,points:a.score});log(a.text,a.score>0?'good':'bad');tick(a.minutes);view='close';st.tab=sc.close.groups[0].id;st.swipeHint=true;st.drawer='closed';render();flushBatch();});}

/* ---------- nærmynd ---------- */
function treating(){return st.treatStart!==null;}
function close(){const c=sc.close;const treated=st.flags.t_dyna&&st.flags.t_hylja;
 const short=l=>l.replace(/^\d\.\s*/,'').replace('Sjúkrasaga og líkamsskoðun','Saga og skoðun').replace('Vettvangur kannaður','Vettvangur');
 let tabs=c.groups.map(g=>({id:g.id,label:short(g.label)}));if(treating())tabs.push({id:'endurmat',label:'🔁 Endurmat'});
 tabs=tabs.concat([{id:'tilkynna',label:'Ákvörðun'},{id:'adstod',label:'📻 Aðstoð'},{id:'skra',label:'📜 Skrá'}]);
 if(st.tab==='endurmat'&&!treating())st.tab=c.groups[0].id;
 let body;
 if(st.tab==='adstod')body=radioBody();else if(st.tab==='skra')body=logBody();else if(st.tab==='endurmat')body=reassessBody();
 else if(st.tab==='tilkynna')body=`<p class="muted">Þegar skoðun og meðferð er lokið: ákveddu flutning.</p><h3>Hvað gerirðu núna?</h3>${sc.report.options.map(o=>`<button data-r="${o.id}">${esc(o.label)}</button>`).join('')}`;
 else body=c.actions.filter(a=>a.group===st.tab).map(a=>`<button data-x="${a.id}" class="${st.flags[a.flag]?'done':''}" ${st.flags[a.flag]&&!a.speaker?'disabled':''}>${st.flags[a.flag]?'✓ ':''}${a.speaker?'💬 ':''}${esc(a.label)}${a.minutes?` <span class="m">· ${a.minutes} mín</span>`:''}</button>`).join('');
 screen(treated?sc.images.treated:sc.images.close,'close',sc.pan.closeStart,hotsHtml(c.hotspots||[],st.seenClose),tabsHtml(tabs)+body);
 hotClick(c.hotspots||[],st.seenClose);
 $$('[data-x]').forEach(b=>b.onclick=()=>act(c.actions.find(a=>a.id===b.dataset.x)));
 $$('[data-ra]').forEach(b=>b.onclick=()=>reassessAct(b.dataset.ra));
 $$('[data-r]').forEach(b=>b.onclick=()=>{const o=sc.report.options.find(x=>x.id===b.dataset.r);let pts,txt;
  if(o.goodWhen&&all(o.goodWhen)){pts=15;txt=o.goodText;}else if(o.okWhen&&all(o.okWhen)){pts=8;txt=o.okText;}else{pts=-10;txt=o.badText;}
  st.report={id:o.id,label:o.label,pts,txt};log('Ákvörðun: '+o.label,pts>0?'good':'bad');view='debrief';render();});}
function act(a){const sev=severe();st.flags[a.flag]=true;let txt=a.text,pts=a.score||0,cls='';st.batch=[];
 if(a.group==='medferd'&&st.treatStart===null)st.treatStart=st.minute;
 if(a.speaker){let sp=a.speaker,reply=fill(a.reply),pre='';
  if(sev&&sp==='sjuklingur'&&a.id!=='tala'){sp='felagi';pre='(Sigga getur ekki svarað skýrt – félaginn svarar fyrir hana) ';}
  const say=a.say?fill(a.say):'';log((say?'Þú: „'+say+'“ ':'')+(sp==='felagi'?'Félaginn: ':sc.patient.name+': ')+pre+reply+(a.note?' ('+a.note+')':''),'');
  const before=st.batch.length;tick(a.minutes);const extra=st.batch.slice(before);st.batch=null;st.drawer='closed';render();speak(sp,say,pre+reply,a.note,extra);return;}
 if(a.rule){const r=sc.close[a.rule];const ok=all(r.goodWhen);txt=ok?r.goodText:r.badText;pts=ok?r.goodScore:r.badScore;}
 else if(a.requiresMild&&sev){txt=a.severeText;pts=a.severeScore;st.flags.drinkSevere=true;}
 else if(a.addresses)a.addresses.forEach(s=>st.addressed[s]=true);
 if(a.id==='lifsmork')st.lastVitals={min:st.minute,temp:st.temp};
 if(pts){st.score.push({label:'Aðgerð: '+a.label,points:pts});cls=pts>0?'good':'bad';}
 log(fill(txt),cls);tick(a.minutes);
 result();}

/* ---------- endurmat ---------- */
function trendOf(prev){if(!prev)return null;const d=st.temp-prev.temp;return d>0.05?'betra':d<-0.05?'verra':'óbreytt';}
function reassessBody(){const R=st.reassess;const last=R.filter(r=>r.kind==='vitals').slice(-1)[0];
 const since=last?st.minute-last.min:null;
 return `<p class="muted">Endurmettu reglulega eftir að meðferð hefst – oftar ef ástand er óstöðugt.${since!==null?` Síðasta mat lífsmarka: fyrir ${since} mín.`:' Lífsmörk ekki endurmetin enn.'}</p>
 <button data-ra="feel">💬 Spyrja hvernig henni líður <span class="m">· 1 mín</span></button>
 <button data-ra="vitals">Endurmeta VÁSE og lífsmörk <span class="m">· 2 mín</span></button>
 <button data-ra="tx">Athuga hvort meðferðin virkar <span class="m">· 1 mín</span></button>
 ${R.length?`<h3>Fyrri endurmöt</h3><div class="log">${R.slice().reverse().map(r=>`<p class="${r.trend==='betra'?'good':r.trend==='verra'?'bad':''}">[${r.min} mín] ${esc(r.label)}${r.trend?' – '+r.trend:''}</p>`).join('')}</div>`:''}`;}
function hands(tr){return st.temp>=35?'Hendur að hlýna, hreyfigeta betri':tr==='betra'?'Hendur aðeins hlýrri':'Hendur ískaldar, stífar og klaufskar';}
function reassessAct(k){const ra=sc.reassess;st.batch=[];const prevV=st.lastVitals;
 if(k==='feel'){tick(1);const tr=trendOf(st.lastFeel||prevV)||'óbreytt';st.lastFeel={temp:st.temp};
  let reply=severe()?ra.feel.severe:ra.feel[tr==='betra'?'better':tr==='verra'?'worse':'same'];
  if(!severe()){const open=sc.heatSources.filter(h=>!st.addressed[h.id]);if(open.length)reply+=' '+ra.complaints[open[0].id];}
  st.reassess.push({min:st.minute,kind:'feel',label:'Líðan spurð',trend:null});
  log('Þú: „'+ra.feelSay+'“ '+sc.patient.name+': '+reply,'');const extra=st.batch;st.batch=null;st.drawer='closed';render();speak('sjuklingur',ra.feelSay,reply,null,extra);return;}
 if(k==='vitals'){tick(2);const b=band();const tr=trendOf(prevV);st.lastVitals={min:st.minute,temp:st.temp};
  const txt=`Endurmat lífsmarka: VÁSE: ${b.VASE} · P: ${b.P} · Ö: ${b.O} · BÞ: ${b.BTH} · L: ${b.L} · H: ${b.H} · ${b.shiver}. `+(tr?`Miðað við fyrra mat: ${tr.toUpperCase()}.`:'Fyrsta mat – ekkert til samanburðar.');
  st.reassess.push({min:st.minute,kind:'vitals',label:'Lífsmörk og VÁSE',trend:tr});log(txt,tr==='betra'?'good':tr==='verra'?'bad':'info');result();return;}
 if(k==='tx'){tick(1);const tr=trendOf(st.lastTx||prevV);st.lastTx={temp:st.temp};const b=band();
  const lines=sc.heatSources.map(h=>(st.addressed[h.id]?'✓ ':'✗ ')+h.label.split(' (')[0]+': '+ra.sources[h.id][st.addressed[h.id]?0:1]);
  lines.push((allSources()?'✓ Hitatap stöðvað.':'✗ Hitatap ekki stöðvað að fullu.'));
  lines.push(severe()?'Skjálfti: enginn – alvarleg ofkæling, hreyfa varlega.':'Skjálfti: '+b.shiver.toLowerCase()+'.');lines.push(hands(tr)+'.');
  if(st.flags.t_drykkur&&!st.flags.drinkSevere)lines.push('✓ Hefur fengið orkuríkan drykk og mat.');
  st.reassess.push({min:st.minute,kind:'tx',label:'Meðferð athuguð',trend:tr});
  log('Er meðferðin að virka? '+lines.join(' '),allSources()?'good':'bad');
  st.batch=st.batch.map(x=>x.t.startsWith('Er meðferðin')?{t:'Er meðferðin að virka?',cls:'h'}:x);
  const evs=st.batch;st.batch=null;if(st.drawer==='full')st.drawer='half';render();showPop(batchHtml(evs)+lines.map(l=>`<p class="ln ${l[0]==='✓'?'good':l[0]==='✗'?'bad':''}">${esc(l)}</p>`).join(''),'card',null,null);return;}}

/* ---------- mat á aðstoð ---------- */
function resJudge(){const items=[];let ok=true;
 sc.resources.forEach(r=>{const c=st.calls[r.id];let pts=0,txt,cls='ok';
  if(r.needWhen&&r.needWhen.length&&all(r.needWhen)){const by=severe()?Math.max(r.callBy||99,(st.severeAt||0)+5):99;
   if(!c){ok=false;cls='no';pts=-r.needPoints;txt='Ekki kallað. '+r.needText;}
   else if(r.callBy&&c.at>by){ok=false;cls='no';pts=Math.round(r.needPoints/2);txt='Kallað of seint (mín '+c.at+', átti að vera fyrir mín '+by+'). '+r.needText;}
   else{pts=r.needPoints||0;txt='Kallað í tæka tíð (mín '+c.at+'). '+r.needText;}}
  else if(c&&any(r.unneededWhen)){ok=false;cls='no';pts=r.unneededPoints;txt='Kallað (mín '+c.at+'). '+r.unneededText;}
  else{txt=c?'Kallað (mín '+c.at+'). '+(r.calledNeutralText||r.neutralText||''):'Ekki kallað. '+(r.neutralText||'');}
  if(c)txt+=c.arrived?' Kom á mín '+c.arrived+'.':' Ekki komin(n) í lok leiks.';
  items.push({r,pts,txt,cls});});
 return{ok,items};}
function saga(){const b=band();const f=st.flags;const yes=k=>f[k];
 const S1=[];if(yes('askedPartner')||yes('olsena_a'))S1.push('34 ára kona, rann í læk fyrir u.þ.b. 2 klst, blaut og köld í slydduveðri á hrauni.');
 [['olsena_o','Ofnæmi: ekkert'],['olsena_l','Lyf: engin'],['olsena_s','Sjúkrasaga: heilbrigð'],['olsena_e','Einkenni: kuldi, þreyta, klaufskar hendur'],['olsena_n','Neysla: morgunmatur kl. 8, lítið síðan']].forEach(([k,t])=>{if(yes(k))S1.push(t+'.');});
 const A=[];if(yes('vase')||yes('vitals'))A.push('VÁSE: '+b.VASE+'.');if(yes('pulse')||yes('vitals'))A.push('P: '+b.P+'.');if(yes('breathing')||yes('vitals'))A.push('Ö: '+b.O+'.');if(yes('vitals'))A.push('H: '+b.H+'. '+b.shiver+'.');if(yes('bleeding'))A.push('Engar blæðingar.');if(yes('exam'))A.push('Blaut föt, húfulaus, engin meiðsli.');
 const RV=st.reassess.filter(r=>r.kind==='vitals');if(RV.length)A.push('Endurmat lífsmarka '+RV.length+'× ('+RV.map(r=>'mín '+r.min+(r.trend?': '+r.trend:'')).join(', ')+').');
 const G=[severe()?'Alvarleg ofkæling (<32°C). G\': hjartsláttaróregla, hjartastopp.':'Væg ofkæling (32–35°C). G\': alvarleg ofkæling.'];
 const Ap=[];sc.close.actions.filter(a=>a.group==='medferd'&&f[a.flag]).forEach(a=>Ap.push(a.label));
 sc.resources.forEach(r=>{if(st.calls[r.id])Ap.push('Kallað eftir: '+r.label);});if(st.report)Ap.push(st.report.label);
 return [['S – Saga sjúklings',S1.join(' ')||'Ekki skráð.'],['A – Athuganir',A.join(' ')||'Ekki skráð.'],['G – Greining',G.join(' ')],['A – Áætlun',Ap.join('; ')||'Ekki skráð.']];}

/* ---------- samantekt ---------- */
function debrief(){
 const rows=sc.debrief.map(r=>{const ok=all(r.ok);return{r,ok,pts:ok?r.points:0};});const rj=resJudge();
 const extra=st.score.reduce((s,x)=>s+x.points,0)+st.report.pts+rj.items.reduce((s,x)=>s+x.pts,0);const max=sc.debrief.reduce((s,r)=>s+r.points,0);
 const raw=rows.reduce((s,x)=>s+x.pts,0);const total=Math.max(0,Math.min(100,Math.round(raw/max*80+Math.max(-20,Math.min(20,extra/4)))));
 const praise=total>=90?'Frábærlega gert':total>=70?'Vel gert':total>=40?'Ágætis tilraun':'Þetta þarf að æfa betur';
 app.innerHTML=bgHtml()+`<div class="full"><div class="card glass"><h1>Samantekt</h1><div class="muted">${esc(sc.title)} · ${esc(nafn())}</div><div class="score">${total}/100</div><p><b>${praise}, ${esc(nafn())}!</b></p><p>Tími: ${st.minute} mín · ${severe()?'<span class="no">alvarleg ofkæling</span>':'<span class="ok">væg ofkæling</span>'} (áætl. kjarnhiti ${st.temp.toFixed(1)}°C)</p>
 <p><b>Ákvörðun:</b> ${esc(st.report.label)}<br><span class="${st.report.pts>0?'ok':'no'}">${esc(st.report.txt)}</span></p></div>
 <div class="card glass"><h3>📻 Aðstoð – val og tímasetning</h3>${rj.items.map(x=>`<div class="step"><b>${x.r.icon} ${esc(x.r.label)}</b> <span class="${x.cls}">${x.pts>0?'+':''}${x.pts}</span><div class="${x.cls}">${esc(x.txt)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>Mat eftir skrefum</h3>${rows.map(x=>`<div class="step"><div><b>${esc(x.r.label)}</b> <span class="${x.ok?'ok':'no'}">${x.pts}/${x.r.points}</span></div><div class="${x.ok?'ok':'no'}">${x.ok?'✓ ':'✗ '}${esc(x.ok?x.r.okText:x.r.badText)}</div><div class="r">${esc(x.r.rule)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>SAGA skráning</h3>${saga().map(([k,v])=>`<div class="step"><b>${k}</b><div>${esc(v)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>Einstakar ákvarðanir</h3><table>${st.score.map(s=>`<tr><td>${esc(s.label)}</td><td class="${s.points>0?'ok':'no'}">${s.points>0?'+':''}${s.points}</td></tr>`).join('')}</table></div>
 <button class="primary" id="again">↺ Spila aftur</button><button id="other">Velja aðrar aðstæður</button><button id="tomenu">Aðalvalmynd</button></div>`;
 $('#again').onclick=()=>start(sc.id);$('#other').onclick=()=>{st=null;pickScreen();};$('#tomenu').onclick=()=>{st=null;mainMenu();};}
window.addEventListener('resize',()=>{if(st&&['distance','close'].includes(view)&&!app.querySelector('.overlay'))render();});
window.addEventListener('error',e=>{console.error(e.message)});
mainMenu();
})();
