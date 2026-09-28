const test = require('node:test');
const assert = require('node:assert/strict');
const motion = require('../src/motion.js');
test('exactly 5 fingers and 3 articulated sections each', () => {
 const p=motion.pose(0,.8,0); assert.equal(p.fingers.length,5);p.fingers.forEach(x=>assert.equal(x.length,3));
});
test('zero intensity freezes the authored rest pose', () => {
 assert.deepEqual(motion.pose(0,0,0),motion.pose(91,0,1));
});
test('intensity is clamped at both bounds',()=>{
 assert.deepEqual(motion.pose(3,-1,0),motion.pose(3,0,0));assert.deepEqual(motion.pose(3,5,1),motion.pose(3,1,1));
});
test('both slots animate with different phase, not duplicated tracking',()=>{
 assert.notDeepEqual(motion.pose(.3,.8,0).fingers,motion.pose(.3,.8,1).fingers);
});
test('angles remain finite and within designed range over 600 seconds',()=>{
 for(let t=0;t<600;t+=.17) for(let s=0;s<2;s++) {
  const p=motion.pose(t,1,s);p.fingers.flat().forEach(x=>assert.ok(Number.isFinite(x)&&x>-1&&x<1.5));assert.ok(Math.abs(p.hornRoll)<=.01201);
 }
});
test('no discontinuity across a 600-second cycle boundary',()=>{
 const a=motion.pose(599.999,.8,0),b=motion.pose(600.001,.8,0);a.fingers.flat().forEach((v,i)=>assert.ok(Math.abs(v-b.fingers.flat()[i])<.003));
});
test('NaN and infinite input fail explicitly',()=>{
 for(const v of [NaN,Infinity,-Infinity,'1',null])assert.throws(()=>motion.pose(v,.8,0));
 assert.throws(()=>motion.pose(0,NaN,0));
});
test('unsupported slots fail explicitly',()=>{for(const s of [-1,2,'0',undefined])assert.throws(()=>motion.pose(0,.8,s));});
