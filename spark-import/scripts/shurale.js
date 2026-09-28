// Shurale Necrolab 0.2.0. Generated from src/. See docs before import.
/* Original animation math shared by the Spark adapter and the offline lab.
 * Pure functions: no tracking, camera, network, timers or platform modules.
 * Angles are radians. The animation is not measured finger articulation.
 */
var SHMotion = (function () {
  'use strict';
  var splay = [1.04, 0.26, 0.03, -0.18, -0.47];
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function finite(value, name) {
    if (typeof value !== 'number' || !isFinite(value)) throw new TypeError(name + ' must be finite');
    return value;
  }
  function pose(seconds, intensity, slot) {
    finite(seconds, 'seconds'); finite(intensity, 'intensity');
    if (slot !== 0 && slot !== 1) throw new RangeError('slot must be 0 or 1');
    var strength = clamp(intensity, 0, 1);
    // Bounded time avoids precision drift during long-running installations.
    var t = ((seconds % 600) + 600) % 600;
    var fingers = splay.map(function (base, finger) {
      var phase = 2 * Math.PI * (t * 0.6 + finger * 0.13 + slot * 0.2);
      var wave = Math.sin(phase);
      var tipWave = Math.sin(phase - 0.4);
      return [base + strength * 0.09 * wave,
              0.10 + strength * (0.20 + 0.18 * wave),
              0.10 + strength * (0.24 + 0.21 * tipWave)];
    });
    return { fingers: fingers, hornRoll: strength * 0.012 * Math.sin(2 * Math.PI * t * 0.4) };
  }
  return { pose: pose, clamp: clamp, version: '0.2.0' };
}());
if (typeof module !== 'undefined' && module.exports) module.exports = SHMotion;

/* Import the generated spark-import/scripts/shurale.js as the only effect script.
 * Assemble the scene using docs/ASSEMBLY_RU.md. Native Spark has NOT been run here.
 * NO MediaPipe API, DOM, fetch, network endpoint, token or authentication bypass.
 */
var SH_BOOT = (async function () {
  'use strict';
  var Scene = require('Scene');
  var FaceTracking = require('FaceTracking');
  var HandTracking = require('HandTracking');
  var Time = require('Time');
  var Diagnostics = require('Diagnostics');
  var C = { intensity: 0.8, maxHands: 2, tickMs: 33,
            handScale: [1, 1], handMirror: [1, -1] };
  var fingerNames = ['thumb', 'index', 'middle', 'ring', 'little'];
  var names = ['SH_horn_anchor', 'SH_hand0_anchor', 'SH_hand1_anchor',
               'SH_hand0_calibration', 'SH_hand1_calibration'];
  for (var s = 0; s < 2; s++) for (var f = 0; f < 5; f++) for (var j = 0; j < 3; j++) {
    names.push('SH_hand' + s + '_' + fingerNames[f] + '_' + j);
  }
  var objects = await Promise.all(names.map(function (name) { return Scene.root.findFirst(name); }));
  var missing = names.filter(function (_, i) { return !objects[i]; });
  // Fail closed: a broken scene must not leave an untracked hand floating on screen.
  for (var k = 0; k < 3; k++) if (objects[k]) objects[k].hidden = true;
  if (missing.length) throw new Error('Scene is incomplete. Missing: ' + missing.join(', '));
  var byName = {};
  names.forEach(function (name, i) { byName[name] = objects[i]; });
  var horn = byName.SH_horn_anchor;
  // The native Face Tracker parent, NOT this script, supplies the head pose.
  horn.hidden = FaceTracking.count.lt(1);
  var enabled = [];
  for (var slot = 0; slot < C.maxHands; slot++) {
    var root = byName['SH_hand' + slot + '_anchor'];
    try {
      var hand = HandTracking.hand(slot);
      if (!hand || !hand.cameraTransform) throw new Error('No cameraTransform');
      // REQUIRED: the anchor is a DIRECT CHILD OF Camera, not Focal Distance.
      root.transform = hand.cameraTransform;
      var visible = HandTracking.count.gt(slot);
      if (hand.isTracked) visible = visible.and(hand.isTracked);
      root.hidden = visible.not();
      var calibration = byName['SH_hand' + slot + '_calibration'];
      calibration.transform.scaleX = C.handScale[slot] * C.handMirror[slot];
      calibration.transform.scaleY = C.handScale[slot];
      calibration.transform.scaleZ = C.handScale[slot];
      enabled.push(slot);
    } catch (error) {
      root.hidden = true;
      Diagnostics.log('SH WARNING: hand slot ' + slot + ' unavailable: ' + error.message);
    }
  }
  function update() {
    var seconds = Time.ms.pinLastValue() / 1000;
    for (var s = 0; s < enabled.length; s++) {
      var index = enabled[s];
      var pose = SHMotion.pose(seconds, C.intensity, index);
      for (var f = 0; f < 5; f++) for (var j = 0; j < 3; j++) {
        byName['SH_hand' + index + '_' + fingerNames[f] + '_' + j].transform.rotationZ = pose.fingers[f][j];
      }
    }
    horn.transform.rotationZ = SHMotion.pose(seconds, C.intensity, 0).hornRoll;
  }
  update();
  var interval = Time.setInterval(update, C.tickMs);
  Diagnostics.log('SH READY: animated hand slots = ' + enabled.join(', ') + '. This is puppet motion, not finger tracking.');
  return { status: 'ready', enabledSlots: enabled, interval: interval,
    setIntensity: function (value) {
      if (typeof value !== 'number' || !isFinite(value)) throw new TypeError('intensity must be finite');
      C.intensity = SHMotion.clamp(value, 0, 1);
    }
  };
}()).catch(function (error) {
  require('Diagnostics').log('SH ERROR: ' + error.message);
  return { status: 'error', message: error.message };
});
