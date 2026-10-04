import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { initialLanguage, resolveSavedLanguage, SUPPORTED_LANGUAGES } from './lib/language';

import en from './locales/en.json';
import ja from './locales/ja.json';

i18n.on('languageChanged', value => {
    const language = resolveSavedLanguage(value);
    document.documentElement.lang = language;
    try { localStorage.setItem('i18nextLng', language); } catch { /* Language remains usable when storage is unavailable. */ }
});

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: en
            },
            ja: {
                translation: ja
            }
        },
        lng: initialLanguage(),
        supportedLngs: SUPPORTED_LANGUAGES,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;
