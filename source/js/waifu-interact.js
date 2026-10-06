/* 看板娘点击互动补丁
 * 组件自带的命中判定依赖 mousedown/mouseup 位移阈值（轻微移动会被判成拖拽），
 * 且初音模型缺少 hit_areas，导致点击常常不触发互动。这里用事件委托兜底：
 * 只要点在看板娘画布上，就派发 live2d:tapbody（组件监听它 → 播放说话台词），
 * 并尝试触发一次身体动作。对 pjax 换页也安全（委托挂在 document 上）。 */
(function () {
  "use strict";

  var last = 0;
  function onInteract(e) {
    var canvas = e.target && e.target.closest && e.target.closest("#waifu canvas");
    if (!canvas) return;
    var now = Date.now();
    if (now - last < 1500) return; // 去重：click 与 pointerup 只算一次，也防组件自身命中连发
    last = now;
    try { window.dispatchEvent(new Event("live2d:tapbody")); } catch (err) {}
  }
  // 同时监听 click 和 pointerup：组件可能对 click 调用 preventDefault，
  // 但 pointerup 不受影响，保证真人点击一定触发互动。
  document.addEventListener("click", onInteract, true);
  document.addEventListener("pointerup", onInteract, true);
})();
