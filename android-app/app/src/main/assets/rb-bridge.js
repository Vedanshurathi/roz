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

  /* ---------- notifications: web Notification API backed by Android notifications ---------- */
  try {
    if (N.notifState) {
      var nReq = 0, nWait = {};
      window.__rbNotif = function (id, state) { var f = nWait[id]; delete nWait[id]; if (f) f(String(state)); };
      var RBNotification = function (title, opts) {
        opts = opts || {};
        this.title = String(title || ''); this.body = String(opts.body || ''); this.tag = opts.tag || '';
        this.onclick = this.onclose = this.onerror = this.onshow = null;
        try { N.notify(this.title, this.body, String(this.tag)); } catch (e) {}
      };
      RBNotification.prototype.close = function () {};
      RBNotification.prototype.addEventListener = function () {};
      RBNotification.prototype.removeEventListener = function () {};
      Object.defineProperty(RBNotification, 'permission', { get: function () { return String(N.notifState()); } });
      RBNotification.requestPermission = function (cb) {
        return new Promise(function (ok) {
          var id = ++nReq;
          nWait[id] = function (st) { try { if (typeof cb === 'function') cb(st); } catch (e) {} ok(st); };
          N.notifRequest(id);
        });
      };
      def(window, 'Notification', RBNotification);
      /* app-only helpers the website uses to switch background order alerts on (see customer/index.html) */
      def(window, 'RBApp', {
        push: true,
        token: function () { return String(N.pushToken()); },
        pushEnable: function (on) { N.pushEnable(!!on); }
      });
    }
  } catch (e) {}

  /* ---------- location: navigator.geolocation backed by the phone's fast location providers ---------- */
  try {
    if (N.geoNative && N.geoNative()) {
      var gSeq = 0, gRun = {};
      var mkPos = function (d) {
        return { coords: { latitude: d.lat, longitude: d.lng, accuracy: d.acc, altitude: d.alt == null ? null : d.alt,
                 altitudeAccuracy: null, heading: d.head == null ? null : d.head, speed: d.speed == null ? null : d.speed },
                 timestamp: d.ts || Date.now() };
      };
      var mkErr = function (code, msg) {
        return { code: code, message: msg || '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
      };
      window.__rbGeo = function (id, type, d) {
        var r = gRun[id]; if (!r) return;
        if (type === 'pos') {
          r.got = true; clearTimeout(r.timer);
          try { r.ok(mkPos(d)); } catch (e) { setTimeout(function () { throw e; }); }
          if (r.once) { delete gRun[id]; N.geoStop(id); }
        } else if (type === 'err') {
          clearTimeout(r.timer);
          var once = r.once || d.code === 1;
          if (once) { delete gRun[id]; N.geoStop(id); }
          if (r.err) try { r.err(mkErr(d.code, d.message)); } catch (e) {}
        }
      };
      var begin = function (ok, err, o, once) {
        o = o || {};
        var id = ++gSeq, r = { ok: ok, err: err, once: once, got: false };
        gRun[id] = r;
        var t = o.timeout;
        if (typeof t === 'number' && isFinite(t) && t >= 0) {
          r.timer = setTimeout(function () {
            if (r.got || !gRun[id]) return;
            if (once) { delete gRun[id]; N.geoStop(id); }
            if (err) try { err(mkErr(3, 'Timeout expired')); } catch (e) {}
          }, t);
        }
        N.geoStart(id, o.enableHighAccuracy !== false);
        return id;
      };
      var geo = {
        getCurrentPosition: function (ok, err, o) { begin(ok, err, o, true); },
        watchPosition: function (ok, err, o) { return begin(ok, err, o, false); },
        clearWatch: function (id) { var r = gRun[id]; if (!r) return; clearTimeout(r.timer); delete gRun[id]; N.geoStop(id); }
      };
      def(navigator, 'geolocation', geo);
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
