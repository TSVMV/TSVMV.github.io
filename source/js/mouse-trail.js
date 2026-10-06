/* VMV 鼠标拖尾：跟随指针飘落的樱花瓣
 * 触屏设备与 prefers-reduced-motion 用户自动跳过。 */
(function () {
  "use strict";

  if (!window.matchMedia) return;
  if (window.matchMedia("(hover: none)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.id = "vmv-trail";
  canvas.setAttribute(
    "style",
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:999997"
  );
  (document.body || document.documentElement).appendChild(canvas);

  var ctx = canvas.getContext("2d");
  var W, H;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  var colors = ["#ffb7d5", "#ff8fb8", "#ffd6e7", "#f772a6"];
  var parts = [];

  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    for (var i = 0; i < 2; i++) {
      parts.push({
        x: e.clientX + (Math.random() - 0.5) * 10,
        y: e.clientY + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.5 + Math.random() * 0.9,
        r: 3 + Math.random() * 4,
        a: 1,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.12,
        c: colors[(Math.random() * colors.length) | 0]
      });
    }
    if (parts.length > 150) parts.splice(0, parts.length - 150);
  });

  (function loop() {
    ctx.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx + Math.sin(p.y * 0.02) * 0.35;
      p.y += p.vy;
      p.rot += p.vr;
      p.a -= 0.013;
      if (p.a <= 0 || p.y > H + 12) {
        parts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(p.a, 0);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(loop);
  })();
})();
