import { describe, expect, it } from 'vitest';
import { safeNext } from '@rozbazaar/web';
import { matchScore, translit } from './search';
import { isActive, navigateUrl, phaseOf } from './status';
import { normUnit, qtyStep, unitLabel } from './names';

describe('search (vendors type Latin, items may be Devanagari)', () => {
  it('transliterates Hindi item names', () => {
    expect(translit('आलू')).toBe('aaloo');
    expect(translit('नींबू')).toBe('neemboo'); // anusvara before a labial is m; norm() later folds oo → u
  });
  it('matches spelling variants and ranks prefix matches first', () => {
    expect(matchScore(['Aloo', null, 'आलू'], 'alu')).toBe(3);
    expect(matchScore(['Pyaaz', 'Onion', 'प्याज़'], 'pyaj')).toBe(3);
    expect(matchScore(['Hari Mirch', 'Green chilli'], 'mirch')).toBe(2);
    expect(matchScore(['Tamatar'], 'bhindi')).toBe(0);
    expect(matchScore(['Tamatar'], '   ')).toBe(0);
  });
});

describe('order phases', () => {
  it('maps every status the vendor can act on', () => {
    expect(phaseOf('placed')).toBe('new');
    expect(phaseOf('bill_approved')).toBe('bill');
    expect(phaseOf('paid')).toBe('paid');
    expect(phaseOf('disputed')).toBe('disputed');
    expect(isActive({ status: 'paid' })).toBe(true);
    expect(isActive({ status: 'completed' })).toBe(false);
    expect(isActive({ status: 'missed' })).toBe(false);
  });
  it('navigates to the saved pin, else the address', () => {
    const base = { mapsUrl: null, addressLine: '12, Ward 2', area: 'Khandewla' };
    expect(navigateUrl({ ...base, lat: 28.38, lng: 76.77 })).toContain('destination=28.38%2C76.77');
    expect(navigateUrl({ ...base, lat: null, lng: null })).toContain('Khandewla');
    expect(navigateUrl({ ...base, lat: 1, lng: 1, mapsUrl: 'https://maps.example/x' })).toBe(
      'https://maps.example/x',
    );
  });
});

describe('units', () => {
  it('treats "1 kg" and "kg" as one unit', () => {
    expect(normUnit('1 kg')).toBe('kg');
    expect(unitLabel('1 kg', 'hi')).toBe('किलो');
    expect(unitLabel('500 g', 'en')).toBe('500 g');
    expect(qtyStep('1 kg')).toBe(0.5);
    expect(qtyStep('dozen')).toBe(1);
  });
});

describe('safeNext (no open redirects after login)', () => {
  it('keeps in-app paths and refuses everything else', () => {
    expect(safeNext('/order/2026-09-30/abc')).toBe('/order/2026-09-30/abc');
    for (const bad of [
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      'javascript:alert(1)',
      '/a\nb',
      '',
      null,
    ])
      expect(safeNext(bad)).toBe('/');
  });
});
