/* v0.7 – ferill björgunarmanns: stjörnur, merki, reynslustig (XP) og tignir.
   Allt geymt í localStorage þessa tækis (fh-stjornur, fh-merki, fh-xp, fh-opid). Engin nettenging. */
(function(){
"use strict";
const ls={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v;}catch(_){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(_){}}};
const J=(k,d)=>{try{const v=JSON.parse(ls.get(k,''));return v&&typeof v==='object'?v:d;}catch(_){return d;}};
/* tignir: FH1 er alltaf opin; FH2 og WFR opnast með reynslu – eða strax ef þú ert á námskeiðinu („opna samt“) */
const RANKS=[
 {xp:0,ic:'🌱',t:'Nýliði',u:'Fyrsta hjálp 1, smáleikir, dagleg áskorun og sögusería'},
 {xp:100,ic:'🎖️',t:'Björgunarmaður',u:'Opnar: Fyrsta hjálp 2 – kuldi, bið, flutningur og fjöldaslys',track:2},
 {xp:300,ic:'🏔️',t:'Reyndur björgunarmaður',u:'Opnar: Wilderness First Responder (WFR)',track:3},
 {xp:700,ic:'🧭',t:'Hópstjóri',u:'Heiðurstign: stýrir félögum á vettvangi og forgangsraðar verkum'},
 {xp:1200,ic:'📡',t:'Vettvangsstjóri',u:'Heiðurstign: margir sjúklingar og samskipti við aðgerðarstjórn'}];
const TRACK_XP={1:0,2:100,3:300};
/* merki: c = litur á merkinu; h = hvernig það vinnst */
const BADGES=[
 {id:'oryggi',ic:'🦺',c:'g',t:'Öryggið fyrst',h:'Örugg nálgun að sjúklingi'},
 {id:'arnarauga',ic:'🔭',c:'b',t:'Arnarauga',h:'Kannaðir alla staði á vettvangi úr fjarlægð'},
 {id:'frumskodun',ic:'🩺',c:'b',t:'Fullkomin frumskoðun',h:'Frumskoðun kláruð án mistaka'},
 {id:'engin',ic:'🎯',c:'y',t:'Engin mistök',h:'Lauk aðstæðum án rangrar aðgerðar'},
 {id:'fullt',ic:'💯',c:'y',t:'Fullt hús',h:'100 stig í aðstæðum'},
 {id:'adstod',ic:'📻',c:'r',t:'Rétt aðstoð',h:'Rétt aðstoð kölluð á réttum tíma'},
 {id:'endurmat',ic:'🔁',c:'b',t:'Endurmat',h:'Lífsmörk endurmetin minnst tvisvar eftir að meðferð hófst'},
 {id:'hitatap',ic:'🧥',c:'g',t:'Hitatap stöðvað',h:'Allar leiðir hitataps stöðvaðar'},
 {id:'taska',ic:'🎒',c:'g',t:'Vel pakkað',h:'Allt sem þurfti var í töskunni'},
 {id:'kaldurhaus',ic:'⚡',c:'r',t:'Kaldur haus',h:'Brást rétt við óvæntri uppákomu'},
 {id:'lidsheild',ic:'👥',c:'b',t:'Liðsheild',h:'Fól teyminu minnst þrjú verkefni'},
 {id:'forgangur',ic:'🚑',c:'r',t:'Forgangsröðun',h:'Rétt forgangsröðun allra sjúklinga í fjöldaslysi'},
 {id:'saga',ic:'📖',c:'y',t:'Sögulok',h:'Laukst allri söguseríunni'},
 {id:'dagleg',ic:'📅',c:'y',t:'Dagsverk',h:'Laukst daglegri áskorun'},
 {id:'vinur',ic:'🤝',c:'g',t:'Áskorun tekin',h:'Spilaðir áskorun frá vini'},
 {id:'sveit',ic:'🏆',c:'r',t:'Fyrir sveitina',h:'Spilaðir vikuáskorun fyrir björgunarsveitina þína'},
 {id:'thrjar',ic:'⭐',c:'y',t:'Þrjár á öllum',h:'3 stjörnur í öllum aðstæðum á einni braut'},
 {id:'smaleikir',ic:'🧠',c:'b',t:'Fróðleiksfús',h:'90+ stig í þremur ólíkum smáleikjum'}];
function stars(score){return score>=90?3:score>=70?2:1;}
const starsAll=()=>J('fh-stjornur',{});const badgesAll=()=>J('fh-merki',{});
const xp=()=>Math.max(0,+ls.get('fh-xp','0')||0);
function rankOf(x){let r=RANKS[0];RANKS.forEach(k=>{if(x>=k.xp)r=k;});return r;}
function nextRank(x){return RANKS.find(k=>k.xp>x)||null;}
function unlocked(track){const o=J('fh-opid',{});return!!o[track]||xp()>=(TRACK_XP[track]||0);}
function forceOpen(track){const o=J('fh-opid',{});o[track]=1;ls.set('fh-opid',JSON.stringify(o));}
function addXp(n){const x=xp()+Math.max(0,Math.round(n));ls.set('fh-xp',String(x));return x;}
function giveBadges(ids){const b=badgesAll(),nw=[];(ids||[]).forEach(id=>{if(!b[id]&&BADGES.some(x=>x.id===id)){b[id]=new Date().toISOString().slice(0,10);nw.push(id);}});ls.set('fh-merki',JSON.stringify(b));return nw;}
/* award: kallað einu sinni í lok aðstæðna. scenarios: listi allra aðstæðna (fyrir „Þrjár á öllum“). Skilar því sem birtist í samantekt. */
function award(o){const before=xp(),rb=rankOf(before);const S=starsAll();const prev=S[o.sid]||0;const s=o.finished===false?0:stars(o.score);
 if(s>prev){S[o.sid]=s;ls.set('fh-stjornur',JSON.stringify(S));}
 const ids=(o.badges||[]).slice();
 if(o.scenarios&&o.track){const L=o.scenarios.filter(x=>x.track===o.track);if(L.length&&L.every(x=>(S[x.id]||0)>=3))ids.push('thrjar');}
 const nw=giveBadges(ids);
 const gain=Math.round(o.score/2)+Math.max(0,s-prev)*25+nw.length*30+(o.bonus||0);const after=addXp(gain);
 return{stars:s,prev,newBest:s>prev,badges:ids.filter((x,i)=>ids.indexOf(x)===i),newBadges:nw,gain,before,after,rankBefore:rb,rank:rankOf(after),next:nextRank(after),rankUp:rankOf(after)!==rb};}
function miniAward(id,score){const nw=[];try{const best=J('fh-mini90',{});if(score>=90){best[id]=1;ls.set('fh-mini90',JSON.stringify(best));}if(Object.keys(best).length>=3)nw.push(...giveBadges(['smaleikir']));}catch(_){}
 const before=xp(),after=addXp(Math.round(score/5));return{gain:after-before,newBadges:nw,rank:rankOf(after),rankUp:rankOf(after)!==rankOf(before)};}
window.FHX={RANKS,BADGES,TRACK_XP,stars,starsAll,badgesAll,xp,rankOf,nextRank,unlocked,forceOpen,addXp,giveBadges,award,miniAward};
})();
