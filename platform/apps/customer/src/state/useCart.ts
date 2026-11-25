/** Adding to the basket exactly like the original app: fly-to-cart, vendor picker, one vendor per booking. */
import type { MouseEvent } from 'react';
import { useI18n } from '@rozbazaar/web';
import { useCatalog, useSession, useVendors } from '../api/queries';
import { pname, type P } from '../lib/model';
import { useToast } from '../ui/Toast';
import { useShop } from './shop';
import { useUI } from './ui';

export function useCart() {
  const shop = useShop();
  const ui = useUI();
  const toast = useToast();
  const { t, lang } = useI18n();
  const loggedIn = Boolean(useSession().data?.authenticated);
  const { products } = useCatalog(shop.area, loggedIn);
  const vendors = useVendors(shop.area);
  const prod = (id: string): P | undefined => products.find((p) => p.id === id);
  const vendorType = (vendorId: string) => vendors.data?.find((v) => v.id === vendorId)?.type ?? null;

  const total = Object.entries(shop.cart).reduce((s, [id, q]) => s + (prod(id)?.price ?? 0) * q, 0);

  /** Only the first item decides the vendor; a different vendor's item gets a warning. */
  function addCart(id: string, qty = 1) {
    const wasEmpty = shop.count === 0;
    shop.addOne(id, qty);
    const p = prod(id);
    if (p?.vendorId) {
      if (wasEmpty || !shop.sel.vendorId)
        shop.setSel({ vendorId: p.vendorId, type: vendorType(p.vendorId) ?? shop.sel.type });
      else if (shop.sel.vendorId !== p.vendorId) {
        const other =
          products.find((x) => x.vendorId === shop.sel.vendorId)?.vendorName ??
          t('your other vendor', 'दूसरा वेंडर');
        toast(
          t(
            `Added — but this is from a different vendor than ${other}`,
            `जुड़ गया — पर यह ${other} से अलग वेंडर का है`,
          ),
        );
      }
    }
    const bar = document.getElementById('cartIn');
    if (bar) {
      bar.classList.remove('pop');
      void bar.offsetWidth;
      bar.classList.add('pop');
    }
  }

  /** ADD: two vendors sell it → let the person choose; otherwise fly it into the basket. */
  function fly(e: MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation();
    const p = prod(id);
    if (!p) return;
    const same = (a: string | null | undefined, b: string | null | undefined) =>
      String(a ?? '')
        .trim()
        .toLowerCase() ===
      String(b ?? '')
        .trim()
        .toLowerCase();
    const siblings = products.filter(
      (x) => x.fresh && ((x.en && same(x.en, p.en)) || same(x.roman, p.roman)),
    );
    if (siblings.length > 1) {
      ui.setVendorPick({ pid: id, productName: pname(p, lang), add: true });
      return;
    }
    const b = e.currentTarget;
    b.classList.add('done');
    b.textContent = '✓';
    window.setTimeout(() => {
      b.classList.remove('done');
      b.textContent = 'ADD';
    }, 1000);
    const target = document.getElementById(window.innerWidth >= 768 ? 'navCart' : 'cart');
    const src = b.closest('.pcard')?.querySelector('.pimg svg, .pimg img, .pimg .emfall');
    const r = b.getBoundingClientRect();
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      addCart(id);
      return;
    }
    const c = target.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'fly';
    if (src) f.appendChild(src.cloneNode(true));
    f.style.left = `${r.left}px`;
    f.style.top = `${r.top}px`;
    document.body.appendChild(f);
    requestAnimationFrame(() => {
      f.style.left = `${c.left + c.width / 2 - 16}px`;
      f.style.top = `${c.top + c.height / 2 - 16}px`;
      f.style.transform = 'scale(.3)';
      f.style.opacity = '.25';
    });
    window.setTimeout(() => {
      f.remove();
      addCart(id);
    }, 700);
  }

  return { products, prod, total, addCart, fly };
}
