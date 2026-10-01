// Language toggle for the privacy page (external file: the site's CSP allows no inline script).
(function () {
  function L(l) {
    document.body.classList.toggle('hi', l === 'hi');
    document.documentElement.lang = l;
    document.getElementById('bEn').classList.toggle('on', l === 'en');
    document.getElementById('bHi').classList.toggle('on', l === 'hi');
    try {
      localStorage.setItem('rbx.lang', JSON.stringify(l)); // same key as the app
    } catch (e) {
      /* storage blocked */
    }
  }
  document.getElementById('bEn').addEventListener('click', function () {
    L('en');
  });
  document.getElementById('bHi').addEventListener('click', function () {
    L('hi');
  });
  var saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('rbx.lang') || 'null') || localStorage.getItem('rb_lang');
  } catch (e) {
    /* storage blocked */
  }
  if (saved === 'hi' || location.hash === '#hi') L('hi');
})();
