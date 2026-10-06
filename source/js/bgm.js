/* VMV 背景音乐：APlayer 直接构建（不依赖 Meting）。
 * 歌单为网易云曲目，经 api.injahow.cn 解析为可播放直链；
 * 直链带时效签名，因此每次进站实时拉取。
 * 浏览器自动播放策略会拦截无手势的 play()：初始化试一次，
 * 若未成功，首次交互（点击/按键/滚轮/触摸）再强制播放。
 * 播放器按钮已被 anime.css 隐藏（按要求不可关闭），循环播放。
 */
(function () {
  "use strict";

  var API = "https://api.injahow.cn/meting/?server=netease&type=song&id=";
  var SONGS = [
    "3420711343", // 琵琶曲 - DJ大大怪
    "461011",     // 恋愛サーキュレーション（恋爱循环） - 花澤香菜
    "2034742057", // アイドル（偶像） - YOASOBI
    "657680",     // 残酷な天使のテーゼ - 高橋洋子
    "426881487"   // 前前前世 (movie ver.) - RADWIMPS
  ];

  if (typeof window.APlayer !== "function") return;

  Promise.all(
    SONGS.map(function (id) {
      return fetch(API + id)
        .then(function (r) { return r.json(); })
        .then(function (j) { return Array.isArray(j) ? j[0] : j; })
        .catch(function () { return null; });
    })
  ).then(function (list) {
    var audios = list.filter(function (s) { return s && s.url; }).map(function (s) {
      return {
        name: s.name,
        artist: s.artist,
        url: s.url,
        cover: s.pic || ""
      };
    });
    if (!audios.length) return;

    var container = document.createElement("div");
    container.id = "vmv-bgm";
    document.body.appendChild(container);

    var player = new APlayer({
      container: container,
      fixed: true,
      autoplay: true,
      loop: "all",
      order: "list",
      volume: 0.55,
      mutex: true,
      theme: "#ff7c9c",
      audio: audios
    });

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
