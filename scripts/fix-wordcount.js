// 修正阅读时间：排除代码块后再统计字数
// hexo-wordcount 默认把代码也算进字数，CTF 博客代码多导致阅读时间虚高

var util = require('hexo-util');
var stripHTML = util.stripHTML;

function counter(content) {
  // 先去掉 fenced code block (```...```)
  content = content.replace(/```[\s\S]*?```/g, '');
  // 去掉行内代码 `...`
  content = content.replace(/`[^`]*`/g, '');
  content = stripHTML(content);
  const cn = (content.match(/[\u4E00-\u9FA5]/g) || []).length;
  const en = (content.replace(/[\u4E00-\u9FA5]/g, '').match(/[a-zA-Z0-9_\u0392-\u03c9\u0400-\u04FF]+|[\u4E00-\u9FFF\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\uac00-\ud7af\u0400-\u04FF]+|[\u00E4\u00C4\u00E5\u00C5\u00F6\u00D6]+|\w+/g) || []).length;
  return [cn, en];
}

// 覆盖 min2read：中文 350 字/分钟，英文 180 词/分钟（技术文章阅读速度）
hexo.extend.helper.register('min2read', function (content, { cn = 350, en = 180 } = {}) {
  var len = counter(content);
  var readingTime = len[0] / cn + len[1] / en;
  return readingTime < 1 ? '1' : parseInt(readingTime, 10);
});

// 覆盖 wordcount：同样排除代码块
hexo.extend.helper.register('wordcount', function (content) {
  var len = counter(content);
  var count = len[0] + len[1];
  if (count < 1000) {
    return count;
  }
  return Math.round(count / 100) / 10 + 'k';
});
