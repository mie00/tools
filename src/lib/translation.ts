// Translation store and utilities for the T component
// Uses Chrome's experimental AI APIs similar to Translator.svelte

import { writable } from 'svelte/store';

// Language definitions
export interface Language {
	code: string;
	name: string;
	nativeName: string;
	rtl: boolean;
}

export const supportedLanguages: Language[] = [
	{ code: 'en', name: 'English', nativeName: 'English', rtl: false },
	{ code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
	{ code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false },
	{ code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
	{ code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
	{ code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
	{ code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false },
	{ code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
	{ code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false },
	{ code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false },
	{ code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false },
	{ code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false },
	{ code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false },
	{ code: 'tr', name: 'Turkish', nativeName: 'Türkçe', rtl: false }
];

// Translation state
interface TranslationState {
	currentLanguage: string;
	fallbackLanguage: string;
	isReady: boolean;
	translations: Map<string, Map<string, string>>; // Map<targetLang, Map<sourceText, translatedText>>
}

// Create the translation store
function createTranslationStore() {
	const STORAGE_KEY = 'app-language';
	const DEFAULT_LANGUAGE = 'en';

	const initialState: TranslationState = {
		currentLanguage: DEFAULT_LANGUAGE,
		fallbackLanguage: DEFAULT_LANGUAGE,
		isReady: false,
		translations: new Map()
	};

	const { subscribe, update, set } = writable(initialState);

	// Chrome AI API instances
	let translator: any = null;
	let currentTranslatorPair: string | null = null;

	// Load saved language from localStorage
	function loadSavedLanguage(): string {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem(STORAGE_KEY);
				if (saved && supportedLanguages.some((lang) => lang.code === saved)) {
					return saved;
				}
			} catch (e) {
				console.warn('Failed to load saved language:', e);
			}
		}
		return DEFAULT_LANGUAGE;
	}

	// Save language to localStorage
	function saveLanguage(code: string) {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(STORAGE_KEY, code);
			} catch (e) {
				console.warn('Failed to save language:', e);
			}
		}
	}

	// Initialize the translation system
	async function initialize() {
		const savedLanguage = loadSavedLanguage();

		update((state) => ({
			...state,
			currentLanguage: savedLanguage,
			isReady: true
		}));

		// No need to initialize Chrome AI if we're using the default language
		if (savedLanguage === DEFAULT_LANGUAGE) {
			return;
		}

		// Try to initialize Chrome AI APIs for translation
		try {
			if ('Translator' in self) {
				// The translator will be initialized when needed
				console.log('Chrome AI Translation API is available');
			} else {
				console.warn('Chrome AI Translation API not available');
			}
		} catch (error) {
			console.warn('Error checking Chrome AI availability:', error);
		}
	}

	// Set the current language
	async function setLanguage(code: string) {
		if (!supportedLanguages.some((lang) => lang.code === code)) {
			console.warn(`Unsupported language code: ${code}`);
			return;
		}

		update((state) => ({
			...state,
			currentLanguage: code
		}));

		saveLanguage(code);

		// Reset translator if language changed
		if (translator && currentTranslatorPair !== `en-${code}`) {
			try {
				translator.destroy();
			} catch (e) {
				// Ignore errors when destroying
			}
			translator = null;
			currentTranslatorPair = null;
		}
	}

	// Get or create translator for the current language pair
	async function getTranslator(targetLang: string): Promise<any> {
		if (targetLang === DEFAULT_LANGUAGE) {
			return null; // No translation needed
		}

		const pairKey = `en-${targetLang}`;

		if (translator && currentTranslatorPair === pairKey) {
			return translator;
		}

		// Clean up old translator
		if (translator) {
			try {
				translator.destroy();
			} catch (e) {
				// Ignore errors when destroying
			}
		}

		try {
			// Check if translation is available for this language pair
			// @ts-ignore - Chrome AI API is experimental
			const availability = await (self as any).Translator.availability({
				sourceLanguage: DEFAULT_LANGUAGE,
				targetLanguage: targetLang
			});

			if (availability === 'unavailable') {
				console.warn(`Translation from ${DEFAULT_LANGUAGE} to ${targetLang} is not available`);
				return null;
			}

			// Create new translator
			// @ts-ignore - Chrome AI API is experimental
			translator = await (self as any).Translator.create({
				sourceLanguage: DEFAULT_LANGUAGE,
				targetLanguage: targetLang
			});

			if (availability === 'downloadable' || availability === 'downloading') {
				await translator.ready;
			}

			currentTranslatorPair = pairKey;
			return translator;
		} catch (error) {
			console.warn(`Error creating translator for ${targetLang}:`, error);
			return null;
		}
	}

	// Translate text
	async function translate(text: string, targetLang?: string): Promise<string> {
		if (!text || !text.trim()) {
			return text;
		}

		// Use current language if no target specified
		if (!targetLang) {
			const state = get(translationStore);
			targetLang = state.currentLanguage;
		}

		// No translation needed for default language
		if (targetLang === DEFAULT_LANGUAGE) {
			return text;
		}

		// Check cache first
		const state = get(translationStore);
		const langCache = state.translations.get(targetLang);
		if (langCache?.has(text)) {
			return langCache.get(text)!;
		}

		try {
			const translatorInstance = await getTranslator(targetLang);
			if (!translatorInstance) {
				return text; // Fallback to original text
			}

			const translated = await translatorInstance.translate(text);

			// Cache the translation
			update((state) => {
				if (!state.translations.has(targetLang!)) {
					state.translations.set(targetLang!, new Map());
				}
				state.translations.get(targetLang!)!.set(text, translated);
				return state;
			});

			return translated;
		} catch (error) {
			console.warn(`Translation error for "${text}":`, error);
			return text; // Fallback to original text
		}
	}

	// Get current language info
	function getCurrentLanguage(): Language {
		const state = get(translationStore);
		return (
			supportedLanguages.find((lang) => lang.code === state.currentLanguage) ||
			supportedLanguages[0]
		);
	}

	// Check if current language is RTL
	function isCurrentLanguageRTL(): boolean {
		return getCurrentLanguage().rtl;
	}

	return {
		subscribe,
		initialize,
		setLanguage,
		translate,
		getCurrentLanguage,
		isCurrentLanguageRTL,
		get: () => get({ subscribe })
	};
}

// Export the store instance
export const translationStore = createTranslationStore();

// Helper function to get a writable reference to the store for reading
function get<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
	let value: T;
	const unsubscribe = store.subscribe((v) => (value = v));
	unsubscribe();
	return value!;
}
