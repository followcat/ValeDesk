import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

const detector = new LanguageDetector();

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN }
};

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  });

const resolveDetectedLanguage = (): string => {
  const detected = i18n.services.languageDetector?.detect?.();
  if (Array.isArray(detected)) {
    return detected[0] || 'en';
  }
  if (typeof detected === 'string' && detected.length > 0) {
    return detected;
  }
  return i18n.language || 'en';
};

export const applyLanguageSetting = (language?: string): void => {
  if (!language || language === 'auto') {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem('i18nextLng');
      } catch {
        // Ignore storage access errors (e.g. privacy mode).
      }
    }
    const detected = resolveDetectedLanguage();
    if (detected && detected !== i18n.language) {
      void i18n.changeLanguage(detected);
    }
    return;
  }

  if (language !== i18n.language) {
    void i18n.changeLanguage(language);
  }
};

export default i18n;
