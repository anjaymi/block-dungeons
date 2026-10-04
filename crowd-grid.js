// Exact broad phase for local crowd interactions. Combat keeps its own narrow phase.
(function(root){
  'use strict';
  class CrowdGrid {
    constructor(size=2){this.size=size;this.cells=new Map();this.records=new Map();this.maxRadius=0;}
    key(x,y){return Math.floor(x/this.size)+','+Math.floor(y/this.size);}
    build(entities){this.cells.clear();this.records.clear();this.maxRadius=0;for(const e of entities)this.add(e);}
    add(e){
      if(this.records.has(e))return;
      const key=this.key(e.x,e.y),record={key,order:this.records.size};this.records.set(e,record);
      if(!this.cells.has(key))this.cells.set(key,new Set());this.cells.get(key).add(e);
      this.maxRadius=Math.max(this.maxRadius,e.r||0);
    }
    update(e){
      this.maxRadius=Math.max(this.maxRadius,e.r||0);
      const record=this.records.get(e);if(!record){this.add(e);return;}
      const key=this.key(e.x,e.y);if(key===record.key)return;
      const old=this.cells.get(record.key);old.delete(e);if(!old.size)this.cells.delete(record.key);
      if(!this.cells.has(key))this.cells.set(key,new Set());this.cells.get(key).add(e);record.key=key;
    }
    query(x,y,r){
      const result=[],s=this.size;
      for(let cy=Math.floor((y-r)/s);cy<=Math.floor((y+r)/s);cy++)for(let cx=Math.floor((x-r)/s);cx<=Math.floor((x+r)/s);cx++){
        const bucket=this.cells.get(cx+','+cy);if(bucket)for(const e of bucket)result.push(e);
      }
      // Preserve the original simulation order, including attack arbitration.
      return result.sort((a,b)=>this.records.get(a).order-this.records.get(b).order);
    }
    order(e){return this.records.get(e).order;}
    separate(entities,constrain){
      this.build(entities);
      for(const a of entities){
        let after=this.order(a),near=this.query(a.x,a.y,a.r+this.maxRadius);
        for(let n=0;n<near.length;n++){
          const b=near[n],order=this.order(b);if(order<=after)continue;after=order;
          const dx=b.x-a.x,dy=b.y-a.y,rr=a.r+b.r,d2=dx*dx+dy*dy;
          if(d2>=rr*rr||d2<=.000001)continue;
          const d=Math.sqrt(d2),push=(rr-d)/2,ux=dx/d,uy=dy/d,wa=b.mass/(a.mass+b.mass),wb=1-wa;
          a.x-=ux*push*2*wa;a.y-=uy*push*2*wa;b.x+=ux*push*2*wb;b.y+=uy*push*2*wb;constrain(a);constrain(b);
          this.update(a);this.update(b);
          // A push can cross a cell boundary. Re-query only later pairs, exactly
          // as the former nested loop would visit them after this correction.
          near=this.query(a.x,a.y,a.r+this.maxRadius);n=-1;
        }
      }
    }
  }
  if(typeof module==='object'&&module.exports)module.exports=CrowdGrid;else root.CrowdGrid=CrowdGrid;
})(typeof globalThis==='object'?globalThis:this);
