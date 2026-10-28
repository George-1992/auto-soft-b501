import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import translations from './src/locales/translations.json'

export const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
];

export const countries = [
    { code: 'am', label: 'Armenia' },
    { code: 'by', label: 'Belarus' },
    { code: 'ee', label: 'Estonia' },
    { code: 'ge', label: 'Georgia' },
    { code: 'kz', label: 'Kazakhstan' },
    { code: 'kg', label: 'Kyrgyzstan' },
    { code: 'lv', label: 'Latvia' },
    { code: 'lt', label: 'Lithuania' },
    { code: 'md', label: 'Moldova' },
    // { code: 'ru', label: 'Russia' },
    { code: 'tj', label: 'Tajikistan' },
    { code: 'tm', label: 'Turkmenistan' },
    { code: 'ua', label: 'Ukraine' },
    { code: 'uz', label: 'Uzbekistan' },
    { code: 'us', label: 'United States' },
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