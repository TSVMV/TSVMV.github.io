/* 全站图片懒加载：渲染输出阶段给没有 loading 属性的 <img> 补上
 * 浏览器原生 loading="lazy"（视口外图片滚动到才加载）。
 * 首屏内的图浏览器会立即加载，因此对首屏体验无损。 */
hexo.extend.filter.register("after_render:html", function (str) {
  if (typeof str !== "string" || str.indexOf("<img") === -1) return str;
  return str.replace(/<img((?![^>]*\sloading=)[^>]*)>/gi, '<img loading="lazy"$1>');
});
