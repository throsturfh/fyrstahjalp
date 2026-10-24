/* Smáleikir – stuttir æfingaleikir úr námsefni fyrstu hjálpar (FH1, FH2, WFR).
   Notar window.FH_API úr game.js. Niðurstöður fara í fh_results með scenario_id „mini_<id>“ og track 0. */
(function(){
"use strict";
/* ---------- efni ---------- */
const ACR=[
 {a:'OLSENA',t:'Sjúkrasaga',w:[['O','Ofnæmi',['Ofkæling','Orka']],['L','Lyf',['Lífsmörk','Líkamshiti']],['S','Sjúkrasaga',['Sár','Skjálfti']],['E','Einkenni',['Eymsli','Endurmat']],['N','Neysla',['Nafn','Neyðarhjálp']],['A','Atvik',['Aldur','Aðstoð']]]},
 {a:'SAGA',t:'Skráning',w:[['S','Saga sjúklings',['Staðsetning','Stelling']],['A','Athugun björgunarmanns',['Atvik','Aðstoð']],['G','Greining vandamála',['Grunnmeðferð','Gegnflæði']],['A','Áætlun',['Aldur','Andardráttur']]]},
 {a:'VÁSE',t:'Meðvitund',w:[['V','Vakandi',['Veikur','Vökvatap']],['Á','Svarar ávarpi',['Áttaður','Áverki']],['S','Svarar sársauka',['Sljór','Sofandi']],['E','Engin viðbrögð',['Eðlileg öndun','Endurlífgun']]]},
 {a:'BROS',t:'Grunnmeðferð',w:[['B','Blástursmeðferð',['Blæðing','Blóðrás']],['R','Róa',['Rafmagn','Rétta']],['O','O₂ – hreint loft',['Orka','Ofnæmi']],['S','Stelling / staða',['Spelka','Sykur']]]},
 {a:'BSH',t:'Mat fyrir neðan áverka',w:[['B','Blóðrás',['Blæðing','Bólga']],['S','Snertiskyn',['Sjón','Sársauki']],['H','Hreyfigeta',['Hiti','Hæð']]]},
 {a:'HVÍL',t:'Stöðugir áverkar',w:[['H','Hvíla',['Hita','Hreyfa']],['V','Vefja',['Verkjalyf','Vatn']],['Í','Ís',['Íbúfen','Íhuga flutning']],['L','Lyfta',['Lyf','Losa']]]},
 {a:'ÞOLHRESS',t:'Taugakerfi',w:[['Þ','Þrýstingur',['Þreyta','Þvag']],['O','O₂ (súrefni)',['Ofnæmi','Orka']],['L','Líkamshiti',['Lyf','Lost']],['H','Hæð',['Hjartsláttur','Höfuðhögg']],['R','Rafmagn',['Róa','Rugl']],['E','Eitranir',['Einkenni','Eymsli']],['S','Sykur',['Sjáöldur','Sár']],['S','Sölt',['Saga','Skjálfti']]]}];
const PAIRS=[['OLSENA','Sjúkrasaga'],['SAGA','Skráning'],['VÁSE','Meðvitund'],['BROS','Grunnmeðferð í fyrstu hjálp'],['BSH','Mat fyrir neðan áverka á útlim'],['HVÍL','Meðferð stöðugra áverka'],['ÞOLHRESS','Taugakerfið'],['Snarvöndull','Blæðing sem beinn þrýstingur stöðvar ekki']];
const PAIRS2=[['Öndunarvegur','Öndunarkerfið'],['Öndun','Öndunarkerfið'],['Púls','Blóðrásarkerfið'],['Blæðing','Blóðrásarkerfið'],['VÁSE','Taugakerfið'],['Stuðningur við hrygg','Taugakerfið']];
const ORDER=[
 {t:'Þríhyrningakerfið',why:'Fyrst er vettvangur kannaður, svo frumskoðun, þá sjúkrasaga og líkamsskoðun. Klára skoðun áður en meðferð hefst – nema bregðast þarf strax við lífshættulegum vandamálum í frumskoðun.',s:['Vettvangur kannaður','Frumskoðun','Sjúkrasaga og líkamsskoðun','Meðferð']},
 {t:'Óstöðugur áverki á útlim',why:'Meta BSH → toga í rétta stöðu ef BSH er skert → halda stöðugu → spelka í réttri stöðu → endurmeta BSH eftir spelkun.',s:['Meta BSH fyrir neðan áverka','Toga í rétta stöðu','Halda stöðugu','Spelka','Endurmeta BSH']},
 {t:'Endurlífgun fullorðinna',why:'Meðvitundarlaus og andar ekki (athuga í hámark 10 sek) → hringja strax í 112 → 30 hnoð og 2 blástrar → hjartastuð sem fyrst, svo 2 mínútur af hnoði áður en tækið greinir aftur.',s:['Tryggja eigið öryggi','Meta meðvitund','Athuga öndun (hámark 10 sek)','Hringja í 112','30 hnoð og 2 blástrar','Tengja hjartastuðtæki og fylgja leiðbeiningum']},
 {t:'Stöðvun blæðingar',why:'Tryggja öryggi → finna blæðingarstað → beinn þrýstingur → snarvöndull ef þrýstingur dugar ekki (a.m.k. 5 cm ofan við áverkann) → annar snarvöndull eða þrýstiumbúðir ef hann dugar ekki.',s:['Tryggja öryggi','Finna blæðingarstað','Beinn þrýstingur','Snarvöndull','Annar snarvöndull eða þrýstiumbúðir']}];
/* lífsmörk fullorðinna: P 60–100/mín, Ö 12–20/mín, hiti 36,5–37,5 °C */
const VITALS=[
 ['Púls','72/mín, reglulegur',1,'Eðlilegur púls fullorðinna er 60–100/mín.'],
 ['Púls','128/mín',0,'Of hraður: eðlilegt er 60–100/mín.'],
 ['Púls','46/mín',0,'Of hægur: eðlilegt er 60–100/mín.'],
 ['Púls','88/mín',1,'Innan 60–100/mín.'],
 ['Öndun','16/mín, auðveld',1,'Eðlileg öndun er 12–20/mín og áreynslulaus.'],
 ['Öndun','30/mín, grunn',0,'Of hröð: eðlilegt er 12–20/mín.'],
 ['Öndun','8/mín',0,'Of hæg: eðlilegt er 12–20/mín.'],
 ['Öndun','14/mín en erfið, hvæsandi',0,'Tíðnin er í lagi en eðlileg öndun er áreynslulaus.'],
 ['Líkamshiti','37,0 °C',1,'Eðlilegur líkamshiti er 36,5–37,5 °C.'],
 ['Líkamshiti','34,6 °C',0,'Undir 35 °C er ofkæling.'],
 ['Líkamshiti','38,6 °C',0,'Yfir eðlilegum mörkum (36,5–37,5 °C).'],
 ['Súrefnismettun','97%',1,'Eðlileg súrefnismettun er yfir 94%.'],
 ['Súrefnismettun','89%',0,'Eðlileg súrefnismettun er yfir 94%.'],
 ['Meðvitund','V – áttaður á stað, stund, persónu og atviki',1,'Vakandi og vel áttaður.'],
 ['Meðvitund','Á – opnar augun aðeins þegar talað er við hann',0,'Skert meðvitund: bregst aðeins við ávarpi.']];
const QUIZ=[
 ['Eðlileg öndunartíðni fullorðinna?','12–20/mín',['6–10/mín','22–30/mín']],
 ['Eðlilegur púls fullorðinna?','60–100/mín',['40–60/mín','100–140/mín']],
 ['Eðlilegur líkamshiti?','36,5–37,5 °C',['35,0–36,0 °C','37,5–38,5 °C']],
 ['Hlutfall hnoða og blástra hjá fullorðnum?','30:2',['15:1','5:1']],
 ['Hraði hjartahnoðs?','100–120 á mínútu',['60–80 á mínútu','140–160 á mínútu']],
 ['Hve lengi í mesta lagi er öndun athuguð fyrir endurlífgun?','10 sekúndur',['30 sekúndur','1 mínútu']],
 ['Hvenær er gott að skipta um hnoðara?','Eftir 2 mínútur eða 5 umferðir',['Eftir 10 mínútur','Aldrei – sami maður hnoðar']],
 ['Drukknun: hvernig er endurlífgun hafin?','Blása 5 sinnum fyrst',['Hjartastuð fyrst','Hnoða 60 sinnum fyrst']],
 ['Hvenær virka hjartastuðtæki best?','Fyrstu 5 mínúturnar',['Eftir 20 mínútur','Aðeins í ofkælingu']],
 ['Eftir eitt hjartastuð…','2 mínútur af hnoði áður en tækið greinir aftur',['Bíða og sjá til','Gefa strax 3 stuð í röð']],
 ['Hættið endurlífgun ef…','Púls greinist',['Sjúklingur er grár','5 mínútur eru liðnar']],
 ['Alvarleg ofkæling: hve lengi er leitað eftir lífsmörkum?','A.m.k. eina mínútu',['10 sekúndur','Það er óþarfi']],
 ['Kjarnhiti í alvarlegri ofkælingu?','Lægri en 32 °C',['35–36 °C','36,5–37,5 °C']],
 ['Kjarnhiti í vægri ofkælingu?','Frá 35 °C niður í 32 °C',['Undir 28 °C','37–38 °C']],
 ['Merki um alvarlega ofkælingu?','Skert meðvitund og enginn skjálfti',['Mikill skjálfti en áttaður','Rauð og heit húð']],
 ['Hitatapsleiðirnar fjórar?','Leiðni, streymi, geislun, uppgufun',['Leiðni, sviti, hreyfing, öndun','Vindur, regn, snjór, kuldi']],
 ['Adrenalín í ofnæmislosti (fullorðinn)?','0,3 mg í vöðva',['3 mg í vöðva','0,3 mg um munn']],
 ['Endurtaka adrenalín í ofnæmislosti…','Eftir 5 mínútur ef þess þarf',['Eftir 1 klst','Aldrei']],
 ['Hvar er snarvöndull settur?','A.m.k. 5 cm ofan við áverkann, ekki yfir lið',['Beint yfir sárið','Yfir næsta lið fyrir ofan']],
 ['Fyrsta úrræði við blæðingu?','Beinn þrýstingur á upptökin',['Lyfta fætinum','Kæla sárið']],
 ['Hámarksskammtur parasetamóls á sólarhring (fullorðinn)?','4000 mg',['1000 mg','8000 mg']],
 ['Hvað er í Parkódín forte?','Kódein og parasetamól',['Íbúprófen','Adrenalín']],
 ['Ópíóíðar (t.d. kódein) geta…','Bælt öndun',['Hækkað líkamshita','Stöðvað blæðingu']],
 ['Hve lengi er fylgst með BSH eftir slys?','24 klst',['1 klst','Aðeins á vettvangi']],
 ['Spelka á löngu beini á að ná yfir…','Liðinn fyrir ofan og neðan',['Aðeins brotstaðinn','Næsta lið fyrir neðan']],
 ['„Á“ í VÁSE þýðir…','Svarar ávarpi',['Áttaður','Áverki']],
 ['Skert hugarstarf hjá sykursjúkum er…','Sykurfall þar til annað kemur í ljós',['Alltaf ofkæling','Ölvun']],
 ['Aðskotahlutur í öndunarvegi, fullorðinn með meðvitund hóstar ekki:','Slá 5x milli herðablaða, þrýsta 5x á kvið',['Gefa vatn að drekka','Leggja í læsta hliðarlegu']],
 ['Eðlileg súrefnismettun?','Yfir 94%',['Yfir 80%','Yfir 70%']],
 ['Skráning á vettvangi: betra að nota…','Blýant',['Penna','Tússpenna']],
 ['Merki um hækkaðan innankúpuþrýsting?','Misstór sjáöldur og uppköst',['Kláði og útbrot','Hægðatregða']],
 ['Ofnæmislost: hvað kemur fyrst?','Adrenalín',['Cetirizine','Dexamethason']],
 ['Heilaáverki – svefn:','Í lagi að sofa en ekki án eftirlits',['Halda vakandi í 24 klst án undantekninga','Sofa einn heima']]];
const SAGAREC=[
 {t:'Skráning 1 – Fótbrot í skriðu',l:[
  ['S','Karl, 28 ára, rann í lausri skriðu fyrir u.þ.b. 30 mín, fóturinn festist og hann féll fram fyrir sig.',0],
  ['S','OLSENA: ekkert ofnæmi, engin lyf, hraustur, verkur í hægri sköflungi, borðaði fyrir 2 klst.',0],
  ['A','P 96/mín, reglulegur. Ö 20/mín, áreynslulaus. VÁSE: V.',0],
  ['A','Hægri sköflungur aflagaður. BSH ekki metið – hann kvartar ekki undan dofa.',1,'BSH á alltaf að meta fyrir neðan áverkann – fyrir og eftir spelkun.'],
  ['G','Óstöðugur áverki á hægri sköflungi.',0],
  ['G','Mögulegar afleiðingar: engar.',1,'Mögulegar afleiðingar (G′) þarf að skrá, t.d. skert BSH, blóðþurrð og kólnun.'],
  ['A','Togað í rétta stöðu, haldið stöðugu, spelkað.',0],
  ['A','Spelka nær aðeins yfir brotstaðinn.',1,'Löng bein: spelka liðinn fyrir ofan og neðan (hné og ökkla).'],
  ['A','Skráð með penna á lausan miða sem varð eftir á vettvangi.',1,'Skráningarblaðið fylgir sjúklingi allan tímann og betra er að nota blýant en penna.']]},
 {t:'Skráning 2 – Kaldur göngumaður',l:[
  ['S','Karl, 60 ára, villtist í þoku, blautur og hefur legið í 2 klst.',0],
  ['S','Lyf: blóðþrýstingslyf. Neysla: morgunmatur kl. 8.',0],
  ['A','VÁSE: Á – svarar ávarpi. Enginn skjálfti.',0],
  ['A','Öndun 10/mín – eðlileg.',1,'Eðlileg öndun fullorðinna er 12–20/mín – 10/mín er of hæg.'],
  ['A','Púls 52/mín – eðlilegur.',1,'Eðlilegur púls fullorðinna er 60–100/mín – 52/mín er of hægur.'],
  ['G','Væg ofkæling.',1,'Skert meðvitund (Á á VÁSE) og enginn skjálfti eru merki um alvarlega ofkælingu.'],
  ['A','Gefinn heitur, sykraður drykkur.',1,'Orkuríkur drykkur er gefinn ef viðkomandi getur kyngt – við vægri ofkælingu. Með skerta meðvitund á ekki að gefa að drekka.'],
  ['A','Stöðvað hitatap: einangrun undir, blaut föt af, vindhelt utan um, hulið höfuð.',0],
  ['A','Hreyft varlega, liggjandi. Látið vita í 112 / aðgerðarstjórn.',0]]}];
const CASES=[
 {q:'Maður hnígur niður. Hann svarar ekki og tekur aðeins stök, óregluleg andköf.',a:'Hringja í 112 og hefja endurlífgun 30:2',o:['Læst hliðarlega og fylgjast með','Leita að púlsi í heila mínútu'],e:'Meðvitundarlaus og andar ekki eðlilega – stök andköf eru ekki eðlileg öndun. Hringja strax í 112, hnoða 30:2 og sækja hjartastuðtæki.'},
 {q:'Kona var stungin af býflugu. Varir bólgna, hálsinn þrengist, öndun hvæsandi, púls hraður og veikur.',a:'Ofnæmislost – adrenalín 0,3 mg í vöðva strax',o:['Staðbundin viðbrögð – kæla stunguna','Gefa cetirizine og bíða'],e:'Einkenni frá öndunarvegi og blóðrás = ofnæmislost. Adrenalín 0,3 mg í vöðva, endurtaka eftir 5 mín ef þarf.'},
 {q:'Ungur maður rotaðist í mínútu. Nú er hann ringlaður, með höfuðverk, kastar upp og sjáöldrin eru misstór.',a:'Grunur um hækkaðan innankúpuþrýsting – neyðarflutningur',o:['Ölvun – láta hann sofa úr sér','Vægur heilahristingur – fara heim'],e:'Skert meðvitund, höfuðverkur, uppköst og misstór sjáöldur eru merki um ↑IKÞ. Neyðarflutningur, búast við uppköstum, tryggja öndunarveg.'},
 {q:'Göngukona skelfur mikið, er köld og klaufsk en vakandi og getur kyngt.',a:'Væg ofkæling – stöðva hitatap og gefa orkuríkan drykk',o:['Alvarleg ofkæling – hefja hnoð','Ekkert að – ganga rösklega af stað'],e:'Skjálfti og klaufskar hreyfingar en vakandi = væg ofkæling. Stöðva hitatap og auka hitaframleiðslu með orku ef hún getur kyngt.'},
 {q:'Kaldur maður bregst aðeins við sársauka, skelfur ekki, púls mjög hægur og veikur.',a:'Alvarleg ofkæling – hreyfa varlega, leita lífsmarka í a.m.k. 1 mín, 112',o:['Væg ofkæling – láta hann ganga','Nudda hendur og fætur kröftuglega'],e:'S á VÁSE og enginn skjálfti = alvarleg ofkæling. Viðkvæmt hjarta: hreyfa varlega og lárétt, stöðva hitatap, láta vita.'},
 {q:'Framhandleggur er aflagaður og fingurnir eru fölir, kaldir og dofnir.',a:'Óstöðugur áverki með skert BSH – toga, halda, spelka, endurmeta BSH',o:['Stöðugur áverki – HVÍL','Spelka í núverandi stöðu og meta BSH aldrei'],e:'Markmið með togi er að leiðrétta skert BSH. Röð: Meta BSH → toga → halda stöðugu → spelka → meta BSH.'},
 {q:'Göngumaður sneri ökkla. Hann getur stigið í fótinn, BSH er eðlilegt og engin aflögun.',a:'Stöðugur áverki – HVÍL',o:['Óstöðugur áverki – toga í ökklann','Þyrla strax'],e:'Stöðugir áverkar: Hvíla, Vefja (muna BSH), Ís, Lyfta.'},
 {q:'Mikil blæðing úr læri. Beinn þrýstingur stöðvar hana ekki.',a:'Snarvöndull a.m.k. 5 cm ofan við sárið, ekki yfir lið',o:['Lyfta fætinum og bíða','Losa þrýstinginn og athuga sárið'],e:'Beinn þrýstingur fyrst; ef hann dugar ekki: snarvöndull a.m.k. 5 cm ofan við áverkann, forðast liði, ekki yfir mikinn fatnað.'},
 {q:'Sykursjúkur göngumaður verður ruglaður, órólegur og sveittur með hraðan púls.',a:'Sykurfall þar til annað kemur í ljós',o:['Ölvun','Ofnæmislost'],e:'„Skert hugarstarf hjá manni sem er sykursjúkur er sykurfall þar til annað kemur í ljós.“'},
 {q:'Kona í skíðaferð er óvenju syfjuð eftir fótbrot. Félaginn gaf henni tvær Parkódín forte.',a:'Kódein getur bælt öndun – vakta öndun og VÁSE, ekki meira parasetamól',o:['Gefa tvær parasetamól í viðbót','Leyfa henni að sofa án eftirlits'],e:'Ópíóíðar eru sljóvgandi og geta haft öndunarbælandi áhrif. Parkódín forte inniheldur parasetamól – hámark 4000 mg á sólarhring.'}];

/* ---------- hjálparföll ---------- */
const MG=[
 {id:'skammstafanir',ic:'🔤',t:'Skammstafanir',s:'Fyrir hvað standa stafirnir?'},
 {id:'tengja',ic:'🔗',t:'Tengja saman',s:'Paraðu saman hugtök.'},
 {id:'rada',ic:'↕️',t:'Raða í rétta röð',s:'Þríhyrningakerfið, spelkun, endurlífgun, blæðing.'},
 {id:'lifsmork',ic:'❤️',t:'Lífsmörk: eðlilegt eða ekki?',s:'Lífsmörk fullorðinna.'},
 {id:'hradaspurningar',ic:'⏱️',t:'Hraðaspurningar',s:'Eins mörg rétt svör og þú getur á 60 sekúndum.'},
 {id:'saga',ic:'📋',t:'Villur í SAGA-skráningu',s:'Finndu rangar línur.'},
 {id:'hnod',ic:'🫀',t:'Halda takti í hjartahnoði',s:'30 hnoð á 100–120 á mínútu.'},
 {id:'hvadaad',ic:'🩺',t:'Hvað er að?',s:'Stutt tilfelli – veldu rétt mat eða viðbragð.'}];
let api,cur,t0;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
function wrap(inner,cls){api.app.classList.remove('dist','close');api.app.innerHTML=api.bgHtml()+`<div class="full menu smal"><div class="card glass ${cls||''}">${inner}</div></div>`;const f=api.app.querySelector('.full');if(f)f.scrollTop=0;}
const q=s=>api.app.querySelector(s),qa=s=>api.app.querySelectorAll(s);
function best(id){return +api.store.get('fh-mini-'+id,'-1');}
function lostFor(labels,missing){const n=labels.length;if(!missing)return[];if(!n)return[{label:'Annað',pts:missing}];const b=Math.floor(missing/n);let r=missing-b*n;
 return labels.slice(0,40).map(l=>({label:String(l).slice(0,160),pts:b+(r-->0?1:0)})).filter(x=>x.pts>0);}
function record(g,score,outcome,lostLabels){try{const name=api.cleanName(api.store.get('fh-nafn',''))||'nafnlaus';
 const lost=lostFor(lostLabels,100-score);
 api.sendResult({id:api.rid(),played_at:new Date().toISOString(),username:name,scenario_id:('mini_'+g.id).slice(0,60),scenario_title:('Smáleikur: '+g.t).slice(0,120),track:0,score,finished:true,
  duration_s:Math.max(0,Math.min(86400,Math.round((Date.now()-t0)/1000))),game_minutes:0,lost,outcome:String(outcome).slice(0,200),patient_stable:true,decision:null,version:api.VER,device_id:api.deviceId()});}catch(_){}}
function finish(score,outcome,review,lostLabels){const g=cur;score=Math.max(0,Math.min(100,Math.round(score)));record(g,score,outcome,lostLabels||[]);
 const b=best(g.id);if(score>b)api.store.set('fh-mini-'+g.id,String(score));
 const praise=score>=90?'Frábært':score>=70?'Vel gert':score>=40?'Ágætt – æfðu þetta betur':'Æfðu þetta aftur';
 wrap(`<h1>${g.ic} ${esc(g.t)}</h1><div class="mscore" id="mscore">${score}/100</div><p><b>${praise}!</b> ${esc(outcome)}</p>${score>b&&b>=0?'<p class="ok">Nýtt met!</p>':''}
 <div class="mrev">${review||''}</div><button class="primary" id="mreplay">↺ Spila aftur</button><button id="mlist">← Smáleikir</button>`,'mres');
 q('#mreplay').onclick=()=>run(g.id);q('#mlist').onclick=list;}
function head(g,prog){return `<div class="mhead"><button class="tback" id="mquit">← Smáleikir</button><span class="muted" id="mprog">${prog||''}</span></div><h1>${g.ic} ${esc(g.t)}</h1>`;}
function bindQuit(){q('#mquit').onclick=()=>{stopAll();list();};}
let timers=[];function stopAll(){timers.forEach(clearInterval);timers.forEach(clearTimeout);timers=[];try{actx&&actx.close();}catch(_){}actx=null;}
let actx=null;

/* ---------- listi ---------- */
function list(){stopAll();cur=null;
 wrap(`<button class="tback" id="mback">← Aðalvalmynd</button><h1>Smáleikir</h1><p class="muted">Stuttar æfingar úr námsefninu. Hver leikur gefur stig af 100.</p>
 <div class="mcards">${MG.map(g=>{const b=best(g.id);return `<button class="mcard" data-m="${g.id}"><span class="mic">${g.ic}</span><span class="sct"><b>${esc(g.t)}</b><span>${esc(g.s)}</span>${b>=0?`<span class="mbest">Besta: ${b}/100</span>`:''}</span></button>`;}).join('')}</div>
 <button id="mback2">← Aðalvalmynd</button>`,'mlist');
 q('#mback').onclick=q('#mback2').onclick=()=>api.mainMenu();
 qa('[data-m]').forEach(b=>b.onclick=()=>run(b.dataset.m));}
function run(id){stopAll();cur=MG.find(g=>g.id===id);t0=Date.now();({skammstafanir:gAcr,tengja:gPairs,rada:gOrder,lifsmork:gVitals,hradaspurningar:gQuiz,saga:gSaga,hnod:gBeat,hvadaad:gCases})[id]();}

/* 1. Skammstafanir: velja orð fyrir hvern staf */
function gAcr(){const g=cur,items=ACR;let i=0,k=0,right=0,total=items.reduce((s,a)=>s+a.w.length,0);const wrong=[];const rev=[];let picked=[];
 function draw(){const a=items[i],w=a.w[k];const opts=shuffle([w[1]].concat(w[2]));
  wrap(head(g,`${i+1}/${items.length}`)+`<p class="muted">${esc(a.t)} – veldu hvað hver stafur stendur fyrir.</p>
  <div class="acr">${a.w.map((x,j)=>`<span class="al${j===k?' on':''}${j<k?(picked[j]?' r':' w'):''}"><b>${esc(x[0])}</b><i>${j<k?esc(x[1]):''}</i></span>`).join('')}</div>
  <div class="mq">${esc(a.a)}: <b>${esc(w[0])}</b> = ?</div><div class="mopts">${opts.map(o=>`<button class="mopt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`);bindQuit();
  qa('.mopt').forEach(b=>b.onclick=()=>{const ok=b.dataset.o===w[1];picked[k]=ok;if(ok)right++;else wrong.push(`${a.a}: ${w[0]} = ${w[1]}`);
   b.classList.add(ok?'r':'w');qa('.mopt').forEach(x=>{x.disabled=true;if(x.dataset.o===w[1])x.classList.add('r');});
   timers.push(setTimeout(()=>{k++;if(k>=a.w.length){rev.push(`<div class="step"><b>${esc(a.a)}</b> – ${esc(a.t)}<div>${a.w.map(x=>`<b>${esc(x[0])}</b> ${esc(x[1])}`).join(' · ')}</div></div>`);i++;k=0;picked=[];}
    if(i>=items.length)finish(100*right/total,`${right}/${total} stafir réttir.`,rev.join(''),wrong);else draw();},ok?350:900));});}
 draw();}

/* 2. Tengja saman */
function gPairs(){const g=cur;const rounds=[{t:'Skammstafanir og hugtök',p:PAIRS},{t:'Frumskoðun: hvaða líffærakerfi?',p:PAIRS2}];let r=0,right=0,total=0;const wrong=[],rev=[];
 function draw(){const R=rounds[r];const L=R.p.map((p,i)=>({i,t:p[0]}));const rightVals=[...new Set(R.p.map(p=>p[1]))];const Rt=shuffle(rightVals);
  const done=new Set(),missed=new Set();let sel=null;total+=R.p.length;
  wrap(head(g,`${r+1}/${rounds.length}`)+`<p class="muted">${esc(R.t)} – pikkaðu á atriði vinstra megin og svo á það sem passar hægra megin.</p>
  <div class="pairs"><div class="pcol">${L.map(x=>`<button class="pl" data-i="${x.i}">${esc(x.t)}</button>`).join('')}</div><div class="pcol">${Rt.map(t=>`<button class="pr" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`);bindQuit();
  qa('.pl').forEach(b=>b.onclick=()=>{if(done.has(+b.dataset.i))return;qa('.pl').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');sel=+b.dataset.i;});
  qa('.pr').forEach(b=>b.onclick=()=>{if(sel===null)return;const p=R.p[sel],lb=q(`.pl[data-i="${sel}"]`);
   if(b.dataset.v===p[1]){done.add(sel);if(!missed.has(sel))right++;lb.classList.remove('sel');lb.classList.add('r');lb.disabled=true;lb.textContent=p[0]+' → '+p[1];
    if(!R.p.some((pp,j)=>!done.has(j)&&pp[1]===p[1])){b.classList.add('r');b.disabled=true;}
    sel=null;if(done.size===R.p.length){rev.push(`<div class="step"><b>${esc(R.t)}</b>${R.p.map(pp=>`<div>${esc(pp[0])} → ${esc(pp[1])}</div>`).join('')}</div>`);r++;
     timers.push(setTimeout(()=>{if(r>=rounds.length)finish(100*right/total,`${right}/${total} tengingar réttar í fyrstu tilraun.`,rev.join(''),wrong);else draw();},500));}}
   else{if(!missed.has(sel)){missed.add(sel);wrong.push(`${p[0]} → ${p[1]}`);}b.classList.add('w');timers.push(setTimeout(()=>b.classList.remove('w'),500));}});}
 draw();}

/* 3. Raða í rétta röð (upp/niður hnappar) */
function gOrder(){const g=cur;let r=0,right=0,total=0;const wrong=[],rev=[];
 function draw(){const R=ORDER[r];let cur2=shuffle(R.s);while(cur2.every((x,i)=>x===R.s[i]))cur2=shuffle(R.s);
  function paint(){q('#olist').innerHTML=cur2.map((x,i)=>`<li class="oi"><span class="on">${i+1}</span><span class="ot">${esc(x)}</span><button class="ob" data-u="${i}" ${i===0?'disabled':''} aria-label="Færa upp">▲</button><button class="ob" data-d="${i}" ${i===cur2.length-1?'disabled':''} aria-label="Færa niður">▼</button></li>`).join('');
   qa('[data-u]').forEach(b=>b.onclick=()=>{const i=+b.dataset.u;[cur2[i-1],cur2[i]]=[cur2[i],cur2[i-1]];paint();});
   qa('[data-d]').forEach(b=>b.onclick=()=>{const i=+b.dataset.d;[cur2[i+1],cur2[i]]=[cur2[i],cur2[i+1]];paint();});}
  wrap(head(g,`${r+1}/${ORDER.length}`)+`<p class="muted">${esc(R.t)} – raðaðu með ▲▼ og ýttu á Athuga.</p><ol class="olist" id="olist"></ol><button class="primary" id="ocheck">Athuga</button>`);bindQuit();paint();
  q('#ocheck').onclick=()=>{let ok=0;cur2.forEach((x,i)=>{if(x===R.s[i])ok++;});right+=ok;total+=R.s.length;if(ok<R.s.length)wrong.push(`${R.t}: ${R.s.join(' → ')}`);
   qa('.oi').forEach((li,i)=>li.classList.add(cur2[i]===R.s[i]?'r':'w'));qa('.ob').forEach(b=>b.disabled=true);
   rev.push(`<div class="step"><b>${esc(R.t)}</b> (${ok}/${R.s.length})<div>${esc(R.why)}</div></div>`);
   const c=q('#ocheck');c.textContent=r+1<ORDER.length?'Næsta →':'Ljúka';c.insertAdjacentHTML('beforebegin',`<div class="mfb ${ok===R.s.length?'ok':'no'}">${ok===R.s.length?'Rétt röð!':'Rétt röð: '+esc(R.s.join(' → '))}</div>`);
   c.onclick=()=>{r++;if(r>=ORDER.length)finish(100*right/total,`${right}/${total} skref á réttum stað.`,rev.join(''),wrong);else draw();};};}
 draw();}

/* 4. Lífsmörk: eðlilegt eða ekki */
function gVitals(){const g=cur;const items=shuffle(VITALS);let i=0,right=0;const wrong=[],rev=[];
 function draw(){const v=items[i];
  wrap(head(g,`${i+1}/${items.length}`)+`<p class="muted">Fullorðinn einstaklingur í hvíld. Er gildið eðlilegt?</p><div class="vcard"><div class="muted">${esc(v[0])}</div><b>${esc(v[1])}</b></div>
  <div class="vbtns"><button class="vno" data-a="0">✗ Ekki eðlilegt</button><button class="vyes" data-a="1">✓ Eðlilegt</button></div><div id="vfb"></div>`);bindQuit();
  qa('[data-a]').forEach(b=>b.onclick=()=>{const ok=+b.dataset.a===v[2];if(ok)right++;else wrong.push(`${v[0]} ${v[1]}: ${v[2]?'eðlilegt':'ekki eðlilegt'}`);
   rev.push(`<div class="step"><span class="${ok?'ok':'no'}">${ok?'✓':'✗'}</span> ${esc(v[0])} ${esc(v[1])} – <b>${v[2]?'eðlilegt':'ekki eðlilegt'}</b><div class="r">${esc(v[3])}</div></div>`);
   qa('[data-a]').forEach(x=>x.disabled=true);b.classList.add(ok?'r':'w');q('#vfb').innerHTML=`<div class="mfb ${ok?'ok':'no'}">${ok?'Rétt':'Rangt'}: ${esc(v[3])}</div>`;
   timers.push(setTimeout(()=>{i++;if(i>=items.length)finish(100*right/items.length,`${right}/${items.length} rétt.`,rev.join(''),wrong);else draw();},ok?600:1400));});}
 draw();}

/* 5. Hraðaspurningar á móti klukku */
function gQuiz(){const g=cur;const items=shuffle(QUIZ);const dur=+(window.FHMINI_TIME||60);let i=0,right=0,wrongN=0,left=dur,over=false;const wrong=[],rev=[];
 function end(){if(over)return;over=true;stopAll();const sc=Math.max(0,Math.min(100,right*10-wrongN*5));
  finish(sc,`${right} rétt og ${wrongN} röng á ${dur} sek (10 stig fyrir rétt svar, −5 fyrir rangt).`,rev.join('')||'<p class="muted">Engu svarað.</p>',wrong.length?wrong:(sc<100?['Of fá rétt svör á tímanum']:[]));}
 function draw(){if(over)return;if(i>=items.length){end();return;}const it=items[i];const opts=shuffle([it[1]].concat(it[2]));
  wrap(head(g,`⏱ <b id="qt">${left}</b> s · ${right} rétt`)+`<div class="qbar"><i id="qbar" style="width:${100*left/dur}%"></i></div><div class="mq">${esc(it[0])}</div><div class="mopts">${opts.map(o=>`<button class="mopt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`);bindQuit();
  qa('.mopt').forEach(b=>b.onclick=()=>{if(over)return;const ok=b.dataset.o===it[1];if(ok)right++;else{wrongN++;wrong.push(`${it[0]} ${it[1]}`);}
   rev.push(`<div class="step"><span class="${ok?'ok':'no'}">${ok?'✓':'✗'}</span> ${esc(it[0])} <b>${esc(it[1])}</b></div>`);
   b.classList.add(ok?'r':'w');qa('.mopt').forEach(x=>{x.disabled=true;if(x.dataset.o===it[1])x.classList.add('r');});i++;timers.push(setTimeout(draw,ok?250:700));});}
 const tick=setInterval(()=>{left--;const t=q('#qt'),b=q('#qbar');if(t)t.textContent=Math.max(0,left);if(b)b.style.width=Math.max(0,100*left/dur)+'%';if(left<=0)end();},1000);timers.push(tick);
 draw();}

/* 6. Villur í SAGA-skráningu */
function gSaga(){const g=cur;let r=0,found=0,falseP=0,total=0;const wrong=[],rev=[];
 function draw(){const R=SAGAREC[r];const sel=new Set();
  wrap(head(g,`${r+1}/${SAGAREC.length}`)+`<p class="muted">${esc(R.t)}: pikkaðu á línurnar sem eru rangar og ýttu svo á Athuga.</p>
  <div class="sagal">${R.l.map((x,j)=>`<button class="sl" data-j="${j}"><span class="sk">${esc(x[0])}</span>${esc(x[1])}</button>`).join('')}</div><button class="primary" id="scheck">Athuga</button>`);bindQuit();
  qa('.sl').forEach(b=>b.onclick=()=>{const j=+b.dataset.j;if(sel.has(j))sel.delete(j);else sel.add(j);b.classList.toggle('sel');});
  q('#scheck').onclick=()=>{let html='';R.l.forEach((x,j)=>{const b=q(`.sl[data-j="${j}"]`);b.disabled=true;
    if(x[2]){total++;if(sel.has(j)){found++;b.classList.add('r');}else{b.classList.add('miss');wrong.push(`Villa ekki fundin: ${x[1]}`);}b.insertAdjacentHTML('beforeend',`<span class="sx">${esc(x[3])}</span>`);html+=`<div class="step"><span class="${sel.has(j)?'ok':'no'}">${sel.has(j)?'✓ Fundin':'✗ Ófundin'}</span> ${esc(x[1])}<div class="r">${esc(x[3])}</div></div>`;}
    else if(sel.has(j)){falseP++;b.classList.add('w');wrong.push(`Rétt lína merkt sem villa: ${x[1]}`);b.insertAdjacentHTML('beforeend',`<span class="sx">Þessi lína er rétt.</span>`);}});
   rev.push(`<div class="step"><b>${esc(R.t)}</b></div>`+html);
   const c=q('#scheck');c.textContent=r+1<SAGAREC.length?'Næsta skráning →':'Ljúka';c.onclick=()=>{r++;if(r>=SAGAREC.length)finish(100*Math.max(0,found-falseP)/total,`${found}/${total} villur fundnar${falseP?`, ${falseP} réttar línur merktar rangar`:''}.`,rev.join(''),wrong);else draw();};};}
 draw();}

/* 7. Halda takti í hjartahnoði */
function gBeat(){const g=cur;const N=30;let taps=[],metro=false;
 wrap(head(g,`0/${N}`)+`<p class="muted">Hnoðaðu 30 sinnum í jöfnum takti, 100–120 á mínútu. Pikkaðu á hnappinn eins og þú hnoðir.</p>
 <button class="bpad" id="bpad" aria-label="Hnoða"><span id="bn">0</span><small>Hnoða</small></button><div class="brate" id="brate">Hraði: –</div>
 <button id="bmet">🎵 Taktmælir (110/mín): af</button>`);bindQuit();
 const pad=q('#bpad');
 q('#bmet').onclick=()=>{metro=!metro;q('#bmet').textContent=`🎵 Taktmælir (110/mín): ${metro?'á':'af'}`;timers.forEach(clearInterval);timers=timers.filter(()=>false);
  if(metro){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();}catch(_){}
   timers.push(setInterval(()=>{pad.classList.add('pulse');setTimeout(()=>pad.classList.remove('pulse'),90);
    try{if(actx){const o=actx.createOscillator(),gn=actx.createGain();o.frequency.value=880;gn.gain.value=.15;o.connect(gn);gn.connect(actx.destination);o.start();o.stop(actx.currentTime+.04);}}catch(_){}},60000/110));}};
 pad.addEventListener('pointerdown',e=>{e.preventDefault();if(taps.length>=N)return;taps.push(performance.now());pad.classList.add('hit');setTimeout(()=>pad.classList.remove('hit'),80);
  q('#bn').textContent=taps.length;q('#mprog').textContent=`${taps.length}/${N}`;
  if(taps.length>=3){const iv=taps.slice(-6).map((t,i,a)=>i?t-a[i-1]:0).slice(1);const m=iv.reduce((a,b)=>a+b,0)/iv.length;const rate=Math.round(60000/m);
   q('#brate').innerHTML=`Hraði: <b class="${rate>=100&&rate<=120?'ok':'no'}">${rate}/mín</b>`;}
  if(taps.length>=N)setTimeout(done,250);});
 function done(){stopAll();const iv=taps.map((t,i)=>i?t-taps[i-1]:0).slice(1);const m=iv.reduce((a,b)=>a+b,0)/iv.length;const rate=60000/m;
  const sd=Math.sqrt(iv.reduce((a,b)=>a+(b-m)*(b-m),0)/iv.length),cv=sd/m;
  const off=rate<100?100-rate:rate>120?rate-120:0;const rs=Math.max(0,70-2*off);const cs=cv<=.08?30:cv>=.3?0:30*(.3-cv)/.22;
  const inR=iv.filter(x=>{const r=60000/x;return r>=100&&r<=120;}).length;
  const lost=[];if(rs<70)lost.push(`Hraði ${Math.round(rate)}/mín (á að vera 100–120/mín)`);if(cs<30)lost.push(`Ójafn taktur (frávik ${Math.round(cv*100)}%)`);
  finish(rs+cs,`Meðalhraði ${Math.round(rate)}/mín · ${inR}/${iv.length} hnoð á bilinu 100–120/mín · frávik ${Math.round(cv*100)}%.`,
   `<div class="step"><b>Hraði</b> (${Math.round(rs)}/70): ${Math.round(rate)}/mín – ${off?'utan':'innan'} 100–120/mín.</div><div class="step"><b>Jafn taktur</b> (${Math.round(cs)}/30): frávik ${Math.round(cv*100)}% milli hnoða.</div>
   <div class="step"><b>Mundu</b><div>Fullorðnir: 30 hnoð og 2 blástrar (30:2), 100–120 á mínútu. Hjartahnoð er mjög erfitt líkamlega – skiptið um hnoðara eftir 2 mínútur eða 5 umferðir.</div></div>`,lost);}}

/* 8. Hvað er að? */
function gCases(){const g=cur;const items=shuffle(CASES);let i=0,right=0;const wrong=[],rev=[];
 function draw(){const c=items[i];const opts=shuffle([c.a].concat(c.o));
  wrap(head(g,`${i+1}/${items.length}`)+`<div class="mcase">${esc(c.q)}</div><p class="muted">Hvað er líklegast að – og hvað gerirðu fyrst?</p><div class="mopts">${opts.map(o=>`<button class="mopt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="cfb"></div>`);bindQuit();
  qa('.mopt').forEach(b=>b.onclick=()=>{const ok=b.dataset.o===c.a;if(ok)right++;else wrong.push(`${c.q.slice(0,70)}… → ${c.a}`);
   qa('.mopt').forEach(x=>{x.disabled=true;if(x.dataset.o===c.a)x.classList.add('r');});if(!ok)b.classList.add('w');
   rev.push(`<div class="step"><span class="${ok?'ok':'no'}">${ok?'✓':'✗'}</span> ${esc(c.q)}<div><b>${esc(c.a)}</b></div><div class="r">${esc(c.e)}</div></div>`);
   q('#cfb').innerHTML=`<div class="mfb ${ok?'ok':'no'}">${ok?'Rétt!':'Rangt.'} ${esc(c.e)}</div><button class="primary" id="cnext">${i+1<items.length?'Næsta →':'Ljúka'}</button>`;
   q('#cnext').onclick=()=>{i++;if(i>=items.length)finish(100*right/items.length,`${right}/${items.length} rétt.`,rev.join(''),wrong);else draw();};
   q('#cnext').scrollIntoView({block:'nearest'});});}
 draw();}

window.FHMINI={open(a){api=a;list();},list:MG,data:{ACR,PAIRS,PAIRS2,ORDER,VITALS,QUIZ,SAGAREC,CASES}};
})();
