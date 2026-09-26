// 生成 robots.txt：Sitemap 地址取当前构建配置的 url
// 两个站点（GitHub Pages / Cloudflare Pages）共用源码但域名不同，
// 用生成器替代硬编码的 source/robots.txt

hexo.extend.generator.register('robots', function () {
  var url = (hexo.config.url || '').replace(/\/+$/, '');
  var lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /js/',
    'Disallow: /css/',
    'Disallow: /fonts/',
    '',
    'Sitemap: ' + url + '/sitemap.xml',
    ''
  ];
  return {
    path: 'robots.txt',
    data: lines.join('\n')
  };
});