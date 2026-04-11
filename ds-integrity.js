(function(){
  var _0xsecret = 'ds-v2-integrity-check-delta';
  function _0xh(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return h.toString(16);
  }
  window._ds_v2 = function(b) {
    if (!b || !b.s || !b.t) return 'err-01';
    // Environmental Fingerprint
    var env = [
      (screen.colorDepth || 0),
      (navigator.hardwareConcurrency || 0),
      (window.outerWidth || 0),
      (window.devicePixelRatio || 1)
    ].join('|');
    
    // Create a secondary signature that wraps the first one and the environment
    var s2 = _0xh(_0xsecret + b.s + b.t + env);
    return {
      v: s2,
      e: btoa(env)
    };
  };
})();
