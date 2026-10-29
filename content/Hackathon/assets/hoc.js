/* Chế độ sáng/tối (nhớ lựa chọn) và hai hàm tìm phần tử dùng chung */
(function () {
  var r = document.documentElement, K = 'hoc-theme';
  try { var s = localStorage.getItem(K); if (s) r.setAttribute('data-theme', s); } catch (e) {}
  function cur() { return r.getAttribute('data-theme') || 'light'; }
  function lab() { var b = document.getElementById('tg'); if (b) b.textContent = cur() === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'; }
  document.addEventListener('DOMContentLoaded', function () {
    lab();
    var b = document.getElementById('tg');
    if (b) b.addEventListener('click', function () {
      var n = cur() === 'dark' ? 'light' : 'dark';
      r.setAttribute('data-theme', n);
      try { localStorage.setItem(K, n); } catch (e) {}
      lab();
    });
  });
  window.$ = function (s, x) { return (x || document).querySelector(s); };
  window.$$ = function (s, x) { return [].slice.call((x || document).querySelectorAll(s)); };
})();
