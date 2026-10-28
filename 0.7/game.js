(function(){
"use strict";
const VER='0.7';
const S=(window.SCENARIOS||[]).slice().sort((a,b)=>(a.order||99)-(b.order||99));const app=document.getElementById('app');
let sc,st,view;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=q=>app.querySelector(q),$$=q=>app.querySelectorAll(q);
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v;}catch(_){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(_){}}};
const nafn=()=>store.get('fh-nafn','').trim()||'björgunarmaður';
const soundOn=()=>store.get('fh-hljod','a')==='a';
/* ---------- tölfræði: niðurstaða hvers borðs send í Supabase ef config.js er útfyllt.
   Truflar aldrei leikinn: allt í try/catch, stuttur tímafrestur, biðröð í localStorage ef netið vantar. ---------- */
const CFG=window.FH_CONFIG||{};const SB_URL=String(CFG.SUPABASE_URL||'').trim().replace(/\/+$/,''),SB_KEY=String(CFG.SUPABASE_ANON_KEY||'').trim();
const statsOn=()=>!!(SB_URL&&SB_KEY&&window.fetch);
function rid(){try{if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();}catch(_){}const b=new Uint8Array(16);try{crypto.getRandomValues(b);}catch(_){for(let i=0;i<16;i++)b[i]=Math.random()*256|0;}
 b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function deviceId(){let d=store.get('fh-taeki','');if(!/^[0-9a-f-]{36}$/.test(d)){d=rid();store.set('fh-taeki',d);}return d;}
const QK='fh-bidrod';let qBusy=false;
function qLoad(){try{const q=JSON.parse(store.get(QK,'[]'));return Array.isArray(q)?q:[];}catch(_){return[];}}
function qSave(q){store.set(QK,JSON.stringify(q.slice(-50)));}
function post(rec,keep){let t=0;try{const ac=window.AbortController?new AbortController():null;t=setTimeout(()=>{try{ac&&ac.abort();}catch(_){}},6000);
  const h={'Content-Type':'application/json','apikey':SB_KEY,'Prefer':'return=minimal'};if(/^eyJ/.test(SB_KEY))h.Authorization='Bearer '+SB_KEY;
  return fetch(SB_URL+'/rest/v1/fh_results',{method:'POST',headers:h,body:JSON.stringify(rec),keepalive:!!keep,signal:ac?ac.signal:undefined,mode:'cors',credentials:'omit',cache:'no-store'})
   .then(r=>{clearTimeout(t);const c=r.status;return(r.ok||c===409)?'ok':(c===400||c===422)?'drop':'retry';},()=>{clearTimeout(t);return'retry';});}
 catch(_){clearTimeout(t);return Promise.resolve('retry');}}
function flushQ(){try{if(!statsOn()||qBusy)return;const now=Date.now();const q=qLoad().filter(r=>r&&r.id&&now-Date.parse(r.played_at)<30*864e5);qSave(q);if(!q.length)return;
 qBusy=true;const rec=q[0];post(rec).then(res=>{qBusy=false;if(res!=='retry'){qSave(qLoad().filter(r=>r.id!==rec.id));setTimeout(flushQ,0);}},()=>{qBusy=false;});}catch(_){qBusy=false;}}
function sendResult(rec){try{if(!statsOn())return;const q=qLoad();q.push(rec);qSave(q);flushQ();}catch(_){}}
window.addEventListener('online',flushQ);setTimeout(flushQ,1500);
/* ástandslíkan: st.temp er almennt ástandsgildi (kjarnhiti í ofkælingu, „ástand“ í öðrum aðstæðum) */
const M=()=>sc.state||sc.temp;const P=()=>(sc.problems||sc.heatSources||[]).filter(h=>!h.activeWhen||all(h.activeWhen));
/* setF: flagg sett og tími skráður (fyrir since:flagg>=N) */
function setF(f){if(!f)return;st.flags[f]=true;if(st.flagAt[f]===undefined)st.flagAt[f]=st.minute;}
function band(){if(st.flags&&st.flags.arrest&&sc.arrestVitals)return sc.arrestVitals;return sc.vitals.find(b=>st.temp>=b.min)||sc.vitals[sc.vitals.length-1];}
function fill(t){const b=band();return String(t).replace(/\{(\w+)\}/g,(m,k)=>k==='nafn'?nafn():b[k]!==undefined?b[k]:m);}
function severe(){return st.temp<M().severeBelow;}
function allSources(){return P().every(h=>st.addressed[h.id]);}
function cond(c){
 if(c==='always')return true;if(c==='never')return false;if(c.startsWith('not:'))return!cond(c.slice(4));if(c.startsWith('or:'))return c.slice(3).split('|').some(cond);if(c==='mild')return!severe();if(c==='severe')return severe();if(c==='allSources')return allSources();
 if(c==='drinkOk')return!st.flags.drinkSevere;if(c==='resourcesOk')return resJudge().ok;
 if(c==='stretcher')return sc.stretcherWhen?any(sc.stretcherWhen):severe()||!!(st.report&&st.report.id==='112_flutningur');
 if(c.startsWith('addressed:'))return!!st.addressed[c.slice(10)];if(c.startsWith('trend:'))return st._trend===c.slice(6);
 if(c.startsWith('flag:'))return!!st.flags[c.slice(5)];if(c.startsWith('call:'))return!!st.calls[c.slice(5)];
 if(c.startsWith('decision:'))return!!(st.report&&st.report.id===c.slice(9));
 let m=c.match(/^hotspots>=(\d+)$/);if(m)return st.seen.length>=+m[1];
 m=c.match(/^addressedBy:(\w+):(\d+)$/);if(m)return st.addressedAt[m[1]]!==undefined&&st.addressedAt[m[1]]<=+m[2];
 m=c.match(/^val(>=|<)([\d.]+)$/);if(m)return m[1]==='>='?st.temp>=+m[2]:st.temp<+m[2];
 m=c.match(/^reassess>=(\d+)$/);if(m)return st.reassess.filter(r=>r.kind==='vitals').length>=+m[1];
 m=c.match(/^since:(\w+)>=(\d+)$/);if(m)return st.flagAt[m[1]]!==undefined&&st.minute-st.flagAt[m[1]]>=+m[2];
 m=c.match(/^olsena>=(\d+)$/);if(m)return Object.keys(st.flags).filter(k=>k.startsWith('olsena_')).length>=+m[1];
 console.warn('óþekkt skilyrði',c);return false;}
const all=a=>(a||[]).every(cond);const any=a=>(a||[]).some(cond);
/* log: allt fer í atburðaskrá; það sem gerist í einni aðgerð safnast í st.batch og birtist á myndinni */
function log(t,cls){st.log.push({t:'['+st.minute+' mín] '+t,cls:cls||''});if(st.batch)st.batch.push({t,cls:cls||''});}
/* hjartastopp (t.d. alvarleg ofkæling): af of lágum kjarnhita eða harkalegri meðhöndlun – sjá arrestBelow og arrestIf */
function arrest(t){if(st.flags.arrest)return;st.flags.arrest=true;st.arrestAt=st.minute;log(t||M().arrestLog||'Hjartastopp!','bad');}
function tick(min){const m=M();for(let i=0;i<min;i++){const open=P().filter(h=>!st.addressed[h.id]);
 const was=severe();st.temp-=open.reduce((s,h)=>s+(h.rate!==undefined?h.rate:m.ratePerSource),0);
 if(m.baseRate&&all(m.baseWhen||['always']))st.temp-=m.baseRate;
 if(open.length===0&&all(m.recoverWhen||['flag:t_drykkur','mild']))st.temp+=m.warmRate||0;
 st.temp=Math.min(st.temp,m.max!==undefined?m.max:36.5);if(m.min!==undefined)st.temp=Math.max(st.temp,m.min);st.minute++;
 events();
 if(!was&&severe()){log(m.severeLog||'Ástand versnar!','bad');st.flags.becameSevere=true;st.severeAt=st.minute;}
 (m.warnings||[]).forEach((w,j)=>{if(!st.flags['warn'+j]&&!st.flags.arrest&&st.temp<w.below){st.flags['warn'+j]=true;log(w.text,'bad');}});
 if(m.arrestBelow!==undefined&&st.temp<m.arrestBelow)arrest(m.arrestLog);
 sc.resources.forEach(r=>{const c=st.calls[r.id];if(c&&!c.arrived&&st.minute>=c.at+etaOf(r)){const had=gearCame();c.arrived=st.minute;st.flags['arrived_'+r.id]=true;log(r.icon+' '+r.arriveText,'info');arriveFx(r,had);}});
 if(st.tHist)st.tHist[st.minute]=st.temp;}}

/* atburðir (sc.events): gerast einu sinni þegar öll skilyrði (when) eru uppfyllt – t.d. hjartastuðtæki berst, sláttur kemst aftur á, einkenni taka sig upp */
function events(){const m=M();(sc.events||[]).forEach(ev=>{if(st.fired[ev.id]||!all(ev.when))return;st.fired[ev.id]=true;
 (ev.unflag||[]).forEach(f=>{delete st.flags[f];});(ev.flags||[]).forEach(setF);
 if(ev.setVal!==undefined)st.temp=ev.setVal;if(ev.addVal)st.temp+=ev.addVal;st.temp=Math.min(st.temp,m.max!==undefined?m.max:36.5);
 if(ev.text)log(fill(ev.text),ev.cls||'info');});}

/* ---------- víðmynd sem er dregin til hliðar ---------- */
let pm=()=>{},pu=()=>{};
const pan={x:0,min:0,v:0,raf:0,down:null,moved:false,key:'',fit:false};
function panHtml(img,hots,list,seen){return `<div class="pano" id="pano"><div class="track" id="track"><img id="bg" src="${img}" alt="Víðmynd – strjúktu til hliðar">${hots||''}</div></div><div class="panbar"><i id="panI"></i></div>${miniHtml(img,list||[],seen||[])}`;}
/* smákort: öll víðmyndin með númeruðum merkjum, rammi sýnir hvert er horft; pikk/dráttur færir myndina */
function miniHtml(img,list,seen){return `<div class="mini" id="mini" role="button" aria-label="Smákort – pikkaðu til að færa myndina"><div class="mimg" style="background-image:url('${img}')"></div>${list.map((h,i)=>{const[dx,dy]=moffOf(h);const c=seen.includes(h.id)?'seen':'';
 return `<i class="ml ${c}" data-ml="${h.id}"></i><i class="md ${c}" data-md="${h.id}" style="left:${h.x}%;top:${h.y}%"></i><b class="${c}" data-mh="${h.id}" data-x="${h.x}" data-y="${h.y}" data-dx="${dx}" data-dy="${dy}" style="left:${h.x}%;top:${h.y}%">${i+1}</b>`;}).join('')}<i class="mview" id="mview"></i></div>`;}
/* smákortsmerki: sama stefna og á stóru myndinni, styttri lína; haldið innan smákortsins */
function miniMarks(mi){const W=mi.clientWidth,H=mi.clientHeight;if(!W||!H)return;mi.querySelectorAll('b[data-mh]').forEach(b=>{
 const ax=W*b.dataset.x/100,ay=H*b.dataset.y/100,r=6.5;const mx=Math.max(r,Math.min(W-r,ax+ +b.dataset.dx)),my=Math.max(r,Math.min(H-r,ay+ +b.dataset.dy));
 b.style.left=mx+'px';b.style.top=my+'px';const ln=mi.querySelector(`[data-ml="${b.dataset.mh}"]`);const L=Math.hypot(mx-ax,my-ay);
 if(ln){ln.style.left=ax+'px';ln.style.top=ay+'px';ln.style.width=Math.max(0,L-r)+'px';ln.style.transform=`rotate(${Math.atan2(my-ay,mx-ax)}rad)`;}});}
function miniSetup(){const mi=$('#mini'),img=$('#bg');if(!mi)return;
 const place=()=>{const hu=$('.hud'),pb=$('#pause'),a=app.getBoundingClientRect();let top=0;
  const r=(img.naturalWidth||2560)/(img.naturalHeight||720);const w=Math.round(Math.min(app.clientWidth*0.46,200));
  /* aðeins það sem er beint fyrir ofan smákortið (hægra megin) ýtir því niður – HUD-línur vinstra megin gera það ekki, annars lendir kortið ofan á merkjum */
  const mL=a.right-8-w;[pb,$('#sndbtn')].concat(hu?[...hu.children]:[]).forEach(e=>{if(e){const q=e.getBoundingClientRect();if(q.height&&q.right>mL-4)top=Math.max(top,q.bottom-a.top);}});mi.style.width=w+'px';mi.style.height=Math.round(w/r)+'px';mi.style.top=Math.round(top+6)+'px';miniMarks(mi);apply();};
 img.complete&&img.naturalWidth?place():img.addEventListener('load',place);
 let down=null;const go=(e,anim)=>{const r=mi.getBoundingClientRect();const pct=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));
  if(anim)panTo(pct,()=>{},true);else{const t=$('#track'),p=$('#pano');cancelAnimationFrame(pan.raf);pan.x=Math.max(pan.min,Math.min(0,p.clientWidth/2-t.offsetWidth*pct/100));apply();}};
 mi.addEventListener('pointerdown',e=>{e.stopPropagation();closePop();down={x:e.clientX,id:e.pointerId,moved:false};try{mi.setPointerCapture(e.pointerId);}catch(_){} });
 mi.addEventListener('pointermove',e=>{if(!down||e.pointerId!==down.id)return;if(Math.abs(e.clientX-down.x)>4)down.moved=true;if(down.moved)go(e,false);});
 mi.addEventListener('pointerup',e=>{if(!down)return;const d=down;down=null;if(!d.moved)go(e,true);});
 mi.addEventListener('pointercancel',()=>{down=null;});
 mi.addEventListener('click',e=>e.stopPropagation());}
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
 const i=$('#panI'),p=$('#pano'),mv=$('#mview');if(p){const TW=t.offsetWidth||1,W=p.clientWidth,w=Math.max(10,W/TW*100),l=Math.min(100-w,Math.max(0,-pan.x/TW*100));
  if(i){i.style.width=w+'%';i.style.left=l+'%';}if(mv){const w2=Math.min(100,W/TW*100);mv.style.width=w2+'%';mv.style.left=Math.min(100-w2,Math.max(0,-pan.x/TW*100))+'%';}}}
/* færir víðmynd þannig að staður (% af breidd) lendi á skjástað `at` (hlutfall af breidd, sjálfgefið miðja). force: færa alltaf */
function panTo(pct,cb,force,at){const t=$('#track'),p=$('#pano');if(!t||!p||pan.fit){cb();return;}cancelAnimationFrame(pan.raf);
 const W=p.clientWidth,TW=t.offsetWidth,x0=pan.x,f=at===undefined?0.5:at,tgt=Math.max(pan.min,Math.min(0,W*f-TW*pct/100));
 const sx=TW*pct/100+x0;if(!force&&sx>W*0.22&&sx<W*0.78){cb();return;}if(Math.abs(tgt-x0)<1){cb();return;}
 const t0=performance.now(),D=380;const step=now=>{const k=Math.min(1,(now-t0)/D),e=1-Math.pow(1-k,3);pan.x=x0+(tgt-x0)*e;apply();if(k<1)pan.raf=requestAnimationFrame(step);else cb();};
 pan.raf=requestAnimationFrame(step);}
window.__pan=pan;

/* ---------- skúffa sem er dregin upp ---------- */
const SNAP=['closed','half','full'];
function snapY(s){const d=$('#drawer');if(!d)return 0;const H=d.offsetHeight,A=app.clientHeight,g=$('#grab').offsetHeight;
 return s==='full'?0:s==='half'?Math.max(0,H-A*0.5):H-g;}
/* st.dy: tímabundin lækkun opinnar skúffu svo talblaðra eða spjald komist fyrir ofan hana (null = í smellustöðu).
   Skúffan lokast aldrei sjálfkrafa við val eða tal – hún heldur stöðu og skrunstað. */
function curY(){return st&&st.dy!=null?st.dy:snapY(st?st.drawer:'closed');}
const grabLbl=s=>s==='closed'?'Dragðu upp – aðgerðir':'Dragðu niður til að loka';
function drawerHtml(body){return `<div class="drawer glass" id="drawer" data-state="${st.drawer}"><button class="grab" id="grab" aria-label="Aðgerðir – dragðu upp"><span class="bars"><b></b><b></b><b></b></span><span class="lbl">${grabLbl(st.drawer)}</span></button><div class="dbody" id="dbody">${body}</div><div class="more" id="more" aria-hidden="true">▼ Fleira fyrir neðan – skrunaðu</div></div>`;}
/* skrunsvæðið nær nákvæmlega að neðri brún skjás í hverri stöðu, svo alltaf sé hægt að skruna að síðasta valkosti */
function sizeBody(y){const d=$('#drawer'),sb=$('#dbody'),g=$('#grab'),mo=$('#more');if(!d||!sb)return;if(typeof y==='string')y=snapY(y);
 sb.style.height=Math.max(0,d.offsetHeight-y-g.offsetHeight)+'px';if(mo)mo.style.bottom=y+'px';moreHint();}
function moreHint(){const sb=$('#dbody'),mo=$('#more');if(!sb||!mo)return;const more=st.drawer!=='closed'&&sb.scrollTop+sb.clientHeight<sb.scrollHeight-6;mo.classList.toggle('on',more);}
function moveDrawer(y,anim){const d=$('#drawer');if(!d)return;if(!anim){d.classList.add('drag');}d.style.transform=`translate3d(0,${y}px,0)`;if(!anim){d.offsetHeight;d.classList.remove('drag');}d.dataset.y=Math.round(y);sizeBody(y);}
function drawerSetup(){const d=$('#drawer'),g=$('#grab');if(!d)return;moveDrawer(curY(),false);
 const sb=$('#dbody');if(sb&&st.scroll&&st.scroll[st.tab])sb.scrollTop=st.scroll[st.tab];if(sb)sb.addEventListener('scroll',()=>{st.scroll[st.tab]=sb.scrollTop;moreHint();},{passive:true});moreHint();
 let s=null;
 g.addEventListener('pointerdown',e=>{s={y:e.clientY,y0:curY(),t:performance.now(),ly:e.clientY,lt:performance.now(),v:0,moved:false,id:e.pointerId};});
 const gm=e=>{if(!s||e.pointerId!==s.id)return;const dy=e.clientY-s.y;if(!s.moved&&Math.abs(dy)>8){s.moved=true;d.classList.add('drag');try{g.setPointerCapture(e.pointerId);}catch(_){} }
  if(s.moved){const now=performance.now();s.v=0.8*((e.clientY-s.ly)/Math.max(1,now-s.lt))+0.2*s.v;s.ly=e.clientY;s.lt=now;
   const y=Math.max(0,Math.min(snapY('closed'),s.y0+dy));d.style.transform=`translate3d(0,${y}px,0)`;}};
 const up=e=>{if(!s)return;const was=s;s=null;d.classList.remove('drag');
  if(!was.moved){setDrawer(st.drawer==='closed'?'half':'closed');return;}
  const cur=Math.max(0,Math.min(snapY('closed'),was.y0+(e.clientY-was.y)));const proj=cur+was.v*150;
  let best='closed',bd=1e9;SNAP.forEach(k=>{const dd=Math.abs(snapY(k)-proj);if(dd<bd){bd=dd;best=k;}});setDrawer(best);};
 window.onpointermove=e=>{gm(e);pm(e);};window.onpointerup=e=>{up(e);pu(e);};window.onpointercancel=e=>{up(e);pu(e);};}
function setDrawer(s){st.drawer=s;st.dy=null;const d=$('#drawer');if(d){d.dataset.state=s;moveDrawer(snapY(s),true);
 const l=$('#grab .lbl');if(l)l.textContent=grabLbl(s);}}
window.__setDrawer=s=>setDrawer(s);
/* rými fyrir spjald/blöðru af hæð h fyrir ofan skúffuna. Skúffan er aðeins lækkuð ef blaðran kemst annars ekki fyrir,
   og aldrei meira en svo að hún sjáist áfram (minnst ~30% skjás). Skilar neðri mörkum fyrir spjaldið. */
function roomFor(h){const d=$('#drawer');if(!d)return app.clientHeight-8;const A=app.clientHeight,H=d.offsetHeight,g=$('#grab').offsetHeight;
 if(st.drawer==='closed'){if(st.dy!=null){st.dy=null;moveDrawer(snapY('closed'),true);}return A-H+snapY('closed')-8;}
 const yS=snapY(st.drawer),need=topLimit()+h+16,minVis=Math.min(H-yS,Math.max(g+150,A*0.3));
 const y=Math.max(yS,Math.min(H-minVis,need-(A-H)));
 if(Math.abs(y-curY())>0.5){st.dy=y>yS+0.5?y:null;moveDrawer(y,true);}
 return A-H+y-8;}
function restoreDrawer(){if(st&&st.dy!=null){st.dy=null;if($('#drawer'))moveDrawer(snapY(st.drawer),true);}}

/* ---------- spjöld og talblöðrur á myndinni ---------- */
function closePop(){const o=$('#ov');if(o)o.innerHTML='';app.classList.remove('popon');}
function dismissPop(){closePop();restoreDrawer();}
function fitH(el,h,bottom,topMin){if(h>bottom-topMin){el.style.maxHeight=Math.max(80,bottom-topMin)+'px';el.style.overflowY='auto';return el.offsetHeight;}return h;}
function popOpen(){const o=$('#ov');return!!(o&&o.firstChild);}
/* kind: 'card' (vísbending/niðurstaða) eða 'bubble' (talblaðra). ax,ay = skjáhnit staðarins sem bent er á (eða null = efst á mynd) */
function showPop(html,kind,ax,ay,gap){const o=$('#ov');if(!o)return;
 const el=document.createElement('div');el.className='pop '+kind;el.innerHTML=html+'<div class="close-hint">Pikkaðu til að loka</div><i class="tail"></i>';
 el.addEventListener('click',e=>{e.stopPropagation();dismissPop();});if(ax==null){el.classList.add('top');el.querySelector('.tail').remove();}o.appendChild(el);app.classList.add('popon');
 const W=app.clientWidth,topMin=topLimit();const w=el.offsetWidth;let h=el.offsetHeight;const bottom=roomFor(h);h=fitH(el,h,bottom,topMin);const tail=el.querySelector('.tail');
 el.dataset.bottom=Math.round(bottom);
 if(ax==null){el.style.left=Math.round((W-w)/2)+'px';el.style.top=topMin+'px';return el;}
 gap=gap||18;let left=Math.max(10,Math.min(W-10-w,ax-w/2)),top,dir;
 if(ay-gap-h>=topMin){top=ay-gap-h;dir='down';}else if(ay+gap+h<=bottom){top=ay+gap;dir='up';}
 else{top=Math.max(topMin,Math.min(bottom-h,ay-gap-h));dir='none';}
 el.style.left=Math.round(left)+'px';el.style.top=Math.round(top)+'px';
 if(dir==='none')tail.remove();else{tail.classList.add(dir);tail.style.left=Math.round(Math.max(14,Math.min(w-30,ax-left-9)))+'px';}
 return el;}
function anchorXY(xp,yp){const t=$('#track'),a=app.getBoundingClientRect();if(!t)return[null,null];const r=t.getBoundingClientRect();return[r.left-a.left+r.width*xp/100,r.top-a.top+r.height*yp/100];}
function batchHtml(items){return items.map(i=>`<p class="ln ${i.cls}">${esc(i.t)}</p>`).join('');}
function flushBatch(){const b=st.batch||[];st.batch=null;if(b.length){closePop();showPop(batchHtml(b),'card',null,null);}}
function isTreated(){return all(sc.images.treatedWhen||['flag:t_dyna','flag:t_hylja']);}
function speakerOf(k){if(view!=='close')return null;const L=(isTreated()&&sc.close.speakersTreated)||sc.close.speakers;return L?L[k]:null;}
function topLimit(){const a=app.getBoundingClientRect();let t=56;['.hud','#pause','#sndbtn'].forEach(q=>{const e=$(q);if(e){const r=e.getBoundingClientRect();if(r.height)t=Math.max(t,r.bottom-a.top);}});return t+6;}
/* talblaðra frá persónu: alltaf fyrir ofan höfuðið (sp.y = efsta brún höfuðs). Ef ekki er pláss fyrir ofan fer hún til hliðar við höfuðið (sp.side),
   og aðeins ef það gengur ekki heldur nær hún niður yfir persónuna. Ef persónan er ekki á myndinni birtist blaðran efst. */
function speak(speaker,say,reply,note,extra){const sp=speakerOf(speaker);
 const html=`${say?`<div class="say">Þú: „${esc(say)}“</div>`:''}<div class="who">${esc(sp?sp.name:speaker==='felagi'?(sc.felagiName||'Félaginn'):sc.patient.name)}</div><div class="reply">${esc(reply)}</div>${note?`<div class="note">${esc(note)}</div>`:''}${extra&&extra.length?`<div class="events">${batchHtml(extra)}</div>`:''}`;
 closePop();
 if(!sp){showPop(html,'bubble',null,null);return;}
 const o=$('#ov');const el=document.createElement('div');el.className='pop bubble';el.style.visibility='hidden';el.innerHTML=html+'<div class="close-hint">Pikkaðu til að loka</div><i class="tail"></i>';
 el.addEventListener('click',e=>{e.stopPropagation();dismissPop();});o.appendChild(el);app.classList.add('popon');
 const W=app.clientWidth,H=app.clientHeight,topMin=topLimit(),gap=14;const ay=anchorXY(sp.x,sp.y)[1];
 const mode=(ay-gap-el.offsetHeight>=topMin)?'above':'side';const side=sp.side||'right';
 setTimeout(()=>panTo(sp.x,()=>{if(!el.isConnected)return;placeBubble(el,sp,mode,side,topMin,gap);},mode==='side',mode==='side'?(side==='right'?0.2:0.8):undefined),60);}
/* blaðran er alltaf í lausa svæðinu fyrir ofan skúffuna (aldrei undir henni); hali aðeins ef hann bendir á sýnilegan stað */
function placeBubble(el,sp,mode,side,topMin,gap){const W=app.clientWidth;const[ax,ay]=anchorXY(sp.x,sp.y);const tail=el.querySelector('.tail');
 const off=Math.round(app.clientHeight*(sp.r||0.045));let place=mode,bottom;
 if(mode==='side'){const avail=Math.min(320,side==='right'?W-(ax+off)-8:(ax-off)-8);
  if(avail>=150){el.style.maxWidth=avail+'px';let h=el.offsetHeight;const w=el.offsetWidth;bottom=roomFor(h);h=fitH(el,h,bottom,topMin);const top=Math.max(topMin,Math.min(bottom-h,ay-6));
   el.style.left=Math.round(side==='right'?ax+off:ax-off-w)+'px';el.style.top=Math.round(top)+'px';
   if(ay<bottom){tail.classList.add(side==='right'?'left':'right');tail.style.top=Math.round(Math.max(10,Math.min(h-30,ay+off*0.7-top)))+'px';}else tail.remove();}
  else place='over';}
 if(place!=='side'){let h=el.offsetHeight;const w=el.offsetWidth;bottom=roomFor(h);h=fitH(el,h,bottom,topMin);let top=place==='above'?ay-gap-h:topMin;top=Math.max(topMin,Math.min(bottom-h,top));
  el.style.left=Math.round(Math.max(10,Math.min(W-10-w,ax-w/2)))+'px';el.style.top=Math.round(top)+'px';
  if(top+h<=ay+2&&ay<bottom+8){tail.classList.add('down');tail.style.left=Math.round(Math.max(14,Math.min(w-30,ax-parseFloat(el.style.left)-9)))+'px';}else tail.remove();}
 el.dataset.place=place;el.dataset.ax=Math.round(ax);el.dataset.ay=Math.round(ay);el.dataset.bottom=Math.round(bottom);el.style.visibility='';}

/* ---------- sameiginlegt ---------- */
function hudHtml(){const pend=sc.resources.filter(r=>st.calls[r.id]).map(r=>{const c=st.calls[r.id];return `<span class="glass">${r.icon} ${c.arrived?'✓':Math.max(0,c.at+etaOf(r)-st.minute)+'′'}</span>`;}).join('');
 return `<div class="hud snd"><span class="glass">⏱ ${st.minute} mín</span>${view!=='distance'?gaugeHtml()+`<span class="glass" title="${esc((sc.hud&&sc.hud.title)||'')}">${severe()?'⚠️':(sc.hud&&sc.hud.icon)||'🥶'} ${P().filter(h=>st.addressed[h.id]).length}/${P().length}</span>`:''}${pend}</div>${sndBtnHtml()}<button class="pausebtn glass" id="pause" aria-label="Hlé – valmynd">⏸</button>`;}
function radioBody(){return `<p class="muted">Þú ert björgunarsveitarmaður á vettvangi. Staðsetning: ${esc(sc.location.label)}. ${st.radioMate?'📻 '+esc(st.radioMate)+' sér um fjarskiptin – köll taka ekki tíma frá þér.':'Hvert kall tekur 1 mín.'}</p>
 ${sc.resources.map(r=>{const c=st.calls[r.id];return `<button data-call="${r.id}" ${c?'disabled class="done"':''}><div class="res"><span class="ic">${r.icon}</span><div><b>${esc(r.label)}</b>${c?` ✓ ${c.arrived?'á staðnum':'kemur eftir ~'+Math.max(0,c.at+etaOf(r)-st.minute)+' mín'}`:` <span class="m">· áætl. ${etaOf(r)} mín</span>`}<small>${esc(r.role)}</small></div></div></button>`;}).join('')}`;}
function logBody(){return `<div class="log">${st.log.slice().reverse().map(l=>`<p class="${l.cls}">${esc(l.t)}</p>`).join('')||'<p class="muted">Ekkert enn.</p>'}</div>`;}
function tabsHtml(tabs){return `<div class="tabs">${tabs.map(g=>`<button data-t="${g.id}" class="${st.tab===g.id?'on':''}">${esc(g.label)}</button>`).join('')}</div>`;}
/* merki: (h.x,h.y) er nákvæmi staðurinn sem á að skoða. Númerið situr til hliðar svo það hylji ekki fólk/hluti (h.off=[dx,dy] í px frá staðnum,
   annars sjálfgefin hliðrun á ská upp, frá næsta jaðri) og örmjó lína með punkti bendir á staðinn. h.moff = sama fyrir smákortið. */
function offOf(h){if(Array.isArray(h.off))return h.off;return[h.x>70?-32:32,h.y<20?30:-30];}
function moffOf(h){if(Array.isArray(h.moff))return h.moff;const[dx,dy]=offOf(h),L=Math.hypot(dx,dy)||1;return[+(dx/L*11).toFixed(1),+(dy/L*11).toFixed(1)];}
function hotsHtml(list,seen){return list.map((h,i)=>{const[dx,dy]=offOf(h),L=Math.hypot(dx,dy),c=seen.includes(h.id)?' seen':'';
 const ln=L>16?`<i class="hl" style="width:${(L-14).toFixed(1)}px;transform:rotate(${Math.atan2(dy,dx).toFixed(4)}rad)"></i><i class="hd"></i>`:'';
 return `<div class="hs${c}" data-hs="${h.id}" style="left:${h.x}%;top:${h.y}%">${ln}<button class="hot${c}" style="left:${dx}px;top:${dy}px" data-h="${h.id}" aria-label="${esc(h.label)}"><span>${i+1}</span></button></div>`;}).join('');}
function screen(img,key,startPct,hots,body,fit,list,seen){app.classList.remove('popon');
 app.innerHTML=(fit?fitHtml(img,hots):panHtml(img,hots,list,seen))+hudHtml()+(st.swipeHint&&!fit?`<div class="swipehint">⟵ strjúktu til að líta í kringum þig ⟶</div>`:'')+drawerHtml(body)+'<div id="ov"></div>';
 if(fit)fitSetup();else{panSetup(key,startPct);miniSetup();}drawerSetup();
 $('#pause').onclick=e=>{e.stopPropagation();pauseMenu();};bindSndBtn();
 $$('[data-t]').forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;st.dy=null;render();});
 $$('[data-call]').forEach(b=>b.onclick=()=>{const r=sc.resources.find(x=>x.id===b.dataset.call);const rm=st.radioMate;st.calls[r.id]={at:st.minute+(rm?0:1),phase:view};
  st.batch=[];log((rm?'📻 '+rm+' kallar eftir: ':'📻 Kallað eftir: ')+r.label+'. „'+sc.location.callText+'“ Áætlaður komutími ~'+etaOf(r)+' mín.','info');if(rm)tick(0);else tick(1);result();});}
function result(){render();flushBatch();checkSurprise();}
function hotClick(list,seenArr){$$('[data-h]').forEach(b=>b.onclick=e=>{e.stopPropagation();const h=list.find(x=>x.id===b.dataset.h);if(!seenArr.includes(h.id))seenArr.push(h.id);
 if(st.swipeHint){st.swipeHint=false;const sh=$('.swipehint');if(sh)sh.remove();}
 st.log.push({t:'['+st.minute+' mín] '+h.label+': '+h.text,cls:''});b.classList.add('seen');if(b.parentElement)b.parentElement.classList.add('seen');app.querySelectorAll(`[data-mh="${h.id}"],[data-md="${h.id}"],[data-ml="${h.id}"]`).forEach(x=>x.classList.add('seen'));
 const r=b.getBoundingClientRect(),a=app.getBoundingClientRect();closePop();
 showPop(`<div class="who">${esc(h.label)}</div><div>${esc(h.text)}</div>`,'card hotcard',r.left-a.left+r.width/2,r.top-a.top+r.height/2,30);
 const n=$('#seenN');if(n)n.textContent=st.seen.length;});}
/* pikk utan spjalds lokar því (en gleypir ekki pikkið) */
/* pikk í skúffunni lokar spjaldi en heldur skúffunni kyrri (svo pikkið hitti hnappinn); pikk á myndina skilar skúffunni í fyrri stöðu */
app.addEventListener('pointerdown',e=>{if(popOpen()&&!e.target.closest('.pop')){if(e.target.closest('#drawer'))closePop();else dismissPop();}},true);
function render(){({distance,close,debrief})[view]();if(view==='debrief')SND.stopAll();else sndScene();}

/* ---------- aðalvalmynd, nafn, val á aðstæðum ---------- */
function bgHtml(s1){SND.stopAll();const s0=s1||S.find(x=>x.type!=='fjoldaslys')||S[0];return `<div class="pano"><div class="fitbg cover" style="background-image:url('${s0?s0.images.distance:''}')"></div></div>`;}
function sndLbl(){return soundOn()?'🔊 Hljóð: á':'🔇 Hljóð: af';}
function mainMenu(){view='menu';const name=store.get('fh-nafn','').trim();const inGame=st&&st.report===null&&sc&&sc.type!=='fjoldaslys';const x=FX.xp(),rk=FX.rankOf(x);
 app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass" id="mainm"><h1>Fyrsta hjálp</h1><div class="muted">Þjálfunarleikur fyrir björgunarsveitarfólk · útgáfa ${VER}</div>${name?`<p class="hi">Hæ, ${esc(name)}! <button class="rkchip" id="rkchip">${rk.ic} ${esc(rk.t)} · ${x} XP</button></p>`:''}
 <button class="primary" id="nyr">Nýr leikur</button>${inGame?`<button id="afram">Halda áfram: ${esc(sc.title)}</button>`:''}
 <button id="dagleg">📅 Dagleg áskorun <span class="m">· ${esc(dayLabel(today()))}</span></button><button id="sagab">📖 Sögusería: ${esc(SERIES.title)}${seriesSaved()?' <span class="m">· 2. hluti bíður</span>':''}</button>
 <button id="vika">🏆 Sveitakeppni vikunnar</button><button id="ferill">🎖️ Ferill og merki</button><button id="smaleikir">🎯 Smáleikir</button>
 <div class="row2"><button id="leid">Leiðbeiningar</button><button id="snd">${sndLbl()}</button></div><button id="nafnbtn">${name?'✎ Breyta notandanafni':'✎ Velja notandanafn'}</button></div></div>`;
 const need=fn=>()=>store.get('fh-nafn','').trim()?fn():nameScreen(fn);
 $('#nyr').onclick=need(newGame);$('#nafnbtn').onclick=()=>nameScreen('menu');if(inGame)$('#afram').onclick=()=>{view=st.view||'distance';render();};$('#leid').onclick=()=>help(mainMenu);$('#smaleikir').onclick=need(openMini);
 $('#dagleg').onclick=need(dailyScreen);$('#sagab').onclick=need(seriesScreen);$('#vika').onclick=need(weeklyScreen);$('#ferill').onclick=careerScreen;if($('#rkchip'))$('#rkchip').onclick=careerScreen;
 $('#snd').onclick=()=>{SND.set(!soundOn());mainMenu();};}
/* notandanafn: slegið inn fyrir fyrsta leik, geymt í localStorage (fh-nafn), hægt að breyta úr aðalvalmynd */
const cleanName=v=>String(v||'').replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
function openMini(){view='mini';app.classList.remove('dist','close');if(window.FHMINI)window.FHMINI.open({app,esc,store,sendResult,rid,deviceId,cleanName,VER,bgHtml,mainMenu,FX,teamName});}
function nameScreen(next){view='name';if(typeof next!=='function')next=(next==='menu'||next==='mini')?next:'pick';const cur=store.get('fh-nafn','').trim();
 app.innerHTML=bgHtml()+`<div class="full menu"><form class="card glass" id="nf"><h1>${cur?'Breyta notandanafni':'Veldu notandanafn'}</h1><p class="muted">Notandanafnið birtist í leiknum og fylgir niðurstöðum hvers borðs svo þjálfarinn geti fylgst með framförum. Það er geymt í þessu tæki og þú getur breytt því hvenær sem er í aðalvalmynd.</p>
 <input id="nafn" type="text" maxlength="24" autocomplete="nickname" autocapitalize="words" spellcheck="false" placeholder="Notandanafn" aria-label="Notandanafn" value="${esc(cur)}"><p class="no" id="nerr" hidden>Notandanafnið þarf að vera minnst 2 stafir.</p>
 <button class="primary" type="submit" id="nok">${next==='menu'?'Vista':'Áfram'}</button><button type="button" id="nback">← Til baka</button></form></div>`;
 $('#nf').onsubmit=e=>{e.preventDefault();const v=cleanName($('#nafn').value);if(v.length<2){$('#nerr').hidden=false;return;}store.set('fh-nafn',v);$('#nafn').blur();window.scrollTo(0,0);typeof next==='function'?next():next==='menu'?mainMenu():next==='mini'?openMini():newGame();};
 $('#nback').onclick=mainMenu;}
const TRACKS=[{n:1,title:'Fyrsta hjálp 1',sub:'Grunnur skyndihjálpar á vettvangi'},{n:2,title:'Fyrsta hjálp 2',sub:'Lengri bið, kuldi, flutningur og óöruggur vettvangur'},{n:3,title:'Wilderness First Responder',sub:'Lengra komnir – WFR'}];
function trackName(n){const t=TRACKS.find(x=>x.n===n);return t?t.title:'';}
function pickScreen(tr){view='pick';
 if(tr&&!TRACKS.some(t=>t.n===tr))tr=null;
 if(!tr){
  app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass"><h1>Veldu braut</h1><p class="muted">${esc(nafn())}, þú ert björgunarsveitarmaður á vettvangi.</p>
 <p class="modeline">${modeLabel(nextMode)} <button class="linkbtn" id="chmode">Breyta</button></p>
 ${TRACKS.map(t=>{const n=S.filter(s=>s.track===t.n).length;const lk=n&&!FX.unlocked(t.n);return `<button class="trackbtn${n&&!lk?' primary':''}${lk?' locked':''}" data-t="${t.n}"${n?'':' disabled aria-disabled="true"'}><b>${lk?'🔒 ':''}${esc(t.title)}</b><span>${n?(lk?`Opnast við tignina ${esc(lockRank(t.n).t)} (${FX.TRACK_XP[t.n]} XP) – eða opnaðu ef þú ert á námskeiðinu`:`${esc(t.sub)} · ${n} aðstæður`):'Væntanlegt'}</span></button>`;}).join('')}
 <button id="pback">← Aðalvalmynd</button></div></div>`;$('#chmode').onclick=modeScreen;
  $$('[data-t]').forEach(b=>b.onclick=()=>pickScreen(+b.dataset.t));$('#pback').onclick=mainMenu;return;}
 if(!FX.unlocked(tr)){lockScreen(tr);return;}
 const L=S.filter(s=>s.track===tr);const S3=FX.starsAll();
 app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass"><button id="tback" class="tback">← Brautir</button><h1>${esc(trackName(tr))}</h1><p class="muted">Veldu aðstæður.</p>
 ${L.length?`<div class="scards">${L.map(s=>`<button class="scard" data-s="${s.id}"><span class="thumb"><img loading="lazy" decoding="async" src="${esc(s.thumb||(s.images&&s.images.close)||'')}" alt="" width="480" height="270"></span><span class="sct"><b>${esc(s.title)}</b>${s.short?`<span>${esc(s.short)}</span>`:''}<span class="sst">${stars3(S3[s.id]||0)}</span></span></button>`).join('')}</div>`:'<p class="empty">Væntanlegt – engar aðstæður komnar á þessa braut enn.</p>'}
 <button id="pback">← Aðalvalmynd</button></div></div>`;
 $$('[data-s]').forEach(b=>b.onclick=()=>start(b.dataset.s,{mode:nextMode}));$('#tback').onclick=()=>pickScreen();$('#pback').onclick=mainMenu;}
const HELP=[
 ['Markmið','Þú ert björgunarsveitarmaður á vettvangi. Vinndu eftir þríhyrningakerfinu: vettvangur kannaður, frumskoðun, sjúkrasaga og líkamsskoðun – og veittu svo rétta meðferð.'],
 ['Myndin','Pikkaðu á rauðu númeruðu merkin til að skoða vísbendingar. Textinn birtist við merkið; pikkaðu á skjáinn til að loka. Nærmyndir eru víðmyndir: strjúktu til hliðar til að líta í kringum þig.'],
 ['Skúffan ☰','Dragðu skúffuna upp eða pikkaðu á handfangið til að velja aðgerðir. Flipar fylgja þríhyrningakerfinu. Svör sjúklings og félaga birtast í talblöðrum á myndinni, niðurstöður sem spjöld.'],
 ['Tíminn ⏱','Hver aðgerð tekur tíma og ástand sjúklings breytist með tímanum. Bregstu hratt við og endurmettu reglulega (flipinn Endurmat birtist þegar meðferð hefst).'],
 ['📻 Aðstoð','Kallaðu eftir þeirri aðstoð sem ástandið og flutningurinn krefjast. Hvert kall tekur 1 mín og aðstoðin kemur eftir áætlaðan komutíma.'],
 ['Ákvörðun','Þegar skoðun og meðferð er lokið ákveður þú flutning. Þá færðu samantekt, stig og SAGA-skráningu. 📜 Skrá geymir allt sem hefur gerst.'],
 ['🎯 Smáleikir','Stuttar æfingar úr aðalvalmyndinni: skammstafanir, lífsmörk, röð skrefa, hraðaspurningar, SAGA-skráning, taktur í hjartahnoði og stutt tilfelli. Hver leikur gefur stig af 100.'],
 ['🎒 Taskan','Áður en þú leggur af stað pakkarðu í töskuna (6 pláss). Það sem er ekki í töskunni geturðu ekki notað fyrr en aðstoð kemur með meiri búnað.'],
 ['❤️ Ástand','Mælirinn efst sýnir ástand sjúklings og hvert stefnir. Ef þú hikar líður tíminn samt, og röng aðgerð gerir illt verra.'],
 ['👥 Teymi','Í „Vinna með teymi“ færðu tvo félaga. Feldu þeim verk í flipanum Teymi – þau vinna á meðan þú sinnir öðru.'],
 ['⭐ Ferill','Þú færð 1–3 stjörnur, merki og XP fyrir hverjar aðstæður. Með XP hækkarðu í tign og opnar Fyrstu hjálp 2 og WFR. Fyrsta hjálp 1 er alltaf opin.'],
 ['📅 Áskoranir','Dagleg áskorun er sú sama fyrir alla í dag. Í sveitakeppni vikunnar safnarðu stigum fyrir björgunarsveitina þína. Með „Áskoraðu vin“ sendirðu vini sömu aðstæður.'],
 ['🔊 Hljóð','Hnappurinn efst slekkur og kveikir á hljóðum (vindur, andardráttur, sírenur).'],
 ['⏸ Hlé','Hnappurinn efst í horninu opnar valmynd: halda áfram, byrja upp á nýtt, velja aðrar aðstæður eða fara í aðalvalmynd.']];
function help(back){const prev=app.querySelector('.overlay');
 const html=`<div class="card glass"><h1>Leiðbeiningar</h1>${HELP.map(([k,v])=>`<div class="step"><b>${esc(k)}</b><div>${esc(v)}</div></div>`).join('')}<button class="primary" id="hback">Til baka</button></div>`;
 if(view==='menu'){app.innerHTML=bgHtml()+`<div class="full menu">${html}</div>`;$('#hback').onclick=back;return;}
 const o=document.createElement('div');o.className='overlay full';o.innerHTML=html;if(prev)prev.remove();app.appendChild(o);$('#hback').onclick=()=>{o.remove();back();};}
function pauseMenu(){closePop();const o=document.createElement('div');o.className='overlay full';o.id='pausem';
 o.innerHTML=`<div class="card glass"><h1>Hlé</h1><div class="muted">${esc(sc.title)} · ⏱ ${st.minute} mín</div>
 <button class="primary" id="p_cont">▶ Halda áfram</button><button id="p_restart">↺ Byrja upp á nýtt</button><button id="p_pick">Velja aðrar aðstæður</button><button id="p_main">Aðalvalmynd</button><button id="p_help">Leiðbeiningar</button><button id="p_snd">${sndLbl()}</button></div>`;
 app.appendChild(o);const q=s=>o.querySelector(s);
 q('#p_cont').onclick=()=>o.remove();q('#p_restart').onclick=()=>start(sc.id,restartOpts());q('#p_pick').onclick=()=>{const t=sc.track;abandon();st=null;pickScreen(t);};
 q('#p_main').onclick=()=>{st.view=view;mainMenu();};q('#p_help').onclick=()=>{o.remove();help(pauseMenu);};
 q('#p_snd').onclick=()=>{SND.set(!soundOn());o.remove();pauseMenu();sndScene();const sb=$('#sndbtn');if(sb)sndBtnSync(sb);};}
/* niðurstöðufærsla fyrir tölfræðina */
function record(finished,sco){const m=M(),sev=severe();
 const val=m.valueText?' '+m.valueText.replace('{v}',st.temp.toFixed(m.decimals!==undefined?m.decimals:1)):'';
 return{id:rid(),played_at:new Date().toISOString(),username:(cleanName(store.get('fh-nafn',''))||'nafnlaus'),scenario_id:String(sc.id).slice(0,60),scenario_title:String(sc.title||'').slice(0,120),
  track:(Number.isInteger(sc.track)&&sc.track>=0&&sc.track<=9)?sc.track:null,score:finished?Math.max(0,Math.min(100,sco.total)):null,finished:!!finished,duration_s:Math.max(0,Math.min(86400,Math.round((Date.now()-st.t0)/1000))),game_minutes:Math.max(0,Math.min(1000,Math.round(st.minute||0))),
  lost:finished?sco.losses.slice(0,40).map(l=>({label:String(l.label).slice(0,160),pts:l.pts})):[],
  outcome:((sev?(m.severeLabel||'alvarlegt ástand'):(m.mildLabel||'stöðugt ástand'))+val).slice(0,200),patient_stable:!sev,
  decision:st.report?String(st.report.label).slice(0,200):null,version:VER,device_id:deviceId(),...runFields(finished?sco.total:null)};}
const started=()=>!!(st&&sc&&!st.report&&!st.sent&&(st.minute>0||st.seen.length>0));
/* borð yfirgefið (byrja upp á nýtt, velja annað, loka síðunni) */
function abandon(){try{if(started()){st.sent=true;sendResult(record(false));}}catch(_){}}
window.addEventListener('pagehide',()=>{try{if(started()&&statsOn()){st.sent=true;const r=record(false);const q=qLoad();q.push(r);qSave(q);post(r,true);}}catch(_){}});
function start(id,o){abandon();o=Object.assign({},o||{});const s0=S.find(s=>s.id===id);if(!s0){mainMenu();return;}
 if(!o.mode)o.mode=nextMode||'einn';if(!Number.isInteger(o.seed))o.seed=hash(id+':'+Date.now()+':'+Math.random())%2147483647;
 if(s0.type==='fjoldaslys'){sc=s0;st=null;run=o;view='triage';if(window.FHTRIAGE)window.FHTRIAGE.start(s0,triageApi(),o);else mainMenu();return;}
 if(!o.bagDone){if(window.FH_TASKA==='allt')o=Object.assign({},o,{bag:GEAR.map(g=>g.id),bagDone:true});else{bagScreen(id,o);return;}}
 sc=s0;run=o;st={t0:Date.now(),chSel:{},sent:false,dy:null,minute:0,temp:M().start,flags:Object.assign({},sc.startFlags||{}),flagAt:{},fired:{},addressed:{},addressedAt:{},seen:[],seenClose:[],calls:{},log:[],score:[],report:null,
 tab:'vettvangur_d',drawer:'closed',pan:{},scroll:{},swipeHint:true,reassess:[],lastVitals:null,treatStart:null,batch:null,
 bag:(o.bag||[]).slice(),bagLeft:(o.bag||[]).slice(),used:[],etaAdd:{},tHist:{},idle:0,hes:0,delegated:0,team:null,radioMate:null,surp:null,surpGood:false,moodBand:'',moodT:0,moodI:0};view='distance';
 st.tHist[0]=st.temp;if(o.mode==='teymi')st.team=teamFor(sc,o.seed);if(o.carry)applyCarry(o.carry);
 const intro=o.intro||sc.intro;
 log(fill(intro),'');render();showPop(`<div class="who">${o.series?'📖 '+esc(SERIES.title)+' · '+o.series.part+'. hluti – ':''}${esc(sc.title)}</div><div>${esc(fill(intro))}</div>${st.team?`<div class="note">👥 Teymið þitt: ${esc(st.team[0].name)} og ${esc(st.team[1].name)}. Feldu þeim verk í flipanum „👥 Teymi“ á vettvangi.</div>`:''}${st.carryNote?`<div class="note">📖 ${esc(st.carryNote)}</div>`:''}<div class="note">Pikkaðu á merkin á myndinni og dragðu svo skúffuna upp til að velja hvað þú gerir.</div>`,'card',null,null);}

/* ---------- fjarlægð ---------- */
function distance(){const d=sc.distance;
 const tabs=[{id:'vettvangur_d',label:'Vettvangur'}].concat(st.team?[{id:'teymi',label:'👥 Teymi'}]:[],[{id:'adstod',label:'📻 Aðstoð'},{id:'skra',label:'📜 Skrá'}]);
 const body=st.tab==='adstod'?radioBody():st.tab==='skra'?logBody():st.tab==='teymi'&&st.team?teamBody(true):
  `<p class="muted">Pikkaðu á merkin á myndinni (<span id="seenN">${st.seen.length}</span>/${d.hotspots.length} könnuð).</p><h3>Hvað gerirðu?</h3>${d.approach.map(a=>`<button data-a="${a.id}">${esc(a.label)}</button>`).join('')}`;
 screen(sc.images.distance,'distance',50,hotsHtml(d.hotspots,st.seen),tabsHtml(tabs)+body,d.fit);
 hotClick(d.hotspots,st.seen);bindTeam();
 $$('[data-a]').forEach(b=>b.onclick=()=>{const a=d.approach.find(x=>x.id===b.dataset.a);st.batch=[];
  /* goodWhen: nálgunin er aðeins rétt ef skilyrðin eru uppfyllt (t.d. búið að kalla á lögreglu); waitFor: beðið þar til aðstoð er komin */
  const ok=!a.goodWhen||all(a.goodWhen);const txt=ok?a.text:a.badText,pts=ok?a.score:a.badScore;setF(ok?a.flag:(a.badFlag||a.flag));(a.flags||[]).forEach(setF);
  let mins=a.minutes;if(a.waitFor){const c=st.calls[a.waitFor],r=sc.resources.find(x=>x.id===a.waitFor);mins=Math.max(mins,c?(c.arrived?0:c.at+etaOf(r)-st.minute):(a.noCallMinutes||mins));}
  st.score.push({label:'Nálgun: '+a.label,points:pts,kind:'approach',text:txt});log(txt,pts>0?'good':'bad');tick(mins);view='close';st.tab=sc.close.groups[0].id;st.swipeHint=true;render();flushBatch();});}

/* ---------- nærmynd ---------- */
function treating(){return st.treatStart!==null;}
function close(){const c=sc.close;const treated=isTreated();const hots=(treated&&c.hotspotsTreated)||c.hotspots||[];
 const short=l=>l.replace(/^\d\.\s*/,'').replace('Sjúkrasaga og líkamsskoðun','Saga og skoðun').replace('Vettvangur kannaður','Vettvangur');
 let tabs=c.groups.map(g=>({id:g.id,label:short(g.label)}));if(st.team)tabs.push({id:'teymi',label:'👥 Teymi'});if(treating())tabs.push({id:'endurmat',label:'🔁 Endurmat'});
 tabs=tabs.concat([{id:'tilkynna',label:'Ákvörðun'},{id:'adstod',label:'📻 Aðstoð'},{id:'skra',label:'📜 Skrá'}]);
 if(st.tab==='endurmat'&&!treating())st.tab=c.groups[0].id;
 let body;
 if(st.tab==='adstod')body=radioBody();else if(st.tab==='skra')body=logBody();else if(st.tab==='endurmat')body=reassessBody();else if(st.tab==='teymi'&&st.team)body=teamBody();
 else if(st.tab==='tilkynna')body=`<p class="muted">Þegar skoðun og meðferð er lokið: ákveddu flutning.</p><h3>Hvað gerirðu núna?</h3>${sc.report.options.map(o=>`<button data-r="${o.id}">${esc(o.label)}</button>`).join('')}`;
 else body=(c.groupIntro&&c.groupIntro[st.tab]?`<p class="muted">${esc(c.groupIntro[st.tab])}</p>`:'')+(()=>{const ta=c.actions.filter(a=>a.group===st.tab),cd={};return ta.map(a=>{if(a.choice){if(cd[a.choice])return '';cd[a.choice]=1;return choiceHtml(a.choice,ta.filter(x=>x.choice===a.choice));}const gOk=st.flags[a.flag]||hasGear(a);return `<button data-x="${a.id}" class="${st.flags[a.flag]?'done':''}${gOk?'':' nogear'}" ${(st.flags[a.flag]&&!a.speaker&&!a.repeatable)||!gOk?'disabled':''}>${st.flags[a.flag]?'✓ ':''}${a.speaker?'💬 ':''}${esc(a.label)}${a.minutes?` <span class="m">· ${a.minutes} mín</span>`:''}${gOk?'':' <span class="gmiss">🎒 Ekki í töskunni</span>'}</button>`;}).join('');})();
 screen(treated?sc.images.treated:sc.images.close,'close',sc.pan.closeStart,hotsHtml(hots,st.seenClose),tabsHtml(tabs)+body,false,hots,st.seenClose);
 hotClick(hots,st.seenClose);
 $$('[data-x]').forEach(b=>b.onclick=()=>act(c.actions.find(a=>a.id===b.dataset.x)));
 $$('[data-co]').forEach(b=>b.onclick=()=>{if(b.disabled||choiceDone(b.dataset.cg))return;st.chSel[b.dataset.cg]=b.dataset.co;render();const sb=$('#dbody'),gr=$(`.matgrp[data-cgrp="${b.dataset.cg}"]`);if(sb&&gr){const d=gr.getBoundingClientRect().bottom-(sb.getBoundingClientRect().bottom-44);if(d>0)sb.scrollTop+=d;}});
 $$('[data-chno]').forEach(b=>b.onclick=()=>{delete st.chSel[b.dataset.chno];render();});
 $$('[data-chok]').forEach(b=>b.onclick=()=>{const g=b.dataset.chok,id=st.chSel[g];delete st.chSel[g];const a=c.actions.find(x=>x.id===id&&x.choice===g);if(a&&!choiceDone(g))act(a);else render();});
 $$('[data-ra]').forEach(b=>b.onclick=()=>reassessAct(b.dataset.ra));bindTeam();
 $$('[data-r]').forEach(b=>b.onclick=()=>{const o=sc.report.options.find(x=>x.id===b.dataset.r);let pts,txt;
  let q;if(o.goodWhen&&all(o.goodWhen)){pts=15;q='good';txt=o.goodText;}else if(o.okWhen&&all(o.okWhen)){pts=8;q='ok';txt=o.okText;}else{pts=-10;q='bad';txt=o.badText;}
  st.report={id:o.id,label:o.label,pts,txt,q,best:(sc.report.options.find(x=>x.goodWhen&&all(x.goodWhen))||{}).label||''};log('Ákvörðun: '+o.label,pts>0?'good':'bad');view='debrief';render();});}
/* setning sem birtist í talblöðru fer aðeins í atburðaskrá, ekki í st.batch – annars birtist svarið tvisvar í blöðrunni */
function logSay(t){st.log.push({t:'['+st.minute+' mín] '+t,cls:''});}
function address(ids){(ids||[]).forEach(s=>{if(!st.addressed[s]){st.addressed[s]=true;st.addressedAt[s]=st.minute;}});}
/* v0.6: valhópur („veldu eitt“) – aðgerðir með "choice":"lykill"; close.choices[lykill] gefur titil o.fl. Læsist þegar ein er staðfest. */
function choiceDone(g){return sc.close.actions.find(a=>a.choice===g&&st.flags[a.flag]);}
function choiceHtml(g,acts){const C=(sc.close.choices||{})[g]||{};const title=C.title||'Veldu eitt',ch=choiceDone(g);st.chSel=st.chSel||{};const sel=ch?null:st.chSel[g];
 const opt=(a,cls,extra,dis)=>`<button class="opt ${cls}" role="radio" aria-checked="${cls==='sel'||cls==='chosen'}" data-co="${a.id}" data-cg="${g}"${dis?' disabled aria-disabled="true"':''}><span class="rd" aria-hidden="true"></span><span class="tx"><b>${esc(a.label)}</b>${a.sub?`<small>${esc(a.sub)}</small>`:''}</span>${extra||''}</button>`;
 const head=`<div class="mh">${C.icon?C.icon+' ':''}${esc(title)} <span class="eitt">${ch?'VALIÐ':'VELDU EITT'}</span></div>`;
 if(ch)return `<div class="matgrp locked" role="radiogroup" aria-disabled="true" aria-label="${esc(title)}" data-cgrp="${g}">${head}<div class="lnote">🔒 <span>${esc(C.locked||'Valið hefur verið staðfest – ekki er hægt að breyta því.')}</span></div>${acts.map(a=>a===ch?opt(a,'chosen',`<span class="tag">${esc(C.yours||'Þitt mat')}</span>`):opt(a,'off','<span class="lk" aria-hidden="true">🔒</span>',true)).join('')}</div>`;
 return `<div class="matgrp" role="radiogroup" aria-label="${esc(title)}" data-cgrp="${g}">${head}${C.note?`<p class="ms">${esc(C.note)}</p>`:''}${acts.map(a=>opt(a,a.id===sel?'sel':'')).join('')}${sel?`<div class="conf"><button class="primary" data-chok="${g}">${esc(C.confirm||'Staðfesta mat')}</button><button class="sec" data-chno="${g}">Hætta við</button></div>`:''}</div>`;}
function act(a,o){o=o||{};const mate=o.by||null;if(a.choice&&choiceDone(a.choice))return;if(!st.flags[a.flag]&&!hasGear(a)){render();return;}const sev=severe();const wasDone=!!st.flags[a.flag];setF(a.flag);let txt=a.text,pts=a.score||0,cls='',fix=a.fix||'';st.batch=[];
 if((a.group==='medferd'||a.treat)&&st.treatStart===null)st.treatStart=st.minute;
 if(a.speaker){let sp=a.speaker,reply=fill(a.reply),pre='';const ca=sc.patient.cantAnswer;
  if(sev&&sp==='sjuklingur'&&!(sc.patient.canAlways||['tala']).includes(a.id)&&ca!==false){sp='felagi';pre=(ca||'('+sc.patient.name+' getur ekki svarað skýrt – félaginn svarar)')+' ';}
  if(sev&&a.replySevere&&sp==='sjuklingur')reply=fill(a.replySevere);
  const say=a.say?fill(a.say):'';logSay((say?'Þú: „'+say+'“ ':'')+(sp==='felagi'?(sc.felagiName||'Félaginn')+': ':sc.patient.name+': ')+pre+reply+(a.note?' ('+a.note+')':''));
  tick(a.minutes);const extra=st.batch;st.batch=null;render();speak(sp,say,pre+reply,a.note,extra);return;}
 if(a.rule){const r=sc.close[a.rule];const ok=all(r.goodWhen);txt=ok?r.goodText:r.badText;pts=ok?r.goodScore:r.badScore;if(!ok&&r.fix)fix=r.fix;
  if(!ok&&r.retry){delete st.flags[a.flag];delete st.flagAt[a.flag];}if(ok&&r.okFlag)setF(r.okFlag);if(!ok&&r.badFlag)setF(r.badFlag);if(a.addresses&&(ok||r.addressAlways))address(a.addresses);}
 else if(a.requiresMild&&sev){txt=a.severeText;pts=a.severeScore;st.flags.drinkSevere=true;}
 else if(a.addresses)address(a.addresses);
 if(a.id==='lifsmork'||a.vitals)st.lastVitals={min:st.minute,temp:st.temp};
 if(wasDone&&a.repeatable)pts=0;
 if(pts){st.score.push({label:(a.choice?(((sc.close.choices||{})[a.choice]||{}).title||'Val')+': ':'Aðgerð: ')+a.label,points:pts,kind:'act',choice:a.choice||undefined,group:a.group,text:fill(txt),fix});cls=pts>0?'good':'bad';}
 if(!wasDone)consume(a);if(mate){st.delegated++;mate.busy=st.minute+Math.max(1,a.minutes||1);mate.task=a.label;}
 log((mate?'👥 '+mate.name+': ':'')+fill(txt),cls);if(pts<0&&fix)st.log[st.log.length-1].fix=fix;if(pts>0)SND.fx('good');
 if(a.arrestIf&&all(a.arrestIf))arrest(a.arrestText);
 if(pts<0&&!a.choice){SND.fx('bad');worsen(0.06);}
 tick(mate?0:a.minutes);
 result();}

/* ---------- endurmat ---------- */
function trendOf(prev){if(!prev)return null;const d=st.temp-prev.temp;const e=(M().trendEps!==undefined?M().trendEps:0.05);return d>e?'betra':d<-e?'verra':'óbreytt';}
function reassessBody(){const R=st.reassess,ra=sc.reassess;const last=R.filter(r=>r.kind==='vitals').slice(-1)[0];
 const since=last?st.minute-last.min:null;
 return `<p class="muted">Endurmettu reglulega eftir að meðferð hefst – oftar ef ástand er óstöðugt.${since!==null?` Síðasta mat lífsmarka: fyrir ${since} mín.`:' Lífsmörk ekki endurmetin enn.'}</p>
 <button data-ra="feel">💬 ${esc(ra.feelLabel||'Spyrja hvernig henni líður')} <span class="m">· 1 mín</span></button>
 <button data-ra="vitals">${esc(ra.vitalsLabel||'Endurmeta VÁSE og lífsmörk')} <span class="m">· 2 mín</span></button>
 <button data-ra="tx">${esc(ra.txLabel||'Athuga hvort meðferðin virkar')} <span class="m">· 1 mín</span></button>
 ${R.length?`<h3>Fyrri endurmöt</h3><div class="log">${R.slice().reverse().map(r=>`<p class="${r.trend==='betra'?'good':r.trend==='verra'?'bad':''}">[${r.min} mín] ${esc(r.label)}${r.trend?' – '+r.trend:''}</p>`).join('')}</div>`:''}`;}
function firstLine(groups){return(groups||[]).map(g=>{const x=g.find(l=>all(l.when));return x?fill(x.text):null;}).filter(Boolean);}
function reassessAct(k){const ra=sc.reassess;st.batch=[];const prevV=st.lastVitals;
 if(k==='feel'){tick(1);const tr=trendOf(st.lastFeel||prevV)||'óbreytt';st.lastFeel={temp:st.temp};
  let reply=severe()?ra.feel.severe:ra.feel[tr==='betra'?'better':tr==='verra'?'worse':'same'];
  if(!severe()){const open=P().filter(h=>!st.addressed[h.id]&&ra.complaints&&ra.complaints[h.id]);if(open.length)reply+=' '+ra.complaints[open[0].id];}
  reply=fill(reply);const who=severe()&&ra.feelSevereBy==='felagi'?'felagi':'sjuklingur';
  st.reassess.push({min:st.minute,kind:'feel',label:'Líðan spurð',trend:null});
  logSay('Þú: „'+ra.feelSay+'“ '+(who==='felagi'?(sc.felagiName||'Félaginn'):sc.patient.name)+': '+reply);
  /* svarið birtist aðeins í blöðrunni; dökki kassinn sýnir bara annað sem gerðist á meðan (t.d. komu aðstoðar) */
  const extra=st.batch;st.batch=null;render();speak(who,ra.feelSay,reply,null,extra);return;}
 if(k==='vitals'){tick(2);const b=band();const tr=trendOf(prevV);st.lastVitals={min:st.minute,temp:st.temp};
  const txt=`Endurmat lífsmarka: VÁSE: ${b.VASE} · P: ${b.P} · Ö: ${b.O} · BÞ: ${b.BTH} · L: ${b.L} · H: ${b.H} · ${b.shiver}. `+(tr?`Miðað við fyrra mat: ${tr.toUpperCase()}.`:'Fyrsta mat – ekkert til samanburðar.');
  st.reassess.push({min:st.minute,kind:'vitals',label:'Lífsmörk og VÁSE',trend:tr});log(txt,tr==='betra'?'good':tr==='verra'?'bad':'info');result();return;}
 if(k==='tx'){tick(1);const tr=trendOf(st.lastTx||prevV);st._trend=tr;st.lastTx={temp:st.temp};const b=band();
  const lines=P().map(h=>(st.addressed[h.id]?'✓ ':'✗ ')+h.label.split(' (')[0]+': '+ra.sources[h.id][st.addressed[h.id]?0:1]);
  lines.push(allSources()?'✓ '+(ra.allText||'Hitatap stöðvað.'):'✗ '+(ra.notAllText||'Hitatap ekki stöðvað að fullu.'));
  lines.push(severe()?(ra.statusSevere||'Ástand alvarlegt.'):(ra.statusPrefix!==undefined?ra.statusPrefix:'Skjálfti: ')+(b.shiver||'óbreytt').toLowerCase()+'.');
  firstLine(ra.lines).forEach(l=>lines.push(l));
  st.reassess.push({min:st.minute,kind:'tx',label:'Meðferð athuguð',trend:tr});
  log('Er meðferðin að virka? '+lines.join(' '),allSources()?'good':'bad');
  st.batch=st.batch.map(x=>x.t.startsWith('Er meðferðin')?{t:'Er meðferðin að virka?',cls:'h'}:x);
  const evs=st.batch;st.batch=null;render();showPop(batchHtml(evs)+lines.map(l=>`<p class="ln ${l[0]==='✓'?'good':l[0]==='✗'?'bad':''}">${esc(l)}</p>`).join(''),'card',null,null);return;}}

/* ---------- mat á aðstoð ---------- */
function resJudge(){const items=[];let ok=true;
 sc.resources.forEach(r=>{const c=st.calls[r.id];let pts=0,txt,cls='ok';
  if(r.needWhen&&r.needWhen.length&&all(r.needWhen)){const by=r.strictCallBy?r.callBy:severe()?Math.max(r.callBy||99,(st.severeAt||0)+5):99;
   if(!c){ok=false;cls='no';pts=-r.needPoints;txt='Ekki kallað. '+r.needText;}
   else if(r.callBy&&c.at>by){ok=false;cls='no';pts=Math.round(r.needPoints/2);txt='Kallað of seint (mín '+c.at+', átti að vera fyrir mín '+by+'). '+r.needText;}
   else{pts=r.needPoints||0;txt='Kallað í tæka tíð (mín '+c.at+'). '+r.needText;}}
  else if(c&&any(r.unneededWhen)){ok=false;cls='no';pts=r.unneededPoints;txt='Kallað (mín '+c.at+'). '+r.unneededText;}
  else{txt=c?'Kallað (mín '+c.at+'). '+(r.calledNeutralText||r.neutralText||''):'Ekki kallað. '+(r.neutralText||'');}
  if(c)txt+=c.arrived?' Kom á mín '+c.arrived+'.':' Ekki komin(n) í lok leiks.';
  items.push({r,pts,txt,cls});});
 return{ok,items};}
function saga(){const b=band();const g=sc.saga||{};const pick=list=>(list||[]).filter(l=>any(l.when)).map(l=>fill(l.text));
 const S1=pick(g.S);const A=pick(g.A);
 const RV=st.reassess.filter(r=>r.kind==='vitals');if(RV.length)A.push('Endurmat lífsmarka '+RV.length+'× ('+RV.map(r=>'mín '+r.min+(r.trend?': '+r.trend:'')).join(', ')+').');
 const G=[severe()?g.Gsevere:g.Gmild].concat(pick(g.G)).filter(Boolean);
 const Ap=[];sc.close.actions.filter(a=>(a.group==='medferd'||a.treat)&&st.flags[a.flag]&&!(a.score<0)).forEach(a=>Ap.push(a.sagaText?fill(a.sagaText):a.label));
 sc.resources.forEach(r=>{if(st.calls[r.id])Ap.push('Kallað eftir: '+r.label+' (mín '+st.calls[r.id].at+')');});if(st.report)Ap.push(st.report.label);
 return [['S – Saga sjúklings',S1.join(' ')||'Ekki skráð.'],['A – Athuganir',A.join(' ')||'Ekki skráð.'],['G – Greining',G.join(' ')||'Ekki skráð.'],['A – Áætlun',Ap.join('; ')||'Ekki skráð.']];}

/* ---------- stig: 100 skiptist á matsliði og ákvörðun; röng/hættuleg aðgerð dregur frá ---------- */
function apportion(ws,total){const sum=ws.reduce((s,w)=>s+w,0)||1;const ex=ws.map(w=>w/sum*total);const fl=ex.map(Math.floor);let rest=total-fl.reduce((s,x)=>s+x,0);
 ex.map((x,i)=>[x-fl[i],i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]).forEach(([_,i])=>{if(rest>0){fl[i]++;rest--;}});return fl;}
function scoring(){const rj=resJudge();const rows=sc.debrief.map(r=>({r,ok:all(r.ok)}));
 const repW=sc.reportPoints||15;const w=apportion(rows.map(x=>x.r.points).concat([repW]),100);
 rows.forEach((x,i)=>x.w=w[i]);const wRep=w[w.length-1];const losses=[];
 rows.forEach(x=>{if(x.ok)return;let what=x.r.badText,todo=x.r.fix||x.r.rule;
  if(x.r.ok.includes('resourcesOk')){const bad=rj.items.filter(i=>i.cls==='no');what=bad.map(i=>i.r.icon+' '+i.r.label+': '+i.txt).join(' ')||what;}
  if(x.r.id==='safe'){const ap=st.score.find(s=>s.kind==='approach');if(ap)what='Þú valdir: „'+ap.label.replace('Nálgun: ','')+'“. '+ap.text;}
  losses.push({label:x.r.label,pts:x.w,what,todo});});
 const rp=st.report;const keepRep=rp.q==='good'?wRep:rp.q==='ok'?Math.floor(wRep/2):0;
 if(keepRep<wRep)losses.push({label:'Ákvörðun um flutning',pts:wRep-keepRep,what:'Þú valdir: „'+rp.label+'“. '+rp.txt,todo:rp.best?'Besta ákvörðunin miðað við ástandið: „'+rp.best+'“.':(sc.report.fix||'Ljúka fyrst skoðun og meðferð og velja svo: „'+((sc.report.options.find(x=>x.goodWhen&&!x.goodWhen.includes('severe'))||sc.report.options[0]).label)+'“.')});
 st.score.filter(s=>s.kind==='act'&&s.points<0).forEach(s=>losses.push({label:s.choice?s.label:'Röng aðgerð: '+s.label.replace('Aðgerð: ',''),pts:Math.max(1,Math.round(-s.points/2)),what:s.text,todo:s.fix||''}));
 losses.sort((a,b)=>b.pts-a.pts);let room=100;losses.forEach(l=>{l.full=l.pts;l.pts=Math.min(l.pts,room);room-=l.pts;});
 const lost=losses.reduce((s,l)=>s+l.pts,0);return{rows,rj,losses:losses.filter(l=>l.pts>0||l.full>0),total:100-lost,lost};}

/* ---------- samantekt ---------- */
function debrief(){const sco=scoring();const{rows,rj,losses,total}=sco;
 if(!st.award){const badges=sceneBadges(sco);if(run.series&&run.series.part===SERIES.parts.length)badges.push('saga');st.award=endAward({sid:sc.id,track:sc.track,score:total,badges});if(run.series)seriesStep(total);}
 const aw=st.award;
 const praise=total>=100?'Fullt hús':total>=90?'Frábærlega gert':total>=70?'Vel gert':total>=40?'Ágætis tilraun':'Þetta þarf að æfa betur';
 const m=M();const stateTxt=severe()?`<span class="no">${esc(m.severeLabel||'alvarlegt ástand')}</span>`:`<span class="ok">${esc(m.mildLabel||'stöðugt ástand')}</span>`;
 const val=m.valueText?' '+esc(m.valueText.replace('{v}',st.temp.toFixed(m.decimals!==undefined?m.decimals:1))):'';
 const miss=losses.length?`<div class="card glass missing" id="missing"><h2>Hvað vantaði upp á 100?</h2><p class="muted">${losses.length} ${losses.length===1?'atriði kostaði':'atriði kostuðu'} samtals <b>${sco.lost} stig</b> (100 − ${total}). Stærstu atriðin fyrst.</p>
  ${losses.map(l=>`<div class="lost"><div class="lh"><b>${esc(l.label)}</b><span class="lp">−${l.pts}</span></div>${l.what?`<div class="lw">✗ ${esc(l.what)}</div>`:''}${l.todo?`<div class="lt">✓ Rétt: ${esc(l.todo)}</div>`:''}${l.full>l.pts?`<div class="r">(${l.full} stig, en stig fara ekki undir 0)</div>`:''}</div>`).join('')}</div>`
  :`<div class="card glass missing perfect" id="missing"><h2>Ekkert vantaði upp á 100! 🎉</h2><p>Frábært, ${esc(nafn())}: öruggur vettvangur, kerfisbundin skoðun, rétt meðferð samkvæmt námsefninu, rétt aðstoð á réttum tíma og góð ákvörðun um flutning. Svona á að gera þetta.</p></div>`;
 app.innerHTML=bgHtml()+`<div class="full"><div class="card glass"><h1>Samantekt</h1><div class="muted">${esc(sc.title)} · ${esc(nafn())}</div><div class="score">${total}/100</div><p><b>${praise}, ${esc(nafn())}!</b></p><p>Tími: ${st.minute} mín · ${stateTxt}${val}</p>
 <p><b>Ákvörðun:</b> ${esc(st.report.label)}<br><span class="${st.report.q==='good'?'ok':'no'}">${esc(st.report.txt)}</span></p></div>
 ${awardHtml(aw)}${friendCard(total)}${challengeCard()}${seriesCard()}
 ${miss}
 ${timelineHtml(st.log)}
 <div class="card glass"><h3>Mat eftir skrefum</h3>${rows.map(x=>`<div class="step"><div><b>${esc(x.r.label)}</b> <span class="${x.ok?'ok':'no'}">${x.ok?x.w:0}/${x.w}</span></div><div class="${x.ok?'ok':'no'}">${x.ok?'✓ ':'✗ '}${esc(x.ok?x.r.okText:x.r.badText)}</div><div class="r">${esc(x.r.rule)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>📻 Aðstoð – val og tímasetning</h3>${rj.items.map(x=>`<div class="step"><b>${x.r.icon} ${esc(x.r.label)}</b> <span class="${x.cls}">${x.cls==='no'?'✗':'✓'}</span><div class="${x.cls}">${esc(x.txt)}</div></div>`).join('')}</div>
 ${bagCard()}${teamCard()}
 <div class="card glass"><h3>SAGA skráning</h3>${saga().map(([k,v])=>`<div class="step"><b>${k}</b><div>${esc(v)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>Einstakar ákvarðanir</h3><table>${st.score.map(s=>`<tr><td>${esc(s.label)}</td><td class="${s.points>0?'ok':'no'}">${s.points>0?'✓':'✗'}</td></tr>`).join('')}</table></div>
 ${shareHtml(total)}<button class="primary" id="again">↺ Spila aftur</button><button id="other">Velja aðrar aðstæður</button><button id="tomenu">Aðalvalmynd</button></div>`;
 window.__score={total,lost:sco.lost,losses:losses.map(l=>({label:l.label,pts:l.pts}))};
 if(!st.sent){st.sent=true;try{sendResult(record(true,sco));}catch(_){}}
 bindEnd(sc,total);$('#again').onclick=()=>start(sc.id,restartOpts());$('#other').onclick=()=>{st=null;pickScreen(sc.track);};$('#tomenu').onclick=()=>{st=null;mainMenu();};}
window.addEventListener('resize',()=>{if(st&&['distance','close'].includes(view)&&!app.querySelector('.overlay'))render();});
window.addEventListener('error',e=>{console.error(e.message)});
/* ==================== v0.7: taska, teymi, ástand, uppákomur, ferill, áskoranir, sögusería ==================== */
const SND=window.FHSND||{on:()=>false,set(v){store.set('fh-hljod',v?'a':'af');},setAmb(){},setBreath(){},fx(){},stopAll(){},state:()=>({})};
const FX=window.FHX;
const MODES=['einn','teymi','vinur'];
let run={mode:'einn'};let nextMode=MODES.includes(store.get('fh-hamur','einn'))?store.get('fh-hamur','einn'):'einn';
function hash(s){let h=2166136261;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=(seed>>>0)||1;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function etaOf(r){return Math.max(1,r.eta+((st&&st.etaAdd&&st.etaAdd[r.id])||0));}
function modeLabel(m){return m==='teymi'?'👥 Vinna með teymi':m==='vinur'?'🤝 Spila með vin':'🧍 Vinna einn';}
function stars3(n){return `<span class="stars" aria-label="${n} af 3 stjörnum">${[1,2,3].map(i=>`<span class="st${i<=n?' on':''}">★</span>`).join('')}</span>`;}
function lockRank(t){return FX.RANKS.find(r=>r.track===t)||FX.RANKS[1];}
function jget(k,d){try{const v=JSON.parse(store.get(k,''));return v&&typeof v==='object'?v:d;}catch(_){return d;}}

/* ---------- hljóð ---------- */
function sndBtnHtml(){const on=soundOn();return `<button class="sndbtn glass${on?'':' off'}" id="sndbtn" aria-label="Hljóð ${on?'á – slökkva':'af – kveikja'}" aria-pressed="${on}">${on?'🔊':'🔇'}</button>`;}
function sndBtnSync(b){const on=soundOn();b.textContent=on?'🔊':'🔇';b.classList.toggle('off',!on);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label','Hljóð '+(on?'á – slökkva':'af – kveikja'));}
function bindSndBtn(){const b=$('#sndbtn');if(!b)return;b.addEventListener('pointerdown',e=>e.stopPropagation());b.onclick=e=>{e.stopPropagation();SND.set(!soundOn());sndBtnSync(b);lastBreath='';sndScene();};}
let lastBreath='';
function sndScene(){if(!sc||!st||!['distance','close'].includes(view)){SND.stopAll();lastBreath='';return;}
 SND.setAmb(sc.ambience||'gola');let cfg=null;
 if(view==='close'&&!st.report&&!st.flags.arrest){const b=band();const r=parseInt(String(b.O||''),10);if(r>0)cfg={rate:r,rough:severe()||/hvæs|óregl/i.test(String(b.O)),vol:severe()?0.7:0.45};}
 const k=JSON.stringify(cfg)+soundOn();if(k!==lastBreath){lastBreath=k;SND.setBreath(cfg);}}
function arriveFx(r,had){SND.fx(r.id==='thyrla'?'thyrla':(r.id==='sjukrabill'||r.id==='logregla')?'sirena':'radio');
 if(st.bag&&run.bagDone&&!had&&gearCame())log('🎒 Meiri búnaður er kominn á staðinn ('+r.label+') – nú er allur búnaður tiltækur.','info');}

/* ---------- taskan ---------- */
const GEAR=[
 {id:'dyna',ic:'🟦',t:'Einangrunardýna',d:'Undir sjúkling – stöðvar hitatap í jörð'},
 {id:'alteppi',ic:'🪙',t:'Álteppi / hitateppi',d:'Létt – hylur og ver gegn hitatapi'},
 {id:'vindpoki',ic:'⛺',t:'Vindpoki / neyðarskýli',d:'Skjól fyrir vindi og bleytu'},
 {id:'svefnpoki',ic:'🛌',t:'Svefnpoki og húfa',d:'Hylur allan líkamann og höfuð'},
 {id:'hitapokar',ic:'🔥',t:'Hitapokar',d:'Á bringu, í handarkrika og á bak'},
 {id:'orka',ic:'🍫',t:'Heitur drykkur og orka',d:'Brúsi með heitum, sykruðum drykk og orkustykki'},
 {id:'snarv',ic:'🩸',t:'Snarvöndull',d:'Lífshættuleg blæðing á útlim'},
 {id:'umbudir',ic:'🩹',t:'Sáraumbúðir og þrýstiumbúðir',d:'Sár og blæðingar'},
 {id:'spelka',ic:'🦴',t:'Spelka',d:'Stuðningur við brot – yfir liðina ofan og neðan við'},
 {id:'kaelipoki',ic:'🧊',t:'Kælipoki',d:'Bólga og tognun'},
 {id:'hofudljos',ic:'🔦',t:'Höfuðljós',d:'Myrkur og lítið skyggni'},
 {id:'vatn',ic:'💧',t:'Vatnsflaska',d:'Drykkur og skolun'},
 {id:'lyfjataska',ic:'💉',t:'Lyfjataska',d:'Adrenalínpenni og lyf – aðeins samkvæmt vinnureglum'}];
const NEED={dyna:['dyna','alteppi'],dyna_hratt:['dyna','alteppi'],einangra:['dyna','alteppi'],hlyja:['alteppi','svefnpoki','dyna'],hylja:['svefnpoki','alteppi'],vindheldi:['vindpoki'],
 hitapokar:['hitapokar'],drykkur:['orka'],snarv:['snarv'],snarv_rangt:['snarv'],umbudir:['umbudir'],spelka:['spelka'],stutt:['spelka'],teppi:['alteppi','svefnpoki'],kaelipoki:['kaelipoki'],
 vatn:['vatn','orka'],adr1:['lyfjataska'],adr2:['lyfjataska'],lyf:['lyfjataska']};
const KEEP=['lyfjataska'],NOUSE=['snarv_rangt','stutt','dyna_hratt'],SLOTS=6,GEAR_RES=['sjukrabill','bjorgunarsveit','thyrla'];
function needOf(a){return a.needs||NEED[a.id]||null;}
function gearCame(){return!!(st&&st.calls&&GEAR_RES.some(id=>st.calls[id]&&st.calls[id].arrived));}
function hasGear(a){if(!st||!st.bag||!run.bagDone)return true;const n=needOf(a);if(!n||gearCame())return true;return n.some(g=>st.bagLeft.includes(g));}
function consume(a){if(!st||!st.bag||!run.bagDone||NOUSE.includes(a.id))return;const n=needOf(a);if(!n||gearCame())return;const g=n.find(x=>st.bagLeft.includes(x));if(!g)return;
 if(!st.used.includes(g))st.used.push(g);if(!KEEP.includes(g))st.bagLeft.splice(st.bagLeft.indexOf(g),1);}
function gearIn(s){const ids=new Set();((s.close&&s.close.actions)||[]).forEach(a=>{const n=needOf(a);if(n)n.forEach(g=>ids.add(g));});return ids;}
function idealBag(s){const out=[];if(!s||!s.close)return out;s.close.actions.filter(a=>(a.score||0)>=0&&!NOUSE.includes(a.id)&&needOf(a)).forEach(a=>{const n=needOf(a);if(n.some(g=>KEEP.includes(g)&&out.includes(g)))return;const f=n.find(g=>!out.includes(g));if(f)out.push(f);});return out.slice(0,SLOTS);}
function seriesIdeal(){const out=[];SERIES.parts.forEach(id=>{const s=S.find(x=>x.id===id);if(!s)return;s.close.actions.filter(a=>(a.score||0)>=0&&!NOUSE.includes(a.id)&&needOf(a)).forEach(a=>{const n=needOf(a);const f=n.find(g=>!out.includes(g));if(f)out.push(f);});});return out.slice(0,SLOTS);}
const GI=id=>GEAR.find(g=>g.id===id)||{id,ic:'',t:id,d:''};
function bagScreen(id,o){view='bag';const s=S.find(x=>x.id===id);const med=s.track===3||gearIn(s).has('lyfjataska');const list=GEAR.filter(g=>g.id!=='lyfjataska'||med);
 let sel=(Array.isArray(o.bag)?o.bag:(()=>{try{const v=JSON.parse(store.get('fh-taska','[]'));return Array.isArray(v)?v:[];}catch(_){return[];}})()).filter(g=>list.some(x=>x.id===g)).slice(0,SLOTS);
 app.classList.remove('dist','close');
 app.innerHTML=bgHtml(s)+`<div class="full menu"><div class="card glass" id="bag"><button class="tback" id="bback">← Til baka</button>
 <h1>🎒 Pakkaðu í töskuna</h1><p class="muted bagintro"><b>${esc(s.title)}</b> · ${esc(modeLabel(o.mode))}<br>Þú hefur ${SLOTS} pláss. Það sem er ekki í töskunni geturðu ekki notað fyrr en aðstoð kemur með meiri búnað.</p>
 ${o.series&&o.series.part===1?`<p class="note">📖 Taskan þarf að duga allan daginn – þú pakkar ekki aftur fyrir 2. hluta.</p>`:''}
 <div class="bagslots" id="slots"></div><p class="m">🧤 Hanskar og 📋 skráningarblað eru alltaf með.</p><p class="no" id="bfull" hidden>Taskan er full – taktu eitthvað úr henni fyrst.</p>
 <div class="gearlist">${list.map(g=>`<button class="gear" data-g="${g.id}" aria-pressed="false"><span class="gi">${g.ic}</span><span class="gt"><b>${esc(g.t)}</b><small>${esc(g.d)}</small></span><span class="gc"></span></button>`).join('')}</div>
 <button class="primary" id="bgo">▶ Leggja af stað</button></div></div>`;
 const sync=()=>{$('#slots').innerHTML=Array.from({length:SLOTS},(_,i)=>sel[i]?`<span class="slot on" title="${esc(GI(sel[i]).t)}">${GI(sel[i]).ic}</span>`:'<span class="slot"></span>').join('')+`<span class="sn">${sel.length}/${SLOTS}</span>`;
  $$('[data-g]').forEach(b=>{const on=sel.includes(b.dataset.g);b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));b.querySelector('.gc').textContent=on?'✓':'+';});
  $('#bgo').textContent=`▶ Leggja af stað (${sel.length}/${SLOTS} pláss)`;};
 sync();
 $$('[data-g]').forEach(b=>b.onclick=()=>{const g=b.dataset.g;const i=sel.indexOf(g);if(i>=0)sel.splice(i,1);else if(sel.length<SLOTS)sel.push(g);else{$('#bfull').hidden=false;return;}$('#bfull').hidden=true;sync();});
 $('#bback').onclick=()=>{o.challenge&&/^dagur-/.test(o.challenge)?dailyScreen():o.challenge&&/^vika-/.test(o.challenge)?weeklyScreen():o.series?seriesScreen():o.friend?mainMenu():pickScreen(s.track);};
 $('#bgo').onclick=()=>{store.set('fh-taska',JSON.stringify(sel));start(id,Object.assign({},o,{bag:sel.slice(),bagDone:true}));};}
function bagCard(){if(!st.bag||!run.bagDone)return'';const ideal=run.series?idealBag(sc):idealBag(sc);const miss=ideal.filter(g=>!st.bag.includes(g)&&!(g==='dyna'&&st.bag.includes('alteppi')&&false));
 const nm=g=>GI(g).ic+' '+esc(GI(g).t);const unused=st.bag.filter(g=>!st.used.includes(g));
 return `<div class="card glass" id="bagres"><h3>🎒 Taskan</h3><p>${st.bag.length?st.bag.map(nm).join(' · '):'Tóm taska.'}</p>
 ${miss.length?`<p class="no">Hefði komið að gagni: ${miss.map(nm).join(', ')}</p>`:'<p class="ok">✓ Allt sem þurfti var í töskunni.</p>'}${unused.length?`<p class="m">Ekki notað hér: ${unused.map(g=>esc(GI(g).t)).join(', ')}</p>`:''}${gearCame()?'<p class="m">Eftir að aðstoð kom var allur búnaður tiltækur.</p>':''}</div>`;}

/* ---------- teymi ---------- */
const MATES=['Anna','Bjarki','Dagný','Einar','Freyja','Gunni','Hrafnhildur','Ívar','Katla','Logi','Magga','Rúnar','Sólveig','Tumi'];
const TEAMOK=['hryggur','thrystingur','halda','lifsmork','dyna','einangra','hlyja','blautfot','vindheldi','hylja','hitapokar','teppi','timi','skra','senda','skipti','vegf','umbudir','vakt','leggja'];
function teamFor(s,seed){const r=rng((seed^hash(s.id))>>>0);const a=MATES.filter(n=>n!==s.felagiName);const out=[];while(out.length<2)out.push({name:a.splice(Math.floor(r()*a.length),1)[0],busy:0,task:''});return out;}
function mateFree(m){return st.minute>=m.busy&&m.name!==st.radioMate;}
function teamActs(){return sc.close.actions.filter(a=>!a.speaker&&!a.choice&&(TEAMOK.includes(a.id)||a.delegate)&&!st.flags[a.flag]&&hasGear(a));}
function teamBody(dist){const A=dist?[]:teamActs();
 return `<p class="muted">Feldu félögunum verk – þau vinna á meðan þú sinnir öðru, svo verkið tekur ekki tíma frá þér. Þú berð samt ábyrgð á því hvað er gert.</p>
 <div class="mates">${st.team.map(m=>`<div class="mate"><span class="mav">${esc(m.name[0])}</span><b>${esc(m.name)}</b> ${m.name===st.radioMate?'<span class="m">📻 sér um fjarskiptin</span>':mateFree(m)?'<span class="ok">laus</span>':`<span class="m">að vinna: ${esc(m.task)}</span>`}</div>`).join('')}</div>
 ${!st.radioMate?`<h3>Fjarskipti</h3>${st.team.map(m=>`<button data-dg="__radio" data-mate="${esc(m.name)}" ${mateFree(m)?'':'disabled'}>📻 ${esc(m.name)} sér um fjarskiptin við 112</button>`).join('')}`:''}
 ${dist?'<p class="m">Verkum á sjúklingnum geturðu falið félögunum þegar þið eruð komin að honum.</p>':`<h3>Verk</h3>${A.length?A.map(a=>`<div class="dgrow"><span class="dl">${esc(a.label)}</span><span class="dbs">${st.team.map(m=>`<button class="dgb" data-dg="${a.id}" data-mate="${esc(m.name)}" ${mateFree(m)?'':'disabled'}>→ ${esc(m.name)}</button>`).join('')}</span></div>`).join(''):'<p class="m">Ekkert verk sem félagarnir geta tekið að sér núna.</p>'}`}`;}
function bindTeam(){$$('[data-dg]').forEach(b=>b.onclick=()=>{if(!st.team)return;const m=st.team.find(x=>x.name===b.dataset.mate);if(!m||!mateFree(m))return;
 if(b.dataset.dg==='__radio'){st.radioMate=m.name;st.batch=[];log('👥 '+m.name+' tekur að sér fjarskiptin og kallar eftir aðstoð fyrir þig.','good');result();return;}
 const a=sc.close.actions.find(x=>x.id===b.dataset.dg);if(a)act(a,{by:m});});}
function teamCard(){if(!st.team)return'';return `<div class="card glass" id="teamres"><h3>👥 Teymið</h3><p>${esc(st.team.map(m=>m.name).join(' og '))} · ${st.delegated} ${st.delegated===1?'verk falið':'verk falin'}${st.radioMate?' · 📻 '+esc(st.radioMate)+' sá um fjarskiptin':''}.</p><p class="m">${st.delegated>=3?'✓ Góð verkaskipting – þú hélst yfirsýn á meðan félagarnir unnu.':'Í teymisvinnu borgar sig að fela félögum verk (t.d. stuðning við höfuð, einangrun, fjarskipti) og halda sjálf(ur) yfirsýn.'}</p></div>`;}

/* ---------- ástand: versnun, hik, mælir ---------- */
function loOf(m){return m.arrestBelow!==undefined?m.arrestBelow:m.min!==undefined?m.min:m.severeBelow-(m.start-m.severeBelow);}
function worsen(f){const m=M();const lo=loOf(m);const span=Math.abs(m.start-lo)||1;const was=severe();st.temp-=span*f;if(m.min!==undefined)st.temp=Math.max(st.temp,m.min);
 log('📉 Ástand sjúklingsins versnar við þetta.','bad');
 if(!was&&severe()){log(m.severeLog||'Ástand versnar!','bad');st.flags.becameSevere=true;st.severeAt=st.minute;}
 if(m.arrestBelow!==undefined&&st.temp<m.arrestBelow)arrest(m.arrestLog);if(st.tHist)st.tHist[st.minute]=st.temp;}
function trendSym(){const m=M();let p=null;for(let i=st.minute-3;i>=0;i--){if(st.tHist[i]!==undefined){p=st.tHist[i];break;}}if(p===null)return'→';const e=m.trendEps!==undefined?m.trendEps:0.05;const d=st.temp-p;return d>e?'↗':d<-e?'↘':'→';}
function gaugeHtml(){const m=M();if(st.flags.arrest)return `<span class="glass gauge r" id="gauge" aria-label="Ástand sjúklings: hjartastopp">❤️<span class="gb"><i style="width:3%"></i></span><b>!</b></span>`;
 const lo=loOf(m),hi=m.max!==undefined?Math.max(m.max,m.start):m.start;const p=Math.max(3,Math.min(100,Math.round((st.temp-lo)/((hi-lo)||1)*100)));const sv=Math.round((m.severeBelow-lo)/((hi-lo)||1)*100);
 const c=severe()?'r':p<sv+15?'y':'g';const tr=trendSym();const lbl=(c==='r'?'alvarlegt':c==='y'?'óstöðugt':'stöðugt')+(tr==='↗'?', batnar':tr==='↘'?', versnar':'');
 return `<span class="glass gauge ${c}" id="gauge" title="Ástand sjúklings: ${lbl}" aria-label="Ástand sjúklings: ${lbl}">❤️<span class="gb"><i style="width:${p}%"></i></span><b>${tr}</b></span>`;}
setInterval(()=>{try{if(!st||st.report||!['distance','close'].includes(view)||!sc||sc.type==='fjoldaslys')return;if(document.hidden||popOpen()||app.querySelector('.overlay')||!$('#drawer'))return;
 const lim=+(window.FH_IDLE_S!==undefined?window.FH_IDLE_S:45);st.idle=(st.idle||0)+1;
 if(lim>0&&st.idle>=lim){st.idle=0;st.hes++;st.batch=[];log('⏳ Þú hikaðir – mínúta leið án aðgerða og tíminn vinnur ekki með sjúklingnum.','bad');tick(1);result();return;}
 moodTick();}catch(e){console.error(e&&e.message);}},1000);
app.addEventListener('pointerdown',()=>{if(st)st.idle=0;},true);
/* tilfinningablöðrur: sjúklingur (eða félagi) segir hvernig honum líður – birtist við breytingu á ástandi og stöku sinnum */
function moodKey(){if(st.flags.arrest)return'bad';if(isTreated()&&!severe())return'treated';if(severe())return'bad';const m=M(),lo=loOf(m),hi=m.max!==undefined?Math.max(m.max,m.start):m.start;const p=(st.temp-lo)/((hi-lo)||1)*100,sv=(m.severeBelow-lo)/((hi-lo)||1)*100;return p<sv+15?'mid':'good';}
function moodTick(){const md=sc.moods;const old=$('#mood');if(view!=='close'||!md||(st.flags.arrest&&md.who!=='felagi')){if(old)old.remove();return;}
 if(popOpen()){if(old)old.remove();return;}
 const k=moodKey();st.moodT=(st.moodT||0)+1;
 if(old&&+old.dataset.t+4<=st.moodT)old.remove();
 if(k===st.moodBand&&st.moodT-(st.moodLast||0)<18)return;
 const L=md[k]||md.mid||[];if(!L.length)return;st.moodBand=k;st.moodLast=st.moodT;const line=L[(st.moodI++)%L.length];
 const who=(md.who&&md.who[k])||md.who||'sjuklingur';const name=who==='felagi'?(sc.felagiName||'Félaginn'):sc.patient.name;
 const ic={good:'🙂',mid:'😟',bad:'😰',treated:'😌'}[k];const e=document.createElement('div');e.className='mood '+k;e.id='mood';e.dataset.t=st.moodT;e.setAttribute('aria-live','polite');
 e.innerHTML=`<span class="me">${ic}</span><span><b>${esc(name)}:</b> „${esc(fill(line))}“</span>`;if(old)old.remove();app.appendChild(e);e.style.top=topLimit()+'px';}

/* ---------- óvæntar uppákomur ---------- */
function surpActive(){const f=window.FH_SURPRISE;if(f===0||f===false)return false;if(typeof f==='string')return true;return!!((FX.starsAll()[sc.id]||0)>=1||run.challenge||run.mode==='vinur'||(run.series&&run.series.part>=2));}
function surpData(k){const city=sc.ambience==='borg';const freeM=st.team?st.team.find(m=>mateFree(m)):null;let D;
 if(k==='seinkun')D={ic:'📻',radio:true,h:'Aðstoð tefst',t:'112 hér. Vegna færðar og annarra útkalla tefst aðstoðin um u.þ.b. 10 mínútur. Hvernig er staðan hjá ykkur?',fix:'Þegar aðstoð tefst: halda áfram meðferð, endurmeta oftar og gefa 112 stutta stöðulýsingu.',
  apply(){let any=false;sc.resources.forEach(r=>{const c=st.calls[r.id];if(c&&!c.arrived){st.etaAdd[r.id]=(st.etaAdd[r.id]||0)+10;any=true;}});if(!any)sc.resources.forEach(r=>{if(!st.calls[r.id])st.etaAdd[r.id]=(st.etaAdd[r.id]||0)+10;});log('📻 Aðstoðin tefst um ~10 mín.','info');},
  o:[{good:1,l:'Halda áfram meðferð, endurmeta oftar og gefa 112 stutta stöðulýsingu',min:1,r:'Rétt: þú heldur ró, hlúir áfram að sjúklingnum og lætur vita af breytingum. Lengri bið kallar á tíðara endurmat.'},
   {l:'Leggja af stað með sjúklinginn á móti aðstoðinni',min:3,p:-8,w:0.08,r:'Að bera sjúkling langa leið án búnaðar og mannskaps er áhættusamt, kælir hann og þreytir ykkur. Betra að hlúa að honum á staðnum þar til aðstoð kemur.'},
   {l:'Hringja aftur og aftur í 112 til að reka á eftir',min:3,p:-4,r:'Endurtekin símtöl flýta ekki aðstoðinni en taka tíma og athygli frá sjúklingnum.'}]};
 else if(k==='vedur')D={ic:'🌨️',h:'Veðrið versnar',t:'Það hvessir skyndilega og slydduél skellur á ykkur. Vindurinn bítur og bleytan eykst.',fix:'Í versnandi veðri: búa til skjól fyrir sjúklinginn strax og verja hann fyrir vindi og bleytu – og aldrei skilja hann eftir einan.',
  apply(){SND.fx('radio');},
  o:[{good:1,l:'Búa til skjól: snúa baki í vindinn og nota bakpoka og það sem þú hefur sem skjól fyrir sjúklinginn',min:2,r:'Rétt: skjól frá vindi og bleytu dregur verulega úr hitatapi. Verndaðu sjúklinginn – og sjálfan þig.'},
   {l:'Halda áfram eins og ekkert hafi í skorist',p:-6,w:0.08,r:'Vindur og bleyta auka hitatap hratt. Ástandið versnar þegar ekkert skjól er.'},
   {l:'Skilja sjúklinginn eftir og sækja meiri búnað',min:4,p:-6,w:0.05,r:'Skildu sjúkling ekki eftir einan nema brýna nauðsyn beri til. Notaðu það sem þú hefur á staðnum.'}]};
 else D={ic:'🧍',h:'Annar slasaður birtist',t:city?'Vegfarandi kemur að ykkur og heldur um höndina: „Ég skar mig þegar ég reyndi að hjálpa – það blæðir aðeins.“ Hann er vel áttaður og stendur sjálfur.':'Göngumaður kemur haltrandi að ykkur: „Ég datt líka þarna uppi – ég held ég hafi snúið ökklann!“ Hann er vel áttaður og gengur sjálfur.',
  fix:'Ef fleiri eru slasaðir: stutt frumskoðun, láta 112 vita af fjölda slasaðra og forgangsraða – sá sem er verst haldinn gengur fyrir.',
  o:[{good:1,l:'Stutt frumskoðun á honum, láta 112 vita af öðrum slösuðum og biðja hann að setjast hjá ykkur',min:1,r:'Rétt: þú metur fljótt að hann er ekki í lífshættu, lætur 112 vita að slasaðir séu fleiri og heldur áfram að sinna þeim sem er verst haldinn.'},
   {l:'Snúa þér alfarið að honum og skoða hann vandlega',min:3,p:-8,w:0.06,r:'Hann er ekki í lífshættu. Á meðan þú sinnir honum fær sá sem er verst haldinn ekki athygli – forgangsraðaðu.'},
   {l:'Hunsa hann – þú hefur nóg með þinn sjúkling',p:-4,r:'Þú þarft ekki að sinna honum lengi, en stutt mat og að láta 112 vita af fleiri slösuðum er hluti af góðri stjórn á vettvangi.'}]};
  if(D.ic==='🧍'&&freeM)D.o.unshift({good:1,mate:freeM,l:'Biðja '+freeM.name+' að meta hann og láta 112 vita',min:0,r:'Rétt: '+freeM.name+' metur hann og lætur 112 vita á meðan þú heldur áfram með sjúklinginn.'});
 const r=rng(((run.seed||1)^hash(k))>>>0);D.o=D.o.map(x=>[r(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);return D;}
function checkSurprise(){try{if(!st||st.report||st.surp||view!=='close'||!sc||!surpActive()||app.querySelector('.overlay'))return;if(st.closeAt===undefined)st.closeAt=st.minute;
 const seed=run.seed||0;const due=Math.min(st.treatStart!==null?st.treatStart+3+seed%4:1e9,st.closeAt+8+seed%4);if(st.minute<due)return;
 const pend=sc.resources.some(r=>st.calls[r.id]&&!st.calls[r.id].arrived);const kinds=[];if(pend)kinds.push('seinkun');if(sc.ambience!=='borg')kinds.push('vedur');kinds.push('annar');
 const f=window.FH_SURPRISE;const k=typeof f==='string'&&['seinkun','vedur','annar'].includes(f)?f:kinds[seed%kinds.length];st.surp={kind:k,at:st.minute};showSurprise(k);}catch(e){console.error(e&&e.message);}}
function showSurprise(k){closePop();const old=$('#mood');if(old)old.remove();SND.fx('radio');const D=surpData(k);const o=document.createElement('div');o.className='overlay full';o.id='surp';
 o.innerHTML=`<div class="card glass evcard"><div class="evh">⚡ Óvænt uppákoma · ⏱ ${st.minute} mín</div><h2>${D.ic} ${esc(D.h)}</h2><div class="evb${D.radio?' radio':''}">${esc(D.t)}</div><h3>Hvað gerirðu?</h3>${D.o.map((x,i)=>`<button data-sp="${i}">${esc(x.l)}${x.min?` <span class="m">· ${x.min} mín</span>`:''}</button>`).join('')}</div>`;
 app.appendChild(o);o.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{const x=D.o[+b.dataset.sp];o.remove();surpPick(D,x);});}
function surpPick(D,x){st.batch=[];if(D.apply)D.apply();log('⚡ '+D.h+': '+x.l,'');
 if(x.good){st.surpGood=true;st.score.push({label:'Óvænt uppákoma: '+D.h,points:5,kind:'surp',text:x.r});log(x.r,'good');SND.fx('good');if(x.mate){x.mate.busy=st.minute+3;x.mate.task=D.h;st.delegated++;}}
 else{st.score.push({label:'Óvænt uppákoma: '+D.h+' – '+x.l,points:x.p,kind:'act',choice:'surp',text:x.r,fix:D.fix});log(x.r,'bad');st.log[st.log.length-1].fix=D.fix;SND.fx('bad');if(x.w)worsen(x.w);}
 tick(x.min||0);render();flushBatch();}

/* ---------- ferill: stjörnur, merki, XP ---------- */
function badgeHtml(b,isNew,locked){return `<div class="bdg c-${b.c||'b'}${locked?' lock':''}${isNew?' new':''}" title="${esc(b.h)}"><span class="bi">${locked?'🔒':b.ic}</span><b>${esc(b.t)}</b><small>${esc(b.h)}</small>${isNew?'<span class="nyt">NÝTT</span>':''}</div>`;}
function sceneBadges(sco){const b=[];const ok=id=>{const r=sco.rows.find(x=>x.r.id===id);return r?r.ok:null;};const neg=st.score.filter(s=>s.points<0);
 if(ok('safe'))b.push('oryggi');const prim=ok('primary')!==null?ok('primary'):ok('mat');if(prim&&!neg.some(s=>s.group==='frumskodun'))b.push('frumskodun');
 if(ok('call'))b.push('adstod');if((sc.distance.hotspots||[]).every(h=>st.seen.includes(h.id)))b.push('arnarauga');
 if(!neg.length)b.push('engin');if(sco.total>=100)b.push('fullt');if(st.reassess.filter(r=>r.kind==='vitals').length>=2)b.push('endurmat');
 if(sc.heatSources&&allSources())b.push('hitatap');const ib=idealBag(sc);if(st.bag&&run.bagDone&&ib.length&&ib.every(g=>st.bag.includes(g)))b.push('taska');
 if(st.surpGood)b.push('kaldurhaus');if(st.delegated>=3)b.push('lidsheild');return b;}
function endAward(o){const ids=(o.badges||[]).slice();let bonus=0;const ch=run.challenge||'';
 if(/^dagur-/.test(ch)){ids.push('dagleg');if(store.get('fh-dagleg','')!==ch){store.set('fh-dagleg',ch);bonus+=50;}}
 if(/^(dagur|vika)-/.test(ch)){const db=jget('fh-dagbest',{});db[ch]=Math.max(db[ch]||0,o.score);store.set('fh-dagbest',JSON.stringify(db));}
 if(/^vika-/.test(ch))ids.push('sveit');if(run.friend)ids.push('vinur');
 return FX.award({sid:o.sid,track:o.track,score:o.score,finished:true,badges:ids,scenarios:S,bonus});}
function awardHtml(aw){if(!aw)return'';const n=aw.next,lo=aw.rank.xp,hi=n?n.xp:Math.max(aw.after,1);const pct=n?Math.max(0,Math.min(100,Math.round((aw.after-lo)/((hi-lo)||1)*100))):100;
 const B=FX.BADGES.filter(b=>aw.badges.includes(b.id));const op=TRACKS.filter(t=>FX.TRACK_XP[t.n]>aw.before&&FX.TRACK_XP[t.n]<=aw.after);
 return `<div class="card glass" id="award"><div class="awtop">${stars3(aw.stars)}<div><b>${aw.newBest?(aw.prev?'Nýtt met!':'Fyrstu stjörnurnar!'):aw.stars===3?'Þrjár stjörnur':'Stjörnur'}</b><div class="m">★ lokið · ★★ 70+ · ★★★ 90+ stig</div></div></div>
 <div class="xpline"><span class="xpbar"><i style="width:${pct}%"></i></span><span class="xpgain">+${aw.gain} XP</span></div>
 <div class="m">${aw.rank.ic} <b>${esc(aw.rank.t)}</b> · ${aw.after} XP${n?` · ${n.xp-aw.after} XP í tignina ${esc(n.t)}`:''}</div>
 ${aw.rankUp?`<div class="rankup">🎉 Ný tign: <b>${esc(aw.rank.t)}</b>!${op.length?(op.length>1?' Nú eru ':' Nú er ')+op.map(t=>'„'+esc(t.title)+'“').join(' og ')+(op.length>1?' opnar.':' opin.'):''}</div>`:''}
 ${B.length?`<h3>Merki (${aw.newBadges.length} ný)</h3><div class="bgrid">${B.map(b=>badgeHtml(b,aw.newBadges.includes(b.id),false)).join('')}</div>`:''}</div>`;}
function careerScreen(){view='menu';const x=FX.xp(),r=FX.rankOf(x),n=FX.nextRank(x);const S3=FX.starsAll(),B=FX.badgesAll();const pct=n?Math.round(100*(x-r.xp)/(n.xp-r.xp)):100;
 const sumSt=Object.values(S3).reduce((a,b)=>a+b,0);const L=S.filter(s=>s.track);
 app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass" id="career"><button class="tback" id="cback">← Aðalvalmynd</button>
 <div class="prof"><div class="av">${r.ic}</div><div><b>${esc(nafn())}</b><div class="m">${esc(r.t)} · ${Object.keys(S3).length}/${L.length} aðstæðum lokið · ${sumSt} ★</div></div></div>
 <div class="xpline"><span class="xpbar"><i style="width:${pct}%"></i></span><span class="rk">${x}${n?' / '+n.xp:''} XP</span></div>
 <p class="m">${n?`${n.xp-x} XP í tignina <b>${esc(n.t)}</b>. XP fæst fyrir aðstæður, stjörnur, merki, smáleiki og daglega áskorun.`:'Þú hefur náð hæstu tign.'}</p>
 <h3>Tignir</h3><ol class="ladder">${FX.RANKS.map(k=>{const done=x>=k.xp,cur=k===r;return `<li class="${cur?'cur ':''}${done?'done':'lockd'}"><span class="dot">${done?k.ic:'🔒'}</span><span class="lt"><b>${esc(k.t)}</b> <span class="xp">${k.xp} XP</span>${cur?' <span class="now">ÞÚ</span>':''}<small>${esc(k.u)}</small></span></li>`;}).join('')}</ol>
 <h3>Merki ${Object.keys(B).filter(k=>FX.BADGES.some(b=>b.id===k)).length}/${FX.BADGES.length}</h3><div class="bgrid">${FX.BADGES.map(b=>badgeHtml(b,false,!B[b.id])).join('')}</div>
 <h3>Aðstæður</h3>${L.map(s=>{const lk=!FX.unlocked(s.track);return `<div class="srow${lk?' lk':''}"><img src="${esc(s.thumb||'')}" alt="" loading="lazy" width="64" height="36"><span class="t"><b>${esc(s.title)}</b><small>${esc(trackName(s.track))}</small></span>${lk?'<span class="lkt">🔒</span>':`<span class="ss">${stars3(S3[s.id]||0)}</span>`}</div>`;}).join('')}
 <button id="cback2">← Aðalvalmynd</button></div></div>`;$('#cback').onclick=mainMenu;$('#cback2').onclick=mainMenu;}
function lockScreen(tr){view='pick';const x=FX.xp(),r=FX.rankOf(x),k=lockRank(tr);
 app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass" id="lockcard"><button class="tback" id="lback">← Brautir</button><h1>🔒 ${esc(trackName(tr))}</h1>
 <p>Þú ert <b>${r.ic} ${esc(r.t)}</b> með ${x} XP. Þessi braut opnast við tignina <b>${k.ic} ${esc(k.t)}</b> (${FX.TRACK_XP[tr]} XP).</p>
 <p class="m">Safnaðu XP í Fyrstu hjálp 1, smáleikjum, söguseríunni og daglegri áskorun. Ef þú ert á þessu námskeiði geturðu opnað brautina strax.</p>
 <button class="primary" id="unlock">🔓 Opna samt – ég er á þessu námskeiði</button><button id="lback2">← Brautir</button></div></div>`;
 $('#unlock').onclick=()=>{FX.forceOpen(tr);pickScreen(tr);};$('#lback').onclick=()=>pickScreen();$('#lback2').onclick=()=>pickScreen();}
/* hamur er munaður (fh-hamur): Nýr leikur fer beint í brautaval þar sem „Breyta“ opnar hamaval */
function newGame(){if(MODES.includes(store.get('fh-hamur','')))pickScreen();else modeScreen();}
function modeScreen(){view='menu';app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass" id="modes"><button class="tback" id="mdback">← Aðalvalmynd</button><h1>Hvernig viltu spila?</h1>
 ${[['einn','🧍','Vinna einn','Þú sinnir öllu sjálf(ur) – hefðbundinn leikur.'],['teymi','👥','Vinna með teymi','Tveir félagar úr sveitinni: feldu þeim verk og sparaðu tíma.'],['vinur','🤝','Spila með vin','Óvæntar uppákomur og áskorunarhlekkur: vinur fær sömu aðstæður – hvort ykkar gerir betur?']]
  .map(([id,ic,t,d])=>`<button class="modebtn${nextMode===id?' primary':''}" data-mode="${id}"><span class="mi">${ic}</span><span class="mt"><b>${t}</b><small>${d}</small></span></button>`).join('')}</div></div>`;
 $$('[data-mode]').forEach(b=>b.onclick=()=>{nextMode=b.dataset.mode;store.set('fh-hamur',nextMode);pickScreen();});$('#mdback').onclick=mainMenu;}

/* ---------- tímalína ---------- */
function timelineHtml(L){const items=(L||[]).filter(l=>l.t&&!/^\[\d+ mín\] (Hvað|Þú ert)/.test(l.t)).slice(0,80);
 return `<div class="card glass" id="timeline"><h3>⏱ Endurspilun – tímalína</h3><p class="m">Allt sem gerðist, í tímaröð. Rauðu atriðin sýna hvað hefði verið betra.</p><ol class="tl">${items.map(l=>{const m=l.t.match(/^\[(\d+) mín\] ([\s\S]*)$/);const t=m?m[2]:l.t;const s=t.length>240?t.slice(0,237)+'…':t;
  return `<li class="${l.cls||''}"><span class="tm">${m?m[1]+'′':''}</span><span class="tx">${esc(s)}${l.fix?`<span class="fx">✓ Betra: ${esc(l.fix)}</span>`:''}</span></li>`;}).join('')}</ol></div>`;}

/* ---------- netið: Supabase RPC (aðeins fh_ föll) ---------- */
function rpc(name,args){if(!statsOn())return Promise.resolve(null);let t=0;try{const ac=window.AbortController?new AbortController():null;t=setTimeout(()=>{try{ac&&ac.abort();}catch(_){}},6000);
 const h={'Content-Type':'application/json','apikey':SB_KEY};if(/^eyJ/.test(SB_KEY))h.Authorization='Bearer '+SB_KEY;
 return fetch(SB_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:h,body:JSON.stringify(args||{}),signal:ac?ac.signal:undefined,mode:'cors',credentials:'omit',cache:'no-store'})
  .then(r=>{clearTimeout(t);return r.ok?r.json():null;}).then(j=>Array.isArray(j)?j:(j&&Array.isArray(j[name]))?j[name]:j&&typeof j==='object'&&Array.isArray(Object.values(j)[0])?Object.values(j)[0]:null,()=>{clearTimeout(t);return null;});}
 catch(_){clearTimeout(t);return Promise.resolve(null);}}
const teamName=()=>String(store.get('fh-sveit','')).replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,40);
function runFields(score){const f={play_mode:MODES.includes(run.mode)?run.mode:'einn'};
 if(run.challenge&&/^(dagur-\d{4}-\d{2}-\d{2}|vika-\d{4}-V\d{2}|vinur)$/.test(run.challenge))f.challenge=run.challenge;
 const tn=teamName();if(tn.length>=2&&run.challenge&&/^vika-/.test(run.challenge))f.team_name=tn;
 if(Number.isInteger(run.seed))f.seed=run.seed%2147483647;if(score!==null&&score!==undefined)f.stars=FX.stars(score);return f;}

/* ---------- dagleg áskorun og vika ---------- */
const MON=['janúar','febrúar','mars','apríl','maí','júní','júlí','ágúst','september','október','nóvember','desember'];
function today(){const f=window.FH_TODAY;if(f&&/^\d{4}-\d{2}-\d{2}$/.test(f))return f;return new Date().toISOString().slice(0,10);}
function dayLabel(d){const[y,m,dd]=d.split('-').map(Number);return dd+'. '+MON[m-1]+' '+y;}
function weekKey(d){const dt=new Date(d+'T12:00:00Z');const day=(dt.getUTCDay()+6)%7;dt.setUTCDate(dt.getUTCDate()-day+3);const y=dt.getUTCFullYear();const f=new Date(Date.UTC(y,0,4));const w=1+Math.round(((dt-f)/864e5-3+((f.getUTCDay()+6)%7))/7);return 'vika-'+y+'-V'+String(w).padStart(2,'0');}
function weekLabel(k){const m=k.match(/(\d{4})-V(\d+)/);return 'Vika '+(+m[2])+', '+m[1];}
function pool(){return S.filter(s=>s.type!=='fjoldaslys'&&s.close);}
function dailyPick(){const d=today(),P2=pool();return{key:'dagur-'+d,s:P2[hash('dagur-'+d)%P2.length],seed:hash('fræ-'+d)%2147483647};}
function weeklyPick(){const k=weekKey(today()),P2=pool();return{key:k,s:P2[hash(k)%P2.length],seed:hash('fræ-'+k)%2147483647};}
function boardHtml(rows,me,team){if(rows===null)return '<p class="m">Stigatafla næst ekki núna (ekkert netsamband). Þú getur samt spilað – niðurstaðan sendist þegar netið kemst á.</p>';
 if(!rows.length)return '<p class="m">Enginn kominn á töfluna enn – vertu fyrst(ur)!</p>';
 return `<ol class="lb">${rows.slice(0,20).map((r,i)=>{const nm=team?r.team:r.username;const mine=team?(nm===teamName()):(nm===cleanName(store.get('fh-nafn','')));return `<li class="${mine?'me':''}"><span class="rk">${i+1}</span><span class="nm">${esc(nm||'')}${!team&&r.team?` <small>${esc(r.team)}</small>`:''}${team?` <small>${r.members||0} ${r.members===1?'meðlimur':'meðlimir'}</small>`:''}</span><span class="sc">${r.score}</span></li>`;}).join('')}</ol>`;}
function dailyScreen(){view='menu';const D=dailyPick();const best=jget('fh-dagbest',{})[D.key];
 app.innerHTML=bgHtml(D.s)+`<div class="full menu"><div class="card glass" id="daily"><button class="tback" id="dback">← Aðalvalmynd</button>
 <div class="dhero"><img src="${esc(D.s.thumb||'')}" alt="" width="480" height="270"><div class="dh"><span class="m">📅 Dagleg áskorun · ${esc(dayLabel(today()))}</span><b>${esc(D.s.title)}</b><small>${esc(trackName(D.s.track))}</small></div></div>
 <p class="muted">Sömu aðstæður og sama atburðarás fyrir alla í dag – líka óvænt uppákoma. Fyrsta lausn dagsins gefur +50 XP.</p>
 <div class="dstat"><span>Þitt besta í dag<b id="drank">${best!==undefined?best:'–'}</b></span><span>Spilarar<b id="dplays">…</b></span></div>
 <button class="primary" id="dgo">▶ Taka áskorun dagsins</button><h3>Stigatafla dagsins</h3><div id="board"><p class="m">Sæki stigatöflu…</p></div><button id="dback2">← Aðalvalmynd</button></div></div>`;
 $('#dback').onclick=mainMenu;$('#dback2').onclick=mainMenu;
 $('#dgo').onclick=()=>{if(!FX.unlocked(D.s.track))FX.forceOpen(D.s.track);start(D.s.id,{mode:'einn',seed:D.seed,challenge:D.key});};
 rpc('fh_board',{p_challenge:D.key}).then(rows=>{const b=$('#board');if(!b)return;b.innerHTML=boardHtml(rows,null,false);const p=$('#dplays');if(p)p.textContent=rows?rows.length:'–';});}
function weeklyScreen(tab){view='menu';const W=weeklyPick();tab=tab||'sveit';const tn=teamName();
 app.innerHTML=bgHtml(W.s)+`<div class="full menu"><div class="card glass" id="weekly"><button class="tback" id="wback">← Aðalvalmynd</button><h1>🏆 Sveitakeppni vikunnar</h1>
 <div class="dhero"><img src="${esc(W.s.thumb||'')}" alt="" width="480" height="270"><div class="dh"><span class="m">${esc(weekLabel(W.key))}</span><b>${esc(W.s.title)}</b><small>${esc(trackName(W.s.track))}</small></div></div>
 <p class="muted">Allir spila sömu aðstæður alla vikuna. Stig sveitar = samanlagt besta skor fimm bestu meðlima.</p>
 <label class="m" for="sveit">Björgunarsveitin þín</label><input id="sveit" type="text" maxlength="40" autocomplete="organization" placeholder="t.d. Björgunarsveitin Ársæll" value="${esc(tn)}"><p class="no" id="serr" hidden>Skrifaðu nafn björgunarsveitarinnar (minnst 2 stafir).</p>
 <button class="primary" id="wgo">▶ Spila fyrir sveitina</button>
 <div class="seg" role="tablist"><button data-wb="sveit" class="${tab==='sveit'?'on':''}" role="tab">Sveitir</button><button data-wb="einst" class="${tab==='einst'?'on':''}" role="tab">Einstaklingar</button></div>
 <div id="wboard"><p class="m">Sæki stigatöflu…</p></div><button id="wback2">← Aðalvalmynd</button></div></div>`;
 $('#wback').onclick=mainMenu;$('#wback2').onclick=mainMenu;
 const save=()=>{const v=String($('#sveit').value).replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,40);store.set('fh-sveit',v);return v;};
 $('#sveit').onchange=save;$$('[data-wb]').forEach(b=>b.onclick=()=>{save();weeklyScreen(b.dataset.wb);});
 $('#wgo').onclick=()=>{const v=save();if(v.length<2){$('#serr').hidden=false;return;}if(!FX.unlocked(W.s.track))FX.forceOpen(W.s.track);start(W.s.id,{mode:'einn',seed:W.seed,challenge:W.key});};
 (tab==='sveit'?rpc('fh_team_board',{p_week:W.key}):rpc('fh_board',{p_challenge:W.key})).then(rows=>{const b=$('#wboard');if(b)b.innerHTML=boardHtml(rows,null,tab==='sveit');});}
function challengeCard(){const ch=run.challenge||'';if(!/^(dagur|vika)-/.test(ch))return'';const isW=/^vika-/.test(ch);
 setTimeout(()=>{(isW?rpc('fh_team_board',{p_week:ch}):rpc('fh_board',{p_challenge:ch})).then(rows=>{const b=$('#chboard');if(b)b.innerHTML=boardHtml(rows,null,isW);});},700);
 return `<div class="card glass" id="chres"><h3>${isW?'🏆 '+esc(weekLabel(ch))+' – sveitir':'📅 Stigatafla dagsins'}</h3>${isW&&teamName()?`<p class="m">Þú spilaðir fyrir <b>${esc(teamName())}</b>.</p>`:''}<div id="chboard"><p class="m">Sæki stigatöflu…</p></div></div>`;}

/* ---------- áskoraðu vin ---------- */
function b64u(s){return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function ub64u(s){s=String(s).replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return decodeURIComponent(escape(atob(s)));}
function shareUrl(sid,score){const base=location.href.split('#')[0].split('?')[0];return base+'#askorun='+b64u(JSON.stringify({s:sid,seed:run.seed,n:cleanName(store.get('fh-nafn',''))||'Vinur',p:score}));}
function shareHtml(score){return `<div class="card glass" id="share"><h3>🤝 Áskoraðu vin</h3><p class="m">Sendu vini sömu aðstæður og sömu atburðarás. Vinurinn sér þitt skor (${score}) og reynir að gera betur.</p><button id="shbtn">🔗 Senda áskorun</button><input id="shareurl" type="text" readonly hidden aria-label="Áskorunarhlekkur"><p class="ok" id="shok" hidden></p></div>`;}
function bindEnd(s,score){const b=$('#shbtn');if(b)b.onclick=()=>{const u=shareUrl(s.id,score);window.__shareUrl=u;const txt=`${nafn()} skorar á þig í Fyrstu hjálp: „${s.title}“ – ${score}/100. Geturðu gert betur?`;
 const show=m=>{const i=$('#shareurl');i.hidden=false;i.value=u;try{i.select();}catch(_){}const k=$('#shok');k.hidden=false;k.textContent=m;};
 if(navigator.share&&!window.FH_NOSHARE){navigator.share({title:'Fyrsta hjálp – áskorun',text:txt,url:u}).then(()=>show('✓ Áskorun send.'),()=>show('Afritaðu hlekkinn og sendu vini.'));return;}
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt+' '+u).then(()=>show('✓ Hlekkur afritaður – límdu hann í skilaboð til vinar.'),()=>show('Afritaðu hlekkinn og sendu vini.'));return;}
 show('Afritaðu hlekkinn og sendu vini.');};
 const nx=$('#next');if(nx)nx.onclick=()=>seriesNext();}
function friendCard(score){const f=run.friend;if(!f)return'';const d=score-f.p;
 return `<div class="card glass" id="vs"><h3>🤝 Áskorun frá ${esc(f.n)}</h3><div class="vsrow"><span><small>${esc(f.n)}</small><b>${f.p}</b></span><span class="vsx">${d>0?'🏆':d===0?'🤝':'💪'}</span><span><small>Þú</small><b>${score}</b></span></div><p class="${d>=0?'ok':'no'}">${d>0?'Þú vannst áskorunina með '+d+' stigum!':d===0?'Jafntefli – jafngóð bæði!':'Vantaði '+(-d)+' stig – reyndu aftur!'}</p></div>`;}
function parseAskorun(){const m=String(location.hash||'').match(/askorun=([A-Za-z0-9_-]+)/);if(!m)return null;try{const o=JSON.parse(ub64u(m[1]));const s=S.find(x=>x.id===o.s);if(!s)return null;
 return{s,seed:Number.isInteger(o.seed)?o.seed%2147483647:hash(o.s),n:cleanName(o.n)||'Vinur',p:Math.max(0,Math.min(100,parseInt(o.p,10)||0))};}catch(_){return null;}}
function friendScreen(F){view='menu';app.innerHTML=bgHtml(F.s.type==='fjoldaslys'?null:F.s)+`<div class="full menu"><div class="card glass" id="friend"><h1>🤝 Áskorun frá ${esc(F.n)}</h1>
 <div class="dhero"><img src="${esc(F.s.thumb||'')}" alt="" width="480" height="270"><div class="dh"><span class="m">${esc(trackName(F.s.track))}</span><b>${esc(F.s.title)}</b></div></div>
 <p><b>${esc(F.n)}</b> fékk <b>${F.p}/100</b> í þessum aðstæðum. Þú færð sömu aðstæður og sömu atburðarás – geturðu gert betur?</p>
 <button class="primary" id="fgo">▶ Taka áskoruninni</button><button id="fno">Nei takk – aðalvalmynd</button></div></div>`;
 const clr=()=>{try{history.replaceState(null,'',location.href.split('#')[0]);}catch(_){}};
 $('#fgo').onclick=()=>{clr();const go=()=>{if(!FX.unlocked(F.s.track))FX.forceOpen(F.s.track);start(F.s.id,{mode:'vinur',seed:F.seed,friend:{n:F.n,p:F.p},challenge:'vinur'});};store.get('fh-nafn','').trim()?go():nameScreen(go);};
 $('#fno').onclick=()=>{clr();mainMenu();};}

/* ---------- sögusería: Gönguhópurinn ---------- */
const SERIES={id:'gonguhopur',title:'Gönguhópurinn',parts:['skrida-fotbrot','ofkaeling-hraun'],
 sub:['Fótbrot í skriðunni – hópurinn bíður','Seinna sama dag: önnur úr hópnum orðin köld á hrauninu'],
 intro2:'Sama dag, síðdegis. {nafn}, Óli er kominn í öruggar hendur. Á bakaleiðinni kallar talstöðin: önnur úr sama gönguhópi, Sigga, varð viðskila við hópinn og datt í læk á hrauninu sunnan við. Þú ferð fyrst á staðinn. Slydduél nálgast og framundan liggur manneskja í hnipri við stóran klett.'};
const seriesSaved=()=>{const v=jget('fh-saga',null);return v&&v.part===2?v:null;};
function seriesScreen(){view='menu';const sv=seriesSaved();const S3=FX.starsAll();
 app.innerHTML=bgHtml(S.find(s=>s.id===SERIES.parts[0]))+`<div class="full menu"><div class="card glass" id="series"><button class="tback" id="sback">← Aðalvalmynd</button><h1>📖 ${esc(SERIES.title)}</h1>
 <p class="muted">Tvær samtengdar aðstæður á sama degi. Það sem þú gerir í 1. hluta fylgir þér: taskan, tíminn sem leið og hvaða aðstoð er á svæðinu.</p>
 <ol class="parts">${SERIES.parts.map((id,i)=>{const s=S.find(x=>x.id===id);return `<li><img src="${esc(s.thumb||'')}" alt="" width="96" height="54"><span><b>${i+1}. ${esc(s.title)}</b><small>${esc(SERIES.sub[i])}</small></span><span class="ss">${stars3(S3[id]||0)}</span></li>`;}).join('')}</ol>
 ${sv?`<button class="primary" id="scont">▶ Halda áfram: 2. hluti</button>`:''}<button class="${sv?'':'primary'}" id="sgo">▶ Byrja söguna${sv?' upp á nýtt':''}</button><button id="sback2">← Aðalvalmynd</button></div></div>`;
 $('#sback').onclick=mainMenu;$('#sback2').onclick=mainMenu;
 $('#sgo').onclick=()=>{store.set('fh-saga','');start(SERIES.parts[0],{mode:nextMode==='vinur'?'einn':nextMode,series:{part:1,total:0}});};
 if(sv)$('#scont').onclick=()=>seriesNext(sv);}
/* lok hluta: geymir það sem fylgir í næsta hluta */
function seriesStep(score){const p=run.series;if(!p)return;
 if(p.part<SERIES.parts.length){const called={};sc.resources.forEach(r=>{if(st.calls[r.id])called[r.id]=1;});
  const carry={bag:gearCame()?st.bag.slice():st.bagLeft.slice(),refill:gearCame(),minutes:st.minute,called,score1:score,full:st.bag.slice()};
  const v={part:p.part+1,carry,mode:run.mode,total:(p.total||0)+score};store.set('fh-saga',JSON.stringify(v));p.saved=v;}
 else{p.finalTotal=(p.total||0)+score;store.set('fh-saga','');}}
function seriesCard(){const p=run.series;if(!p)return'';
 if(p.part<SERIES.parts.length){const c=(p.saved||{}).carry||{};return `<div class="card glass" id="seriesres"><h3>📖 ${esc(SERIES.title)} – ${p.part}. hluta af ${SERIES.parts.length} lokið</h3>
  <p>Næst: <b>${esc(S.find(x=>x.id===SERIES.parts[p.part]).title)}</b>. Það sem fylgir þér:</p><ul class="carry"><li>🎒 Eftir í töskunni: ${c.bag&&c.bag.length?c.bag.map(g=>GI(g).ic+' '+esc(GI(g).t)).join(', '):'ekkert'}${c.refill?' (fyllt á úr búnaði sveitarinnar)':''}</li><li>⏱ ${c.minutes} mín liðu – á meðan beið Sigga lengur í kuldanum.</li>${c.called&&c.called.bjorgunarsveit?'<li>🧑‍🚒 Félagarnir úr sveitinni eru enn á svæðinu og eru fljótari á staðinn.</li>':''}${c.called&&c.called.thyrla?'<li>🚁 Þyrlan er upptekin við að flytja Óla – hún verður lengur á leiðinni.</li>':''}</ul>
  <button class="primary" id="next">▶ Áfram: ${p.part+1}. hluti</button></div>`;}
 return `<div class="card glass" id="seriesres"><h3>📖 Sögulok: ${esc(SERIES.title)}</h3><p>Samanlagt: <b>${p.finalTotal}/${SERIES.parts.length*100}</b> stig. Þú sinntir tveimur úr sama gönguhópnum á einum degi með einni tösku.</p></div>`;}
function seriesNext(v){v=v||seriesSaved()||(run.series&&run.series.saved);if(!v)return;const id=SERIES.parts[v.part-1];
 start(id,{mode:v.mode||'einn',series:{part:v.part,total:v.total},carry:v.carry,bag:v.carry.bag,bagDone:true,intro:SERIES.intro2});}
function applyCarry(c){const m=M();const drop=Math.max(0,Math.min(0.6,((c.minutes||0)-30)*0.02));st.temp=Math.round((st.temp-drop)*10)/10;st.tHist[0]=st.temp;
 if(c.called){if(c.called.thyrla)st.etaAdd.thyrla=(st.etaAdd.thyrla||0)+20;if(c.called.sjukrabill)st.etaAdd.sjukrabill=(st.etaAdd.sjukrabill||0)+15;if(c.called.bjorgunarsveit)st.etaAdd.bjorgunarsveit=(st.etaAdd.bjorgunarsveit||0)-10;}
 st.carryNote=drop>0?'Sigga hefur beðið lengur – hún er kaldari en ella.':'';void m;}
function restartOpts(){const o=Object.assign({},run);if(!(o.series&&o.series.part>1))delete o.bagDone;if(o.series)o.series={part:o.series.part,total:o.series.total||0};return o;}

/* ---------- fjöldaslys: viðmót í fjoldaslys.js ---------- */
function triageApi(){return{app,esc,store,nafn,bgHtml,mainMenu,pickScreen,trackName,SND,FX,VER,stars3,badgeHtml,awardHtml,timelineHtml,shareHtml,friendCard,challengeCard,teamFor,rng,hash,sndBtnHtml,soundOn,help,
 run:()=>run,restart:()=>start(sc.id,restartOpts()),award:o=>endAward(o),
 bindEnd:(s,score)=>bindEnd(s,score),
 send:(rec)=>{try{sendResult(Object.assign({id:rid(),played_at:new Date().toISOString(),username:(cleanName(store.get('fh-nafn',''))||'nafnlaus'),scenario_id:String(sc.id).slice(0,60),scenario_title:String(sc.title||'').slice(0,120),track:sc.track,version:VER,device_id:deviceId()},runFields(rec.finished?rec.score:null),rec));}catch(_){}}};}

/* ---------- ræsing ---------- */
window.__fhStart=(id,o)=>start(id,o||{});window.__fhBagFor=id=>id==='series'?seriesIdeal():idealBag(S.find(s=>s.id===id));window.__fhState=()=>st&&{minute:st.minute,temp:st.temp,bagLeft:st.bagLeft,team:st.team,surp:st.surp,delegated:st.delegated,hes:st.hes,etaAdd:st.etaAdd,radioMate:st.radioMate};
window.__fhRun=()=>run;
function bootGame(){const F=parseAskorun();if(F)friendScreen(F);else mainMenu();}

bootGame();
})();
