/* RozBazaar app bridge — runs before the website's own scripts, only on https://rozbazaar.shop.
   Fills the few web features an Android WebView lacks, using the phone's own features through RBNative:
   voice input (SpeechRecognition), sharing a picture (navigator.share), saving a made-in-page picture
   (a[download] with blob:/data:), permission state (navigator.permissions), and pull-to-refresh rules. */
(function () {
  if (window.__rbApp) return;
  window.__rbApp = true;
  var N = window.RBNative;
  if (!N) return;

  function def(obj, name, val) {
    try { Object.defineProperty(obj, name, { value: val, configurable: true, writable: true }); }
    catch (e) { try { obj[name] = val; } catch (e2) {} }
  }

  /* ---------- permissions: report the app's real Android permission ---------- */
  try {
    var P = navigator.permissions;
    var orig = P && P.query ? P.query.bind(P) : null;
    var query = function (d) {
      var n = d && d.name;
      if (n === 'geolocation' || n === 'microphone') {
        var s = String(N.permState(n));
        return Promise.resolve({ name: n, state: s, status: s, onchange: null,
          addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return false; } });
      }
      return orig ? orig(d) : Promise.reject(new TypeError('Permission not supported'));
    };
    if (P) def(P, 'query', query);
  } catch (e) {}

  /* ---------- voice: SpeechRecognition backed by Android's speech recogniser ---------- */
  try {
    if (N.speechAvailable()) {
      var cur = null, seq = 0;
      var SR = function () {
        this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
        this.onresult = this.onerror = this.onend = this.onstart = this.onaudiostart = this.onspeechend = null;
        this._id = 0; this._l = {};
      };
      SR.prototype.addEventListener = function (t, f) { (this._l[t] = this._l[t] || []).push(f); };
      SR.prototype.removeEventListener = function (t, f) { var a = this._l[t] || [], i = a.indexOf(f); if (i >= 0) a.splice(i, 1); };
      SR.prototype._fire = function (t, e) {
        e = e || {}; e.type = t; e.target = this;
        var h = this['on' + t];
        if (typeof h === 'function') { try { h.call(this, e); } catch (x) { setTimeout(function () { throw x; }); } }
        (this._l[t] || []).slice().forEach(function (f) { try { f(e); } catch (x) {} });
      };
      SR.prototype.start = function () {
        if (this._id) throw new DOMException('recognition has already started', 'InvalidStateError');
        if (cur && cur !== this) { N.speechAbort(cur._id); cur._end(); }
        this._id = ++seq; cur = this;
        N.speechStart(this._id, String(this.lang || 'hi-IN'), Math.max(1, this.maxAlternatives | 0), !!this.interimResults);
      };
      SR.prototype.stop = function () { if (this._id) N.speechStop(this._id); };
      SR.prototype.abort = function () { if (this._id) { N.speechAbort(this._id); this._end(); } };
      SR.prototype._end = function () {
        if (!this._id) return;
        this._id = 0; if (cur === this) cur = null;
        this._fire('end');
      };
      window.__rbSpeech = function (id, type, data) {
        var r = cur;
        if (!r || r._id !== id) return;
        if (type === 'start') { r._fire('start'); r._fire('audiostart'); }
        else if (type === 'result') {
          var res = (data.alts || []).map(function (t, i) { return { transcript: t, confidence: i === 0 ? 0.9 : 0.5 }; });
          res.isFinal = !!data.final;
          res.item = function (i) { return this[i]; };
          var list = [res]; list.item = function (i) { return this[i]; };
          r._fire('result', { results: list, resultIndex: 0 });
        }
        else if (type === 'speechend') r._fire('speechend');
        else if (type === 'error') r._fire('error', { error: data.error, message: data.error });
        else if (type === 'end') r._end();
      };
      def(window, 'SpeechRecognition', SR);
      def(window, 'webkitSpeechRecognition', SR);
    }
  } catch (e) {}

  /* ---------- sharing (rates card, invites) through Android's share sheet ---------- */
  function toB64(blob) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); ok(s.slice(s.indexOf(',') + 1)); };
      r.onerror = no;
      r.readAsDataURL(blob);
    });
  }
  function shareFiles(title, text, files) {
    return Promise.all(files.map(function (f) {
      return toB64(f).then(function (d) { return { name: f.name || 'file', type: f.type || 'application/octet-stream', data: d }; });
    })).then(function (list) {
      if (!N.share(String(title || ''), String(text || ''), JSON.stringify(list))) throw new DOMException('Share failed', 'AbortError');
    });
  }
  try {
    def(navigator, 'canShare', function (d) {
      if (!d) return false;
      if (!d.files) return !!(d.text || d.url || d.title);
      return Array.prototype.every.call(d.files, function (f) { return /^(image\/|text\/|application\/pdf)/.test(f.type || ''); });
    });
    def(navigator, 'share', function (d) {
      d = d || {};
      var text = [d.text, d.url].filter(Boolean).join('\n');
      return shareFiles(d.title, text, Array.prototype.slice.call(d.files || []));
    });
  } catch (e) {}

  /* ---------- a picture made in the page (blob:/data: link with download) → share sheet ---------- */
  function saveLink(a) {
    var h = a.href || '';
    if (!/^(blob:|data:)/.test(h)) return false;
    fetch(h).then(function (r) { return r.blob(); }).then(function (b) {
      return shareFiles('', '', [new File([b], a.getAttribute('download') || 'file', { type: b.type || 'application/octet-stream' })]);
    }).catch(function () {});
    return true;
  }
  try {
    var oc = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.hasAttribute('download') && saveLink(this)) return;
      return oc.apply(this, arguments);
    };
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
      if (a && saveLink(a)) e.preventDefault();
    }, true);
  } catch (e) {}

  /* ---------- pull-to-refresh: only from the very top of the page, never inside a map, a pop-up or a scrolled box ---------- */
  function canPull(t) {
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 0) return false;
    for (var el = t; el && el.nodeType === 1 && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollTop > 0) return false;
      if (el.classList && el.classList.contains('leaflet-container')) return false;
      if (getComputedStyle(el).position === 'fixed') return false;
    }
    return true;
  }
  window.addEventListener('touchstart', function (e) {
    try { N.setPull(e.touches.length === 1 && canPull(e.target)); } catch (x) {}
  }, { capture: true, passive: true });
  window.addEventListener('touchend', function () { try { N.setPull(false); } catch (x) {} }, { capture: true, passive: true });
})();
