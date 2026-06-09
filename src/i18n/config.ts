import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

const DEFAULT_LANGUAGE = 'zh-CN'
type SupportedLanguage = 'zh-CN' | 'en-US'

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>(['zh-CN', 'en-US'])

const localeLoaders = {
    'zh-CN': () => import('./locales/zh-CN.json'),
    'en-US': () => import('./locales/en-US.json')
} as const

const loadedLanguages = new Set<string>()

function isSupportedLanguage(language: string): language is SupportedLanguage {
    return SUPPORTED_LANGUAGES.has(language as SupportedLanguage)
}

function normalizeLanguage(language?: string | null): SupportedLanguage {
    if (!language) return DEFAULT_LANGUAGE
    if (isSupportedLanguage(language)) return language

    const baseLanguage = language.split('-')[0]?.toLowerCase()
    if (baseLanguage === 'zh') return 'zh-CN'
    if (baseLanguage === 'en') return 'en-US'

    return DEFAULT_LANGUAGE
}

async function loadLanguageResources(language?: string | null) {
    const normalizedLanguage = normalizeLanguage(language) as SupportedLanguage

    if (loadedLanguages.has(normalizedLanguage)) {
        return normalizedLanguage
    }

    const module = await localeLoaders[normalizedLanguage]()
    i18n.addResourceBundle(normalizedLanguage, 'translation', module.default, true, true)
    loadedLanguages.add(normalizedLanguage)

    return normalizedLanguage
}

let initPromise: Promise<typeof i18n> | null = null

export async function initI18n() {
    if (!initPromise) {
        initPromise = (async () => {
            await i18n
                .use(LanguageDetector)
                .use(initReactI18next)
                .init({
                    resources: {},
                    lng: DEFAULT_LANGUAGE,
                    fallbackLng: DEFAULT_LANGUAGE,
                    interpolation: {
                        escapeValue: false
                    },
                    detection: {
                        order: ['localStorage', 'navigator'],
                        caches: ['localStorage']
                    }
                })

            const initialLanguage = normalizeLanguage(i18n.resolvedLanguage || i18n.language)
            await loadLanguageResources(initialLanguage)

            if (i18n.language !== initialLanguage) {
                await i18n.changeLanguage(initialLanguage)
            }

            i18n.on('languageChanged', async (language) => {
                const nextLanguage = await loadLanguageResources(language)
                if (nextLanguage !== language) {
                    await i18n.changeLanguage(nextLanguage)
                }
            })

            return i18n
        })()
    }

    return initPromise
}

export default i18n
