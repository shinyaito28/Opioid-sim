export const SUPPORTED_LANGUAGES = ['en', 'ja'];
export function resolveSavedLanguage(value) {
  if (typeof value !== 'string' || !value.trim()) return 'en';
  try {
    const language = new Intl.Locale(value.trim()).language;
    return SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
  } catch { return 'en'; }
}
export function initialLanguage(storage) {
  try {
    const preferences = storage === undefined ? globalThis.localStorage : storage;
    return resolveSavedLanguage(preferences?.getItem('i18nextLng'));
  } catch { return 'en'; }
}
