/* VMV 氛围漂浮物：樱花瓣 / 星星 / 光斑 / 气泡
 * 与鼠标拖尾(mouse-trail.js)分层：本层 z-index 88，
 * 压在看板娘(99)与右下按钮组(100)之下，不挡任何点击。
 * 手机减量、页面隐藏暂停、prefers-reduced-motion 跳过。 */
(function () {
  "use strict";

  if (window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // pjax 站内导航：画布挂 window 做单例，换页时挂回新 body
  if (window.__vmvAmbient) {
    (document.body || document.documentElement).appendChild(window.__vmvAmbient);
    return;
  }

  var canvas = document.createElement("canvas");
  canvas.id = "vmv-ambient";
  canvas.setAttribute(
    "style",
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:88"
  );
  (document.body || document.documentElement).appendChild(canvas);
  window.__vmvAmbient = canvas;

  document.addEventListener("pjax:complete", function () {
    if (window.__vmvAmbient && !document.getElementById("vmv-ambient")) {
      (document.body || document.documentElement).appendChild(window.__vmvAmbient);
    }
  });

  var ctx = canvas.getContext("2d");
  var W, H;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  var mobile = Math.min(W, window.screen ? window.screen.width : W) < 768;
  var MAX = mobile ? 70 : 150;        // 同屏数量上限
  var BATCH = mobile ? 2 : 4;         // 每批生成数
  var INTERVAL = mobile ? 1100 : 720; // 生成间隔

  var PINKS = ["#ffb7d5", "#ff8fb8", "#ffd6e7", "#f772a6", "#ffe3ef"];
  var STARS = ["#ffffff", "#ffe9f3", "#fff7d6"];
  var BOKEH = ["255,183,213", "147,197,253", "253,224,71", "255,143,184"];

  var parts = [];
  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn() {
    if (document.hidden || parts.length >= MAX) return;
    for (var i = 0; i < BATCH; i++) {
      var roll = Math.random();
      if (roll < 0.56) {
        // 樱花瓣：左右摇摆下落，带瓣形与旋转
        parts.push({
          t: "petal",
          x: rand(0, W), y: -16,
          vy: rand(0.5, 1.2), sway: rand(0.7, 1.7),
          phase: rand(0, 6.28), vphase: rand(0.014, 0.028),
          size: rand(4.5, 10.5), rot: rand(0, 6.28), vr: rand(-0.028, 0.028),
          c: PINKS[(Math.random() * PINKS.length) | 0],
          a: rand(0.5, 0.92)
        });
      } else if (roll < 0.72) {
        // 星星：原地闪烁，寿命结束即消失
        parts.push({
          t: "star",
          x: rand(0, W), y: rand(0, H * 0.75),
          life: 0, max: rand(140, 260),
          r: rand(1, 2.3), freq: rand(0.04, 0.11),
          c: STARS[(Math.random() * STARS.length) | 0]
        });
      } else if (roll < 0.88) {
        // 光斑：大而柔、缓慢上浮
        parts.push({
          t: "bokeh",
          x: rand(0, W), y: H + rand(30, 90),
          vy: -rand(0.12, 0.38), sway: rand(0.15, 0.5),
          phase: rand(0, 6.28), vphase: rand(0.006, 0.014),
          r: rand(14, 34),
          c: BOKEH[(Math.random() * BOKEH.length) | 0],
          a: rand(0.05, 0.15)
        });
      } else {
        // 气泡：细圈上浮 + 高光点
        parts.push({
          t: "bubble",
          x: rand(0, W), y: H + 12,
          vy: -rand(0.35, 0.85), sway: rand(0.3, 0.9),
          phase: rand(0, 6.28), vphase: rand(0.012, 0.024),
          r: rand(2.5, 6), a: rand(0.22, 0.5)
        });
      }
    }
  }

  setInterval(spawn, INTERVAL);
  spawn();

  var last = 0;
  (function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 33) return; // 环境层 30fps 足够，省电
    last = t;
    if (document.hidden) return;
    ctx.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      if (p.t === "petal") {
        p.phase += p.vphase;
        p.x += Math.sin(p.phase) * p.sway * 0.5;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > H + 20 || p.x < -30 || p.x > W + 30) { parts.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + Math.sin(p.phase) * 0.4);
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        // 樱花瓣形：两条对称贝塞尔，尖端带浅缺口感
        ctx.moveTo(0, -p.size);
        ctx.quadraticCurveTo(p.size * 0.95, -p.size * 0.35, 0, p.size);
        ctx.quadraticCurveTo(-p.size * 0.95, -p.size * 0.35, 0, -p.size);
        ctx.fill();
        ctx.globalAlpha = p.a * 0.5;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      } else if (p.t === "star") {
        p.life++;
        if (p.life > p.max) { parts.splice(i, 1); continue; }
        var fade = Math.sin((p.life / p.max) * Math.PI);
        var tw = 0.55 + 0.45 * Math.sin(p.life * p.freq * 6);
        var al = fade * tw;
        ctx.save();
        ctx.globalAlpha = Math.max(al, 0);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // 十字光芒
        ctx.globalAlpha = Math.max(al * 0.6, 0);
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 0.7;
        var s = p.r * 3.2;
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
        ctx.stroke();
        ctx.restore();
      } else if (p.t === "bokeh") {
        p.phase += p.vphase;
        p.x += Math.sin(p.phase) * p.sway;
        p.y += p.vy;
        if (p.y < -p.r - 20) { parts.splice(i, 1); continue; }
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, "rgba(" + p.c + "," + p.a + ")");
        g.addColorStop(1, "rgba(" + p.c + ",0)");
        ctx.save();
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        p.phase += p.vphase;
        p.x += Math.sin(p.phase) * p.sway * 0.4;
        p.y += p.vy;
        if (p.y < -12) { parts.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
        ctx.restore();
      }
    }
  })(0);
})();
