/* VMV 背景音乐：APlayer 直接构建（不依赖 Meting）。
 * 歌单为网易云曲目，经 api.injahow.cn 解析为可播放直链；
 * 直链带时效签名，因此每次进站实时拉取。
 * 浏览器自动播放策略会拦截无手势的 play()：初始化试一次，
 * 若未成功，首次交互（点击/按键/滚轮/触摸）再强制播放。
 * 播放器按钮已被 anime.css 隐藏，循环播放；左下角音符小圆片
 * 是可点击的开关：点击暂停/恢复，暂停时变灰静止并带斜线。
 * pjax 说明：Butterfly 站内导航会重新执行本脚本，因此把播放器
 * 实例挂在 window 上做单例——pjax 换页时 audio（不在 DOM 里）
 * 继续播放不中断，只补回被换掉的指示器容器并重绑开关。 */
(function () {
  "use strict";

  function syncState() {
    var p = window.__vmvBgmPlayer;
    var c = document.getElementById("vmv-bgm");
    if (!p || !p.audio || !c) return;
    c.classList.toggle("vmv-bgm-paused", p.audio.paused);
  }

  function ensureIndicator() {
    var c = document.getElementById("vmv-bgm");
    if (!c) {
      c = document.createElement("div");
      c.id = "vmv-bgm";
      c.setAttribute("role", "button");
      c.setAttribute("aria-label", "背景音乐 开/关");
      c.title = "背景音乐 开/关";
      (document.body || document.documentElement).appendChild(c);
    }
    if (!c.__vmvToggleBound) {
      c.__vmvToggleBound = true;
      c.addEventListener("click", function () {
        var p = window.__vmvBgmPlayer;
        if (!p || !p.audio) return;
        try {
          if (p.audio.paused) { p.audio.play(); } else { p.audio.pause(); }
        } catch (e) {}
      });
    }
    return c;
  }

  // pjax 站内导航：音乐继续，不重建，只补回指示器并同步开关状态
  if (window.__vmvBgmPlayer) {
    ensureIndicator();
    syncState();
    return;
  }

  if (typeof window.APlayer !== "function") return;
  ensureIndicator();

  var API = "https://api.injahow.cn/meting/?server=netease&type=song&id=";
  // 所有 ID 均经 meting 接口实测可解析出可播放直链
  var SONGS = [
    "3420711343", // 琵琶曲 - DJ大大怪
    "461011",     // 恋愛サーキュレーション（恋爱循环） - 花澤香菜
    "2034742057", // アイドル（偶像） - YOASOBI
    "657680",     // 残酷な天使のテーゼ - 高橋洋子
    "426881487",  // 前前前世 (movie ver.) - RADWIMPS
    "461005",     // Staple Stable - 斎藤千和
    "461013",     // Sugar Sweet Nightmare - 堀江由衣
    "461009",     // Ambivalent World - 沢城みゆき
    "461014",     // 序章 - 神前暁
    "404083266"   // インフィニティ - May'n
  ];

  Promise.all(
    SONGS.map(function (id) {
      return fetch(API + id)
        .then(function (r) { return r.json(); })
        .then(function (j) { return Array.isArray(j) ? j[0] : j; })
        .catch(function () { return null; });
    })
  ).then(function (list) {
    // pjax 快速切换时可能已经建好，避免双实例
    if (window.__vmvBgmPlayer) return;
    var audios = list.filter(function (s) { return s && s.url; }).map(function (s) {
      return {
        name: s.name,
        artist: s.artist,
        url: s.url,
        cover: s.pic || ""
      };
    });
    if (!audios.length) return;

    var container = document.getElementById("vmv-bgm");
    if (!container) return;

    var player = new APlayer({
      container: container,
      fixed: true,
      autoplay: true,
      loop: "all",
      order: "list",
      volume: 0.25,
      mutex: true,
      theme: "#ff7c9c",
      audio: audios
    });
    window.__vmvBgmPlayer = player;

    // 开关状态跟随 audio 原生事件，避免依赖 APlayer 版本差异
    player.audio.addEventListener("play", syncState);
    player.audio.addEventListener("pause", syncState);
    syncState();

    function play() {
      try { player.play(); } catch (e) {}
    }
    play();

    function onGesture() {
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
      document.removeEventListener("wheel", onGesture, true);
      document.removeEventListener("touchstart", onGesture, true);
      play();
    }
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
    document.addEventListener("wheel", onGesture, true);
    document.addEventListener("touchstart", onGesture, true);
  });
})();
