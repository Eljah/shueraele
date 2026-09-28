/* Contract tests use our own small mocks, not a Meta runtime or tracking model. */
const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../spark-import/scripts/shurale.js'),'utf8');
class Signal {constructor(value){this.value=value;}lt(x){return new Signal(this.value<x)}gt(x){return new Signal(this.value>x)}and(x){return new Signal(this.value&&x.value)}not(){return new Signal(!this.value)}pinLastValue(){return this.value}}
async function harness(options={}) {
 const nodes={},logs=[],intervals=[];
 for(const name of ['SH_horn_anchor','SH_hand0_anchor','SH_hand1_anchor','SH_hand0_calibration','SH_hand1_calibration'])nodes[name]={transform:{}};
 for(let s=0;s<2;s++)for(const f of ['thumb','index','middle','ring','little'])for(let j=0;j<3;j++)nodes[`SH_hand${s}_${f}_${j}`]={transform:{}};
 if(options.missing)delete nodes[options.missing];
 const modules={
 Scene:{root:{findFirst:async n=>nodes[n]}}, FaceTracking:{count:new Signal(options.faces??1)},
 HandTracking:{count:new Signal(options.hands??2),hand:i=>{if(options.oneSlot&&i===1)throw Error('Unsupported index');return {cameraTransform:{x:new Signal(i)},isTracked:new Signal(options.tracked??true)}}},
 Time:{ms:new Signal(1250),setInterval:(fn,ms)=>{intervals.push({fn,ms});return 7}}, Diagnostics:{log:m=>logs.push(m)}
 };
 const context=vm.createContext({require:n=>{assert.ok(modules[n],n);return modules[n]},console});
 vm.runInContext(code,context);const result=await context.SH_BOOT;return{result,nodes,logs,intervals};
}
test('complete scene binds two independent slots in the mock',async()=>{
 const h=await harness();assert.equal(h.result.status,'ready');assert.equal(h.result.enabledSlots.length,2);assert.equal(h.intervals.length,1);assert.equal(h.nodes.SH_hand1_calibration.transform.scaleX,-1);
});
test('unsupported second slot is hidden without killing the first',async()=>{
 const h=await harness({oneSlot:true});assert.equal(h.result.enabledSlots.length,1);assert.equal(h.nodes.SH_hand1_anchor.hidden,true);assert.ok(h.logs.some(x=>x.includes('WARNING')));
});
test('missing scene node fails closed and starts no timer',async()=>{
 const h=await harness({missing:'SH_hand0_index_1'});assert.equal(h.result.status,'error');assert.equal(h.intervals.length,0);assert.equal(h.nodes.SH_horn_anchor.hidden,true);assert.ok(h.result.message.includes('SH_hand0_index_1'));
});
test('lost face hides the horn while hand state remains independent',async()=>{
 const h=await harness({faces:0});assert.equal(h.nodes.SH_horn_anchor.hidden.value,true);assert.equal(h.nodes.SH_hand0_anchor.hidden.value,false);
});
test('zero detected hands hides both graphics',async()=>{
 const h=await harness({hands:0});assert.equal(h.nodes.SH_hand0_anchor.hidden.value,true);assert.equal(h.nodes.SH_hand1_anchor.hidden.value,true);
});
test('isTracked false suppresses stale tracker transforms',async()=>{
 const h=await harness({hands:2,tracked:false});assert.equal(h.nodes.SH_hand0_anchor.hidden.value,true);
});
test('the animation updates all 30 section nodes',async()=>{
 const h=await harness();const a=Object.entries(h.nodes).filter(([n])=>/_\d$/.test(n));assert.equal(a.length,30);a.forEach(([,x])=>assert.ok(Number.isFinite(x.transform.rotationZ)));
});
test('no browser, neural-model, token, or network dependencies in Spark script',()=>{
 for(const forbidden of ['getUserMedia','require("MediaPipe")','fetch(','XMLHttpRequest','https://','access_token'])assert.equal(code.includes(forbidden),false,forbidden);
});
