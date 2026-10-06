/* VMV 鼠标拖尾：跟随指针飘落的樱花瓣
 * 触屏设备与 prefers-reduced-motion 用户自动跳过。 */
(function () {
  "use strict";

  if (!window.matchMedia) return;
  if (window.matchMedia("(hover: none)").matches) return;

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
    for (var i = 0; i < 3; i++) {
      parts.push({
        x: e.clientX + (Math.random() - 0.5) * 14,
        y: e.clientY + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 0.9,
        vy: 0.5 + Math.random() * 1.1,
        r: 4 + Math.random() * 5,
        a: 1,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.14,
        c: colors[(Math.random() * colors.length) | 0],
        env: false
      });
    }
    if (parts.length > 220) parts.splice(0, parts.length - 220);
  });

  // 全站常驻樱花雨：每隔一阵从顶部飘落几片，重度二次元氛围
  setInterval(function () {
    if (document.hidden) return;
    for (var i = 0; i < 3; i++) {
      parts.push({
        x: Math.random() * window.innerWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.6 + Math.random() * 0.9,
        r: 4 + Math.random() * 5,
        a: 0.85,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.1,
        c: colors[(Math.random() * colors.length) | 0],
        env: true
      });
    }
    if (parts.length > 320) parts.splice(0, parts.length - 320);
  }, 900);

  (function loop() {
    ctx.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx + Math.sin(p.y * 0.02) * 0.35;
      p.y += p.vy;
      p.rot += p.vr;
      var offscreen = p.y > H + 12 || p.x < -24 || p.x > W + 24;
      if (p.env) {
        // 环境花瓣不随时间淡出，飘出屏幕才移除
        if (offscreen) {
          parts.splice(i, 1);
          continue;
        }
      } else {
        p.a -= 0.013;
        if (p.a <= 0 || offscreen) {
          parts.splice(i, 1);
          continue;
        }
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
