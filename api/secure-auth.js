import { createClient } from '@supabase/supabase-js';

const _0xdec = (s) => Buffer.from(s, 'base64').toString('utf8');

const _0x_u1 = _0xdec('aHR0cHM6Ly9mZm1ra3dza3Zqdnl0ZGRkZXZtbS5zdXBhYmFzZS5jbw==');
const _0x_k2 = _0xdec('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW1abWJXdHJkM05yZG1wMmVYUmtaR1JsZG0xdElpd2ljbTlzWlNJNkluTmxjblpwWTJWZmNtOXNaU0lzSW1saGRDSTZNVGMzTlRZMk5UZzVOU3dpWlhod0lqb3lNRGt4TWpReE9EazFmUS5ZdGFXRmRtLWd5cXBxem9WeVpUQ0JUazhyUzhDa201Y09Zc3VuOEd3R2xR');
const _0x_s3 = _0xdec('ZHMtZ2F0ZXdheS12MS1hbHBoYS05OQ==');
const _0x_v2_s = 'ds-v2-integrity-check-delta';

const _0x_sc = createClient(_0x_u1, _0x_k2);

function _0xgen_hash(s) {
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function _0x_step(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894946606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }
  function _0x_blk(s) { var blks = [], i; for (i = 0; i < 64; i += 4) { blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i+3) << 24); } return blks; }
  function _0x_core(s) { var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i; for (i = 64; i <= s.length; i += 64) { _0x_step(state, _0x_blk(s.substring(i - 64, i))); } s = s.substring(i - 64); var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3); tail[i >> 2] |= 0x80 << ((i % 4) << 3); if (i > 55) { _0x_step(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; } tail[14] = n * 8; _0x_step(state, tail); return state; }
  function rhex(n) { var s = '', j = 0; for (; j < 4; j++) s += '0123456789abcdef'[(n >> (j * 8 + 4)) & 0x0F] + '0123456789abcdef'[(n >> (j * 8)) & 0x0F]; return s; }
  function hex(x) { for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]); return x.join(''); }
  return hex(_0x_core(Buffer.from(s).toString('base64')));
}

function _0xv2h(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h.toString(16);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '' });
  }
  const { email, password, usertoken, geohash: countryName, gotrue_meta_security } = req.body;
  if (!gotrue_meta_security || !gotrue_meta_security.s || !gotrue_meta_security.t || !gotrue_meta_security.v2 || !gotrue_meta_security.cv) {
    return res.status(403).json({ error: 'Network error.' });
  }
  const { t, s, h, b, v2, e, cv, ci } = gotrue_meta_security;
  const now = Date.now();
  if (Math.abs(now - t) > 60000) {
    return res.status(403).json({ error: 'Network error.' });
  }
  const hVals = Array.isArray(h) ? h.join('') : '';
  const bVals = Array.isArray(b) ? b.join('') : '';
  const expectedSig = _0xgen_hash(_0x_s3 + t + hVals + bVals);
  if (s !== expectedSig) {
    return res.status(403).json({ error: 'Network error.' });
  }
  const env = Buffer.from(e || '', 'base64').toString('utf8');
  const expectedV2 = _0xv2h(_0x_v2_s + s + t + env);
  if (v2 !== expectedV2) {
    return res.status(403).json({ error: 'Network error.' });
  }

  // Captcha Verification
  if (!ci || _0xv2h(_0x_v2_s + 'cap' + ci) !== cv) {
    return res.status(403).json({ error: 'Verification failed.' });
  }

  try {
    const { data, error } = await _0x_sc.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      return res.status(error.status || 400).json({
        error: error.message,
        error_description: error.message
      });
    }

    if (!usertoken) {
      return res.status(403).json({ error: 'User token is required.', error_description: 'User token is required.' });
    }

    let { data: userData, error: userError } = await _0x_sc
      .from('users')
      .select('id, usertoken, country')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!userData) {
      const { data: emailData } = await _0x_sc
        .from('users')
        .select('id, usertoken, country')
        .eq('email', email)
        .maybeSingle();
      userData = emailData;
    }

    if (!userData || userData.usertoken !== usertoken) {
      return res.status(403).json({ error: 'Invalid user token.', error_description: 'Invalid user token.' });
    }

    if (userData && userData.country && countryName) {
      if (userData.country !== countryName) {
        return res.status(403).json({ error: 'Security Error: Account locked. Location mismatch.', error_description: 'This account is locked to another location.' });
      }
    } else if (userData && !userData.country && countryName) {
      const { error: updateError } = await _0x_sc
        .from('users')
        .update({ country: countryName })
        .eq('id', userData.id);
      
      if (updateError) {
        console.error('Failed to update country:', updateError);
      } else {
        console.log(`Successfully updated country for user ${userData.id} to: ${countryName}`);
      }
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: '' });
  }
}
