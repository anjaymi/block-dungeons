const fs=require('node:fs/promises'),path=require('node:path');
const sharp=require('C:/Users/anjaymi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../assets/inventory');
const sources={helm:'delapouite/black-knight-helm',amulet:'lorc/gem-necklace',armor:'delapouite/chest-armor',gloves:'delapouite/gauntlet',belt:'lucasms/belt',ring:'delapouite/diamond-ring',close:'sbed/cancel',salvage:'lorc/anvil-impact',sort:'delapouite/broom',emerald:'skoll/diamonds',cube:'delapouite/cube',appearance:'delapouite/t-shirt',stats:'delapouite/chart',blocked:'sbed/cancel',weapon:'lorc/crossed-swords',hp:'skoll/hearts',mana:'skoll/diamonds',str:'lorc/fist',dex:'delapouite/running-shoe'};
(async()=>{
  await fs.mkdir(path.join(root,'icons'),{recursive:true});await fs.mkdir(path.join(root,'icon-sources'),{recursive:true});
  await Promise.all(Object.entries(sources).map(async([name,source])=>{
    let original;
    for(let attempt=0;attempt<3&&!original;attempt++){
      try{const response=await fetch('https://raw.githubusercontent.com/game-icons/icons/master/'+source+'.svg',{signal:AbortSignal.timeout(7000)});if(!response.ok)throw new Error(source+': '+response.status);original=await response.text();}
      catch(e){if(attempt===2)throw e;}
    }
    if(!original.startsWith('<svg'))throw new Error('Invalid icon '+source);
    await fs.writeFile(path.join(root,'icon-sources',name+'.svg'),original);
    const color=({hp:'#ff5470',mana:'#42c9ff',str:'#ff625c',dex:'#5aec91',emerald:'#35ed83',close:'#ffb39e'})[name]||(['helm','amulet','armor','gloves','belt','ring','blocked'].includes(name)?'#aaa8b6':'#f5d696');
    const svg=original.replace(/<path d="M0 0h512v512H0z"\s*\/>/,'').replace(/<rect[^>]*fill="(?:#000|black)"[^>]*\/>/g,'').replace(/fill="(?:#fff|white)"/g,'fill="'+color+'"');
    await sharp(Buffer.from(svg)).resize(192,192).png().toFile(path.join(root,'icons',name+'.png'));
  }));
  await fs.copyFile(path.join(root,'../hud/GAME-ICONS-LICENSE.txt'),path.join(root,'GAME-ICONS-LICENSE.txt'));
  await fs.writeFile(path.join(root,'CREDITS.md'),'# 背包 PNG 素材\n\n标题框、石台、格子与金色按钮：内置 ImageGen，提示词保存于同目录；原始透明通道保留。面板及部分图标复用 ../hud。角色和装备物品由游戏原有模型与装备数据实时渲染。\n\n图标来自 Game-icons.net，原作者 Lorc、Delapouite、Lucas MS、sbed、Skoll；CC BY 3.0，保留原路径，调整颜色并生成 PNG。\n\n'+Object.entries(sources).map(([k,s])=>'- '+k+': ['+s+'](https://game-icons.net/1x1/'+s+'.html)').join('\n')+'\n');
  console.log('Inventory PNG icons: '+Object.keys(sources).length);
})().catch(e=>{console.error(e);process.exitCode=1});
