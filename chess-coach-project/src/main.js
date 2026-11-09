import './style.css';
import { Chess } from './chessLib.js';
import { root, rootT, DEPTH, NOISE, wp } from './engine.js';
import { GL, drawBoard } from './board.js';
import { askClaude } from './claude.js';
import { sfInit, sfRoot, SF_LEVELS } from './stockfish.js';

const $=s=>document.querySelector(s);
let game=new Chess(),me='w',lvl=2,flip=false,sel=null,hint=null,busy=false,mode='P',rv=null,ri=0,saved=false,token=0,coachHist=[],pm='free',pend=null;
const draw=(g,last)=>drawBoard(g,last,{sel,hint,flip});

const lastMove=()=>{const h=game.history({verbose:true});return h[h.length-1];};

/* ---------- play ---------- */
function sync(){
 draw(game,lastMove());
 let t;
 if(game.game_over())t=game.in_checkmate()?(game.turn()===me?'Checkmate. You lost.':'Checkmate. You won!'):'Draw.';
 else t=(game.turn()===me?'Your move':'Engine is thinking…')+(game.in_check()?' (check)':'');
 $('#st').textContent=t;$('#st').className=game.in_checkmate()?'mt':'';
 const h=game.history();let s='';
 h.forEach((m,i)=>{s+=(i%2?'':`<span>${(i>>1)+1}.</span>`)+`<b style="font-weight:400;padding:2px 4px">${m}</b>`;});
 $('#ml').innerHTML=s||'<span>No moves yet.</span>';$('#ml').scrollTop=1e5;}
function fin(){
 if(saved||!game.history().length)return;saved=true;
 const res=game.in_checkmate()?(game.turn()===me?'Loss':'Win'):'Draw';
 try{const a=JSON.parse(localStorage.getItem('cc_games')||'[]');
  a.unshift({pgn:game.pgn(),res,lvl,me,d:new Date().toLocaleDateString()});
  localStorage.setItem('cc_games',JSON.stringify(a.slice(0,20)));}catch(e){}}
async function pickMove(g){
 if(lvl>=5){try{const r=await sfRoot(g,SF_LEVELS[lvl]);if(r.m)return r;}catch(e){showSF('Stockfish problem ('+e.message+'). Using the built-in engine for this move.');}}
 return lvl>=4?rootT(g,3500):root(g,DEPTH[Math.min(lvl,3)-1],NOISE[Math.min(lvl,3)-1]);}
function showSF(t){const el=$('#sfs');el.hidden=!t;el.textContent=t||'';}
function preloadSF(){showSF('Loading Stockfish…');sfInit().then(()=>showSF('Stockfish ready.')).catch(e=>showSF('Stockfish could not load ('+e.message+'). The built-in engine will be used instead.'));}
function engine(){
 if(game.game_over()){fin();sync();return;}
 busy=true;sync();
 const gm=game;
 setTimeout(async()=>{
  const t0=Date.now(),r=await pickMove(gm),wait=Math.max(0,800+Math.random()*1400-(Date.now()-t0));
  setTimeout(()=>{if(gm!==game)return;if(r.m)game.move(r.m);busy=false;hint=null;sync();if(game.game_over())fin();},wait);},60);}
function newGame(){
 token++;game=new Chess();me=$('#selC').value;lvl=+$('#selL').value;lvl>=5?preloadSF():showSF('');flip=me==='b';
 sel=hint=null;saved=false;rv=null;busy=false;coachHist=[];pend=null;$('#nt').hidden=true;pm=$('#selM').value;setMode('P');sync();if(me==='b')engine();}
$('#board').addEventListener('click',e=>{
 const el=e.target.closest('.sq');if(!el||mode==='R'||busy||game.game_over()||game.turn()!==me)return;
 const sq=el.dataset.sq,p=game.get(sq);
 if(sel){const mv=game.moves({square:sel,verbose:true}).find(m=>m.to===sq);
  if(mv){if(mv.flags.includes('p')){askPromo(sel,sq);return;}doMove(sel,sq,'q');return;}}
 sel=p&&p.color===me?sq:null;draw(game,lastMove());});
function doMove(from,to,pr){const fen0=game.fen(),mo=game.move({from,to,promotion:pr});sel=hint=null;sync();if(game.game_over()){fin();return;}pm==='free'?engine():check(fen0,mo);}
function closePromo(){$('#pp').hidden=true;sel=null;draw(game,lastMove());}
function askPromo(from,to){
 $('#pr').innerHTML=[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(([t,n])=>`<button class="b pb" data-p="${t}" aria-label="${n}"><span class="pc ${me}">${GL[t]}\uFE0E</span></button>`).join('');
 $('#pp').hidden=false;
 $('#pr').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('#pp').hidden=true;doMove(from,to,b.dataset.p);});
 $('#pr').querySelector('button').focus();}
$('#pp').onclick=e=>{if(e.target.id==='pp')closePromo();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#pp').hidden)closePromo();});
$('#bNew').onclick=newGame;
$('#bFlip').onclick=()=>{flip=!flip;mode==='P'?draw(game,lastMove()):renderR();};
$('#bUndo').onclick=()=>{if(busy||game.history().length<2)return;game.undo();game.undo();saved=false;sel=hint=null;sync();};
$('#bHint').onclick=()=>{if(busy||game.game_over()||game.turn()!==me)return;
 const r=root(game,2,0);hint=r.m;draw(game,lastMove());$('#st').textContent='Hint: look at the outlined squares.';};

/* ---------- review ---------- */
function setMode(m){mode=m;$('#vP').hidden=m!=='P';$('#vR').hidden=m!=='R';$('#vC').hidden=m!=='C';
 $('#tP').setAttribute('aria-selected',m==='P');$('#tR').setAttribute('aria-selected',m==='R');$('#tC').setAttribute('aria-selected',m==='C');}
$('#tP').onclick=()=>{setMode('P');sel=null;sync();};
$('#tR').onclick=()=>{setMode('R');renderR();};
const CLS=[[20,'best','Best'],[60,'good','Good'],[120,'inacc','Inaccuracy'],[300,'mistake','Mistake'],[1e9,'blunder','Blunder']];
const SYM={inacc:'?!',mistake:'?',blunder:'??'};
async function analyze(g){
 const my=++token,mv=g.history({verbose:true}),t=new Chess(),fens=[t.fen()];
 mv.forEach(m=>{t.move({from:m.from,to:m.to,promotion:m.promotion});fens.push(t.fen());});
 rv={mv,fens,e:[],best:[],loss:[],cls:[],done:false};ri=mv.length;setMode('R');renderR();
 for(let i=0;i<=mv.length;i++){
  const p=new Chess(fens[i]),r=root(p,2,0);
  rv.e.push(r.s*(p.turn()==='w'?1:-1));rv.best.push(r.m?r.m.san:'');
  $('#pb')&&($('#pb').style.width=(i/mv.length*100)+'%');
  await new Promise(r=>setTimeout(r,0));if(my!==token)return;}
 for(let i=0;i<mv.length;i++){const s=i%2?-1:1;
  const cl=Math.min(1500,Math.max(0,s*(rv.e[i]-rv.e[i+1])));
  rv.loss.push(cl);rv.cls.push(CLS.find(c=>cl<c[0]));}
 rv.done=true;renderR();}
function acc(side){const l=rv.loss.filter((_,i)=>i%2===side);if(!l.length)return '–';
 return Math.round(100*Math.exp(-(l.reduce((a,b)=>a+b,0)/l.length)/150))+'%';}
function renderR(){
 const box=$('#vR');
 if(!rv){let a=[];try{a=JSON.parse(localStorage.getItem('cc_games')||'[]');}catch(e){}
  box.innerHTML=`<p class="mute">Review checks every move of a game and flags inaccuracies, mistakes and blunders.</p>
  <div class="row"><button class="b p" id="bCur" ${game.history().length?'':'disabled'}>Review current game</button></div>
  <p class="mute">Saved games</p>`+(a.length?a.map((x,i)=>`<div class="row"><button class="b" data-g="${i}">Review</button><span>${x.d} · ${x.res} · Level ${x.lvl}</span></div>`).join(''):'<p class="mute">Finished games appear here automatically.</p>');
  $('#bCur')&&($('#bCur').onclick=()=>analyze(game));
  box.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const g=new Chess();g.load_pgn(a[b.dataset.g].pgn);me=a[b.dataset.g].me;flip=me==='b';analyze(g);});
  draw(game,lastMove());return;}
 const n=rv.mv.length,c=new Chess(rv.fens[ri]);sel=hint=null;draw(c,rv.mv[ri-1]);
 $('#st').textContent=rv.done?'Reviewing move '+ri+' of '+n:'Analysing…';
 let h='';
 if(!rv.done)h+=`<p class="mute">Checking each move…</p><div class="bar"><div id="pb"></div></div>`;
 else{
  const cnt=s=>['inacc','mistake','blunder'].map(k=>rv.cls.filter((c,i)=>i%2===s&&c[1]===k).length);
  const a=cnt(0),b=cnt(1);
  h+=`<table><tr><th></th><th>Accuracy</th><th>Inacc.</th><th>Mistakes</th><th>Blunders</th></tr>
  <tr><td>White</td><td>${acc(0)}</td><td>${a[0]}</td><td>${a[1]}</td><td>${a[2]}</td></tr>
  <tr><td>Black</td><td>${acc(1)}</td><td>${b[0]}</td><td>${b[1]}</td><td>${b[2]}</td></tr></table>
  <p class="mute" style="margin:4px 0 8px">Accuracy is an estimate from a shallow engine search.</p>`;
  const pts=rv.e.map((e,i)=>`${(i/Math.max(1,n)*300).toFixed(1)},${(42-Math.max(-600,Math.min(600,e))/600*38).toFixed(1)}`).join(' ');
  h+=`<svg class="gr" id="gr" viewBox="0 0 300 84" preserveAspectRatio="none" role="img" aria-label="Evaluation graph"><line x1="0" x2="300" y1="42" y2="42" stroke="currentColor" opacity=".25"/><polyline points="${pts}" fill="none" stroke="#2b8a6e" stroke-width="2" vector-effect="non-scaling-stroke"/><line x1="${ri/Math.max(1,n)*300}" x2="${ri/Math.max(1,n)*300}" y1="0" y2="84" stroke="#c25a10" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  if(ri>0){const i=ri-1,cl=rv.cls[i];
   h+=`<div class="box"><b>${(i>>1)+1}${i%2?'…':'.'} ${rv.mv[i].san}</b> — ${cl[2]}${cl[1]==='best'||cl[1]==='good'?'':` (−${(rv.loss[i]/100).toFixed(1)} pawns)`}`+
   (cl[1]==='inacc'||cl[1]==='mistake'||cl[1]==='blunder'?`<br>Better: <b>${rv.best[i]}</b>`:'')+`</div>`;}
 }
 h+=`<div class="mvs">`+rv.mv.map((m,i)=>{const k=rv.cls[i]?rv.cls[i][1]:'';
  return (i%2?'':`<span>${(i>>1)+1}.</span>`)+`<button data-i="${i+1}" class="${i+1===ri?'cur ':''}c-${k}">${m.san}${SYM[k]||''}</button>`;}).join('')+`</div>`;
 h+=`<div class="row" style="margin-top:12px"><button class="b" id="rp">◀</button><button class="b" id="rn">▶</button><button class="b" id="rf">Flip</button><button class="b" id="rx">Close review</button></div>
  <p class="mute" style="margin-bottom:4px">PGN (copy to keep or import elsewhere)</p><textarea readonly id="pg"></textarea>`;
 box.innerHTML=h;
 const full=new Chess();rv.mv.forEach(m=>full.move({from:m.from,to:m.to,promotion:m.promotion}));$('#pg').value=full.pgn();
 box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ri=+b.dataset.i;renderR();});
 $('#rp').onclick=()=>{ri=Math.max(0,ri-1);renderR();};
 $('#rn').onclick=()=>{ri=Math.min(n,ri+1);renderR();};
 $('#rf').onclick=()=>{flip=!flip;renderR();};
 $('#rx').onclick=()=>{token++;rv=null;renderR();};
 const gr=$('#gr');gr&&(gr.onclick=e=>{const r=gr.getBoundingClientRect();ri=Math.round((e.clientX-r.left)/r.width*n);renderR();});}
/* ---------- coach ---------- */
/* ---------- tutor / live coach ---------- */
function check(fen0,mo){
 busy=true;$('#st').textContent='Checking your move…';const gm=game;
 setTimeout(()=>{
  if(gm!==game)return;
  const b=root(new Chess(fen0),3,0),a=root(new Chess(game.fen()),3,0);
  const w0=wp(b.s),w1=wp(-a.s);
  let drop=Math.max(0,w0-w1);if(b.m&&b.m.san===mo.san)drop=0;
  const i={fen0,played:mo.san,best:b.m?b.m.san:'',bm:b.m,reply:a.m?a.m.san:'',w0,w1,drop,bad:drop>=+$('#selT').value,hadMate:b.s>20000};
  showNote(i);
  if(i.bad&&pm==='tutor'){pend=i;$('#st').textContent='Your move was flagged. Choose below.';return;}
  engine();},30);}
function showNote(i){
 const n=$('#nt'),tut=pm==='tutor'&&i.bad;n.hidden=false;
 const head=i.bad?`${i.played} drops your winning chances from ${Math.round(i.w0)}% to ${Math.round(i.w1)}%. Better was ${i.best}.${i.hadMate?' A forced mate was available.':''}`:`${i.played} is fine. Your winning chances are about ${Math.round(i.w1)}%.`;
 n.innerHTML=`<b>${head}</b><div class="bar" style="margin:6px 0"><div style="width:${i.w1}%"></div></div><p id="nr" class="mute" style="margin:0 0 6px"></p>`+(tut?`<div class="row" style="margin:0"><button class="b p" id="nBack">Try again</button><button class="b" id="nShow">Show better move</button><button class="b" id="nKeep">Keep my move</button></div>`:'');
 if(tut){$('#nBack').onclick=()=>undoPend(false);$('#nShow').onclick=()=>undoPend(true);$('#nKeep').onclick=()=>{pend=null;engine();};}
 if(i.bad)explain(i);}
function undoPend(show){const i=pend;if(!i)return;game.undo();pend=null;busy=false;hint=show?i.bm:null;sel=null;sync();}
async function explain(i){
 const el=$('#nr');if(!el)return;el.textContent='Coach is thinking…';
 try{
  const res=await askClaude(`You are a chess coach. In at most 3 short sentences (under 60 words), explain what the student's move allows or misses, then why the better move is better. Use ONLY the data below; never invent moves or pieces; plain language; no preamble.\n\nBoard before the move (uppercase White, lowercase Black):\n${ascii(new Chess(i.fen0))}\nStudent (${me==='w'?'White':'Black'}) played ${i.played}; the better move was ${i.best}.\nAfter ${i.played}, the engine's best reply is ${i.reply||'none'}.\nStudent's winning chances: ${Math.round(i.w0)}% before, ${Math.round(i.w1)}% after.\n${i.hadMate?'The better move led to a forced checkmate.\n':''}`,{cache:false,onText:({text})=>{if($('#nr')===el)el.textContent=text;}});
  if($('#nr')===el)el.textContent=res.text;
 }catch(e){if($('#nr')===el)el.textContent=e&&e.code==='not_granted'?'Allow the coach in the permission prompt to see explanations.':'';}}
$('#selM').onchange=()=>{pm=$('#selM').value;$('#nt').hidden=true;if(pend){pend=null;engine();}};
var coachBusy=false;
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const mvo=m=>({from:m.from,to:m.to,promotion:m.promotion});
const pw=s=>Math.abs(s)>20000?(s>0?'forced mate for the side to move':'forced mate against the side to move'):(s>=0?'+':'')+(s/100).toFixed(1);
function ascii(g){return g.board().map((r,i)=>(8-i)+' '+r.map(p=>p?(p.color==='w'?p.type.toUpperCase():p.type):'.').join(' ')).join('\n')+'\n  a b c d e f g h';}
function facts(){
 const g=game,h=g.history(),side=t=>t==='w'?'White':'Black';
 let s=`Student plays ${side(me)}; engine level ${lvl}. ${side(g.turn())} to move.\nMoves: ${h.join(' ')||'(none yet)'}\nBoard (uppercase White, lowercase Black):\n${ascii(g)}\nLegal moves now: ${g.moves().join(' ')||'none (game over)'}\n`;
 if(g.in_check())s+='The side to move is in check.\n';
 const r=root(new Chess(g.fen()),2,0);
 if(r.m)s+=`Engine pick for ${side(g.turn())}: ${r.m.san}, score ${pw(r.s)} pawns for the side to move.\n`;
 const hv=g.history({verbose:true});let k=hv.length-1;while(k>=0&&hv[k].color!==me)k--;
 if(k>=0){const c=new Chess();for(let i=0;i<k;i++)c.move(mvo(hv[i]));const b=root(c,2,0);c.move(mvo(hv[k]));const a=root(c,2,0);
  s+=`Student's last move: ${hv[k].san}; engine preferred ${b.m?b.m.san:'?'} there; approximate loss ${Math.max(0,Math.round(b.s+a.s))} centipawns (about 20 is fine, 100+ is a real mistake).\n`;}
 return s;}
function renderCL(){const l=$('#cl');
 l.innerHTML=coachHist.length?coachHist.map(m=>`<div class="cm"><b>${m.r}</b><p>${esc(m.t)}</p></div>`).join(''):'<p class="mute" style="margin:0">Pick a question or type your own.</p>';l.scrollTop=1e5;}
async function ask(q){
 if(!q.trim()||coachBusy)return;coachBusy=true;
 coachHist.push({r:'You',t:q});const a={r:'Coach',t:'Thinking…'};coachHist.push(a);renderCL();
 try{
  const prev=coachHist.slice(0,-2).slice(-6).map(m=>m.r+': '+m.t).join('\n');
  const res=await askClaude(`You are a warm, patient chess coach for a casual player who sometimes leaves pieces hanging. Rules: use ONLY the position data below and never invent pieces or moves; use algebraic notation; engine numbers come from a shallow search and can be wrong, so treat them as hints; explain ideas (threats, piece safety, plans) in plain language rather than only naming a move; any move you recommend must be in the legal move list; at most 3 short sentences (under 60 words); no headings, lists or preamble; lead with the single most important point.\n\n${facts()}\n${prev?'Recent chat:\n'+prev+'\n\n':''}Student: ${q}`,{cache:false,onText:({text})=>{a.t=text;renderCL();}});
  a.t=res.text;
 }catch(e){a.t=e&&e.code==='rate_limited'?'Too many questions at once. Wait a moment and try again.':e&&e.code==='not_granted'?'The coach needs your permission. Ask again and choose Allow.':'The coach could not answer: '+((e&&e.message)||'unknown error');}
 coachBusy=false;renderCL();}
$('#tC').onclick=()=>{setMode('C');sel=null;sync();renderCL();};
document.querySelectorAll('#cq button').forEach(b=>b.onclick=()=>ask(b.dataset.q));
$('#cs').onclick=()=>{const v=$('#ci').value;$('#ci').value='';ask(v);};
$('#ci').addEventListener('keydown',e=>{if(e.key==='Enter')$('#cs').click();});
document.addEventListener('keydown',e=>{if(mode!=='R'||!rv||!rv.done)return;
 if(e.key==='ArrowLeft'){ri=Math.max(0,ri-1);renderR();}
 if(e.key==='ArrowRight'){ri=Math.min(rv.mv.length,ri+1);renderR();}});
$('#bFlip').onclick=()=>{flip=!flip;mode==='P'?draw(game,lastMove()):renderR();};
newGame();
