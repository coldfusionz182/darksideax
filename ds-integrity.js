(function(){
  var _0xsecret = 'ds-v2-integrity-check-delta';
  var _0x_cur_v = '';

  function _0xh(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return h.toString(16);
  }

  function _0x_draw() {
    var c = document.getElementById('captcha-canvas');
    if (!c) return;
    var ctx = c.getContext('2d');
    var code = Math.floor(100000 + Math.random() * 900000).toString();
    _0x_cur_v = code;
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, c.width, c.height);
    
    // Noise
    for (var i = 0; i < 15; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,'+(Math.random()*0.2)+')';
      ctx.beginPath();
      ctx.moveTo(Math.random()*c.width, Math.random()*c.height);
      ctx.lineTo(Math.random()*c.width, Math.random()*c.height);
      ctx.stroke();
    }
    
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    
    for (var j = 0; j < 6; j++) {
      ctx.save();
      ctx.translate(20 + j*18, c.height/2);
      ctx.rotate((Math.random()-0.5)*0.4);
      ctx.fillText(code[j], 0, 0);
      ctx.restore();
    }
    
    return _0xh(_0xsecret + 'cap' + code);
  }

  var _0x_vtok = '';
  function refresh() {
    _0x_vtok = _0x_draw();
  }

  window.addEventListener('load', function() {
    refresh();
    var r = document.getElementById('captcha-refresh');
    if (r) r.onclick = refresh;
  });

  window._ds_refresh_cap = refresh;

  window._ds_v2 = function(b) {
    if (!b || !b.s || !b.t) return 'err-01';
    var env = [
      (screen.colorDepth || 0),
      (navigator.hardwareConcurrency || 0),
      (window.outerWidth || 0),
      (window.devicePixelRatio || 1)
    ].join('|');
    
    var s2 = _0xh(_0xsecret + b.s + b.t + env);
    return {
      v: s2,
      e: btoa(env),
      cv: _0x_vtok // Captcha verification token
    };
  };
})();
