/* VMV 进站启动动画 · 播放脚本
 * 前置条件：head 内联脚本已给 <html> 加上 splash-running 类，
 * 并写入 sessionStorage 标记（一次会话只播放一次）。
 * 本脚本在 </body> 前执行：把舞台挂到 <html> 上（body 此时被 CSS
 * 隐藏，不受影响），逐行播放引导序列，播完/点击/任意键后淡出清理。
 */
(function () {
  "use strict";

  var html = document.documentElement;
  if (!html.classList.contains("splash-running")) return;

  var wrap = document.createElement("div");
  wrap.id = "vmv-splash";
  wrap.innerHTML =
    '<video class="vs-bg" src="/img/ayaka.mp4" muted loop playsinline preload="auto"></video>' +
    '<div class="vs-shade"></div>' +
    '<div class="vs-petals"></div>' +
    '<div class="vs-logo" data-text="VMV">VMV<span class="vs-cursor">&nbsp;</span></div>' +
    '<pre class="vs-term"></pre>' +
    '<div class="vs-tip">click / any key to skip</div>';
  html.appendChild(wrap);

  // 樱花瓣：随机位置/速度/大小
  var petalBox = wrap.querySelector(".vs-petals");
  for (var k = 0; k < 10; k++) {
    var petal = document.createElement("i");
    var size = 7 + Math.random() * 8;
    petal.style.cssText =
      "left:" + (Math.random() * 100) + "%;" +
      "width:" + size + "px;height:" + size + "px;" +
      "animation-duration:" + (2.6 + Math.random() * 2.4) + "s;" +
      "animation-delay:-" + (Math.random() * 4) + "s;" +
      "opacity:" + (0.5 + Math.random() * 0.4).toFixed(2);
    petalBox.appendChild(petal);
  }

  // 背景视频：muted 自动播放，失败则退回纯深色底
  var vid = wrap.querySelector(".vs-bg");
  vid.play().catch(function () { vid.remove(); });

  var term = wrap.querySelector(".vs-term");
  var lines = [
    ["> init kernel ................ ", "[ ok ]"],
    ["> load modules ctf|rev|crypto|ai ", "[ ok ]"],
    ["> verify signature ........... ", "[ ok ]"],
    ["> access vmv.sec ............. ", "GRANTED"]
  ];

  var timer = null;
  var finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);
    html.classList.add("splash-fade");
    setTimeout(function () {
      html.classList.remove("splash-running", "splash-fade");
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 600);
  }

  var i = 0;
  timer = setInterval(function () {
    if (i >= lines.length) {
      clearInterval(timer);
      timer = null;
      setTimeout(finish, 550);
      return;
    }
    var row = document.createElement("div");
    row.className = "vs-line";
    row.textContent = lines[i][0];
    var ok = document.createElement("span");
    ok.className = "vs-ok";
    ok.textContent = lines[i][1];
    row.appendChild(ok);
    term.appendChild(row);
    i++;
  }, 240);

  wrap.addEventListener("click", finish);
  document.addEventListener("keydown", finish);

  // 保底：无论发生什么，3 秒后一定结束
  setTimeout(finish, 3000);
})();
