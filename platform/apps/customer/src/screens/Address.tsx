/**
 * Add / edit an address — the original screen: exact GPS (best fix in 20 s), a map with a draggable
 * 📍 (satellite or street), village matched from our own village boundaries, written details
 * auto-filled from OpenStreetMap (only small parts + OUR village), Home / Shop / Parents' home / named.
 */
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Address as Addr, AreaMatch } from '@rozbazaar/shared';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { keys, useAddresses, useAreas } from '../api/queries';
import { getPreciseLocation } from '../lib/geo';
import { addrName, KNOWN_TAGS } from '../lib/model';
import { useShop } from '../state/shop';
import { useCheckout } from '../state/useCheckout';
import { useMe } from '../state/useMe';
import { useToast } from '../ui/Toast';
import { CheckoutBanner } from '../ui/CheckoutBanner';

interface Coords {
  lat: number;
  lng: number;
  acc: number | null;
  pinned: boolean;
}
type Tag = (typeof KNOWN_TAGS)[number] | 'Aur';
const TILES = {
  sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  street: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};

export default function AddressScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromCheckout = params.get('from') === 'checkout';
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const shop = useShop();
  const { loggedIn, pending } = useMe();
  const { createBooking } = useCheckout();
  const areas = useAreas();
  const addrs = useAddresses(loggedIn);
  const editing: Addr | null = id ? (addrs.data?.find((a) => a.id === id) ?? null) : null;

  const [coords, setCoords] = useState<Coords | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [gpsBusy, setGpsBusy] = useState<string | null>(null);
  const [full, setFull] = useState('');
  const [touched, setTouched] = useState(false);
  const [house, setHouse] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [land, setLand] = useState('');
  const [note, setNote] = useState('');
  const [tag, setTag] = useState<Tag>('Ghar');
  const [label, setLabel] = useState('');
  const [src, setSrc] = useState('');
  const [detected, setDetected] = useState<{ color: string; text: string } | null>(null);
  const [layer, setLayer] = useState<'sat' | 'street'>('sat');
  const [hint, setHint] = useState<{ warn: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<{
    m: L.Map;
    pin: L.Marker;
    circ: L.Circle | null;
    layers: Record<'sat' | 'street', L.TileLayer>;
  } | null>(null);
  const touchedRef = useRef(false);
  const fillT = useRef<number | undefined>(undefined);
  const areaRef = useRef('');
  useEffect(() => {
    areaRef.current = area;
  }, [area]);
  useEffect(() => {
    touchedRef.current = touched;
  }, [touched]);

  // Fill the form once: editing shows what is saved (and its pin); new = empty form.
  const filled = useRef(false);
  useEffect(() => {
    if (filled.current || (id && !addrs.isSuccess)) return;
    filled.current = true;
    const ed = editing;
    setArea(ed?.area ?? shop.area ?? '');
    setHouse(ed?.house ?? '');
    setStreet(ed?.street ?? '');
    setLand(ed?.landmark ?? '');
    setTouched(Boolean(ed));
    const known = (KNOWN_TAGS as readonly string[]).includes(ed?.label ?? '');
    const first: Tag = ed
      ? known
        ? (ed.label as Tag)
        : ed.label
          ? 'Aur'
          : 'Ghar'
      : addrs.data?.some((a) => a.label === 'Ghar')
        ? 'Aur'
        : 'Ghar';
    setTag(first);
    setLabel(ed && !known && ed.label && ed.label !== 'Aur' ? ed.label : '');
    if (ed?.lat != null && ed.lng != null) {
      setCoords({ lat: ed.lat, lng: ed.lng, acc: 0, pinned: true });
      void openPinMap(ed.lat, ed.lng, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once the saved list is known
  }, [addrs.isSuccess, id]);

  useEffect(() => {
    return () => {
      map.current?.m.remove();
      map.current = null;
      window.clearTimeout(fillT.current);
    };
  }, []);

  if (!pending && !loggedIn) return <Navigate to="/login" replace />;

  function pinHint(acc: number, moved: boolean) {
    const rough = !moved && acc > 60;
    setHint({
      warn: rough,
      text: moved
        ? t(
            '📌 Pin set by you — the vendor will come exactly here',
            '📌 पिन आपने लगाया — वेंडर ठीक यहीं आएगा',
          )
        : rough
          ? t(
              `⚠️ Location is rough (±${Math.round(acc)} m). Drag the pin onto your house, or go outside and tap ◎`,
              `⚠️ लोकेशन सही नहीं है (±${Math.round(acc)} मी)। पिन को खींचकर अपने घर पर रखें, या बाहर जाकर ◎ दबाएँ`,
            )
          : t(
              '✓ Is the pin on your house? If not, drag it to your door',
              '✓ क्या पिन आपके घर पर है? नहीं तो खींचकर अपने दरवाज़े पर रखें',
            ),
    });
  }

  function setPin(lat: number, lng: number) {
    setCoords({ lat, lng, acc: 5, pinned: true });
    pinHint(0, true);
    const mm = map.current;
    if (mm?.circ) {
      mm.m.removeLayer(mm.circ);
      mm.circ = null;
    }
    void matchArea(lat, lng);
    window.clearTimeout(fillT.current);
    fillT.current = window.setTimeout(() => void fillFromCoords(lat, lng), 700);
  }

  async function openPinMap(lat: number, lng: number, acc: number) {
    setShowMap(true);
    await new Promise((r) => requestAnimationFrame(r));
    if (!mapEl.current) return;
    const z = acc > 2000 ? 14 : acc > 300 ? 16 : 18;
    if (!map.current) {
      const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView([lat, lng], z);
      L.control.zoom({ position: 'topright' }).addTo(m);
      const layers = {
        sat: L.tileLayer(TILES.sat, { maxZoom: 19, attribution: 'Imagery © Esri' }),
        street: L.tileLayer(TILES.street, { maxZoom: 19, attribution: '© OpenStreetMap' }),
      };
      layers.sat.addTo(m);
      const icon = L.divIcon({
        className: '',
        html: '<div class="rbpin">📍</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 36],
      });
      const pin = L.marker([lat, lng], { draggable: true, autoPan: true, icon }).addTo(m);
      pin.on('dragend', () => {
        const p = pin.getLatLng();
        setPin(p.lat, p.lng);
      });
      m.on('click', (e: L.LeafletMouseEvent) => {
        pin.setLatLng(e.latlng);
        setPin(e.latlng.lat, e.latlng.lng);
      });
      map.current = { m, pin, circ: null, layers };
    } else {
      map.current.m.setView([lat, lng], z);
      map.current.pin.setLatLng([lat, lng]);
    }
    const mm = map.current;
    if (mm.circ) {
      mm.m.removeLayer(mm.circ);
      mm.circ = null;
    }
    if (acc > 15)
      mm.circ = L.circle([lat, lng], { radius: acc, color: '#1E8E3E', weight: 1, fillOpacity: 0.08 }).addTo(
        mm.m,
      );
    window.setTimeout(() => mm.m.invalidateSize(), 200);
    pinHint(acc, false);
  }

  function switchLayer(k: 'sat' | 'street') {
    const mm = map.current;
    if (!mm) return;
    Object.values(mm.layers).forEach((l) => mm.m.removeLayer(l));
    mm.layers[k].addTo(mm.m);
    setLayer(k);
  }

  // Village from OUR village boundaries (not from map text).
  async function matchArea(lat: number, lng: number) {
    try {
      const d = await api.get<AreaMatch>('/v1/public/areas/locate', { lat: String(lat), lng: String(lng) });
      if (!d.inRange || !d.area) {
        setDetected({
          color: 'var(--mut)',
          text: t(
            "Couldn't match a village automatically — please pick yours below",
            'गाँव अपने आप मेल नहीं खाया — नीचे अपना चुनें',
          ),
        });
        return;
      }
      if (!d.served) {
        setDetected({
          color: '#E14B4B',
          text: t(
            `You're near ${d.area}, but no vendor delivers there yet — please pick a served village below`,
            `आप ${d.area} के पास हैं, पर अभी वहाँ कोई वेंडर नहीं — नीचे कोई सेवा वाला गाँव चुनें`,
          ),
        });
        return;
      }
      if ((areas.data ?? []).some((a) => a.name === d.area)) setArea(d.area);
      setDetected(
        d.confident
          ? { color: 'var(--g-dk)', text: '✓ ' + t(`Detected: ${d.area}`, `मिल गया: ${d.area}`) }
          : {
              color: 'var(--mut)',
              text: t(
                `Looks like ${d.area} — confirm or change if that's wrong`,
                `शायद ${d.area} है — सही हो तो ठीक, नहीं तो बदल दें`,
              ),
            },
      );
      if (d.area !== shop.area) shop.setArea(d.area);
    } catch {
      /* the pin is still saved; the person picks the village */
    }
  }

  // Written line from OpenStreetMap: house no., road, mohalla/hamlet + OUR village only.
  async function fillFromCoords(lat: number, lng: number) {
    if (touchedRef.current) return;
    setSrc(t('detecting…', 'पता लगा रहे हैं…'));
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          referrerPolicy: 'no-referrer',
          credentials: 'omit',
        },
      );
      const j = (await r.json()) as { address?: Record<string, string> };
      const a = j.address ?? {};
      const known = (areas.data ?? []).map((x) => x.name.toLowerCase());
      const village =
        areaRef.current ||
        [a.village, a.hamlet, a.suburb, a.town].find((v) => v && known.includes(String(v).toLowerCase())) ||
        '';
      const road = a.road || a.pedestrian || a.footway || a.residential;
      const parts = [a.house_number, road, a.neighbourhood || a.hamlet || a.quarter || a.suburb, village]
        .filter((v): v is string => Boolean(v))
        .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);
      if (!touchedRef.current) setFull(parts.join(', '));
      setStreet((s) => s || road || a.neighbourhood || '');
      setLand((l) => l || a.amenity || a.shop || a.place_of_worship || a.building || a.hamlet || '');
      setSrc(t('auto-filled · check and edit if needed', 'अपने आप भर दिया · जाँच लें, ज़रूरत हो तो बदलें'));
    } catch {
      setSrc(t('type it below', 'नीचे लिख दें'));
    }
  }

  async function locateMe() {
    if (gpsBusy) return;
    if (!navigator.geolocation)
      return toast(
        t(
          'This phone cannot share location — please type the address',
          'यह फ़ोन लोकेशन नहीं दे सकता — पता लिख दें',
        ),
      );
    try {
      const st = await navigator.permissions?.query({ name: 'geolocation' });
      if (st?.state === 'denied')
        return toast(
          t(
            'Location is blocked — allow it in browser settings, or type the address',
            'लोकेशन बंद है — ब्राउज़र सेटिंग्स में चालू करें, या पता लिख दें',
          ),
        );
    } catch {
      /* no permissions API */
    }
    setGpsBusy(t('Finding you…', 'आपको ढूँढ रहे हैं…'));
    toast(
      t(
        'Getting your exact location — keep the phone still for a few seconds',
        'आपकी सही लोकेशन ले रहे हैं — कुछ सेकंड फ़ोन स्थिर रखें',
      ),
    );
    try {
      const best = await getPreciseLocation(
        (p) => {
          setGpsBusy(
            t('Sharpening… ±', 'और सही कर रहे हैं… ±') + Math.round(p.coords.accuracy) + t(' m', ' मी'),
          );
          setCoords({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            acc: p.coords.accuracy,
            pinned: false,
          });
        },
        20000,
        20,
      );
      setGpsBusy(null);
      const c = best.coords;
      try {
        localStorage.setItem('rb_geo_ok', '1');
      } catch {
        /* storage blocked */
      }
      setCoords({ lat: c.latitude, lng: c.longitude, acc: c.accuracy, pinned: false });
      void openPinMap(c.latitude, c.longitude, c.accuracy);
      toast(
        c.accuracy <= 60
          ? t('Location found — check the pin is on your house', 'लोकेशन मिल गई — देख लें पिन आपके घर पर है')
          : t(
              'Location is rough — drag the pin onto your house',
              'लोकेशन सही नहीं है — पिन को अपने घर पर रखें',
            ),
      );
      void fillFromCoords(c.latitude, c.longitude);
      void matchArea(c.latitude, c.longitude);
    } catch (err) {
      setGpsBusy(null);
      toast(
        (err as { code?: number })?.code === 1
          ? t('Permission denied — please type the address below', 'अनुमति नहीं मिली — नीचे पता लिख दें')
          : t('Could not find you — please type the address below', 'लोकेशन नहीं मिली — नीचे पता लिख दें'),
      );
    }
  }

  function leave() {
    nav(fromCheckout ? '/basket' : '/account');
  }

  async function save() {
    if (!area) return toast(t('Choose your village', 'अपना गाँव चुनें'));
    if (!coords && !house.trim() && !street.trim() && !land.trim() && !full.trim()) {
      toast(
        t(
          'Tap "Allow location access" for your exact location — or write a landmark',
          'अपनी सही लोकेशन के लिए "लोकेशन की अनुमति दें" दबाएँ — या कोई लैंडमार्क लिखें',
        ),
      );
      return void locateMe();
    }
    let lbl: string = tag;
    if (tag === 'Aur') {
      lbl = label.trim();
      if (!lbl)
        return toast(t('Give this address a name — e.g. Office', 'इस पते का नाम लिखें — जैसे: ऑफ़िस'));
    }
    const list = addrs.data ?? [];
    const opt = (s: string) => s.trim() || undefined;
    setSaving(true);
    try {
      const saved = await api.post<Addr>('/v1/customer/addresses', {
        id: editing?.id,
        label: lbl,
        house: opt(house),
        street: opt(street) ?? opt(full),
        landmark: opt([land.trim(), note.trim()].filter(Boolean).join(' · ')),
        area,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        makeDefault: editing ? editing.isDefault || list.length <= 1 : !list.length,
      });
      await qc.invalidateQueries({ queryKey: keys.addresses });
      toast(t('Address saved', 'पता सेव हो गया'));
      // Only book when this address was added while placing an order.
      if (fromCheckout && shop.count > 0 && saved.id) {
        shop.setAddrId(saved.id);
        return void createBooking(saved.id);
      }
      nav('/account');
    } catch (e) {
      toast(
        t('Could not save the address — ', 'पता सेव नहीं हुआ — ') +
          ((e as Error).message || t('check your internet', 'इंटरनेट देखें')),
      );
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!editing) return;
    if (
      !window.confirm(t(`Delete "${addrName(editing.label, t)}"?`, `"${addrName(editing.label, t)}" हटाएँ?`))
    )
      return;
    try {
      await api.del(`/v1/customer/addresses/${editing.id}`);
      await qc.invalidateQueries({ queryKey: keys.addresses });
      if (shop.addrId === editing.id) shop.setAddrId(null);
      toast(t('Address deleted', 'पता हटा दिया'));
      nav('/account');
    } catch (e) {
      toast((e as Error).message || t('Could not delete', 'हटाया नहीं जा सका'));
    }
  }

  const located = coords;
  const tags: Array<[Tag, string]> = [
    ['Ghar', t('🏠 Home', '🏠 घर')],
    ['Dukaan', t('🏪 Shop', '🏪 दुकान')],
    ['Mummy ka ghar', t("👵 Parents' home", '👵 मम्मी का घर')],
    ['Aur', t('📍 Other', '📍 अन्य')],
  ];

  return (
    <div className="scr on" id="s-loc">
      <div className="topbar">
        <button className="bk" onClick={leave} aria-label={t('Back', 'वापस')}>
          ←
        </button>
        <div>
          <h1 id="locH1">{id ? t('Edit address', 'पता बदलें') : t('New address', 'नया पता')}</h1>
          <div className="sub">
            {t('so the vendor reaches the right gate', 'ताकि वेंडर सही दरवाज़े पर पहुँचे')}
          </div>
        </div>
      </div>

      <div className="pg" style={{ maxWidth: 560, paddingBottom: 150 }}>
        <CheckoutBanner />

        {!located && !skipped ? (
          <div className="locate" id="locateCard">
            <div className="lc-top">
              <span className="lc-ico">📍</span>
              <div style={{ minWidth: 0 }}>
                <b>{t('Use my exact location', 'मेरी सही लोकेशन लें')}</b>
                <span>
                  {t(
                    "Your phone's GPS pins the precise spot, so the vendor doesn't wander the lanes looking for you. Nothing is stored until you save this address.",
                    'आपके फ़ोन का GPS सही जगह पकड़ लेगा, ताकि वेंडर गली में न भटके। पता सेव करने तक कुछ भी सेव नहीं होता।',
                  )}
                </span>
              </div>
            </div>
            <button
              className="bigbtn"
              style={{ width: '100%', marginTop: 14 }}
              id="gpsBtn"
              disabled={Boolean(gpsBusy)}
              onClick={() => void locateMe()}
            >
              <span id="gpsLbl">{gpsBusy ?? t('Allow location access', 'लोकेशन की अनुमति दें')}</span>
            </button>
            <button
              className="linkbtn"
              onClick={() => {
                setSkipped(true);
                toast(t('No problem — just fill the address below', 'कोई बात नहीं — नीचे पता भर दें'));
                window.setTimeout(() => document.getElementById('aFull')?.focus(), 50);
              }}
            >
              {t("I'll type it myself", 'मैं खुद लिख दूँगा')}
            </button>
          </div>
        ) : null}

        {located ? (
          <div className="located" id="locatedCard">
            <span className="lc-tick">✓</span>
            <div style={{ minWidth: 0 }}>
              <b id="locTitle">
                {located.pinned
                  ? t('Exact location set by you', 'सही लोकेशन आपने लगाई')
                  : (located.acc ?? 0) > 60
                    ? t('Approximate location — set the pin below', 'लगभग लोकेशन — नीचे पिन सही करें')
                    : t('Exact location captured', 'सही लोकेशन मिल गई')}
              </b>
              <span id="coordLine">
                {located.lat.toFixed(5)}, {located.lng.toFixed(5)}
                {located.pinned
                  ? ' · ' + t('pin set by you', 'पिन आपने लगाया')
                  : located.acc
                    ? ` · ±${Math.round(located.acc)}m`
                    : ''}
              </span>
            </div>
            <button className="mini" onClick={() => void locateMe()}>
              {gpsBusy ? '…' : t('↻ Redo', '↻ फिर से')}
            </button>
          </div>
        ) : null}
        <div className="pinmap" id="pinWrap" hidden={!showMap}>
          <div id="pinMap" ref={mapEl} />
          <div className="pm-seg">
            <button className={layer === 'sat' ? 'on' : ''} onClick={() => switchLayer('sat')}>
              {t('Satellite', 'सैटेलाइट')}
            </button>
            <button className={layer === 'street' ? 'on' : ''} onClick={() => switchLayer('street')}>
              {t('Map', 'नक्शा')}
            </button>
          </div>
          <button
            className="pm-me"
            onClick={() => void locateMe()}
            aria-label={t('My location', 'मेरी लोकेशन')}
          >
            ◎
          </button>
          {hint ? <div className={`pm-hint ${hint.warn ? 'warn' : ''}`}>{hint.text}</div> : null}
        </div>

        <div className="lbl-row" style={{ marginTop: 22 }}>
          <label className="lbl" style={{ margin: 0 }} htmlFor="aFull">
            {t('Full address', 'पूरा पता')}
          </label>
          <span className="opt" id="addrSrc">
            {src}
          </span>
        </div>
        <textarea
          className="field"
          id="aFull"
          rows={2}
          maxLength={120}
          value={full}
          onChange={(e) => {
            setFull(e.target.value);
            setTouched(true);
          }}
          placeholder={t('Village, area — or let location fill it', 'गाँव, इलाका — या लोकेशन से भर जाएगा')}
        />

        <div className="two" style={{ marginTop: 15 }}>
          <div>
            <label className="lbl" htmlFor="aHouse">
              {t('House no. (optional)', 'घर / मकान नंबर (वैकल्पिक)')}
            </label>
            <input
              className="field"
              id="aHouse"
              maxLength={80}
              placeholder="142-B"
              value={house}
              onChange={(e) => setHouse(e.target.value)}
            />
          </div>
          <div>
            <label className="lbl" htmlFor="aStreet">
              {t('Street / locality (optional)', 'गली / मोहल्ला (वैकल्पिक)')}
            </label>
            <input
              className="field"
              id="aStreet"
              maxLength={120}
              placeholder={t('Ward 4, New colony', 'वार्ड 4, नई बस्ती')}
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </div>
        </div>

        <label className="lbl" style={{ marginTop: 15 }} htmlFor="aArea">
          {t('Your village / area *', 'आपका गाँव / इलाका *')}
        </label>
        <select className="field" id="aArea" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="" disabled>
            {t('Choose your village', 'अपना गाँव चुनें')}
          </option>
          {(areas.data ?? []).map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        {detected ? (
          <p
            id="areaDetected"
            style={{ fontSize: 11.5, fontWeight: 700, marginTop: 6, color: detected.color }}
          >
            {detected.text}
          </p>
        ) : null}

        <label className="lbl" style={{ marginTop: 15 }} htmlFor="aLand">
          {t('Landmark (optional)', 'लैंडमार्क (वैकल्पिक)')}
        </label>
        <input
          className="field"
          id="aLand"
          maxLength={80}
          placeholder={t('e.g. Near the Hanuman temple', 'जैसे: हनुमान मंदिर के पास')}
          value={land}
          onChange={(e) => setLand(e.target.value)}
        />
        <p className="muted" style={{ marginTop: 8 }}>
          {t(
            'This matters more than a pincode here — it is how vendors actually find your door.',
            'यहाँ पिनकोड से ज़्यादा यही काम आता है — वेंडर ऐसे ही दरवाज़ा ढूँढते हैं।',
          )}
        </p>

        <label className="lbl" style={{ marginTop: 18 }} htmlFor="aNote">
          {t('Note for the vendor (optional)', 'वेंडर के लिए नोट (वैकल्पिक)')}
        </label>
        <input
          className="field"
          id="aNote"
          maxLength={36}
          placeholder={t('e.g. green gate, upstairs', 'जैसे: हरा गेट, ऊपर वाली मंज़िल')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="h2" style={{ margin: '22px 0 11px' }}>
          {t('Save this as', 'इसे सेव करें')}
        </div>
        <div className="saveas" id="saveAs">
          {tags.map(([k, txt]) => (
            <button
              key={k}
              className={tag === k ? 'on' : ''}
              onClick={() => {
                setTag(k);
                if (k === 'Aur') window.setTimeout(() => document.getElementById('aLabel')?.focus(), 50);
              }}
            >
              {txt}
            </button>
          ))}
        </div>
        {tag === 'Aur' ? (
          <div id="aLabelWrap" style={{ marginTop: 12 }}>
            <label className="lbl" htmlFor="aLabel">
              {t('Name this address *', 'इस पते का नाम *')}
            </label>
            <input
              className="field"
              id="aLabel"
              maxLength={30}
              placeholder={t("e.g. Office, Aunt's house, Farm", 'जैसे: ऑफ़िस, बुआ का घर, खेत')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        ) : null}
        {editing ? (
          <button
            className="linkbtn"
            id="aDelete"
            style={{ marginTop: 18, color: '#D93025' }}
            onClick={() => void del()}
          >
            {t('🗑 Delete this address', '🗑 यह पता हटाएँ')}
          </button>
        ) : null}
      </div>

      <div className="stick">
        <div className="stick-in">
          <button
            className="bigbtn"
            disabled={saving}
            style={saving ? { opacity: 0.6 } : undefined}
            onClick={() => void save()}
          >
            {t('Save address & continue', 'पता सेव करके आगे बढ़ें')}
          </button>
        </div>
      </div>
    </div>
  );
}
