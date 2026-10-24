(function(){
"use strict";
const VER='0.5';
const S=(window.SCENARIOS||[]).slice().sort((a,b)=>(a.order||99)-(b.order||99));const app=document.getElementById('app');
let sc,st,view;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=q=>app.querySelector(q),$$=q=>app.querySelectorAll(q);
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v;}catch(_){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(_){}}};
const nafn=()=>store.get('fh-nafn','').trim()||'björgunarmaður';
const soundOn=()=>store.get('fh-hljod','af')==='a';
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
 sc.resources.forEach(r=>{const c=st.calls[r.id];if(c&&!c.arrived&&st.minute>=c.at+r.eta){c.arrived=st.minute;st.flags['arrived_'+r.id]=true;log(r.icon+' '+r.arriveText,'info');}});}}

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
 const place=()=>{const hu=$('.hud'),pb=$('#pause'),a=app.getBoundingClientRect();let top=0;[hu,pb].forEach(e=>{if(e){const r=e.getBoundingClientRect();if(r.height)top=Math.max(top,r.bottom-a.top);}});
  const r=(img.naturalWidth||2560)/(img.naturalHeight||720);const w=Math.round(Math.min(app.clientWidth*0.46,200));mi.style.width=w+'px';mi.style.height=Math.round(w/r)+'px';mi.style.top=Math.round(top+6)+'px';miniMarks(mi);apply();};
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
function topLimit(){const a=app.getBoundingClientRect();let t=56;['.hud','#pause'].forEach(q=>{const e=$(q);if(e){const r=e.getBoundingClientRect();if(r.height)t=Math.max(t,r.bottom-a.top);}});return t+6;}
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
function hudHtml(){const pend=sc.resources.filter(r=>st.calls[r.id]).map(r=>{const c=st.calls[r.id];return `<span class="glass">${r.icon} ${c.arrived?'✓':Math.max(0,c.at+r.eta-st.minute)+'′'}</span>`;}).join('');
 return `<div class="hud"><span class="glass">⏱ ${st.minute} mín</span>${view!=='distance'?`<span class="glass" title="${esc((sc.hud&&sc.hud.title)||'')}">${severe()?'⚠️':(sc.hud&&sc.hud.icon)||'🥶'} ${P().filter(h=>st.addressed[h.id]).length}/${P().length}</span>`:''}${pend}</div><button class="pausebtn glass" id="pause" aria-label="Hlé – valmynd">⏸</button>`;}
function radioBody(){return `<p class="muted">Þú ert björgunarsveitarmaður á vettvangi. Staðsetning: ${esc(sc.location.label)}. Hvert kall tekur 1 mín.</p>
 ${sc.resources.map(r=>{const c=st.calls[r.id];return `<button data-call="${r.id}" ${c?'disabled class="done"':''}><div class="res"><span class="ic">${r.icon}</span><div><b>${esc(r.label)}</b>${c?` ✓ ${c.arrived?'á staðnum':'kemur eftir ~'+Math.max(0,c.at+r.eta-st.minute)+' mín'}`:` <span class="m">· áætl. ${r.eta} mín</span>`}<small>${esc(r.role)}</small></div></div></button>`;}).join('')}`;}
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
 $('#pause').onclick=e=>{e.stopPropagation();pauseMenu();};
 $$('[data-t]').forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;st.dy=null;render();});
 $$('[data-call]').forEach(b=>b.onclick=()=>{const r=sc.resources.find(x=>x.id===b.dataset.call);st.calls[r.id]={at:st.minute+1,phase:view};
  st.batch=[];log('📻 Kallað eftir: '+r.label+'. „'+sc.location.callText+'“ Áætlaður komutími ~'+r.eta+' mín.','info');tick(1);result();});}
function result(){render();flushBatch();}
function hotClick(list,seenArr){$$('[data-h]').forEach(b=>b.onclick=e=>{e.stopPropagation();const h=list.find(x=>x.id===b.dataset.h);if(!seenArr.includes(h.id))seenArr.push(h.id);
 if(st.swipeHint){st.swipeHint=false;const sh=$('.swipehint');if(sh)sh.remove();}
 st.log.push({t:'['+st.minute+' mín] '+h.label+': '+h.text,cls:''});b.classList.add('seen');if(b.parentElement)b.parentElement.classList.add('seen');app.querySelectorAll(`[data-mh="${h.id}"],[data-md="${h.id}"],[data-ml="${h.id}"]`).forEach(x=>x.classList.add('seen'));
 const r=b.getBoundingClientRect(),a=app.getBoundingClientRect();closePop();
 showPop(`<div class="who">${esc(h.label)}</div><div>${esc(h.text)}</div>`,'card hotcard',r.left-a.left+r.width/2,r.top-a.top+r.height/2,30);
 const n=$('#seenN');if(n)n.textContent=st.seen.length;});}
/* pikk utan spjalds lokar því (en gleypir ekki pikkið) */
/* pikk í skúffunni lokar spjaldi en heldur skúffunni kyrri (svo pikkið hitti hnappinn); pikk á myndina skilar skúffunni í fyrri stöðu */
app.addEventListener('pointerdown',e=>{if(popOpen()&&!e.target.closest('.pop')){if(e.target.closest('#drawer'))closePop();else dismissPop();}},true);
function render(){({distance,close,debrief})[view]();}

/* ---------- aðalvalmynd, nafn, val á aðstæðum ---------- */
function bgHtml(){const s0=S[0];return `<div class="pano"><div class="fitbg cover" style="background-image:url('${s0?s0.images.distance:''}')"></div></div>`;}
function sndLbl(){return soundOn()?'🔊 Hljóð: á':'🔇 Hljóð: af';}
function mainMenu(){view='menu';const name=store.get('fh-nafn','').trim();const inGame=st&&st.report===null&&sc;
 app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass"><h1>Fyrsta hjálp</h1><div class="muted">Þjálfunarleikur fyrir björgunarsveitarfólk · útgáfa ${VER}</div>${name?`<p>Hæ, ${esc(name)}!</p>`:''}
 <button class="primary" id="nyr">Nýr leikur</button>${inGame?`<button id="afram">Halda áfram: ${esc(sc.title)}</button>`:''}<button id="smaleikir">🎯 Smáleikir</button><button id="leid">Leiðbeiningar</button><button id="nafnbtn">${name?'✎ Breyta notandanafni':'✎ Velja notandanafn'}</button><button id="snd">${sndLbl()}</button></div></div>`;
 $('#nyr').onclick=()=>store.get('fh-nafn','').trim()?pickScreen():nameScreen('pick');$('#nafnbtn').onclick=()=>nameScreen('menu');if(inGame)$('#afram').onclick=()=>{view=st.view||'distance';render();};$('#leid').onclick=()=>help(mainMenu);$('#smaleikir').onclick=()=>store.get('fh-nafn','').trim()?openMini():nameScreen('mini');
 $('#snd').onclick=()=>{store.set('fh-hljod',soundOn()?'af':'a');mainMenu();};}
/* notandanafn: slegið inn fyrir fyrsta leik, geymt í localStorage (fh-nafn), hægt að breyta úr aðalvalmynd */
const cleanName=v=>String(v||'').replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
function openMini(){view='mini';app.classList.remove('dist','close');if(window.FHMINI)window.FHMINI.open({app,esc,store,sendResult,rid,deviceId,cleanName,VER,bgHtml,mainMenu});}
function nameScreen(next){view='name';next=(next==='menu'||next==='mini')?next:'pick';const cur=store.get('fh-nafn','').trim();
 app.innerHTML=bgHtml()+`<div class="full menu"><form class="card glass" id="nf"><h1>${cur?'Breyta notandanafni':'Veldu notandanafn'}</h1><p class="muted">Notandanafnið birtist í leiknum og fylgir niðurstöðum hvers borðs svo þjálfarinn geti fylgst með framförum. Það er geymt í þessu tæki og þú getur breytt því hvenær sem er í aðalvalmynd.</p>
 <input id="nafn" type="text" maxlength="24" autocomplete="nickname" autocapitalize="words" spellcheck="false" placeholder="Notandanafn" aria-label="Notandanafn" value="${esc(cur)}"><p class="no" id="nerr" hidden>Notandanafnið þarf að vera minnst 2 stafir.</p>
 <button class="primary" type="submit" id="nok">${next==='menu'?'Vista':'Áfram'}</button><button type="button" id="nback">← Til baka</button></form></div>`;
 $('#nf').onsubmit=e=>{e.preventDefault();const v=cleanName($('#nafn').value);if(v.length<2){$('#nerr').hidden=false;return;}store.set('fh-nafn',v);$('#nafn').blur();window.scrollTo(0,0);next==='menu'?mainMenu():next==='mini'?openMini():pickScreen();};
 $('#nback').onclick=mainMenu;}
const TRACKS=[{n:1,title:'Fyrsta hjálp 1',sub:'Grunnur skyndihjálpar á vettvangi'},{n:2,title:'Fyrsta hjálp 2',sub:'Lengri bið, kuldi, flutningur og óöruggur vettvangur'},{n:3,title:'Wilderness First Responder',sub:'Lengra komnir – WFR'}];
function trackName(n){const t=TRACKS.find(x=>x.n===n);return t?t.title:'';}
function pickScreen(tr){view='pick';
 if(tr&&!TRACKS.some(t=>t.n===tr))tr=null;
 if(!tr){
  app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass"><h1>Veldu braut</h1><p class="muted">${esc(nafn())}, þú ert björgunarsveitarmaður á vettvangi.</p>
 ${TRACKS.map(t=>{const n=S.filter(s=>s.track===t.n).length;return `<button class="trackbtn${n?' primary':''}" data-t="${t.n}"${n?'':' disabled aria-disabled="true"'}><b>${esc(t.title)}</b><span>${n?`${esc(t.sub)} · ${n} aðstæður`:'Væntanlegt'}</span></button>`;}).join('')}
 <button id="pback">← Aðalvalmynd</button></div></div>`;
  $$('[data-t]').forEach(b=>b.onclick=()=>pickScreen(+b.dataset.t));$('#pback').onclick=mainMenu;return;}
 const L=S.filter(s=>s.track===tr);
 app.innerHTML=bgHtml()+`<div class="full menu"><div class="card glass"><button id="tback" class="tback">← Brautir</button><h1>${esc(trackName(tr))}</h1><p class="muted">Veldu aðstæður.</p>
 ${L.length?`<div class="scards">${L.map(s=>`<button class="scard" data-s="${s.id}"><span class="thumb"><img loading="lazy" decoding="async" src="${esc(s.thumb||(s.images&&s.images.close)||'')}" alt="" width="480" height="270"></span><span class="sct"><b>${esc(s.title)}</b>${s.short?`<span>${esc(s.short)}</span>`:''}</span></button>`).join('')}</div>`:'<p class="empty">Væntanlegt – engar aðstæður komnar á þessa braut enn.</p>'}
 <button id="pback">← Aðalvalmynd</button></div></div>`;
 $$('[data-s]').forEach(b=>b.onclick=()=>start(b.dataset.s));$('#tback').onclick=()=>pickScreen();$('#pback').onclick=mainMenu;}
const HELP=[
 ['Markmið','Þú ert björgunarsveitarmaður á vettvangi. Vinndu eftir þríhyrningakerfinu: vettvangur kannaður, frumskoðun, sjúkrasaga og líkamsskoðun – og veittu svo rétta meðferð.'],
 ['Myndin','Pikkaðu á rauðu númeruðu merkin til að skoða vísbendingar. Textinn birtist við merkið; pikkaðu á skjáinn til að loka. Nærmyndir eru víðmyndir: strjúktu til hliðar til að líta í kringum þig.'],
 ['Skúffan ☰','Dragðu skúffuna upp eða pikkaðu á handfangið til að velja aðgerðir. Flipar fylgja þríhyrningakerfinu. Svör sjúklings og félaga birtast í talblöðrum á myndinni, niðurstöður sem spjöld.'],
 ['Tíminn ⏱','Hver aðgerð tekur tíma og ástand sjúklings breytist með tímanum. Bregstu hratt við og endurmettu reglulega (flipinn Endurmat birtist þegar meðferð hefst).'],
 ['📻 Aðstoð','Kallaðu eftir þeirri aðstoð sem ástandið og flutningurinn krefjast. Hvert kall tekur 1 mín og aðstoðin kemur eftir áætlaðan komutíma.'],
 ['Ákvörðun','Þegar skoðun og meðferð er lokið ákveður þú flutning. Þá færðu samantekt, stig og SAGA-skráningu. 📜 Skrá geymir allt sem hefur gerst.'],
 ['🎯 Smáleikir','Stuttar æfingar úr aðalvalmyndinni: skammstafanir, lífsmörk, röð skrefa, hraðaspurningar, SAGA-skráning, taktur í hjartahnoði og stutt tilfelli. Hver leikur gefur stig af 100.'],
 ['⏸ Hlé','Hnappurinn efst í horninu opnar valmynd: halda áfram, byrja upp á nýtt, velja aðrar aðstæður eða fara í aðalvalmynd.']];
function help(back){const prev=app.querySelector('.overlay');
 const html=`<div class="card glass"><h1>Leiðbeiningar</h1>${HELP.map(([k,v])=>`<div class="step"><b>${esc(k)}</b><div>${esc(v)}</div></div>`).join('')}<button class="primary" id="hback">Til baka</button></div>`;
 if(view==='menu'){app.innerHTML=bgHtml()+`<div class="full menu">${html}</div>`;$('#hback').onclick=back;return;}
 const o=document.createElement('div');o.className='overlay full';o.innerHTML=html;if(prev)prev.remove();app.appendChild(o);$('#hback').onclick=()=>{o.remove();back();};}
function pauseMenu(){closePop();const o=document.createElement('div');o.className='overlay full';o.id='pausem';
 o.innerHTML=`<div class="card glass"><h1>Hlé</h1><div class="muted">${esc(sc.title)} · ⏱ ${st.minute} mín</div>
 <button class="primary" id="p_cont">▶ Halda áfram</button><button id="p_restart">↺ Byrja upp á nýtt</button><button id="p_pick">Velja aðrar aðstæður</button><button id="p_main">Aðalvalmynd</button><button id="p_help">Leiðbeiningar</button><button id="p_snd">${sndLbl()} <span class="m">(hljóð koma síðar)</span></button></div>`;
 app.appendChild(o);const q=s=>o.querySelector(s);
 q('#p_cont').onclick=()=>o.remove();q('#p_restart').onclick=()=>start(sc.id);q('#p_pick').onclick=()=>{const t=sc.track;abandon();st=null;pickScreen(t);};
 q('#p_main').onclick=()=>{st.view=view;mainMenu();};q('#p_help').onclick=()=>{o.remove();help(pauseMenu);};
 q('#p_snd').onclick=()=>{store.set('fh-hljod',soundOn()?'af':'a');o.remove();pauseMenu();};}
/* niðurstöðufærsla fyrir tölfræðina */
function record(finished,sco){const m=M(),sev=severe();
 const val=m.valueText?' '+m.valueText.replace('{v}',st.temp.toFixed(m.decimals!==undefined?m.decimals:1)):'';
 return{id:rid(),played_at:new Date().toISOString(),username:(cleanName(store.get('fh-nafn',''))||'nafnlaus'),scenario_id:String(sc.id).slice(0,60),scenario_title:String(sc.title||'').slice(0,120),
  track:(Number.isInteger(sc.track)&&sc.track>=0&&sc.track<=9)?sc.track:null,score:finished?Math.max(0,Math.min(100,sco.total)):null,finished:!!finished,duration_s:Math.max(0,Math.min(86400,Math.round((Date.now()-st.t0)/1000))),game_minutes:Math.max(0,Math.min(1000,Math.round(st.minute||0))),
  lost:finished?sco.losses.slice(0,40).map(l=>({label:String(l.label).slice(0,160),pts:l.pts})):[],
  outcome:((sev?(m.severeLabel||'alvarlegt ástand'):(m.mildLabel||'stöðugt ástand'))+val).slice(0,200),patient_stable:!sev,
  decision:st.report?String(st.report.label).slice(0,200):null,version:VER,device_id:deviceId()};}
const started=()=>!!(st&&sc&&!st.report&&!st.sent&&(st.minute>0||st.seen.length>0));
/* borð yfirgefið (byrja upp á nýtt, velja annað, loka síðunni) */
function abandon(){try{if(started()){st.sent=true;sendResult(record(false));}}catch(_){}}
window.addEventListener('pagehide',()=>{try{if(started()&&statsOn()){st.sent=true;const r=record(false);const q=qLoad();q.push(r);qSave(q);post(r,true);}}catch(_){}});
function start(id){abandon();sc=S.find(s=>s.id===id);st={t0:Date.now(),sent:false,dy:null,minute:0,temp:M().start,flags:Object.assign({},sc.startFlags||{}),flagAt:{},fired:{},addressed:{},addressedAt:{},seen:[],seenClose:[],calls:{},log:[],score:[],report:null,
 tab:'vettvangur_d',drawer:'closed',pan:{},scroll:{},swipeHint:true,reassess:[],lastVitals:null,treatStart:null,batch:null};view='distance';
 log(fill(sc.intro),'');render();showPop(`<div class="who">${esc(sc.title)}</div><div>${esc(fill(sc.intro))}</div><div class="note">Pikkaðu á merkin á myndinni og dragðu svo skúffuna upp til að velja hvað þú gerir.</div>`,'card',null,null);}

/* ---------- fjarlægð ---------- */
function distance(){const d=sc.distance;
 const tabs=[{id:'vettvangur_d',label:'Vettvangur'},{id:'adstod',label:'📻 Aðstoð'},{id:'skra',label:'📜 Skrá'}];
 const body=st.tab==='adstod'?radioBody():st.tab==='skra'?logBody():
  `<p class="muted">Pikkaðu á merkin á myndinni (<span id="seenN">${st.seen.length}</span>/${d.hotspots.length} könnuð).</p><h3>Hvað gerirðu?</h3>${d.approach.map(a=>`<button data-a="${a.id}">${esc(a.label)}</button>`).join('')}`;
 screen(sc.images.distance,'distance',50,hotsHtml(d.hotspots,st.seen),tabsHtml(tabs)+body,d.fit);
 hotClick(d.hotspots,st.seen);
 $$('[data-a]').forEach(b=>b.onclick=()=>{const a=d.approach.find(x=>x.id===b.dataset.a);st.batch=[];
  /* goodWhen: nálgunin er aðeins rétt ef skilyrðin eru uppfyllt (t.d. búið að kalla á lögreglu); waitFor: beðið þar til aðstoð er komin */
  const ok=!a.goodWhen||all(a.goodWhen);const txt=ok?a.text:a.badText,pts=ok?a.score:a.badScore;setF(ok?a.flag:(a.badFlag||a.flag));(a.flags||[]).forEach(setF);
  let mins=a.minutes;if(a.waitFor){const c=st.calls[a.waitFor],r=sc.resources.find(x=>x.id===a.waitFor);mins=Math.max(mins,c?(c.arrived?0:c.at+r.eta-st.minute):(a.noCallMinutes||mins));}
  st.score.push({label:'Nálgun: '+a.label,points:pts,kind:'approach',text:txt});log(txt,pts>0?'good':'bad');tick(mins);view='close';st.tab=sc.close.groups[0].id;st.swipeHint=true;render();flushBatch();});}

/* ---------- nærmynd ---------- */
function treating(){return st.treatStart!==null;}
function close(){const c=sc.close;const treated=isTreated();const hots=(treated&&c.hotspotsTreated)||c.hotspots||[];
 const short=l=>l.replace(/^\d\.\s*/,'').replace('Sjúkrasaga og líkamsskoðun','Saga og skoðun').replace('Vettvangur kannaður','Vettvangur');
 let tabs=c.groups.map(g=>({id:g.id,label:short(g.label)}));if(treating())tabs.push({id:'endurmat',label:'🔁 Endurmat'});
 tabs=tabs.concat([{id:'tilkynna',label:'Ákvörðun'},{id:'adstod',label:'📻 Aðstoð'},{id:'skra',label:'📜 Skrá'}]);
 if(st.tab==='endurmat'&&!treating())st.tab=c.groups[0].id;
 let body;
 if(st.tab==='adstod')body=radioBody();else if(st.tab==='skra')body=logBody();else if(st.tab==='endurmat')body=reassessBody();
 else if(st.tab==='tilkynna')body=`<p class="muted">Þegar skoðun og meðferð er lokið: ákveddu flutning.</p><h3>Hvað gerirðu núna?</h3>${sc.report.options.map(o=>`<button data-r="${o.id}">${esc(o.label)}</button>`).join('')}`;
 else body=(c.groupIntro&&c.groupIntro[st.tab]?`<p class="muted">${esc(c.groupIntro[st.tab])}</p>`:'')+c.actions.filter(a=>a.group===st.tab).map(a=>`<button data-x="${a.id}" class="${st.flags[a.flag]?'done':''}" ${st.flags[a.flag]&&!a.speaker&&!a.repeatable?'disabled':''}>${st.flags[a.flag]?'✓ ':''}${a.speaker?'💬 ':''}${esc(a.label)}${a.minutes?` <span class="m">· ${a.minutes} mín</span>`:''}</button>`).join('');
 screen(treated?sc.images.treated:sc.images.close,'close',sc.pan.closeStart,hotsHtml(hots,st.seenClose),tabsHtml(tabs)+body,false,hots,st.seenClose);
 hotClick(hots,st.seenClose);
 $$('[data-x]').forEach(b=>b.onclick=()=>act(c.actions.find(a=>a.id===b.dataset.x)));
 $$('[data-ra]').forEach(b=>b.onclick=()=>reassessAct(b.dataset.ra));
 $$('[data-r]').forEach(b=>b.onclick=()=>{const o=sc.report.options.find(x=>x.id===b.dataset.r);let pts,txt;
  let q;if(o.goodWhen&&all(o.goodWhen)){pts=15;q='good';txt=o.goodText;}else if(o.okWhen&&all(o.okWhen)){pts=8;q='ok';txt=o.okText;}else{pts=-10;q='bad';txt=o.badText;}
  st.report={id:o.id,label:o.label,pts,txt,q,best:(sc.report.options.find(x=>x.goodWhen&&all(x.goodWhen))||{}).label||''};log('Ákvörðun: '+o.label,pts>0?'good':'bad');view='debrief';render();});}
/* setning sem birtist í talblöðru fer aðeins í atburðaskrá, ekki í st.batch – annars birtist svarið tvisvar í blöðrunni */
function logSay(t){st.log.push({t:'['+st.minute+' mín] '+t,cls:''});}
function address(ids){(ids||[]).forEach(s=>{if(!st.addressed[s]){st.addressed[s]=true;st.addressedAt[s]=st.minute;}});}
function act(a){const sev=severe();const wasDone=!!st.flags[a.flag];setF(a.flag);let txt=a.text,pts=a.score||0,cls='',fix=a.fix||'';st.batch=[];
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
 if(pts){st.score.push({label:'Aðgerð: '+a.label,points:pts,kind:'act',text:fill(txt),fix});cls=pts>0?'good':'bad';}
 log(fill(txt),cls);if(a.arrestIf&&all(a.arrestIf))arrest(a.arrestText);tick(a.minutes);
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
 st.score.filter(s=>s.kind==='act'&&s.points<0).forEach(s=>losses.push({label:'Röng aðgerð: '+s.label.replace('Aðgerð: ',''),pts:Math.max(1,Math.round(-s.points/2)),what:s.text,todo:s.fix||''}));
 losses.sort((a,b)=>b.pts-a.pts);let room=100;losses.forEach(l=>{l.full=l.pts;l.pts=Math.min(l.pts,room);room-=l.pts;});
 const lost=losses.reduce((s,l)=>s+l.pts,0);return{rows,rj,losses:losses.filter(l=>l.pts>0||l.full>0),total:100-lost,lost};}

/* ---------- samantekt ---------- */
function debrief(){const sco=scoring();const{rows,rj,losses,total}=sco;
 const praise=total>=100?'Fullt hús':total>=90?'Frábærlega gert':total>=70?'Vel gert':total>=40?'Ágætis tilraun':'Þetta þarf að æfa betur';
 const m=M();const stateTxt=severe()?`<span class="no">${esc(m.severeLabel||'alvarlegt ástand')}</span>`:`<span class="ok">${esc(m.mildLabel||'stöðugt ástand')}</span>`;
 const val=m.valueText?' '+esc(m.valueText.replace('{v}',st.temp.toFixed(m.decimals!==undefined?m.decimals:1))):'';
 const miss=losses.length?`<div class="card glass missing" id="missing"><h2>Hvað vantaði upp á 100?</h2><p class="muted">${losses.length} ${losses.length===1?'atriði kostaði':'atriði kostuðu'} samtals <b>${sco.lost} stig</b> (100 − ${total}). Stærstu atriðin fyrst.</p>
  ${losses.map(l=>`<div class="lost"><div class="lh"><b>${esc(l.label)}</b><span class="lp">−${l.pts}</span></div>${l.what?`<div class="lw">✗ ${esc(l.what)}</div>`:''}${l.todo?`<div class="lt">✓ Rétt: ${esc(l.todo)}</div>`:''}${l.full>l.pts?`<div class="r">(${l.full} stig, en stig fara ekki undir 0)</div>`:''}</div>`).join('')}</div>`
  :`<div class="card glass missing perfect" id="missing"><h2>Ekkert vantaði upp á 100! 🎉</h2><p>Frábært, ${esc(nafn())}: öruggur vettvangur, kerfisbundin skoðun, rétt meðferð samkvæmt námsefninu, rétt aðstoð á réttum tíma og góð ákvörðun um flutning. Svona á að gera þetta.</p></div>`;
 app.innerHTML=bgHtml()+`<div class="full"><div class="card glass"><h1>Samantekt</h1><div class="muted">${esc(sc.title)} · ${esc(nafn())}</div><div class="score">${total}/100</div><p><b>${praise}, ${esc(nafn())}!</b></p><p>Tími: ${st.minute} mín · ${stateTxt}${val}</p>
 <p><b>Ákvörðun:</b> ${esc(st.report.label)}<br><span class="${st.report.q==='good'?'ok':'no'}">${esc(st.report.txt)}</span></p></div>
 ${miss}
 <div class="card glass"><h3>Mat eftir skrefum</h3>${rows.map(x=>`<div class="step"><div><b>${esc(x.r.label)}</b> <span class="${x.ok?'ok':'no'}">${x.ok?x.w:0}/${x.w}</span></div><div class="${x.ok?'ok':'no'}">${x.ok?'✓ ':'✗ '}${esc(x.ok?x.r.okText:x.r.badText)}</div><div class="r">${esc(x.r.rule)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>📻 Aðstoð – val og tímasetning</h3>${rj.items.map(x=>`<div class="step"><b>${x.r.icon} ${esc(x.r.label)}</b> <span class="${x.cls}">${x.cls==='no'?'✗':'✓'}</span><div class="${x.cls}">${esc(x.txt)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>SAGA skráning</h3>${saga().map(([k,v])=>`<div class="step"><b>${k}</b><div>${esc(v)}</div></div>`).join('')}</div>
 <div class="card glass"><h3>Einstakar ákvarðanir</h3><table>${st.score.map(s=>`<tr><td>${esc(s.label)}</td><td class="${s.points>0?'ok':'no'}">${s.points>0?'✓':'✗'}</td></tr>`).join('')}</table></div>
 <button class="primary" id="again">↺ Spila aftur</button><button id="other">Velja aðrar aðstæður</button><button id="tomenu">Aðalvalmynd</button></div>`;
 window.__score={total,lost:sco.lost,losses:losses.map(l=>({label:l.label,pts:l.pts}))};
 if(!st.sent){st.sent=true;try{sendResult(record(true,sco));}catch(_){}}
 $('#again').onclick=()=>start(sc.id);$('#other').onclick=()=>{st=null;pickScreen(sc.track);};$('#tomenu').onclick=()=>{st=null;mainMenu();};}
window.addEventListener('resize',()=>{if(st&&['distance','close'].includes(view)&&!app.querySelector('.overlay'))render();});
window.addEventListener('error',e=>{console.error(e.message)});
mainMenu();
})();
