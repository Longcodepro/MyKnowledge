/* Trình bấm "Bước tiếp" cho đồ thị có hướng (dùng chung cho các trang thuật toán TT).
   ttStepper(id, N, E, frames, o)
   N: { tên: [nhãn, x, y] }   E: [[từ, đến]] hoặc [[từ, đến, 'cong']]
   frames[i]: { t: lời giải thích, cls: {nút: 'ok'|'fr'|'cur'|'bad'}, sub: {nút: chữ nhỏ}, on: [[a,b]], bad: [[a,b]], hide: [[a,b]], row: [các ô của bảng] }
   o: { vb: [rộng, cao], cols: [tiêu đề các cột phụ], cap: chú thích dưới bảng, rowLabel: tiêu đề cột "việc làm" } */
(function () {
  var W = 150, H = 44;
  function k(e) { return e[0] + '>' + e[1]; }
  function set(list) { var m = {}; (list || []).forEach(function (e) { m[k(e)] = 1; }); return m; }
  function clip(a, b, gap) {            // điểm trên viền hình chữ nhật của nút a theo hướng sang b
    var cx = a[1], cy = a[2] + H / 2, dx = b[1] - cx, dy = b[2] + H / 2 - cy;
    var t = Math.min(dx ? (W / 2) / Math.abs(dx) : 1e9, dy ? (H / 2 + gap) / Math.abs(dy) : 1e9);
    return [cx + dx * t, cy + dy * t];
  }
  window.ttStepper = function (id, N, E, frames, o) {
    o = o || {};
    var root = document.getElementById(id), i = 0, names = Object.keys(N), cols = o.cols || [];
    root.innerHTML = '<svg class="d" viewBox="0 0 ' + o.vb[0] + ' ' + o.vb[1] + '" role="img" aria-label="Đồ thị minh họa từng bước">' +
      '<defs><marker id="' + id + 'a0" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--mut)"/></marker>' +
      '<marker id="' + id + 'a1" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--red)"/></marker>' +
      '<marker id="' + id + 'a2" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--blue)"/></marker></defs>' +
      '<g id="' + id + 'e"></g><g id="' + id + 'n"></g></svg>' +
      '<div class="row"><button class="b" id="' + id + 'nx" type="button">Bước tiếp</button><button class="b" id="' + id + 'rs" type="button">Làm lại</button></div>' +
      '<div class="msg" id="' + id + 'm" aria-live="polite"></div><div class="tw" id="' + id + 't"></div>';
    function draw() {
      var f = frames[i], on = set(f.on), bad = set(f.bad), hide = set(f.hide);
      $('#' + id + 'e').innerHTML = E.map(function (e) {
        if (hide[k(e)]) return '';
        var a = N[e[0]], b = N[e[1]], cl = bad[k(e)] ? ' bad' : on[k(e)] ? ' on' : '', mk = bad[k(e)] ? 'a1' : on[k(e)] ? 'a2' : 'a0';
        if (e[2] === 'cong') {
          var sx = a[1] + W / 2, sy = a[2] + H / 2, ex = b[1] + W / 2, ey = b[2] + H / 2;
          return '<path class="ed' + cl + '" d="M' + sx + ' ' + sy + ' C ' + (sx + 260) + ' ' + sy + ', ' + (ex + 260) + ' ' + ey + ', ' + (ex + 4) + ' ' + ey + '" marker-end="url(#' + id + mk + ')"/>';
        }
        var p = clip(a, b, 0), q = clip(b, a, 5);
        return '<line class="ed' + cl + '" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '" marker-end="url(#' + id + mk + ')"/>';
      }).join('');
      $('#' + id + 'n').innerHTML = names.map(function (n) {
        var d = N[n], c = (f.cls || {})[n] || '', s = (f.sub || {})[n] || '';
        return '<g class="nd' + (c ? ' ' + c : '') + '"><rect x="' + (d[1] - W / 2) + '" y="' + d[2] + '" width="' + W + '" height="' + H + '" rx="2"/>' +
          '<text x="' + d[1] + '" y="' + (d[2] + 19) + '" text-anchor="middle">' + n + ' · ' + d[0] + '</text><text class="sm" x="' + d[1] + '" y="' + (d[2] + 35) + '" text-anchor="middle">' + s + '</text></g>';
      }).join('');
      $('#' + id + 'm').innerHTML = f.t;
      var h = '<table aria-label="Các bước"><thead><tr><th>Bước</th><th>' + (o.rowLabel || 'Việc làm') + '</th>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
      frames.slice(0, i + 1).forEach(function (r, j) {
        h += '<tr' + (j === i ? ' class="hit"' : '') + '><td>' + (j === 0 ? 'Đầu' : j) + '</td><td>' + (r.s || r.t) + '</td>' + cols.map(function (c, x) { return '<td>' + ((r.row || [])[x] === undefined ? '' : r.row[x]) + '</td>'; }).join('') + '</tr>';
      });
      $('#' + id + 't').innerHTML = h + '</tbody></table>' + (o.cap ? '<p class="cap">' + o.cap + '</p>' : '');
      $('#' + id + 'nx').disabled = i >= frames.length - 1;
    }
    $('#' + id + 'nx').onclick = function () { if (i < frames.length - 1) { i++; draw(); } };
    $('#' + id + 'rs').onclick = function () { i = 0; draw(); };
    draw();
  };
})();
