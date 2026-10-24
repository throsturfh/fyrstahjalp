/* Fyrsta hjálp – tölfræðisíða (óhlekkjuð). Les gögn úr Supabase í gegnum rpc/fh_get_stats með leynilykli.
   Lykill: tolfraedi.html#<lykill> (vistast í þessum vafra og er strax fjarlægður úr slóðinni) eða sleginn inn. */
(function(){
'use strict';
const VER='0.4';
const CFG=window.FH_CONFIG||{};
const URL_=String(CFG.SUPABASE_URL||'').trim().replace(/\/+$/,''),KEY=String(CFG.SUPABASE_ANON_KEY||'').trim();
const LK='fh-tolfr-lykill';
const app=document.getElementById('app');
const TZ='Atlantic/Reykjavik';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ls={get(k){try{return localStorage.getItem(k)||'';}catch(_){return'';}},set(k,v){try{localStorage.setItem(k,v);}catch(_){}},del(k){try{localStorage.removeItem(k);}catch(_){}}};
let rows=[],F={lvl:'',user:'',days:'0'},drill=null,loadedAt=null;

/* lykill úr slóð */
(function(){const h=decodeURIComponent((location.hash||'').replace(/^#/,'')).trim();
 if(h){ls.set(LK,h);try{history.replaceState(null,'',location.pathname+location.search);}catch(_){location.hash='';}}})();

/* dagsetningar í Reykjavík */
const MON=['jan.','feb.','mar.','apr.','maí','jún.','júl.','ágú.','sep.','okt.','nóv.','des.'];
const parts=d=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d),g=t=>(p.find(x=>x.type===t)||{}).value;
 return {y:g('year'),mo:g('month'),d:g('day'),h:g('hour')==='24'?'00':g('hour'),mi:g('minute')};};
const fmtD={format:d=>{const p=parts(d);return (+p.d)+'. '+MON[+p.mo-1];}};
const dayKey=d=>{const p=parts(d);return p.y+'-'+p.mo+'-'+p.d;};
const dt=s=>{const d=new Date(s);if(isNaN(d))return'–';const p=parts(d);return (+p.d)+'. '+MON[+p.mo-1]+' '+p.y+' kl. '+p.h+':'+p.mi;};
const dur=s=>{s=Math.round(+s||0);const m=Math.floor(s/60),r=s%60;return m?m+' mín '+r+' s':r+' s';};
const uk=u=>String(u||'').trim().toLocaleLowerCase('is-IS');
const scCls=v=>v==null?'s-na':v>=85?'s-hi':v>=60?'s-mid':'s-lo';
const scH=v=>`<span class="sc ${scCls(v)}">${v==null?'–':esc(v)}</span>`;
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;

function keyScreen(msg){
 app.innerHTML=`<h1>Tölfræði</h1><p class="m">Fyrsta hjálp í óbyggðum · útgáfa ${VER}</p>
 ${msg?`<div class="err">${esc(msg)}</div>`:''}
 <form class="card keyform" id="kf"><label for="k">Aðgangslykill</label>
 <input id="k" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Límdu lykilinn hér">
 <button class="primary" type="submit">Opna tölfræði</button>
 <p class="m">Lykillinn er geymdur í þessum vafra þar til þú velur „Gleyma lykli“.</p></form>`;
 document.getElementById('kf').onsubmit=e=>{e.preventDefault();const v=document.getElementById('k').value.trim();if(v){ls.set(LK,v);load();}};
}

function load(){
 if(!URL_||!KEY){app.innerHTML=`<h1>Tölfræði</h1><div class="err">Tölfræðin er ekki tengd: fylla þarf inn SUPABASE_URL og SUPABASE_ANON_KEY í config.js.</div>`;return;}
 const k=ls.get(LK);if(!k){keyScreen();return;}
 app.innerHTML='<h1>Tölfræði</h1><p class="m">Sæki gögn…</p>';
 const h={'Content-Type':'application/json','apikey':KEY};if(/^eyJ/.test(KEY))h.Authorization='Bearer '+KEY;
 const ac=window.AbortController?new AbortController():null;const t=setTimeout(()=>{try{ac&&ac.abort();}catch(_){}},20000);
 fetch(URL_+'/rest/v1/rpc/fh_get_stats',{method:'POST',headers:h,body:JSON.stringify({p_key:k}),signal:ac?ac.signal:undefined,cache:'no-store',credentials:'omit'})
 .then(r=>{clearTimeout(t);if(r.status===401||r.status===403){ls.del(LK);throw{key:1};}if(!r.ok)throw{code:r.status};return r.json();})
 .then(d=>{if(!Array.isArray(d)){ls.del(LK);throw{key:1};}rows=d.filter(x=>x&&x.username&&x.scenario_id).map(x=>Object.assign({},x,{t:new Date(x.played_at),u:uk(x.username)}));rows.sort((a,b)=>b.t-a.t);loadedAt=new Date();render();})
 .catch(e=>{clearTimeout(t);if(e&&e.key)keyScreen('Rangur aðgangslykill. Reyndu aftur.');else app.innerHTML=`<h1>Tölfræði</h1><div class="err">Tókst ekki að sækja gögn${e&&e.code?' (villa '+esc(e.code)+')':''}. Athugaðu nettenginguna.</div><button id="rt" class="primary">Reyna aftur</button>`,(document.getElementById('rt')||{}).onclick=load;});
}

/* nöfn: algengasti ritháttur hvers notanda (hástafaóháð flokkun), við jafntefli sá nýjasti */
function names(rs){const c=new Map();rs.forEach(r=>{const k=r.u;if(!c.has(k))c.set(k,new Map());const m=c.get(k),n=String(r.username).trim();m.set(n,(m.get(n)||0)+1);});
 const out=new Map();c.forEach((m,k)=>{let best='',bn=-1;m.forEach((n,nm)=>{if(n>bn){best=nm;bn=n;}});out.set(k,best);});return out;}
function levels(rs){const m=new Map();rs.forEach(r=>{if(!m.has(r.scenario_id))m.set(r.scenario_id,r.scenario_title||r.scenario_id);});return m;}

function filtered(){const now=Date.now(),d=+F.days;
 return rows.filter(r=>(!F.lvl||r.scenario_id===F.lvl)&&(!F.user||r.u===F.user)&&(!d||now-r.t<d*864e5));}

function render(){
 const all=rows,NM=names(all),LV=levels(all),rs=filtered();
 const fin=rs.filter(r=>r.finished&&r.score!=null),sc=fin.map(r=>+r.score);
 const players=new Set(rs.map(r=>r.u)).size;
 let h=`<div class="top"><div><h1>Tölfræði</h1><p class="m">Fyrsta hjálp í óbyggðum · ${all.length} færslur · sótt ${esc(dt(loadedAt))}</p></div>
 <div class="acts"><button id="rl">↻ Endurhlaða</button><button id="fg">Gleyma lykli</button></div></div>
 <div class="filters">
 <label>Borð<select id="f_l"><option value="">Öll borð</option>${[...LV].map(([id,t])=>`<option value="${esc(id)}"${F.lvl===id?' selected':''}>${esc(t)}</option>`).join('')}</select></label>
 <label>Tímabil<select id="f_d">${[['0','Allt'],['1','Síðasti sólarhringur'],['7','Síðustu 7 dagar'],['30','Síðustu 30 dagar'],['90','Síðustu 90 dagar']].map(([v,t])=>`<option value="${v}"${F.days===v?' selected':''}>${t}</option>`).join('')}</select></label>
 <label class="wide">Notandi<select id="f_u"><option value="">Allir notendur</option>${[...NM].sort((a,b)=>a[1].localeCompare(b[1],'is')).map(([k,n])=>`<option value="${esc(k)}"${F.user===k?' selected':''}>${esc(n)}</option>`).join('')}</select></label></div>`;
 if(drill){h+=drillHtml(drill,NM,LV);app.innerHTML=h;wire();return;}
 h+=`<div class="tiles">
 <div class="tile"><b>${rs.length}</b><span>spilanir alls</span></div>
 <div class="tile"><b>${fin.length}</b><span>kláraðar</span></div>
 <div class="tile"><b>${rs.length-fin.length}</b><span>hætt í miðju</span></div>
 <div class="tile"><b>${players}</b><span>spilarar</span></div>
 <div class="tile"><b>${avg(sc)==null?'–':avg(sc)}</b><span>meðalstig</span></div>
 <div class="tile"><b>${sc.length?Math.max(...sc):'–'}</b><span>hæstu stig</span></div></div>`;
 if(!rs.length){h+='<p class="empty">Engar færslur passa við síuna.</p>';app.innerHTML=h;wire();return;}
 /* stigatafla per borð */
 h+='<h2>🏆 Stigatafla</h2>';
 const lvIds=[...new Set(rs.map(r=>r.scenario_id))];
 lvIds.forEach(id=>{const best=new Map();rs.filter(r=>r.scenario_id===id&&r.finished&&r.score!=null).forEach(r=>{const b=best.get(r.u);if(!b||+r.score>+b.score||(+r.score===+b.score&&r.t<b.t))best.set(r.u,r);});
  const top=[...best.values()].sort((a,b)=>b.score-a.score||a.t-b.t).slice(0,10);
  h+=`<h3>${esc(LV.get(id))}</h3>`+(top.length?`<div class="tw"><table><tr><th>#</th><th>Notandi</th><th class="n">Stig</th><th>Hvenær</th></tr>${top.map((r,i)=>`<tr><td class="rank">${i+1}</td><td><button class="link" data-u="${esc(r.u)}">${esc(NM.get(r.u))}</button></td><td class="n">${scH(r.score)}</td><td class="m">${esc(dt(r.played_at))}</td></tr>`).join('')}</table></div>`:'<p class="empty">Enginn hefur klárað þetta borð enn.</p>');});
 /* spilarar per borð */
 h+='<h2>👤 Spilarar</h2><div class="tw"><table><tr><th>Notandi</th><th>Borð</th><th class="n">Spil.</th><th class="n">Meðal</th><th class="n">Best</th><th class="n">Síðast</th></tr>';
 const grp=new Map();rs.forEach(r=>{const k=r.u+'\u0000'+r.scenario_id;if(!grp.has(k))grp.set(k,[]);grp.get(k).push(r);});
 [...grp.values()].sort((a,b)=>NM.get(a[0].u).localeCompare(NM.get(b[0].u),'is')||String(LV.get(a[0].scenario_id)).localeCompare(LV.get(b[0].scenario_id),'is')).forEach(g=>{
  const f=g.filter(r=>r.finished&&r.score!=null).map(r=>+r.score),last=g.find(r=>r.finished&&r.score!=null);
  h+=`<tr><td><button class="link" data-u="${esc(g[0].u)}">${esc(NM.get(g[0].u))}</button></td><td>${esc(LV.get(g[0].scenario_id))}</td><td class="n">${g.length}</td><td class="n">${avg(f)==null?'–':avg(f)}</td><td class="n">${f.length?Math.max(...f):'–'}</td><td class="n">${scH(last?+last.score:null)}</td></tr>`;});
 h+='</table></div>';
 /* algengustu mistök */
 h+='<h2>⚠️ Algengustu mistök</h2>';
 lvIds.forEach(id=>{const f=rs.filter(r=>r.scenario_id===id&&r.finished);const m=new Map();
  f.forEach(r=>(Array.isArray(r.lost)?r.lost:[]).forEach(l=>{const k=String(l&&l.label||'').trim();if(!k)return;const o=m.get(k)||{n:0,p:0};o.n++;o.p+=(+l.pts||0);m.set(k,o);}));
  const top=[...m].sort((a,b)=>b[1].n-a[1].n||b[1].p-a[1].p).slice(0,8);
  h+=`<h3>${esc(LV.get(id))} <span class="pill">${f.length} kláraðar</span></h3>`+(top.length?`<div class="card">${top.map(([k,o])=>{const pc=f.length?Math.round(100*o.n/f.length):0;return`<div class="mist"><div class="lab">${esc(k)}<div class="meter"><i style="width:${pc}%"></i></div></div><div class="num">${pc}% · ${o.n}×<br>−${Math.round(o.p/o.n)} stig</div></div>`;}).join('')}</div>`:'<p class="empty">Engin töpuð stig skráð.</p>');});
 /* virkni per dag */
 const nd=+F.days&&+F.days<=90?Math.max(7,+F.days):30;const cnt=new Map();rs.forEach(r=>{const k=dayKey(r.t);cnt.set(k,(cnt.get(k)||0)+1);});
 const days=[];for(let i=nd-1;i>=0;i--){const d=new Date(Date.now()-i*864e5);days.push({k:dayKey(d),d,n:cnt.get(dayKey(d))||0});}
 const mx=Math.max(1,...days.map(x=>x.n));
 h+=`<h2>📅 Virkni á dag (síðustu ${nd} dagar)</h2><div class="bars">${days.map(x=>`<div class="${x.n?'':'z'}" style="height:${x.n?Math.max(4,Math.round(100*x.n/mx)):2}%" title="${esc(fmtD.format(x.d))}: ${x.n}"></div>`).join('')}</div>
 <div class="barx"><span>${esc(fmtD.format(days[0].d))}</span><span>mest ${mx} á dag</span><span>${esc(fmtD.format(days[days.length-1].d))}</span></div>`;
 /* nýjustu spilanir */
 h+='<h2>🕑 Nýjustu spilanir</h2>'+attempts(rs.slice(0,25),NM,LV,true);
 app.innerHTML=h;wire();
}

function attempts(rs,NM,LV,showUser){
 return `<div class="tw"><table><tr><th>Hvenær</th>${showUser?'<th>Notandi</th>':''}<th>Borð</th><th class="n">Stig</th><th class="n">Tími</th><th>Ástand / mistök</th></tr>${rs.map(r=>{
  const lost=Array.isArray(r.lost)?r.lost:[];
  return `<tr><td class="m">${esc(dt(r.played_at))}</td>${showUser?`<td><button class="link" data-u="${esc(r.u)}">${esc(NM.get(r.u))}</button></td>`:''}<td>${esc(LV.get(r.scenario_id))}</td><td class="n">${r.finished?scH(r.score):'<span class="sc s-na">hætt</span>'}</td><td class="n">${esc(dur(r.duration_s))}</td><td>${esc(r.outcome||'–')}${r.version?`<span class="pill">v${esc(r.version)}</span>`:''}${lost.length?`<details><summary>${lost.length} atriði kostuðu stig</summary><ul class="lost">${lost.map(l=>`<li>${esc(l.label)} (−${esc(l.pts)})</li>`).join('')}</ul></details>`:''}</td></tr>`;}).join('')}</table></div>`;
}

function drillHtml(u,NM,LV){
 const rs=filtered().filter(r=>r.u===u);
 let h=`<button class="back" id="bk">← Til baka</button><h2>👤 ${esc(NM.get(u)||u)}</h2>`;
 if(!rs.length)return h+'<p class="empty">Engar færslur fyrir þennan notanda með þessari síu.</p>';
 const f=rs.filter(r=>r.finished&&r.score!=null).map(r=>+r.score);
 h+=`<div class="tiles"><div class="tile"><b>${rs.length}</b><span>spilanir</span></div><div class="tile"><b>${avg(f)==null?'–':avg(f)}</b><span>meðalstig</span></div><div class="tile"><b>${f.length?Math.max(...f):'–'}</b><span>hæstu stig</span></div><div class="tile"><b>${new Set(rs.map(r=>r.device_id)).size}</b><span>tæki</span></div></div>`;
 h+='<h2>Eftir borðum</h2><div class="tw"><table><tr><th>Borð</th><th class="n">Spil.</th><th class="n">Meðal</th><th class="n">Best</th><th class="n">Fyrst</th><th class="n">Síðast</th></tr>';
 [...new Set(rs.map(r=>r.scenario_id))].forEach(id=>{const g=rs.filter(r=>r.scenario_id===id),s=g.filter(r=>r.finished&&r.score!=null);const ss=s.map(r=>+r.score);
  h+=`<tr><td>${esc(LV.get(id))}</td><td class="n">${g.length}</td><td class="n">${avg(ss)==null?'–':avg(ss)}</td><td class="n">${ss.length?Math.max(...ss):'–'}</td><td class="n">${scH(s.length?+s[s.length-1].score:null)}</td><td class="n">${scH(s.length?+s[0].score:null)}</td></tr>`;});
 h+='</table></div><h2>Allar tilraunir</h2>'+attempts(rs,NM,LV,false);
 return h;
}

function wire(){
 const g=id=>document.getElementById(id);
 g('rl').onclick=load;
 g('fg').onclick=()=>{ls.del(LK);rows=[];drill=null;keyScreen('Lyklinum var eytt úr þessum vafra.');};
 g('f_l').onchange=e=>{F.lvl=e.target.value;render();};
 g('f_d').onchange=e=>{F.days=e.target.value;render();};
 g('f_u').onchange=e=>{F.user=e.target.value;drill=F.user||null;render();window.scrollTo(0,0);};
 if(g('bk'))g('bk').onclick=()=>{drill=null;F.user='';render();};
 app.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{drill=b.dataset.u;F.user=drill;render();window.scrollTo(0,0);});
}

load();
})();
