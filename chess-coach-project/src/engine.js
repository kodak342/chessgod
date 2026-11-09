// Old in-page engine (negamax + alpha-beta, iterative deepening for Level 4).
// This is the file Stockfish will replace or sit beside.
const V={p:100,n:320,b:330,r:500,q:900,k:0};

/* ---------- engine: negamax + alpha-beta ---------- */
export function stat(g){let s=0;const b=g.board();
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(!p)continue;
  const cen=3.5-Math.max(Math.abs(r-3.5),Math.abs(c-3.5));
  let v=V[p.type];
  if(p.type==='p')v+=(p.color==='w'?6-r:r-1)*6+cen*3;else if(p.type!=='k')v+=cen*8;
  s+=p.color==='w'?v:-v;}
 return s*(g.turn()==='w'?1:-1);}
function order(ms){const k=m=>(m.captured?V[m.captured]*10-V[m.piece]:0)+(m.promotion?800:0);ms.sort((a,b)=>k(b)-k(a));}
function nm(g,d,a,b,ply){
 const ms=g.moves({verbose:true});
 if(!ms.length)return g.in_check()?-30000+ply:0;
 if(d<=0)return stat(g);
 order(ms);let best=-1e9;
 for(const m of ms){g.move(m);const v=-nm(g,d-1,-b,-a,ply+1);g.undo();
  if(v>best)best=v;if(v>a)a=v;if(a>=b)break;}
 return best;}
export function root(g,d,noise){
 const ms=g.moves({verbose:true});
 if(!ms.length)return{m:null,s:g.in_check()?-30000:0};
 order(ms);let best=null,bs=-1e9;
 for(const m of ms){g.move(m);let v=-nm(g,d-1,-1e9,noise?1e9:-bs,1);g.undo();
  if(noise)v+=Math.random()*noise;
  if(v>bs){bs=v;best=m;}}
 return{m:best,s:bs};}
/* strongest in-page search: iterative deepening + quiescence + time limit */
let tEnd=0,nodes=0,abort=false;
function qs(g,a,b,q,ms){
 const st=stat(g);if(st>=b)return st;if(st>a)a=st;if(q>=6)return a;
 const cs=ms.filter(m=>m.captured||m.promotion);order(cs);
 for(const m of cs){g.move(m);const v=-qs(g,-b,-a,q+1,g.moves({verbose:true}));g.undo();if(v>=b)return v;if(v>a)a=v;}
 return a;}
function nmT(g,d,a,b,ply){
 if((++nodes&255)===0&&Date.now()>tEnd)abort=true;if(abort)return 0;
 const ms=g.moves({verbose:true});
 if(!ms.length)return g.in_check()?-30000+ply:0;
 if(d<=0)return qs(g,a,b,0,ms);
 order(ms);let best=-1e9;
 for(const m of ms){g.move(m);const v=-nmT(g,d-1,-b,-a,ply+1);g.undo();if(abort)return 0;
  if(v>best)best=v;if(v>a)a=v;if(a>=b)break;}
 return best;}
export function rootT(g,limit){
 const mv=g.moves({verbose:true});if(!mv.length)return{m:null,s:g.in_check()?-30000:0};
 order(mv);let best=mv[0],bs=0;tEnd=Date.now()+limit;abort=false;nodes=0;
 for(let d=1;d<=8;d++){let cb=null,cs=-1e9;
  for(const m of mv){g.move(m);const v=-nmT(g,d-1,-1e9,-cs,1);g.undo();if(abort)break;if(v>cs){cs=v;cb=m;}}
  if(abort||!cb)break;best=cb;bs=cs;mv.splice(mv.indexOf(cb),1);mv.unshift(cb);
  if(Math.abs(bs)>20000)break;}
 return{m:best,s:bs};}
export const DEPTH=[1,2,3],NOISE=[150,50,8];

export const wp=cp=>50+50*(2/(1+Math.exp(-0.00368208*Math.max(-3000,Math.min(3000,cp))))-1);
