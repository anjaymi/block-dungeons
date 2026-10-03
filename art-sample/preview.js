// Preview orchestration only; it does not wrap any combat, damage or collision function.
(function(){
  const seed=20261003;
  const random=Math.random;let n=seed;
  Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  try{selC=0;selK=0;selW=0;selM=0;ZOOM=1.4;startGame();}finally{Math.random=random;}
  window.MOSS_PREVIEW={seed,baseline:!!window.MOSS_BASELINE,grid:()=>Array.from(G),snapshot:()=>({state,x:player.x,y:player.y,hp:player.hp,room:curRoom&&curRoom.id,rooms:rooms.length,mobs:mobs.length,webgl:!!document.getElementById('gl3d')})};
  const panel=document.createElement('aside');panel.id='moss-toolbar';
  panel.innerHTML=`<div><small>LOCAL ART STUDY / 01</small><strong>苔石哨所 <em>${window.MOSS_BASELINE?'原版对照':'美术样板'}</em></strong></div><nav><a href="moss-outpost.html${window.MOSS_BASELINE?'':'?baseline=1'}">${window.MOSS_BASELINE?'查看新版':'同种子原版'}</a><button id="moss-clean">收起界面 [H]</button><button id="moss-reset">重置场景</button></nav>`;
  const css=document.createElement('style');css.textContent=`#moss-toolbar{position:fixed;left:50%;bottom:112px;transform:translateX(-50%);z-index:8;display:flex;align-items:center;gap:26px;background:#101e22ef;border:1px solid #7e977e66;border-radius:4px;padding:12px 18px;color:#e8edda;font:13px system-ui;white-space:nowrap}#moss-toolbar small{display:block;letter-spacing:3px;color:#94ad9d;font-size:9px;margin-bottom:4px}#moss-toolbar strong{font-size:18px;font-weight:550;letter-spacing:3px}#moss-toolbar em{font-size:11px;font-style:normal;color:#a6bb9b;letter-spacing:1px}#moss-toolbar nav{display:flex;gap:8px}#moss-toolbar a,#moss-toolbar button{border:1px solid #8ca88b55;border-radius:3px;background:#273b36;color:#e3ebd9;padding:8px 10px;text-decoration:none;font:11px system-ui;cursor:pointer}#moss-toolbar.hide{opacity:0;pointer-events:none}`;document.head.append(css);document.body.append(panel);
  let clean=false;const oldHUD=drawHUD;drawHUD=function(){if(!clean)oldHUD();};
  const toggle=()=>{clean=!clean;panel.classList.toggle('hide',clean);};
  document.getElementById('moss-clean').onclick=toggle;
  document.getElementById('moss-reset').onclick=()=>{if(confirm('重置会清空本次样板试玩，继续？'))location.reload();};
  addEventListener('keydown',e=>{if(e.code==='KeyH'){e.preventDefault();toggle();}});
})();
