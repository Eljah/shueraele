/* Reactive contract double for debugging our adapter; NOT a Meta runtime.
 * Signals are recomputed on read, so lost/reacquired tracking is testable.
 */
window.SHMock = async function (models, code, options = {}) {
  class Signal {
    constructor(read) { this.read = typeof read === 'function' ? read : () => read; }
    pinLastValue() { return this.read(); }
    lt(x) { return new Signal(() => this.read() < value(x)); }
    gt(x) { return new Signal(() => this.read() > value(x)); }
    and(x) { return new Signal(() => this.read() && value(x)); }
    not() { return new Signal(() => !this.read()); }
  }
  const value = x => x instanceof Signal ? x.pinLastValue() : x;
  const state = { seconds: 1.25, faces: 1, hands: 2, tracked: [true, true], ticks: 0 };
  const nodes = {}, logs = [], timers = [];
  ['SH_horn_anchor','SH_hand0_anchor','SH_hand1_anchor'].forEach(n => nodes[n] = {hidden:true,transform:{}});
  Object.values(models).forEach(m => m.j.nodes.forEach(n => nodes[n.name] = {hidden:false,transform:{}}));
  if (options.missing) delete nodes[options.missing];
  const handPoses = [0,1].map(i => ({
    x: new Signal(() => (i ? 1 : -1) * .175 + .015 * Math.sin(state.seconds * 1.1 + i)),
    y: new Signal(() => -.005 + .010 * Math.sin(state.seconds * .8 + i)),
    z: new Signal(.080)
  }));
  const modules = {
    Scene: {root:{findFirst:async n => nodes[n]}},
    FaceTracking: {count:new Signal(() => state.faces)},
    HandTracking: {count:new Signal(() => state.hands), hand:i => {
      if (options.oneSlot && i === 1) throw new Error('Mock: second slot disabled');
      return {cameraTransform:handPoses[i],isTracked:new Signal(() => state.tracked[i])};
    }},
    Time: {ms:new Signal(() => state.seconds * 1000),setInterval:fn => {timers.push(fn);return timers.length;}},
    Diagnostics: {log:s => logs.push(String(s))}
  };
  // Execute the EXACT generated import script, not a reimplementation of it.
  const boot = await new Function('require', code + '\nreturn SH_BOOT;')(name => {
    if (!modules[name]) throw Error('Unexpected module ' + name);
    return modules[name];
  });
  return {state,nodes,logs,boot,value,
    tick(t, intensity) {
      state.seconds = t;
      if (boot.setIntensity) boot.setIntensity(intensity);
      timers.forEach(fn => fn()); state.ticks++;
    },
    snapshot() {
      return {runtime:'our reactive mock; NOT Meta Spark',status:boot.status,
        seconds:state.seconds, ticks:state.ticks, faces:state.faces, hands:state.hands,
        hornVisible:!value(nodes.SH_horn_anchor.hidden),
        handVisible:[0,1].map(i=>!value(nodes['SH_hand'+i+'_anchor'].hidden)),
        fingerAngles:[0,1].map(s=>['thumb','index','middle','ring','little'].map(f=>[0,1,2].map(j=>nodes[`SH_hand${s}_${f}_${j}`]?.transform.rotationZ ?? null))),
        enabledSlots:boot.enabledSlots || [],logs:logs.slice()};
    }
  };
};
