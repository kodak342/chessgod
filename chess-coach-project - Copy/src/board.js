const $=s=>document.querySelector(s);
export const GL={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};

export function drawBoard(g,last,{sel,hint,flip}){
 const bd=g.board(),ts=sel?g.moves({square:sel,verbose:true}).map(m=>m.to):[],mt=g.in_checkmate(),ck=g.in_check()?(()=>{for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=bd[r][c];if(p&&p.type==='k'&&p.color===g.turn())return 'abcdefgh'[c]+(8-r);}})():null;let h='';
 for(let i=0;i<64;i++){
  const r=flip?7-(i>>3):i>>3,c=flip?7-(i&7):i&7,sq='abcdefgh'[c]+(8-r),p=bd[r][c];
  let cl='sq '+((r+c)%2?'d':'l');
  if(last&&(last.from===sq||last.to===sq))cl+=' last';
  if(sq===sel)cl+=' sel';if(sq===ck)cl+=mt?' mate':' chk';
  if(hint&&(hint.from===sq||hint.to===sq))cl+=' hint';
  if(ts.includes(sq))cl+=p?' cap':' tgt';
  h+=`<div class="${cl}" data-sq="${sq}" role="gridcell" aria-label="${sq}${p?' '+p.color+p.type:''}">`+
   (i%8===0?`<i class="rk">${8-r}</i>`:'')+(i>>3===7?`<i class="fl">${'abcdefgh'[c]}</i>`:'')+
   (p?`<span class="pc ${p.color}">${GL[p.type]}\uFE0E</span>`:'')+`</div>`;}
 $('#board').innerHTML=h;}
