/* v0.7 – fjöldaslys (FH2): vettvangur, 112, „allir sem geta gengið“, stutt frumskoðun á öllum, forgangsröðun, meðferð, endurmat og flutningur.
   Gögn í scenarios/fjoldaslys-bilvelta.json; leikurinn (game.js) lætur í té api: bakgrunn, feril, deilingu og tölfræði. */
(function(){
"use strict";
let A,sc,run,T;
const PRI={1:['r','1 – Strax'],2:['y','2 – Fljótt'],3:['g','3 – Getur beðið']};
function $(q){return A.app.querySelector(q);}function $$(q){return A.app.querySelectorAll(q);}
function fillN(t){return String(t).replace(/\{nafn\}/g,A.nafn()).replace(/\{m1\}/g,T.team?T.team[0].name:'').replace(/\{m2\}/g,T.team?T.team[1].name:'');}
function log(t,cls,fix){T.log.push({t:'['+T.min+' mín] '+t,cls:cls||'',fix:fix||''});}
function shuffle(o,key){const r=A.rng(((run.seed||1)^A.hash(key))>>>0);return o.map(x=>[r(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
function start(s,api,o){A=api;sc=s;run=o;T={min:0,step:'intro',got:{},log:[],pri:{},seen:{},bad:0,team:o.mode==='teymi'?api.teamFor(s,o.seed):null,eta:null,callAt:null,res:{},drag:false,t0:Date.now(),done:false};
 log(fillN(sc.intro));A.SND.setAmb(sc.ambience||'vindur');show();}
function frame(body){const pend=T.callAt!==null?`<span class="chip">🚑 ${T.min>=T.callAt+T.eta?'✓':Math.max(0,T.callAt+T.eta-T.min)+'′'}</span>`:'';
 A.app.innerHTML=A.bgHtml(sc)+`<div class="full menu triage"><div class="card glass" id="tri"><div class="trbar"><span class="trchips"><span class="chip">🚨 Fjöldaslys</span><span class="chip">⏱ ${T.min} mín</span>${pend}</span>${A.sndBtnHtml()}<button class="pausebtn glass trp" id="tpause" aria-label="Hlé – valmynd">⏸</button></div>${body}</div></div>`;
 A.SND.setAmb(sc.ambience||'vindur');
 const sb=$('#sndbtn');if(sb)sb.onclick=e=>{e.stopPropagation();A.SND.set(!A.soundOn());frame0();};
 $('#tpause').onclick=pause;}
let frame0=()=>show();
function optsHtml(ph){const L=shuffle(ph.opts.filter(x=>!x.team||T.team),ph.id);ph._L=L;return L.map((x,i)=>`<button class="opt2" data-o="${i}">${A.esc(fillN(x.l))}${x.min?` <span class="m">· ${x.min} mín</span>`:''}</button>`).join('');}
function pick(ph,x){T.min+=x.min||0;T.got[ph.id]={pts:x.pts,good:!!x.good,l:fillN(x.l),r:x.r,fix:x.fix||'',cat:ph.cat,title:ph.title};
 if(ph.id==='call'){T.callAt=T.min+(x.delay||0);T.eta=x.eta;}
 if(!x.good)T.bad++;if(x.w)T.drag=true;if(x.good&&x.team)T.teamUsed=true;
 log(ph.title+': '+fillN(x.l),'');log(x.r,x.good?'good':'bad',x.good?'':x.fix);A.SND.fx(x.good?'good':'bad');
 T.fb={ok:!!x.good,t:x.r};}
function fbHtml(){if(!T.fb)return'';const f=T.fb;T.fb=null;return `<div class="fb ${f.ok?'ok':'no'}">${f.ok?'✓':'✗'} ${A.esc(f.t)}</div>`;}
function show(){frame0=show;const ph=sc.phases.find(p=>!T.got[p.id]);
 if(T.step==='intro'){frame(`<h1>${A.esc(sc.title)}</h1><p>${A.esc(fillN(sc.intro))}</p>${T.team?`<p class="note">👥 Teymið þitt: ${A.esc(T.team[0].name)} og ${A.esc(T.team[1].name)} eru með þér í bílnum.</p>`:''}<p class="m">Fjöldaslys: fleiri slasaðir en hjálparhendur. Tryggðu vettvang, kallaðu eftir nægri aðstoð, gerðu stutta frumskoðun á öllum og forgangsraðaðu.</p><button class="primary" id="tgo">▶ Hefjast handa</button>`);
  $('#tgo').onclick=()=>{T.step='phase';show();};return;}
 if(ph){const fb=fbHtml();frame(`${fb}<h3>${A.esc(ph.title)}</h3><h2>${A.esc(ph.q)}</h2>${optsHtml(ph)}`);
  $$('[data-o]').forEach(b=>b.onclick=()=>{pick(ph,ph._L[+b.dataset.o]);show();});return;}
 if(T.step==='phase')T.step='assess';
 if(T.step==='assess'){const fb=fbHtml();const all=sc.patients.every(p=>T.seen[p.id]);const allP=sc.patients.every(p=>T.pri[p.id]);
  frame(`${fb}<h3>Frumskoðun og forgangsröðun</h3><h2>Stutt frumskoðun á öllum – svo forgangur</h2><p class="m">Pikkaðu á hvern sjúkling til að meta hann (${sc.assessMin} mín). Gefðu síðan hverjum forgang: 1 = strax, 2 = fljótt, 3 = getur beðið.</p>
  <div class="pts">${sc.patients.map(p=>{const s=T.seen[p.id],pr=T.pri[p.id];return `<div class="pcard${pr?' t'+PRI[pr][0]:''}" data-p="${p.id}"><div class="ph"><b>${A.esc(p.name)}, ${p.age} ára</b>${pr?`<span class="tag ${PRI[pr][0]}">${PRI[pr][1]}</span>`:''}</div><div class="m">${A.esc(p.who)}</div>
   ${s?`<div class="find">${A.esc(p.find)}</div><div class="prow">${[1,2,3].map(n=>`<button class="pb ${PRI[n][0]}${pr===n?' on':''}" data-pr="${p.id}:${n}" aria-pressed="${pr===n}">${n}</button>`).join('')}</div>`:`<button class="primary" data-as="${p.id}">🩺 Meta ${A.esc(p.name)} (VÁSE, öndun, blóðrás)</button>`}</div>`;}).join('')}</div>
  <button class="primary" id="tconf" ${all&&allP?'':'disabled'}>Staðfesta forgangsröðun</button>`);
  $$('[data-as]').forEach(b=>b.onclick=()=>{const p=sc.patients.find(x=>x.id===b.dataset.as);T.seen[p.id]=1;T.min+=sc.assessMin;log('Frumskoðun – '+p.name+': '+p.find,'');show();});
  $$('[data-pr]').forEach(b=>b.onclick=()=>{const[id,n]=b.dataset.pr.split(':');T.pri[id]=+n;show();});
  $('#tconf').onclick=()=>{let pts=0,ok=true;const lines=[];sc.patients.forEach(p=>{const g=T.pri[p.id]===p.pri;if(g)pts+=p.pts;else ok=false;lines.push((g?'✓ ':'✗ ')+p.name+': forgangur '+T.pri[p.id]+(g?'':' (rétt: '+p.pri+')')+' – '+p.why);});
   T.got.pri={pts,good:ok,cat:'forgangur',title:'Forgangsröðun',l:sc.patients.map(p=>p.name+' '+T.pri[p.id]).join(', '),r:lines.join(' '),fix:ok?'':'Halldór 1 (lost, skert meðvitund), Kári 2 (brot með skertu BSH, getur ekki gengið), Elín 3 (gengur, eðlileg lífsmörk).'};
   if(!ok)T.bad++;log('Forgangsröðun: '+T.got.pri.l,ok?'good':'bad',T.got.pri.fix);A.SND.fx(ok?'good':'bad');T.priLines=lines;T.step='treat';show();};return;}
 if(T.step==='treat'){const tp=sc.treat.find(p=>!T.got[p.id]);const head=T.priLines?`<div class="fb ${T.got.pri.good?'ok':'no'}">${T.priLines.map(l=>`<div>${A.esc(l)}</div>`).join('')}</div>`:'';T.priLines=null;
  if(tp){const fb=head||fbHtml();frame(`${fb}<h3>${A.esc(tp.title)}</h3><h2>${A.esc(tp.q)}</h2>${optsHtml(tp)}`);$$('[data-o]').forEach(b=>b.onclick=()=>{pick(tp,tp._L[+b.dataset.o]);show();});return;}
  T.step='twist';}
 if(T.step==='twist'){const tw=sc.twist;if(!T.got[tw.id]){const fb=fbHtml();T.min+=2;A.SND.fx('radio');frame(`${fb}<div class="evcard ev2"><div class="evh">🔁 Endurmat · ⏱ ${T.min} mín</div><div class="evb">${A.esc(tw.ev)}</div></div><h2>${A.esc(tw.q)}</h2>${optsHtml(tw)}`);T.min-=2;
   $$('[data-o]').forEach(b=>b.onclick=()=>{T.min+=2;log(tw.ev,'info');pick(tw,tw._L[+b.dataset.o]);T.step='transport';show();});return;}T.step='transport';}
 if(T.step==='transport'){const tr=sc.transport;const fb=fbHtml();const arr=Math.max(T.min,T.callAt+T.eta);
  frame(`${fb}<div class="evcard ev2"><div class="evh">🚑 ⏱ ${arr} mín</div><div class="evb">Sírenur nálgast. Fyrsti sjúkrabíllinn er kominn${T.got.call&&T.got.call.pts>=15?' – annar og tækjabíll eru rétt á eftir':''}.</div></div><h2>${A.esc(tr.q)}</h2>
  ${shuffle(tr.opts,'flutn').map(x=>{const p=sc.patients.find(q=>q.id===x.p);return `<button class="opt2" data-tp="${x.p}">🚑 ${A.esc(p.name)}</button>`;}).join('')}`);
  if(arr>T.min){T.min=arr;}A.SND.fx('sirena');
  $$('[data-tp]').forEach(b=>b.onclick=()=>{const x=tr.opts.find(o=>o.p===b.dataset.tp);const p=sc.patients.find(q=>q.id===x.p);pick({id:tr.id,cat:tr.cat,title:tr.title},Object.assign({},x,{l:'Fyrstur í sjúkrabíl: '+p.name}));finish();});return;}}
function pause(){const o=document.createElement('div');o.className='overlay full';o.id='pausem';
 o.innerHTML=`<div class="card glass"><h1>Hlé</h1><div class="muted">${A.esc(sc.title)} · ⏱ ${T.min} mín</div><button class="primary" id="p_cont">▶ Halda áfram</button><button id="p_restart">↺ Byrja upp á nýtt</button><button id="p_pick">Velja aðrar aðstæður</button><button id="p_main">Aðalvalmynd</button></div>`;
 A.app.appendChild(o);const q=s=>o.querySelector(s);q('#p_cont').onclick=()=>o.remove();q('#p_restart').onclick=()=>{abandon();A.restart();};q('#p_pick').onclick=()=>{abandon();A.pickScreen(sc.track);};q('#p_main').onclick=()=>{abandon();A.mainMenu();};}
function abandon(){if(T&&!T.done&&T.min>0){T.done=true;A.send({finished:false,score:null,duration_s:Math.round((Date.now()-T.t0)/1000),game_minutes:T.min,lost:[],outcome:'hætt í miðjum leik',patient_stable:false,decision:null});}}
function finish(){T.done=true;const cats=sc.cats;const by={};Object.keys(cats).forEach(k=>by[k]=0);Object.values(T.got).forEach(g=>{by[g.cat]=(by[g.cat]||0)+g.pts;});
 let total=0;Object.keys(cats).forEach(k=>{by[k]=Math.min(by[k],cats[k][1]);total+=by[k];});if(T.drag)total=Math.max(0,total-5);
 const losses=Object.values(T.got).filter(g=>!g.good).map(g=>({label:g.title,pts:Math.max(0,(g.cat==='forgangur'&&g.title==='Forgangsröðun'?24:g.cat==='medferd'?10:cats[g.cat][1])-g.pts),what:'Þú valdir: „'+g.l+'“. '+g.r,todo:g.fix})).filter(l=>l.pts>0);
 if(T.drag)losses.push({label:'Ástand Halldórs versnaði',pts:5,what:'Röng meðferð jók lostið hjá Halldóri.',todo:'Styðja við höfuð og háls, tryggja öndunarveg og veita lostmeðferð.'});
 losses.sort((a,b)=>b.pts-a.pts);
 const ids=[];if(T.got.safe&&T.got.safe.good)ids.push('oryggi');if(T.got.call&&T.got.call.good)ids.push('adstod');if(T.got.pri&&T.got.pri.good&&T.got.twist&&T.got.twist.good)ids.push('forgangur');
 if(T.got.pri&&T.got.pri.good)ids.push('frumskodun');if(!T.bad)ids.push('engin');if(total>=100)ids.push('fullt');if(T.got.twist&&T.got.twist.good)ids.push('kaldurhaus');if(T.teamUsed)ids.push('lidsheild');
 const aw=A.award({sid:sc.id,track:sc.track,score:total,badges:ids});
 const stable=!T.drag&&T.got.twist&&T.got.twist.good;
 A.send({finished:true,score:total,duration_s:Math.max(0,Math.min(86400,Math.round((Date.now()-T.t0)/1000))),game_minutes:T.min,lost:losses.slice(0,40).map(l=>({label:String(l.label).slice(0,160),pts:l.pts})),outcome:(stable?'allir þrír komust í sjúkrabíl í stöðugu ástandi':'ástand eins eða fleiri versnaði').slice(0,200),patient_stable:!!stable,decision:String((T.got.flutn||{}).l||'').slice(0,200)});
 window.__score={total,lost:100-total,losses:losses.map(l=>({label:l.label,pts:l.pts}))};
 const praise=total>=100?'Fullt hús':total>=90?'Frábærlega gert':total>=70?'Vel gert':total>=40?'Ágætis tilraun':'Þetta þarf að æfa betur';
 A.app.innerHTML=A.bgHtml(sc)+`<div class="full"><div class="card glass"><h1>Samantekt</h1><div class="muted">${A.esc(sc.title)} · ${A.esc(A.nafn())}</div><div class="score">${total}/100</div><p><b>${praise}, ${A.esc(A.nafn())}!</b></p><p>Tími: ${T.min} mín · ${stable?'<span class="ok">allir þrír komust í sjúkrabíl í stöðugu ástandi</span>':'<span class="no">ástand eins eða fleiri versnaði</span>'}</p></div>
 ${A.awardHtml(aw)}${A.friendCard(total)}${A.challengeCard()}
 ${losses.length?`<div class="card glass missing" id="missing"><h2>Hvað vantaði upp á 100?</h2>${losses.map(l=>`<div class="lost"><div class="lh"><b>${A.esc(l.label)}</b><span class="lp">−${l.pts}</span></div><div class="lw">✗ ${A.esc(l.what)}</div>${l.todo?`<div class="lt">✓ Rétt: ${A.esc(l.todo)}</div>`:''}</div>`).join('')}</div>`:`<div class="card glass missing perfect" id="missing"><h2>Ekkert vantaði upp á 100! 🎉</h2><p>Öruggur vettvangur, nákvæmt kall til 112, stutt frumskoðun á öllum, rétt forgangsröðun, endurmat og réttur flutningur.</p></div>`}
 <div class="card glass"><h3>Mat eftir skrefum</h3>${Object.keys(cats).map(k=>`<div class="step"><b>${A.esc(cats[k][0])}</b> <span class="${by[k]>=cats[k][1]?'ok':'no'}">${by[k]}/${cats[k][1]}</span></div>`).join('')}</div>
 <div class="card glass"><h3>🚦 Forgangsröðun</h3>${sc.patients.map(p=>`<div class="step"><span class="tag ${PRI[p.pri][0]}">${PRI[p.pri][1]}</span> <b>${A.esc(p.name)}</b> <span class="${T.pri[p.id]===p.pri?'ok':'no'}">${T.pri[p.id]===p.pri?'✓':'✗ þú: '+T.pri[p.id]}</span><div class="r">${A.esc(p.why)}${p.id==='elin'?' Eftir endurmat: forgangur 2 (↑IKÞ).':''}</div></div>`).join('')}</div>
 ${A.timelineHtml(T.log)}
 ${A.shareHtml(total)}<button class="primary" id="again">↺ Spila aftur</button><button id="other">Velja aðrar aðstæður</button><button id="tomenu">Aðalvalmynd</button></div>`;
 A.bindEnd(sc,total);$('#again').onclick=()=>A.restart();$('#other').onclick=()=>A.pickScreen(sc.track);$('#tomenu').onclick=()=>A.mainMenu();}
window.addEventListener('pagehide',()=>{try{abandon();}catch(_){}});
window.FHTRIAGE={start,state:()=>T};
})();
