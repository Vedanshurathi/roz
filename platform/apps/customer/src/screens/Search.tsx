import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@rozbazaar/web';
import { useCatalog } from '../api/queries';
import { Art } from '../art/Art';
import { matches, VENDOR_TYPES } from '../lib/model';
import { useShop } from '../state/shop';
import { useMe } from '../state/useMe';
import { ProductCard, Skeletons } from '../ui/ProductCard';

export default function Search() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const shop = useShop();
  const { loggedIn } = useMe();
  const { q: cat, products, favs } = useCatalog(shop.area, loggedIn);
  const input = useRef<HTMLInputElement>(null);
  const q = shop.query.trim().toLowerCase();

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        input.current?.focus({ preventScroll: true });
      } catch {
        input.current?.focus();
      }
    }, 90);
    return () => {
      window.clearTimeout(id);
    };
  }, []);

  const list = useMemo(() => (q ? products.filter((p) => matches(p, q)) : []), [products, q]);
  const popular = products.slice(0, 8);
  const first = (s: string) => s.split(' ')[0] ?? s;

  return (
    <div className="scr on" id="s-search">
      <div className="srch-bar">
        <button
          className="bk"
          onClick={() => {
            shop.setQuery('');
            nav('/');
          }}
          aria-label={t('Back', 'वापस')}
        >
          ←
        </button>
        <div className="srch-in">
          <span>🔍</span>
          <input
            id="sq"
            ref={input}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={t('Search "potato", "tomato", "banana"…', 'खोजें "आलू", "टमाटर", "केला"…')}
            value={shop.query}
            onChange={(e) => shop.setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label={t('Search', 'खोजें')}
          />
          <button
            className="sq-clear"
            id="sqClear"
            style={{ display: shop.query ? 'flex' : 'none' }}
            onClick={() => {
              shop.setQuery('');
              input.current?.focus();
            }}
            aria-label={t('Clear search', 'खोज हटाएँ')}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="pg-search">
        {!q ? (
          <div id="searchSug">
            <div className="sug-hd">{t('POPULAR SEARCHES', 'लोग ये ढूँढते हैं')}</div>
            <div className="sug-wrap">
              {popular.map((p) => (
                <button
                  className="sug"
                  key={p.id}
                  onClick={() => shop.setQuery(first(lang === 'en' ? p.en : p.hi))}
                >
                  <span className="si">
                    <Art photo={p.photo} artKey={p.artKey} em={p.em} alt={p.en} />
                  </span>
                  {first(lang === 'en' ? p.en : p.hi)}
                </button>
              ))}
            </div>
            <div className="sug-hd">{t('BROWSE BY VENDOR', 'वेंडर के हिसाब से देखें')}</div>
            <div className="sug-wrap">
              {VENDOR_TYPES.map((v) => (
                <button className="sug" key={v.id} onClick={() => nav(`/cat/${v.id}`)}>
                  <span className="si" style={{ fontSize: 15 }}>
                    {v.em}
                  </span>
                  {lang === 'en' ? v.en.replace(' vendor', '') : v.hi.replace(' वाला', '')}
                </button>
              ))}
            </div>
          </div>
        ) : cat.isPending ? (
          <div className="grid" id="searchGrid">
            <Skeletons n={4} />
          </div>
        ) : !list.length ? (
          <div id="searchCount">
            <div className="empty">
              <div className="ee">🔍</div>
              <b>
                {t(`Nothing matched “${shop.query.trim()}”`, `“${shop.query.trim()}” के लिए कुछ नहीं मिला`)}
              </b>
              <p>{t('Try potato, tomato, onion or coriander', 'आलू, टमाटर, प्याज़ या धनिया खोजें')}</p>
              <button
                className="bigbtn"
                style={{ marginTop: 20, padding: '14px 28px' }}
                onClick={() => shop.setQuery('')}
              >
                {t('Clear search', 'खोज हटाएँ')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div id="searchCount">
              <div className="srch-count">
                {list.length}{' '}
                {t(list.length === 1 ? 'result' : 'results', list.length === 1 ? 'सामान मिला' : 'सामान मिले')}{' '}
                {t('for', '—')} “{shop.query.trim()}”
              </div>
            </div>
            <div className="grid" id="searchGrid">
              {list.map((p) => (
                <ProductCard key={p.id} p={p} fav={favs.has(p.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
