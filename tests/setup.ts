import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../src/ui/locales/en.json";

// Расширяем expect с матчерами из jest-dom
expect.extend(matchers);

// Очищаем после каждого теста
afterEach(() => {
  cleanup();
});

// Initialize i18n for tests so useTranslation works without warnings.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false }
  });
}

// Настройка для jsdom (только если window доступен)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
