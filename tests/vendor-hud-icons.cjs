// Offline PNG icon assets derived from the canonical Game-icons.net library.
const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('C:/Users/anjaymi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../assets/hud');
const icons={
  attack:['lorc/crossed-swords','#fff6dc','#e9a362'],roll:['lorc/run','#ffffff','#a5a0b7'],
  potion:['delapouite/health-potion','#ff8dba','#ed0036'],potionGreen:['delapouite/health-potion','#c8ffd6','#1dc778'],
  skill:['lorc/crystal-cluster','#f6dcff','#a93bff'],spell:['lorc/moon','#e3b0ff','#7124ee'],
  bag:['delapouite/backpack','#ffdc9c','#e6a541'],quest:['lorc/scroll-unfurled','#fff0d3','#dba471'],
  settings:['lorc/gears','#ffdfa4','#d89e51'],interact:['sbed/hand','#ffe5c4','#f2b372'],
  coin:['delapouite/two-coins','#fff2a6','#e49b13'],key:['lorc/key','#ffe68c','#e7a722'],
  hp:['lorc/heart-inside','#ffafbe','#ea0046'],mana:['lorc/crystal-cluster','#d5f7ff','#00aaff'],
  shield:['sbed/shield','#b9f4ff','#159ae0'],boot:['lorc/boot-stomp','#ffe9a9','#d88b27'],
  heal:['sbed/health-normal','#d2ff9f','#3eec56'],pin:['delapouite/pin','#ffe2a4','#eca227'],
  compass:['lorc/compass','#fff6b3','#bc8741'],fireball:['lorc/fireball','#ffe7a9','#ff6c21'],
  frost:['lorc/snowflake-1','#efffff','#65cbe8'],chain:['lorc/crystal-cluster','#edcdff','#a667ff'],
  art0:['delapouite/dynamite','#ffb4c5','#e12c6c'],art1:['lorc/crystal-cluster','#bdffff','#1390bf'],
  art2:['lorc/key','#ffe191','#efa821'],bow:['delapouite/bow-arrow','#fff1bf','#bf9959'],
  jump:['delapouite/jump-across','#f8f5ff','#bdb5cb'],swap:['lorc/swap-bag','#ffe7b0','#ae8652'],
  more:['lorc/scroll-unfurled','#dad3eb','#81768e'],star:['lorc/crystal-cluster','#f8ddff','#a55deb']
};
(async()=>{
  await fs.mkdir(path.join(root,'icons'),{recursive:true});
  await fs.mkdir(path.join(root,'icon-sources'),{recursive:true});
  await Promise.all(Object.entries(icons).map(async([name,[source,hi,lo]])=>{
    const original=await (await fetch('https://raw.githubusercontent.com/game-icons/icons/master/'+source+'.svg')).text();
    if(!original.startsWith('<svg'))throw new Error('Invalid SVG '+source);
    await fs.writeFile(path.join(root,'icon-sources',name+'.svg'),original);
    // Keep the original artist's paths; remove only the library's black backplate.
    const svg=original.replace(/<path d="M0 0h512v512H0z"\s*\/>/,'').replace(/<rect[^>]*fill="(?:#000|black)"[^>]*\/>/g,'')
      .replace(/(fill=")[#]fff("|\s)/g,'$1url(#tone)$2').replace(/<path fill="white"/g,'<path fill="url(#tone)"')
      .replace(/(<svg[^>]*>)/,'$1<defs><linearGradient id="tone" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="'+hi+'"/><stop offset="1" stop-color="'+lo+'"/></linearGradient></defs>');
    await sharp(Buffer.from(svg)).resize(192,192).png().toFile(path.join(root,'icons',name+'.png'));
  }));
  const license=await(await fetch('https://raw.githubusercontent.com/game-icons/icons/master/license.txt')).text();
  await fs.writeFile(path.join(root,'GAME-ICONS-LICENSE.txt'),license);
  await fs.writeFile(path.join(root,'CREDITS.md'),'# HUD 素材来源\n\n面板、圆形按钮、头像框、摇杆和首领血条框：内置 ImageGen，参考用户提供的手机与 PC HUD。完整提示词在同目录 `.prompt.txt`。\n\n图标：Lorc、Delapouite、sbed，来自 [Game-icons.net](https://game-icons.net)，[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。保留原始图形路径，修改配色并栅格化成透明 PNG。图标与原作者清单：\n\n'+Object.entries(icons).map(([name,[source]])=>'- '+name+': ['+source+'](https://game-icons.net/1x1/'+source+'.html)').join('\n')+'\n');
  console.log('Created '+Object.keys(icons).length+' PNG HUD icons.');
})().catch(e=>{console.error(e);process.exitCode=1;});
