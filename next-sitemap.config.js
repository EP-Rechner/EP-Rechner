// next-sitemap.config.js
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://equine-rechner.de', // Deine Domain ohne www
  generateRobotsTxt: true,              // erstellt automatisch robots.txt
  sitemapSize: 5000,
  changefreq: 'daily',
  priority: 0.7,
};
