export interface AppConfig {
	name: string;
	icon: string;
	description: string;
	shortcut: string;
	buildUrl: (input: string, ...args: any[]) => string;
}

// App configurations for URL parameter mapping
export const appConfigs: Record<string, AppConfig> = {
	calculator: {
		name: 'Calculator',
		icon: '🧮',
		description: 'Simple calculator',
		shortcut: 'c',
		buildUrl: (input: string) => `/calculator?expression=${encodeURIComponent(input)}`
	},
	functiondrawer: {
		name: 'Function Drawer',
		icon: '📈',
		description: 'Draw mathematical functions',
		shortcut: 'f',
		buildUrl: (input: string) => `/functiondrawer?expression=${encodeURIComponent(input)}`
	},
	unitconverter: {
		name: 'Unit Converter',
		icon: '📐',
		description: 'Convert between units',
		shortcut: 'u',
		buildUrl: (input: string, category?: string, from?: string, to?: string) => {
			const params = new URLSearchParams();
			if (category) params.set('category', category);
			if (from) params.set('from', from);
			if (to) params.set('to', to);
			const match = input.match(/(\d+(?:\.\d+)?)/);
			if (match) params.set('value', match[1]);
			return `/unitconverter?${params.toString()}`;
		}
	},
	datetime: {
		name: 'Date & Time',
		icon: '🕐',
		description: 'Current time and epoch converter',
		shortcut: 'd',
		buildUrl: (input: string, type: 'epoch' | 'time' = 'epoch', timezone?: string) => {
			const params = new URLSearchParams();
			params.set(type, input);
			if (timezone && type === 'time') {
				params.set('custom_tz', timezone);
			}
			return `/datetime?${params.toString()}`;
		}
	},
	currencyconverter: {
		name: 'Currency Converter',
		icon: '💱',
		description: 'Convert currencies',
		shortcut: 'm',
		buildUrl: (input: string, from?: string, to?: string) => {
			const params = new URLSearchParams();
			if (from) params.set('from', from);
			if (to) params.set('to', to);
			const match = input.match(/(\d+(?:\.\d+)?)/);
			if (match) params.set('amount', match[1]);
			return `/currencyconverter?${params.toString()}`;
		}
	},
	colorpicker: {
		name: 'Color Picker',
		icon: '🎨',
		description: 'Color utilities',
		shortcut: 'p',
		buildUrl: (input: string) => `/colorpicker?hex=${encodeURIComponent(input)}`
	},
	stocktracker: {
		name: 'Stock Tracker',
		icon: '📈',
		description: 'Track stock prices',
		shortcut: 's',
		buildUrl: (input: string) => `/stocktracker?stock=${encodeURIComponent(input.replace('$', ''))}`
	},
	translator: {
		name: 'Language Translator',
		icon: '🔤',
		description: 'Translate text between languages',
		shortcut: 't',
		buildUrl: (input: string, targetLang?: string, sourceText?: string, sourceLang?: string) => {
			const params = new URLSearchParams();
			params.set('from', sourceLang || 'auto');
			if (targetLang) params.set('to', targetLang);
			if (sourceText) params.set('text', sourceText);
			return `/translator?${params.toString()}`;
		}
	},
	urlexaminer: {
		name: 'URL Examiner',
		icon: '🔗',
		description: 'Analyze URLs',
		shortcut: 'w',
		buildUrl: (input: string) => `/urlexaminer?input=${encodeURIComponent(input)}`
	},
	base64: {
		name: 'Base64',
		icon: '🔐',
		description: 'Encode/decode Base64',
		shortcut: 'b',
		buildUrl: (input: string) => `/base64?input=${encodeURIComponent(input)}&operation=decode`
	},
	jsonformat: {
		name: 'JSON Formatter',
		icon: '📋',
		description: 'Format and validate JSON',
		shortcut: 'j',
		buildUrl: (input: string) => `/jsonformat?input=${encodeURIComponent(input)}`
	},
	googlesearch: {
		name: 'Google Search',
		icon: '🔍',
		description: 'Search on Google',
		shortcut: 'g',
		buildUrl: (input: string) => `https://www.google.com/search?q=${encodeURIComponent(input)}`
	}
};

// Create shortcut mapping
export function getShortcutMapping(): Record<string, string> {
	const mapping: Record<string, string> = {};
	for (const [id, config] of Object.entries(appConfigs)) {
		mapping[config.shortcut] = id;
	}
	return mapping;
}

// UI Helper functions
export function getConfidenceColor(confidence: number): string {
	if (confidence >= 0.8) return 'text-green-600';
	if (confidence >= 0.6) return 'text-yellow-600';
	return 'text-orange-600';
}

export function getConfidenceLabel(confidence: number): string {
	if (confidence >= 0.8) return 'High';
	if (confidence >= 0.6) return 'Medium';
	return 'Low';
} 