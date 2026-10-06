/* VMV 进站启动动画 v4 · 播放脚本
 * 前置：head 内联脚本给 <html> 加 splash-running（每次进站都播，站内跳转不播）。
 * 背景：静态动漫图兜底 + ayaka.mp4 视频就绪后淡入叠加；
 * 逐行引导日志等视频就绪（或最多 0.9 秒）再开始，避免视频没加载完动画就播完了。 */
(function () {
  "use strict";

  var html = document.documentElement;
  if (!html.classList.contains("splash-running")) return;

  var wrap = document.createElement("div");
  wrap.id = "vmv-splash";
  wrap.innerHTML =
    '<img class="vs-bgimg" src="/img/anime/mahoyo.jpg" alt="">' +
    '<video class="vs-bg" src="/img/ayaka.mp4" muted loop playsinline preload="auto"></video>' +
    '<div class="vs-shade"></div>' +
    '<div class="vs-petals"></div>' +
    '<div class="vs-stage">' +
    '<div class="vs-rings"><i></i><i></i></div>' +
    '<div class="vs-logo" data-text="VMV">VMV<span class="vs-cursor">&nbsp;</span></div>' +
    '<pre class="vs-term"></pre>' +
    '<div class="vs-granted">ACCESS GRANTED</div>' +
    '<div class="vs-tip">click / any key to skip</div>' +
    "</div>" +
    '<div class="vs-progress"><i></i></div>';
  html.appendChild(wrap);

  // 樱花瓣：随机位置/速度/大小
  var petalBox = wrap.querySelector(".vs-petals");
  for (var k = 0; k < 16; k++) {
    var petal = document.createElement("i");
    var size = 7 + Math.random() * 9;
    petal.style.cssText =
      "left:" + (Math.random() * 100) + "%;" +
      "width:" + size + "px;height:" + size + "px;" +
      "animation-duration:" + (2.6 + Math.random() * 2.6) + "s;" +
      "animation-delay:-" + (Math.random() * 5) + "s;" +
      "opacity:" + (0.5 + Math.random() * 0.4).toFixed(2);
    petalBox.appendChild(petal);
  }

  // 背景视频：就绪后淡入；加载失败则移除，留下静态图兜底
  var vid = wrap.querySelector(".vs-bg");
  var vidReady = false;
  vid.addEventListener("canplay", function () {
    vidReady = true;
    vid.classList.add("vs-ready");
  });
  var pp = vid.play && vid.play();
  if (pp && pp.catch) pp.catch(function () { vid.remove(); });

  var term = wrap.querySelector(".vs-term");
  var granted = wrap.querySelector(".vs-granted");
  var lines = [
    ["> init kernel ................ ", "[ ok ]"],
    ["> mount /dev/sakura .......... ", "[ ok ]"],
    ["> load modules ctf|rev|crypto ", "[ ok ]"],
    ["> summon waifu.exe ........... ", "[ ok ]"],
    ["> loading anime wallpapers ... ", "[ ok ]"],
    ["> verify signature ........... ", "[ ok ]"],
    ["> decode moe stream .......... ", "[ ok ]"],
    ["> establish kawaii link ...... ", "[ ok ]"],
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
    }, 650);
  }

  wrap.addEventListener("click", finish);
  document.addEventListener("keydown", finish);

  function startSequence() {
    var i = 0;
    timer = setInterval(function () {
      if (i >= lines.length) {
        clearInterval(timer);
        timer = null;
        term.style.transition = "opacity 0.4s ease";
        term.style.opacity = "0.12";
        granted.classList.add("vs-show");
        setTimeout(finish, 1700);
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
    }, 300);
  }

  // 等视频就绪再开始日志；视频慢/失败最多等 0.9 秒照常开始
  var waited = 0;
  var gate = setInterval(function () {
    waited += 100;
    if (vidReady || !vid.parentNode || waited >= 900) {
      clearInterval(gate);
      startSequence();
    }
  }, 100);

  // 保底：无论发生什么，7 秒后一定结束
  setTimeout(finish, 7000);
})();
