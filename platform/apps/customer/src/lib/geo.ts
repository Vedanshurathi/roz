/**
 * Precise location. A phone's first answer is often a rough cell-tower guess (one real address was
 * once saved 57 km away), so keep listening, keep the most accurate fix, stop at ±goodAcc metres or
 * after maxMs. One GPS session at a time — a second caller joins the running one.
 */
let run: { p: Promise<GeolocationPosition>; subs: Array<(p: GeolocationPosition) => void> } | null = null;

export function getPreciseLocation(
  onUpdate?: (p: GeolocationPosition) => void,
  maxMs = 20000,
  goodAcc = 20,
): Promise<GeolocationPosition> {
  if (run) {
    if (onUpdate) run.subs.push(onUpdate);
    return run.p;
  }
  const r: { p: Promise<GeolocationPosition>; subs: Array<(p: GeolocationPosition) => void> } = {
    subs: onUpdate ? [onUpdate] : [],
    p: Promise.resolve(null as unknown as GeolocationPosition),
  };
  r.p = new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject({ code: 0 });
    let best: GeolocationPosition | null = null;
    let done = false;
    let wid: number | null = null;
    const stop = () => {
      done = true;
      run = null;
      if (wid !== null) navigator.geolocation.clearWatch(wid);
    };
    const end = () => {
      if (done) return;
      stop();
      if (best) resolve(best);
      else reject({ code: 3 });
    };
    wid = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy < best.coords.accuracy) {
          best = p;
          for (const f of r.subs)
            try {
              f(p);
            } catch {
              /* a listener failing must not stop the GPS */
            }
        }
        if (best.coords.accuracy <= goodAcc) end();
      },
      (err) => {
        if (best) return end();
        if (done) return;
        stop();
        reject(err);
      },
      { enableHighAccuracy: true, timeout: maxMs, maximumAge: 0 },
    );
    window.setTimeout(end, maxMs);
  });
  run = r;
  return r.p;
}

export async function geoState(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!navigator.geolocation) return 'unsupported';
  try {
    if (navigator.permissions) return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    /* Safari < 16 has no permissions API */
  }
  try {
    return localStorage.getItem('rb_geo_ok') ? 'granted' : 'prompt';
  } catch {
    return 'prompt';
  }
}

/** Opened as the Play Store app (TWA)? Then permissions live in the phone's app settings. */
export const IN_APP = (() => {
  try {
    if (document.referrer.startsWith('android-app://') || /[?&]source=pwa/.test(location.search))
      sessionStorage.setItem('rb_app', '1');
    return Boolean(sessionStorage.getItem('rb_app'));
  } catch {
    return document.referrer.startsWith('android-app://');
  }
})();

export function unblockHow(kind: 'notif' | 'geo', t: (en: string, hi: string) => string): string {
  const en = kind === 'notif' ? 'Notifications' : 'Location';
  const hi = kind === 'notif' ? 'सूचनाएँ' : 'लोकेशन';
  return IN_APP
    ? t(
        `Phone Settings → Apps → RozBazaar → ${en} → Allow`,
        `फ़ोन सेटिंग्स → ऐप्स → RozBazaar → ${hi} → अनुमति दें`,
      )
    : t(
        `Tap 🔒 next to the website address → Permissions → ${en} → Allow`,
        `वेबसाइट के पते के पास 🔒 दबाएँ → अनुमतियाँ → ${hi} → अनुमति दें`,
      );
}
