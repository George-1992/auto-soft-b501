import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import translations from './src/locales/translations.json'

export const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
];

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        debug: false,
        fallbackLng: 'en',
        supportedLngs: ['en', 'es'],
        interpolation: {
            escapeValue: false,
        },
        // resources: {
        //     en: { translation: translations.en },
        //     es: { translation: translations.es },
        // },
        resources: languages.map((lang) => ({
            [lang.code]: {
                translation: translations[lang.code],
            },
        })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
    })

export default i18n