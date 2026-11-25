// First-party attribution + pageview beacon. Load synchronously BEFORE site.js.
(function () {
  var KEY = 'mag_ctx';
  var start = Date.now();
  var q = new URLSearchParams(location.search);
  var ctx = {};
  try { ctx = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) { ctx = {}; }

  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'].forEach(function (k) {
    var v = q.get(k);
    if (v) ctx[k] = v.slice(0, 200);
  });
  if (!ctx.landing) ctx.landing = location.pathname;
  if (!ctx.referrer && document.referrer && document.referrer.indexOf(location.host) === -1) {
    ctx.referrer = document.referrer.slice(0, 300);
  }
  try { sessionStorage.setItem(KEY, JSON.stringify(ctx)); } catch (e) {}

  // pageview beacon, once per session per path
  var seenKey = 'mag_v:' + location.pathname;
  try {
    if (!sessionStorage.getItem(seenKey)) {
      sessionStorage.setItem(seenKey, '1');
      var payload = JSON.stringify({ p: location.pathname, r: ctx.referrer || '' });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('https://mbbsadmissionguide-in.wahidiqubal9.workers.dev/api/hit', payload);
      } else {
        fetch('https://mbbsadmissionguide-in.wahidiqubal9.workers.dev/api/hit', { method: 'POST', body: payload, keepalive: true }).catch(function () {});
      }
    }
  } catch (e) {}

  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/api/lead') !== -1 && init && typeof init.body === 'string') {
        var body = JSON.parse(init.body);
        var hp = document.querySelector('input[name="website"]');
        body = Object.assign({}, ctx, body, {
          website: hp ? hp.value : '',
          submit_ms: Date.now() - start,
          page: location.pathname
        });
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      }
    } catch (e) {}
    return origFetch.call(this, input, init);
  };

  // honeypot: any input named website should stay empty for humans
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || !form.querySelector) return;
    if (form.querySelector('[name="website"]')) return;
    var hp = document.createElement('input');
    hp.type = 'text';
    hp.name = 'website';
    hp.tabIndex = -1;
    hp.autocomplete = 'off';
    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
    form.appendChild(hp);
  }, true);
})();
