(function () {
  // Runs in <head> before the first paint: appearance, language, motion and clock weight, so nothing flashes.
  // A flag in the address wins over a choice remembered from Quick settings. The old wallpaper names
  // (?theme=) still work: they now only pick the page mode.
  var d = document.documentElement, q = new URLSearchParams(location.search);
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var THEME = { midnight: 'dark', orbit: 'dark', blossom: 'dark', aurora: 'dark', dark: 'dark', lagoon: 'light', dawn: 'light', light: 'light' };
  var a = q.get('appearance');
  if (!/^(auto|dark|light)$/.test(a || '')) a = THEME[q.get('theme')] || get('ls7-appearance');
  var l = q.get('lang') || get('ls7-lang');
  var m = q.get('motion') || get('ls7-motion');
  var p = q.get('parallax') || get('ls7-parallax');
  var w = q.get('weight') || get('ls7-weight');
  if (!/^(auto|dark|light)$/.test(a || '')) a = 'auto';
  if (!/^(en|zh)$/.test(l || '')) l = /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
  var light = a === 'light' || (a === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  d.setAttribute('data-appearance-pref', a);
  d.setAttribute('data-appearance', light ? 'light' : 'dark');
  d.setAttribute('data-lang', l);
  d.lang = l === 'zh' ? 'zh-CN' : 'en';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', light ? '#ffffff' : '#08090c');
  var reduce = m === 'reduce' || (m !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce) d.classList.add('reduced');
  if (p === 'off') d.classList.add('no-parallax');
  if (w === 'thin') d.classList.add('thin');
  d.classList.remove('no-js');
  d.classList.add('js');
})();
