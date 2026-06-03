/* ──────────────────────────────────────────────
   卷首人物 —— 鼠标 hover 时的克制视差
   随指针在框内 ±6px 漂移 + 微缩放，离开复位。
   对标原站 mascot parallax。
   ────────────────────────────────────────────── */
(function () {
  var frame = document.getElementById('plateFrame');
  if (!frame) return;
  var art = frame.querySelector('.plate__art');
  if (!art) return;

  var raf = null, dx = 0, dy = 0;

  function apply() {
    art.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.015)';
    raf = null;
  }

  frame.addEventListener('mousemove', function (e) {
    var r = frame.getBoundingClientRect();
    dx = ((e.clientX - r.left) / r.width  - 0.5) * 6;
    dy = ((e.clientY - r.top)  / r.height - 0.5) * 6;
    if (!raf) raf = requestAnimationFrame(apply);
  });

  frame.addEventListener('mouseleave', function () {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    art.style.transform = '';
  });
})();
