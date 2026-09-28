/* Software inspector for the shipped GLB subset. Canvas2D triangle rendering.
 * It is NOT Spark, not a camera, and not a conformant glTF implementation.
 * All animated node values come from the real import script in our mock.
 */
(async function () {
'use strict';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const status=document.querySelector('#status');
function parse(text) {
  const b=Uint8Array.from(atob(text),c=>c.charCodeAt(0)),d=new DataView(b.buffer);
  if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2)throw Error('Invalid GLB');
  const jl=d.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(b.slice(20,20+jl)));
  return {j,bin:b.slice(28+jl)};
}
function read(m,i) {
  const a=m.j.accessors[i],v=m.j.bufferViews[a.bufferView],n={VEC2:2,VEC3:3,SCALAR:1}[a.type];
  const data=m.bin.slice((v.byteOffset||0)+(a.byteOffset||0));
  const flat=a.componentType===5126?new Float32Array(data.buffer,0,a.count*n):new Uint16Array(data.buffer,0,a.count*n);
  return Array.from({length:a.count},(_,k)=>Array.from(flat.slice(k*n,(k+1)*n)));
}
async function prepare(text) {
  const m=parse(text);
  m.meshes=m.j.meshes.map(mesh=>mesh.primitives.map(p=>({v:read(m,p.attributes.POSITION),uv:read(m,p.attributes.TEXCOORD_0),idx:read(m,p.indices).flat(),mat:m.j.materials[p.material]})));
  m.images=await Promise.all((m.j.images||[]).map(im=>new Promise((resolve,reject)=>{
    const v=m.j.bufferViews[im.bufferView],bytes=m.bin.slice(v.byteOffset,v.byteOffset+v.byteLength);
    let s='';for(const x of bytes)s+=String.fromCharCode(x);
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Texture decode failed'));
    image.src='data:'+im.mimeType+';base64,'+btoa(s);
  })));
  return m;
}
function mul(a,b){const c=new Array(16).fill(0);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
function trs(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]){let[x,y,z,w]=q;return[(1-2*y*y-2*z*z)*s[0],(2*x*y+2*w*z)*s[0],(2*x*z-2*w*y)*s[0],0,(2*x*y-2*w*z)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*w*x)*s[1],0,(2*x*z+2*w*y)*s[2],(2*y*z-2*w*x)*s[2],(1-2*x*x-2*y*y)*s[2],0,...t,1];}
function point(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);}
const models={};for(const [k,v] of Object.entries(SH_GLB))models[k]=await prepare(v);
let runtime=await SHMock(models,SH_SPARK_SOURCE),t=1.25,playing=true,last=performance.now();
window.SH_LAB_RUNTIME=runtime;
const project=p=>[(p[0]+.39)/.78*canvas.width,(.51-p[1])/.72*canvas.height,p[2]];
function collect(m,base,out) {
  function visit(i,parent) {
    const n=m.j.nodes[i],live=runtime.nodes[n.name];let q=n.rotation,s=n.scale;
    if(live && runtime.value(live.hidden))return;
    if(live && Number.isFinite(live.transform.rotationZ)){
      const a=live.transform.rotationZ;q=[0,0,Math.sin(a/2),Math.cos(a/2)];
    }
    if(live && Number.isFinite(live.transform.scaleX))s=[live.transform.scaleX,live.transform.scaleY,live.transform.scaleZ];
    const world=mul(parent,trs(n.translation,q,s));
    if(n.mesh!==undefined)for(const p of m.meshes[n.mesh]){
      const vertices=p.v.map(v=>project(point(world,v))),pbr=p.mat.pbrMetallicRoughness,tx=pbr.baseColorTexture;
      for(let k=0;k<p.idx.length;k+=3){const ids=p.idx.slice(k,k+3),v=ids.map(i=>vertices[i]);
        out.push({v,uv:ids.map(i=>p.uv[i]),z:v.reduce((a,v)=>a+v[2],0)/3,
          image:tx?m.images[m.j.textures[tx.index].source]:null,color:pbr.baseColorFactor||[1,1,1,1]});
      }
    }
    (n.children||[]).forEach(child=>visit(child,world));
  }
  m.j.scenes[m.j.scene||0].nodes.forEach(i=>visit(i,base));
}
function triangle(tri){const p=tri.v;
  if(Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[2][0]-p[0][0])*(p[1][1]-p[0][1]))<.001)return;
  ctx.save();ctx.beginPath();ctx.moveTo(...p[0].slice(0,2));ctx.lineTo(...p[1].slice(0,2));ctx.lineTo(...p[2].slice(0,2));ctx.closePath();
  if(!tri.image){const c=tri.color;ctx.fillStyle=`rgba(${c.slice(0,3).map(x=>Math.round(x*255)).join(',')},${c[3]})`;ctx.fill();ctx.restore();return;}
  ctx.clip();const uv=tri.uv.map(v=>[v[0]*tri.image.width,v[1]*tri.image.height]);
  const [u0,v0]=uv[0],[u1,v1]=uv[1],[u2,v2]=uv[2],D=(u1-u0)*(v2-v0)-(u2-u0)*(v1-v0);
  if(Math.abs(D)>1e-10){const a=((p[1][0]-p[0][0])*(v2-v0)-(p[2][0]-p[0][0])*(v1-v0))/D;
    const c=((u1-u0)*(p[2][0]-p[0][0])-(u2-u0)*(p[1][0]-p[0][0]))/D;
    const b=((p[1][1]-p[0][1])*(v2-v0)-(p[2][1]-p[0][1])*(v1-v0))/D;
    const d=((u1-u0)*(p[2][1]-p[0][1])-(u2-u0)*(p[1][1]-p[0][1]))/D;
    ctx.transform(a,b,c,d,p[0][0]-a*u0-c*v0,p[0][1]-b*u0-d*v0);ctx.drawImage(tri.image,0,0);
  }ctx.restore();
}
function render(){
 runtime.state.faces=+document.querySelector('#faces').value;runtime.state.hands=+document.querySelector('#hands').value;
 runtime.tick(t,+document.querySelector('#power').value);
 ctx.fillStyle='#edf0df';ctx.fillRect(0,0,canvas.width,canvas.height);
 // Grid is a measuring guide, not a camera image.
 ctx.strokeStyle='#dce2cb';ctx.lineWidth=1;
 for(let x=0;x<canvas.width;x+=75){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
 for(let y=0;y<canvas.height;y+=75){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
 const yaw=+document.querySelector('#yaw').value*Math.PI/180,common=trs([0,0,0],[0,Math.sin(yaw/2),0,Math.cos(yaw/2)]),out=[];
 if(runtime.state.faces)collect(models.head,mul(common,trs([0,.10,-.030],[0,0,0,1],[.92,.92,.92])),out);
 if(!runtime.value(runtime.nodes.SH_horn_anchor.hidden)){
   const a=runtime.nodes.SH_horn_anchor.transform.rotationZ||0;
   collect(models.horn,mul(common,trs([0,.215,.018],[0,0,Math.sin(a/2),Math.cos(a/2)])),out);
 }
 for(let i=0;i<2;i++){
   const anchor=runtime.nodes['SH_hand'+i+'_anchor'];
   if(runtime.value(anchor.hidden))continue;
   const p=['x','y','z'].map(k=>runtime.value(anchor.transform[k]));
   collect(models['h'+i],mul(common,trs(p)),out);
 }
 out.sort((a,b)=>a.z-b.z).forEach(triangle);
 const shot=runtime.snapshot();shot.triangles=out.length;shot.renderer='Canvas2D/software';
 ctx.fillStyle='#294634';ctx.font='bold 18px sans-serif';ctx.fillText('SYNTHETIC INPUT / ACTUAL GLB + shurale.js',20,32);
 document.querySelector('#clock').textContent=t.toFixed(2)+' s · ticks '+shot.ticks;
 document.querySelector('#debug').textContent=JSON.stringify({status:shot.status,faces:shot.faces,hands:shot.hands,hornVisible:shot.hornVisible,handVisible:shot.handVisible,triangles:shot.triangles},null,2);
 document.querySelector('#logs').textContent=runtime.logs.join('\n');window.SH_LAB_STATE=shot;
}
window.SH_LAB_SET_TIME=function(value){playing=false;t=value;render();};
window.SH_LAB_SET_MODE=async function(mode){runtime=await SHMock(models,SH_SPARK_SOURCE,mode==='oneSlot'?{oneSlot:true}:mode==='missing'?{missing:'SH_hand0_index_1'}:{});window.SH_LAB_RUNTIME=runtime;render();};
function frame(now){if(playing)t+=(now-last)/1000;last=now;render();requestAnimationFrame(frame);}
window.SH_LAB_READY=true;status.textContent='4 GLB · Canvas2D · тот же shurale.js';render();requestAnimationFrame(frame);
document.querySelector('#pause').onclick=()=>{playing=!playing;document.querySelector('#pause').textContent=playing?'Пауза':'Продолжить';};
document.querySelector('#snapshot').onclick=()=>{render();const a=document.createElement('a');a.href=canvas.toDataURL();a.download='shurale-synthetic-debug.png';a.click();};
})().catch(error=>{document.querySelector('#status').textContent=String(error);console.error(error);});
