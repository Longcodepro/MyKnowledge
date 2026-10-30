/* Sơ đồ trên điện thoại: ở trang chính chỉ xem (không thao tác được);
   bấm "Phóng to" thì sơ đồ mở toàn màn hình, xoay ngang và thao tác được; "Quay lại" trả về như cũ.
   Máy tính: không làm gì cả (script thoát ngay).
   Áp dụng cho mọi .fig có sơ đồ svg.d, hoặc .fig có thuộc tính data-zoom. Thêm data-nozoom để bỏ qua. */
(function () {
  var mq = window.matchMedia && window.matchMedia('(pointer:coarse)');
  var phone = mq && mq.matches && Math.min(screen.width, screen.height) <= 700;
  if (!phone) return;

  var root = document.documentElement;
  root.classList.add('ph');

  var ov, hd, bd, tt, bk;          // lớp phủ, thanh trên, thân, tiêu đề, nút quay lại
  var cur = null, ph = null, btn = null, opened = false, wasPortrait = false, scrollY = 0, enteredFs = false;

  function build() {
    ov = document.createElement('div');
    ov.className = 'zo';
    ov.hidden = true;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Sơ đồ phóng to');
    hd = document.createElement('div');
    hd.className = 'zh';
    bk = document.createElement('button');
    bk.type = 'button';
    bk.className = 'b';
    bk.textContent = '← Quay lại';
    tt = document.createElement('span');
    tt.className = 'zt';
    hd.appendChild(bk);
    hd.appendChild(tt);
    bd = document.createElement('div');
    bd.className = 'zbd';
    ov.appendChild(hd);
    ov.appendChild(bd);
    (document.querySelector('main') || document.body).appendChild(ov);
    bk.addEventListener('click', function () {
      if (history.state && history.state.zoom) history.back(); else close();
    });
  }

  function titleOf(fig) {
    var h = null, n = fig;
    while (n) {
      var p = n.previousElementSibling;
      while (p) {
        if (/^H[23]$/.test(p.tagName)) { h = p; break; }
        p = p.previousElementSibling;
      }
      if (h) break;
      n = n.parentElement;
    }
    return h ? h.textContent.trim() : document.title;
  }

  function fit() {
    if (!opened) return;
    var w = window.innerWidth, h = window.innerHeight, portrait = h > w;
    ov.classList.toggle('rot', portrait);       // máy còn đứng và không khóa được hướng: xoay giao diện bằng CSS
    var W = portrait ? h : w, H = portrait ? w : h;
    ov.style.width = W + 'px';
    ov.style.height = H + 'px';
    ov.style.setProperty('--zbh', (H - (hd.offsetHeight || 44)) + 'px');
  }

  function open(fig, opener) {
    if (opened) return;
    if (!ov) build();
    cur = fig; btn = opener; opened = true;
    wasPortrait = window.innerHeight > window.innerWidth;
    scrollY = window.pageYOffset;
    ph = document.createElement('div');                 // giữ chỗ để trang không bị nhảy
    ph.className = 'zph';
    ph.style.height = fig.offsetHeight + 'px';
    fig.parentNode.insertBefore(ph, fig);
    bd.appendChild(fig);
    fig.classList.remove('zv');
    fig.classList.add('zin');
    fig.classList.toggle('zg', !!fig.querySelector(':scope > svg.d'));
    tt.textContent = titleOf(ph);
    ov.hidden = false;
    root.classList.add('zo-open');
    history.pushState({ zoom: 1 }, '');
    fit();
    try {
      var p = root.requestFullscreen ? root.requestFullscreen() : Promise.reject();
      p.then(function () {
        enteredFs = true;
        return screen.orientation.lock('landscape');
      }).catch(function () {}).then(function () { setTimeout(fit, 150); });
    } catch (e) {}
    setTimeout(function () { bk.focus(); fit(); }, 60);
  }

  function close() {
    if (!opened) return;
    opened = false;
    if (cur && ph && ph.parentNode) {
      ph.parentNode.insertBefore(cur, ph);
      ph.parentNode.removeChild(ph);
    }
    if (cur) { cur.classList.remove('zin', 'zg'); cur.classList.add('zv'); }
    ov.hidden = true;
    ov.classList.remove('rot');
    root.classList.remove('zo-open');
    window.scrollTo(0, scrollY);
    var fs = document.fullscreenElement;
    var done = function () {
      try { screen.orientation.unlock(); } catch (e) {}
      if (document.fullscreenElement) { try { document.exitFullscreen().catch(function () {}); } catch (e) {} }
    };
    // trước đó máy đang đứng: trả màn hình về dọc trước khi thoát toàn màn hình
    if (wasPortrait && fs && screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(function () {}).then(function () { setTimeout(done, 250); });
    } else done();
    enteredFs = false;
    if (btn) { try { btn.focus(); } catch (e) {} }
    cur = ph = btn = null;
  }

  window.addEventListener('popstate', function () { if (opened) close(); });
  window.addEventListener('resize', function () { setTimeout(fit, 50); });
  window.addEventListener('orientationchange', function () { setTimeout(fit, 250); });
  document.addEventListener('fullscreenchange', function () {
    if (opened && enteredFs && !document.fullscreenElement) {
      if (history.state && history.state.zoom) history.back(); else close();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (opened && e.key === 'Escape') { if (history.state && history.state.zoom) history.back(); else close(); }
  });

  function init() {
    [].slice.call(document.querySelectorAll('.fig')).forEach(function (fig) {
      if (fig.hasAttribute('data-nozoom')) return;
      if (!fig.hasAttribute('data-zoom') && !fig.querySelector('svg.d')) return;
      fig.classList.add('zv');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'b zb';
      b.textContent = 'Phóng to';
      b.setAttribute('aria-label', 'Phóng to sơ đồ để thao tác');
      b.addEventListener('click', function () { open(fig, b); });
      fig.insertBefore(b, fig.firstChild);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
