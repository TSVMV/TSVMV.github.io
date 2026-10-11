/* VMV 阅读进度条：文章页顶部粉色细条，随滚动填充
 * 仅在文章页(#post)显示；rAF 节流；pjax 换页自动刷新。 */
(function () {
  "use strict";

  var bar = null;
  var ticking = false;

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "vmv-progress";
    bar.setAttribute(
      "style",
      "position:fixed;top:0;left:0;height:3px;width:0;z-index:990;" +
        "background:linear-gradient(90deg,#ffb7d5,#ff7c9c,#f772a6);" +
        "box-shadow:0 0 8px rgba(255,124,156,.55);pointer-events:none;" +
        "transition:width .08s linear"
    );
    (document.body || document.documentElement).appendChild(bar);
    return bar;
  }

  function update() {
    ticking = false;
    var b = ensureBar();
    var isPost = !!document.getElementById("post");
    if (!isPost) {
      b.style.width = "0";
      return;
    }
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    b.style.width = pct + "%";
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  document.addEventListener("pjax:complete", function () {
    ticking = false;
    onScroll();
  });
  update();
})();
