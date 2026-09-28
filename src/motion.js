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
