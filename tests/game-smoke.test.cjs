const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
for(const kind of ['greatsword','sickles','sword','hammer','staff','shieldblade','daggers','axe','spear','claymore']){
  test(`${kind}：真实地图、怪物和输入循环连续运行`,()=>{
    const g=loadGame({lab:['greatsword','sickles','hammer'].includes(kind),weapon:kind});
    g.run(`selW=START_W.indexOf('${kind}');if(selW<0)selW=0;startGame();player.eq.weapon=newBase('weapon',0,'${kind}');player.attr.vit=1000;recalc();player.hp=player.maxhp;player.G.ow=100;player.G.poisonDmg=4;mouse.wx=player.x+3;mouse.wy=player.y;mobs=[spawnMob('zombie',player.x+1,player.y),spawnMob('skeleton',player.x+2,player.y+.5)];for(let k=0;k<720;k++){if(k%120===0)touchAction('attack',true);if(k%120===70)touchAction('attack',false);simStep(STEP);} `);
    assert.equal(g.run('Number.isFinite(player.hp) && Number.isFinite(player.x) && Number.isFinite(player.y)'),true);
    assert.equal(g.run('mobs.every(m=>Number.isFinite(m.hp)&&Number.isFinite(m.x)&&Number.isFinite(m.y))'),true);
    assert.ok(g.run('player.attackId>1'));
  });
}
