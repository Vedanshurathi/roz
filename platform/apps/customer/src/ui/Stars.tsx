import { useI18n } from '@rozbazaar/web';

export function Stars({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="stars" role="radiogroup" aria-label={t('Rating', 'रेटिंग')}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          className={`star ${i <= value ? 'on' : ''}`}
          role="radio"
          aria-checked={value === i}
          aria-label={`${i}`}
          onClick={() => onPick(i)}
          style={{ transitionDelay: `${i * 18}ms` }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

export function starWord(n: number, t: (en: string, hi: string) => string): string {
  const w = [
    t('Bad', 'बेकार'),
    t('Okay', 'ठीक'),
    t('Good', 'अच्छा'),
    t('Very good', 'बहुत अच्छा'),
    t('Excellent!', 'ज़बरदस्त!'),
  ];
  return n ? w[n - 1]! : '';
}
