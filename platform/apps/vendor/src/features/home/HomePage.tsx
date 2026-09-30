import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TIME_SLOTS, type Booking, type VendorProfile } from '@rozbazaar/shared';
import {
  EmptyState,
  ErrorState,
  istDate,
  rupees,
  Skeleton,
  slotIcon,
  slotLabel,
  useI18n,
  useToast,
} from '@rozbazaar/web';
import { api } from '../../api/client';
import { useVendor } from '../../app/vendor-context';
import { keys, useOrders, useProducts, useStats, type VendorSession } from '../../api/queries';
import { Toggle } from '../../components/Toggle';
import { productName, typeLabel } from '../../lib/names';
import { isActive, navigateUrl, orderTotal, phaseOf, statusPill } from '../../lib/status';
import { CountUp } from './CountUp';
import { PushCard } from './PushCard';

const DAYS = 7;

export default function HomePage() {
  const { t, lang, setLang } = useI18n();
  const vendor = useVendor();
  const [day, setDay] = useState(0);
  const date = istDate(day);
  const today = istDate(0);
  const orders = useOrders(date);
  const todays = useOrders(today);
  const stats = useStats();

  const runs = (orders.data ?? []).filter(isActive);
  const doneToday = (todays.data ?? []).filter((b) => phaseOf(b.status) === 'done');
  const leftToday = (todays.data ?? []).filter(isActive);
  const sale = stats.data?.todaySale ?? 0;
  const rate = stats.data?.commissionRate ?? 10;
  const keep = Math.round(sale * (1 - rate / 100));
  // NEXT = an order already in progress, else the first new one (today only).
  const next = day === 0 ? (runs.find((b) => phaseOf(b.status) !== 'new') ?? runs[0]) : undefined;

  return (
    <div className="home">
      <section className="duty">
        <div className="duty__top">
          <span className="duty__logo">
            <img src="/brand/mark.png" alt="" width={30} height={30} />
            RozBazaar
          </span>
          <div className="langsw langsw--dark" role="group" aria-label={t('Language', 'भाषा')}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>
              हिं
            </button>
          </div>
          <Link to="/profile" className="duty__av" aria-label={t('My profile', 'मेरी प्रोफ़ाइल')}>
            {vendor.name.slice(0, 1).toUpperCase()}
          </Link>
        </div>
        <p className="duty__name">
          {vendor.name} · {typeLabel(vendor.type, lang)}
        </p>
        <div className="duty__earn">
          {stats.isPending ? <Skeleton h={44} w={140} /> : <CountUp value={sale} className="duty__sale" />}
          <span>{t('sale today', 'आज की बिक्री')}</span>
        </div>
        {sale > 0 ? (
          <p className="duty__keep">
            {t(
              `After ${rate}% commission you keep ${rupees(keep)}`,
              `${rate}% कमीशन के बाद आपके ${rupees(keep)}`,
            )}
          </p>
        ) : null}
        <div className="duty__stats">
          <div>
            <b>{doneToday.length}</b>
            <span>{t('delivered', 'डिलीवर')}</span>
          </div>
          <div>
            <b>{leftToday.length}</b>
            <span>{t('left today', 'बाकी')}</span>
          </div>
          <div>
            <b>{(todays.data ?? []).length}</b>
            <span>{t('orders total', 'कुल ऑर्डर')}</span>
          </div>
        </div>
        <OnlineSwitch vendor={vendor} />
      </section>

      <div className="wrap wrap--home">
        {vendor.status !== 'approved' ? <ApprovalNote status={vendor.status} /> : null}
        <PushCard />

        <div className="daypills" role="tablist" aria-label={t('Day', 'दिन')}>
          {Array.from({ length: DAYS }, (_, i) => (
            <DayPill key={i} offset={i} selected={day === i} onClick={() => setDay(i)} />
          ))}
        </div>

        <div className="sechd">
          <h2>
            {day === 0
              ? t('Orders to deliver', 'डिलीवर करने वाले ऑर्डर')
              : t('Orders booked', 'बुक हुए ऑर्डर')}
          </h2>
          <span>
            {runs.length} {day === 0 ? t('left', 'बाकी') : t('booked', 'बुक')}
          </span>
        </div>

        {orders.isPending ? (
          <div className="stack">
            <Skeleton h={96} r={18} />
            <Skeleton h={96} r={18} />
          </div>
        ) : orders.isError ? (
          <ErrorState
            message={orders.error.message}
            onRetry={() => orders.refetch()}
            retryLabel={t('Retry', 'फिर से')}
          />
        ) : !runs.length ? (
          day === 0 && doneToday.length ? (
            <EmptyState
              icon="✅"
              title={t('All done for today', 'आज का काम पूरा')}
              text={t('Nice work. Rest up.', 'बढ़िया काम। अब आराम करें।')}
            />
          ) : (
            <EmptyState
              icon="🌤️"
              title={
                day === 0
                  ? t('Nothing booked yet today', 'आज अभी कोई बुकिंग नहीं')
                  : t('Nothing booked yet', 'अभी कोई बुकिंग नहीं')
              }
              text={day === 0 ? undefined : t('Check back closer to the day', 'दिन के करीब फिर देखें')}
            />
          )
        ) : (
          TIME_SLOTS.map((slot) => {
            const list = runs.filter((b) => b.slot === slot);
            if (!list.length) return null;
            return (
              <section key={slot} className="slotgrp" aria-label={slotLabel(slot, lang)}>
                <div className="slothd">
                  <span className="slothd__ic" aria-hidden>
                    {slotIcon(slot)}
                  </span>
                  <b>{slotLabel(slot, lang)}</b>
                  <span>
                    {list.length} {day === 0 ? t('left', 'बाकी') : t('booked', 'बुक')}
                  </span>
                </div>
                {list.map((b, i) => (
                  <RunCard key={b.id} b={b} n={i + 1} date={date} isNext={next?.id === b.id} />
                ))}
              </section>
            );
          })
        )}

        <QuickActions />
      </div>
    </div>
  );
}

function DayPill({ offset, selected, onClick }: { offset: number; selected: boolean; onClick: () => void }) {
  const { t, lang } = useI18n();
  const iso = istDate(offset);
  const d = new Date(`${iso}T12:00:00+05:30`);
  const name =
    offset === 0
      ? t('Today', 'आज')
      : offset === 1
        ? t('Tmrw', 'कल')
        : d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
            weekday: 'short',
            timeZone: 'Asia/Kolkata',
          });
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`daypill ${selected ? 'is-on' : ''}`}
      onClick={onClick}
    >
      <i>{name}</i>
      <b>{Number(iso.slice(8))}</b>
    </button>
  );
}

function RunCard({ b, n, date, isNext }: { b: Booking; n: number; date: string; isNext: boolean }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const st = statusPill(b.status, t);
  const open = () => nav(`/order/${date}/${b.id}`);
  return (
    <article className={`run ${isNext ? 'is-next' : ''} run--${phaseOf(b.status)}`}>
      <button type="button" className="run__main" onClick={open}>
        {isNext ? <span className="run__next">▶ {t('NEXT', 'अगला')}</span> : null}
        <span className="run__n" aria-hidden>
          {n}
        </span>
        <span className="run__t">
          <span className="run__top">
            <span className="run__code">{b.code}</span>
            <span className="run__slot">
              {slotIcon(b.slot)} {slotLabel(b.slot, lang)}
            </span>
          </span>
          <b>{b.customerName ?? t('Customer', 'ग्राहक')}</b>
          <span className="run__addr">
            {b.addressLine}
            {b.landmark ? ` · 📍 ${b.landmark}` : ''}
          </span>
        </span>
        <span className="run__amt">
          <b>{rupees(orderTotal(b))}</b>
          <span className={`rb-pill rb-pill--${st.tone}`}>{st.text}</span>
        </span>
      </button>
      {isNext ? (
        <div className="run__acts">
          <a className="rb-btn btn-blue" href={navigateUrl(b)} target="_blank" rel="noopener noreferrer">
            <span>🧭 {t('Navigate', 'रास्ता')}</span>
          </a>
          {b.counterpartPhone ? (
            <a className="rb-btn rb-btn--secondary" href={`tel:+91${b.counterpartPhone}`}>
              <span>📞 {t('Call', 'कॉल')}</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function OnlineSwitch({ vendor }: { vendor: VendorProfile }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: (active: boolean) => api.post<{ active: boolean }>('/v1/vendor/active', { active }),
    onSuccess: (r) => {
      qc.setQueryData<VendorSession>(keys.session, (s) =>
        s?.user ? { ...s, user: { ...s.user, isActive: r.active } } : s,
      );
      toast.show(
        r.active
          ? t('You are online — new bookings will come to you', 'आप ऑनलाइन हैं — नई बुकिंग आपको मिलेंगी')
          : t('You are offline — no new bookings', 'आप ऑफ़लाइन हैं — नई बुकिंग नहीं आएँगी'),
        'good',
      );
    },
    onError: (e) => toast.show(e.message, 'bad'),
  });
  const on = set.isPending ? Boolean(set.variables) : vendor.isActive;
  return (
    <div className={`online ${on ? 'is-on' : ''}`}>
      <span className="online__dot" aria-hidden />
      <span className="online__t">
        <b>{on ? t("You're online", 'आप ऑनलाइन हैं') : t("You're offline", 'आप ऑफ़लाइन हैं')}</b>
        <small>
          {on
            ? t('new bookings will come to you', 'नई बुकिंग आपको मिलेंगी')
            : t('no new bookings will come', 'नई बुकिंग नहीं आएँगी')}
        </small>
      </span>
      <Toggle
        on={on}
        disabled={set.isPending}
        onChange={(v) => set.mutate(v)}
        label={t('Take new bookings', 'नई बुकिंग लें')}
      />
    </div>
  );
}

function ApprovalNote({ status }: { status: string }) {
  const { t } = useI18n();
  const text =
    status === 'pending'
      ? t(
          'Your account is waiting for RozBazaar approval. Add your items and slots meanwhile.',
          'आपका खाता RozBazaar की मंज़ूरी का इंतज़ार कर रहा है। तब तक अपना सामान और स्लॉट जोड़ लें।',
        )
      : status === 'suspended'
        ? t(
            'Your account is paused. Please call RozBazaar.',
            'आपका खाता रुका हुआ है। RozBazaar को फ़ोन करें।',
          )
        : t(
            'Your account is not active. Please call RozBazaar.',
            'आपका खाता चालू नहीं है। RozBazaar को फ़ोन करें।',
          );
  return (
    <div className="note note--or" role="status">
      <span aria-hidden>⏳</span>
      <span>{text}</span>
    </div>
  );
}

/** "जल्दी वाले काम" — the quick-actions box at the bottom of Home (original layout). */
function QuickActions() {
  const { t, lang } = useI18n();
  const products = useProducts();
  const out = useMemo(() => (products.data ?? []).filter((p) => !p.inStock), [products.data]);
  const stale = (products.data ?? []).filter((p) => p.priceIsStale).length;
  return (
    <section className="card quick">
      <h2>{t('Quick actions', 'जल्दी वाले काम')}</h2>
      <Link className="rb-btn rb-btn--secondary rb-btn--block" to="/stock">
        <span>🥬 {t('Update stock & rates', 'स्टॉक और रेट बदलें')}</span>
      </Link>
      <Link className="rb-btn rb-btn--secondary rb-btn--block" to="/slots">
        <span>🕖 {t('Change slots', 'स्लॉट बदलें')}</span>
      </Link>
      <Link className="rb-btn rb-btn--secondary rb-btn--block" to="/dashboard">
        <span>📊 {t('Open dashboard', 'डैशबोर्ड खोलें')}</span>
      </Link>
      {out.length ? (
        <div className="note note--or">
          <span aria-hidden>⚠️</span>
          <span>
            {t('Marked out of stock: ', 'स्टॉक ख़त्म बताया है: ')}
            {out.map((p) => productName(p, lang)).join(', ')}
          </span>
        </div>
      ) : null}
      {stale ? (
        <div className="note note--blue">
          <span aria-hidden>📣</span>
          <span>
            {t(
              `${stale} item rates are old — update today's rate`,
              `${stale} सामान के रेट पुराने हैं — आज का रेट डालें`,
            )}
          </span>
        </div>
      ) : null}
    </section>
  );
}
