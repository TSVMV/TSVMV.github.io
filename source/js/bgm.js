/* VMV 背景音乐：APlayer 直接构建（不依赖 Meting）。
 * 歌单为网易云曲目，经 api.injahow.cn 解析为可播放直链；
 * 直链带时效签名，因此每次进站实时拉取。
 * 浏览器自动播放策略会拦截无手势的 play()：初始化试一次，
 * 若未成功，首次交互（点击/按键/滚轮/触摸）再强制播放。
 * 播放器按钮已被 anime.css 隐藏（按要求不可关闭），循环播放。
 * pjax 说明：Butterfly 站内导航会重新执行本脚本，因此把播放器
 * 实例挂在 window 上做单例——pjax 换页时 audio（不在 DOM 里）
 * 继续播放不中断，只补回被换掉的指示器容器。 */
(function () {
  "use strict";

  function ensureIndicator() {
    var c = document.getElementById("vmv-bgm");
    if (!c) {
      c = document.createElement("div");
      c.id = "vmv-bgm";
      (document.body || document.documentElement).appendChild(c);
    }
  }

  // pjax 站内导航：音乐继续，不重建
  if (window.__vmvBgmPlayer) {
    ensureIndicator();
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
