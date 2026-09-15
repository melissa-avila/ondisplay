// Minimal self-contained QR encoder (byte mode, EC level M, versions 1-10).
// window.QRSimple.generate(text) -> { size, modules: boolean[][] }
(function () {
  var EXP = new Array(256), LOG = new Array(256), x = 1;
  for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  EXP[255] = EXP[0];
  function mul(a, b) { return (!a || !b) ? 0 : EXP[(LOG[a] + LOG[b]) % 255]; }
  function genPoly(n) {
    var p = [1];
    for (var i = 0; i < n; i++) {
      var r = new Array(p.length + 1).fill(0);
      for (var j = 0; j < p.length; j++) { r[j] ^= mul(p[j], 1); r[j + 1] ^= mul(p[j], EXP[i]); }
      p = r;
    }
    return p;
  }
  function rsEc(data, ecLen) {
    var gp = genPoly(ecLen), res = new Array(ecLen).fill(0);
    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ res[0];
      res.shift(); res.push(0);
      for (var i = 0; i < ecLen; i++) res[i] ^= mul(gp[i + 1], factor);
    }
    return res;
  }

  // version -> [ecPerBlock, [[numBlocks, dataPerBlock], ...]] for level M
  var EC = {
    1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]],
    5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]],
    8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]]
  };
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };
  var FORMAT_M = [0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0];
  var VERSION_INFO = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3 };

  var MASKS = [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return ((i * j) % 2) + ((i * j) % 3) === 0; },
    function (i, j) { return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0; },
    function (i, j) { return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0; }
  ];

  function blocksOf(v) {
    var out = [];
    EC[v][1].forEach(function (g) { for (var k = 0; k < g[0]; k++) out.push(g[1]); });
    return out;
  }
  function dataCapacity(v) {
    var total = blocksOf(v).reduce(function (a, b) { return a + b; }, 0);
    var countBits = v < 10 ? 8 : 16;
    return Math.floor((total * 8 - 4 - countBits) / 8);
  }

  function encode(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    var version = 1;
    while (version <= 10 && dataCapacity(version) < bytes.length) version++;
    if (version > 10) throw new Error("QR payload too long");

    var bits = [];
    function push(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >> b) & 1); }
    push(4, 4);
    push(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });

    var blockSizes = blocksOf(version);
    var totalData = blockSizes.reduce(function (a, b) { return a + b; }, 0);
    var cap = totalData * 8;
    for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    var codewords = [];
    for (var k = 0; k < bits.length; k += 8) {
      var byte = 0;
      for (var m = 0; m < 8; m++) byte = (byte << 1) | bits[k + m];
      codewords.push(byte);
    }
    var pad = [0xEC, 0x11], p = 0;
    while (codewords.length < totalData) codewords.push(pad[p++ % 2]);

    var ecLen = EC[version][0], dataBlocks = [], ecBlocks = [], pos = 0;
    blockSizes.forEach(function (sz) {
      var d = codewords.slice(pos, pos + sz); pos += sz;
      dataBlocks.push(d); ecBlocks.push(rsEc(d, ecLen));
    });
    var out = [], maxLen = Math.max.apply(null, blockSizes);
    for (var c2 = 0; c2 < maxLen; c2++)
      for (var b2 = 0; b2 < dataBlocks.length; b2++)
        if (c2 < dataBlocks[b2].length) out.push(dataBlocks[b2][c2]);
    for (var c3 = 0; c3 < ecLen; c3++)
      for (var b3 = 0; b3 < ecBlocks.length; b3++) out.push(ecBlocks[b3][c3]);

    return { version: version, codewords: out };
  }

  function buildMatrix(version, codewords) {
    var size = version * 4 + 17;
    var mods = [], reserved = [];
    for (var i = 0; i < size; i++) {
      mods.push(new Array(size).fill(false));
      reserved.push(new Array(size).fill(false));
    }
    function set(r, c, v) { mods[r][c] = v; reserved[r][c] = true; }

    function finder(r, c) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        var inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        var on = false;
        if (inRing) {
          var edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          var core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          on = edge || core;
        }
        set(rr, cc, on);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    for (var t = 8; t < size - 8; t++) {
      set(6, t, t % 2 === 0);
      set(t, 6, t % 2 === 0);
    }

    var centers = ALIGN[version];
    centers.forEach(function (r) {
      centers.forEach(function (c) {
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) return;
        for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
          var ring = Math.max(Math.abs(dr), Math.abs(dc));
          set(r + dr, c + dc, ring !== 1);
        }
      });
    });

    set(size - 8, 8, true); // dark module

    // reserve format areas
    for (var f = 0; f < 9; f++) {
      if (!reserved[8][f]) set(8, f, false);
      if (!reserved[f][8]) set(f, 8, false);
    }
    for (var g = 0; g < 8; g++) {
      if (!reserved[8][size - 1 - g]) set(8, size - 1 - g, false);
      if (!reserved[size - 1 - g][8]) set(size - 1 - g, 8, false);
    }
    if (version >= 7) {
      for (var v1 = 0; v1 < 6; v1++) for (var v2 = 0; v2 < 3; v2++) {
        set(size - 11 + v2, v1, false);
        set(v1, size - 11 + v2, false);
      }
    }

    // data placement
    var bitstream = [];
    codewords.forEach(function (b) { for (var i2 = 7; i2 >= 0; i2--) bitstream.push((b >> i2) & 1); });
    var bi = 0, up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      for (var n = 0; n < size; n++) {
        var row = up ? size - 1 - n : n;
        for (var d = 0; d < 2; d++) {
          var cc2 = col - d;
          if (reserved[row][cc2]) continue;
          mods[row][cc2] = bi < bitstream.length ? bitstream[bi++] === 1 : false;
        }
      }
      up = !up;
    }

    // choose mask
    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mk = 0; mk < 8; mk++) {
      var cand = mods.map(function (r) { return r.slice(); });
      for (var r2 = 0; r2 < size; r2++) for (var c4 = 0; c4 < size; c4++)
        if (!reserved[r2][c4] && MASKS[mk](r2, c4)) cand[r2][c4] = !cand[r2][c4];
      var sc = score(cand, size);
      if (sc < bestScore) { bestScore = sc; best = cand; bestMask = mk; }
    }

    // format info
    var fmt = FORMAT_M[bestMask];
    for (var b4 = 0; b4 < 15; b4++) {
      var bit = ((fmt >> b4) & 1) === 1;
      if (b4 < 6) best[b4][8] = bit;
      else if (b4 === 6) best[7][8] = bit;
      else if (b4 === 7) best[8][8] = bit;
      else if (b4 === 8) best[8][7] = bit;
      else best[8][14 - b4] = bit;

      if (b4 < 8) best[8][size - 1 - b4] = bit;
      else best[size - 15 + b4][8] = bit;
    }
    if (version >= 7) {
      var vi = VERSION_INFO[version];
      for (var b5 = 0; b5 < 18; b5++) {
        var vb = ((vi >> b5) & 1) === 1;
        best[Math.floor(b5 / 3)][size - 11 + (b5 % 3)] = vb;
        best[size - 11 + (b5 % 3)][Math.floor(b5 / 3)] = vb;
      }
    }
    return { size: size, modules: best };
  }

  function score(m, size) {
    var s = 0, dark = 0, r, c, run, i;
    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) { run++; if (run === 5) s += 3; else if (run > 5) s += 1; }
        else run = 1;
      }
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) { run++; if (run === 5) s += 3; else if (run > 5) s += 1; }
        else run = 1;
      }
    }
    for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
      var v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) s += 3;
    }
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) dark++;
    var pct = (dark * 100) / (size * size);
    s += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return s;
  }

  window.QRSimple = {
    generate: function (text) {
      var e = encode(text);
      return buildMatrix(e.version, e.codewords);
    },
    draw: function (canvas, text, px, dark) {
      var q = window.QRSimple.generate(text);
      var quiet = 2, total = q.size + quiet * 2;
      var scale = Math.max(1, Math.floor(px / total));
      var dim = scale * total;
      canvas.width = dim; canvas.height = dim;
      canvas.style.width = px + "px"; canvas.style.height = px + "px";
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, dim, dim);
      ctx.fillStyle = dark || "#14141A";
      for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++)
        if (q.modules[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      return q;
    }
  };
})();
