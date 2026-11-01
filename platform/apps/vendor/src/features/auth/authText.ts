import { ApiError } from '@rozbazaar/web';

/** Friendly, bilingual messages for the login errors vendors actually hit. */
export function loginErrorText(e: Error, t: (en: string, hi: string) => string): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return t('Wrong phone number or password', 'फ़ोन नंबर या पासवर्ड ग़लत है');
    if (e.status === 429)
      return t('Too many wrong tries. Please wait 15 minutes.', 'बहुत बार ग़लत हुआ। 15 मिनट रुकिए।');
    if (e.code === 'NETWORK' || e.code === 'TIMEOUT')
      return t('No internet — try again', 'इंटरनेट नहीं है — फिर से कोशिश करें');
  }
  return e.message;
}
