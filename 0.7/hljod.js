/* v0.7 – hljóð með WebAudio (engar hljóðskrár): vindur/umhverfi, andardráttur sjúklings, sírena, þyrla og stutt merki.
   Lágt stillt, byrjar aðeins eftir snertingu notanda, þagnar þegar síðan er falin. Val geymt í fh-hljod ('a'/'af'). */
(function(){
"use strict";
const LS='fh-hljod';const get=()=>{try{const v=localStorage.getItem(LS);return v===null?'a':v;}catch(_){return'a';}};
let ctx=null,master=null,noiseBuf=null,amb=null,ambKind='',breath=null,breathCfg=null,unlocked=false;
const on=()=>get()==='a';
function ensure(){if(ctx||!on())return ctx;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ctx=new AC();master=ctx.createGain();master.gain.value=0.22;master.connect(ctx.destination);
 const n=ctx.sampleRate*2;noiseBuf=ctx.createBuffer(1,n,ctx.sampleRate);const d=noiseBuf.getChannelData(0);let b=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;b=0.97*b+0.03*w;d[i]=b*3.2+w*0.08;}}catch(_){ctx=null;}return ctx;}
function noise(){const s=ctx.createBufferSource();s.buffer=noiseBuf;s.loop=true;return s;}
function stopNode(x){if(!x)return;try{x.g.gain.cancelScheduledValues(ctx.currentTime);x.g.gain.setTargetAtTime(0,ctx.currentTime,0.25);const n=x.nodes;setTimeout(()=>n.forEach(k=>{try{k.stop&&k.stop();}catch(_){}try{k.disconnect();}catch(_){}}),900);}catch(_){}}
/* umhverfishljóð: 'vindur' (sterkur vindur), 'gola' (létt gola), 'borg' (niður í borg á nóttu) */
function startAmb(kind){if(!ctx||!kind)return;const t=ctx.currentTime;const g=ctx.createGain();g.gain.value=0;g.connect(master);const s=noise();const f=ctx.createBiquadFilter();f.type='lowpass';
 const lfo=ctx.createOscillator(),lg=ctx.createGain();const nodes=[s,lfo];
 const P={vindur:[520,0.55,0.07,0.3],gola:[380,0.22,0.05,0.1],borg:[180,0.3,0.03,0.06]}[kind]||[400,0.2,0.05,0.1];
 f.frequency.value=P[0];f.Q.value=0.7;lfo.frequency.value=P[2];lg.gain.value=P[3];lfo.connect(lg);const vg=ctx.createGain();vg.gain.value=P[1];lg.connect(vg.gain);
 s.connect(f);f.connect(vg);vg.connect(g);s.start();lfo.start();g.gain.setTargetAtTime(1,t,1.2);amb={g,nodes};ambKind=kind;}
function setAmb(kind){if(kind===ambKind&&amb)return;if(amb){stopNode(amb);amb=null;}ambKind=kind||'';if(kind&&on()&&ensure()&&unlocked)startAmb(kind);}
/* andardráttur: rate = andardrættir á mín, rough = 0..1 (hvæsandi/erfið öndun) */
function setBreath(cfg){breathCfg=cfg||null;if(breath){clearInterval(breath.iv);stopNode(breath);breath=null;}if(!cfg||!on()||!ensure()||!unlocked)return;
 const g=ctx.createGain();g.gain.value=0;g.connect(master);const s=noise();const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=cfg.rough?1500:900;f.Q.value=cfg.rough?3:0.9;const eg=ctx.createGain();eg.gain.value=0;
 s.connect(f);f.connect(eg);eg.connect(g);s.start();g.gain.setTargetAtTime(cfg.vol||0.5,ctx.currentTime,0.3);
 const per=60/Math.max(4,Math.min(40,cfg.rate||16));const one=()=>{try{const t=ctx.currentTime;eg.gain.cancelScheduledValues(t);eg.gain.setValueAtTime(0,t);eg.gain.linearRampToValueAtTime(0.9,t+per*0.32);eg.gain.linearRampToValueAtTime(0.05,t+per*0.45);eg.gain.linearRampToValueAtTime(0.5,t+per*0.6);eg.gain.linearRampToValueAtTime(0,t+per*0.9);}catch(_){}};
 one();breath={g,nodes:[s],iv:setInterval(one,per*1000)};}
function tone(freqs,dur,type,vol,gap){if(!on()||!ensure()||!unlocked)return;try{let t=ctx.currentTime+0.02;freqs.forEach(fr=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'sine';o.frequency.value=fr;g.gain.value=0;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol||0.25,t+0.015);g.gain.setTargetAtTime(0,t+dur*0.6,dur*0.2);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.2);t+=dur+(gap||0);});}catch(_){}}
function fx(k){if(!on()||!ensure()||!unlocked)return;
 if(k==='good')tone([660,880],0.09,'sine',0.18,0.01);
 else if(k==='bad')tone([240,180],0.14,'triangle',0.22,0.02);
 else if(k==='radio')tone([1000,1000,1000],0.07,'square',0.06,0.06);
 else if(k==='star')tone([784,988,1175],0.12,'sine',0.18,0.02);
 else if(k==='sirena'){try{const t=ctx.currentTime;const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';for(let i=0;i<8;i++)o.frequency.setValueAtTime(i%2?770:960,t+i*0.45);g.gain.value=0;g.gain.linearRampToValueAtTime(0.09,t+0.6);g.gain.setValueAtTime(0.09,t+2.8);g.gain.linearRampToValueAtTime(0,t+3.6);o.connect(g);g.connect(master);o.start(t);o.stop(t+3.7);}catch(_){}}
 else if(k==='thyrla'){try{const t=ctx.currentTime;const s=noise(),f=ctx.createBiquadFilter(),g=ctx.createGain(),am=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();f.type='lowpass';f.frequency.value=160;lfo.frequency.value=11;lg.gain.value=0.5;am.gain.value=0.5;lfo.connect(lg);lg.connect(am.gain);
  g.gain.value=0;g.gain.linearRampToValueAtTime(0.9,t+1);g.gain.setValueAtTime(0.9,t+3);g.gain.linearRampToValueAtTime(0,t+4.2);s.connect(f);f.connect(am);am.connect(g);g.connect(master);s.start(t);lfo.start(t);s.stop(t+4.3);lfo.stop(t+4.3);}catch(_){}}}
function unlock(){if(!on())return;if(!ensure())return;try{if(ctx.state==='suspended')ctx.resume();}catch(_){}if(!unlocked){unlocked=true;const k=ambKind;ambKind='';if(k)setAmb(k);if(breathCfg)setBreath(breathCfg);}}
['pointerdown','keydown','touchstart'].forEach(e=>document.addEventListener(e,unlock,{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(!ctx)return;try{document.hidden?ctx.suspend():on()&&ctx.resume();}catch(_){}});
function set(v){try{localStorage.setItem(LS,v?'a':'af');}catch(_){}if(!v){const k=ambKind,b=breathCfg;if(amb){stopNode(amb);amb=null;}if(breath){clearInterval(breath.iv);stopNode(breath);breath=null;}ambKind=k;breathCfg=b;try{ctx&&ctx.suspend();}catch(_){}}
 else{unlock();try{ctx&&ctx.resume();}catch(_){}const k=ambKind,b=breathCfg;ambKind='';if(k)setAmb(k);if(b)setBreath(b);}}
function stopAll(){setAmb('');setBreath(null);}
window.FHSND={on,set,setAmb,setBreath,fx,stopAll,state:()=>({on:on(),ctx:ctx?ctx.state:'none',amb:amb?ambKind:'',breath:!!breath,unlocked})};
})();
