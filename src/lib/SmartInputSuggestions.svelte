<script lang="ts">
	import { onMount } from 'svelte';

	interface AppSuggestion {
		id: string;
		name: string;
		icon: string;
		description: string;
		confidence: number;
		url: string;
		reason: string;
	}

	let inputText = '';
	let suggestions: AppSuggestion[] = [];
	let showSuggestions = false;

	// App configurations for URL parameter mapping
	const appConfigs = {
		calculator: {
			name: 'Calculator',
			icon: '🧮',
			description: 'Simple calculator',
			buildUrl: (input: string) => `/calculator?expression=${encodeURIComponent(input)}`
		},
		functiondrawer: {
			name: 'Function Drawer',
			icon: '📈',
			description: 'Draw mathematical functions',
			buildUrl: (input: string) => `/functiondrawer?expression=${encodeURIComponent(input)}`
		},
		datetime: {
			name: 'Date & Time',
			icon: '🕐',
			description: 'Current time and epoch converter',
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
			buildUrl: (input: string) => `/colorpicker?hex=${encodeURIComponent(input)}`
		},
		stocktracker: {
			name: 'Stock Tracker',
			icon: '📈',
			description: 'Track stock prices',
			buildUrl: (input: string) => `/stocktracker?stock=${encodeURIComponent(input.replace('$', ''))}`
		},
		translator: {
			name: 'Language Translator',
			icon: '🔤',
			description: 'Translate text between languages',
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
			buildUrl: (input: string) => `/urlexaminer?input=${encodeURIComponent(input)}`
		},
		base64: {
			name: 'Base64',
			icon: '🔐',
			description: 'Encode/decode Base64',
			buildUrl: (input: string) => `/base64?input=${encodeURIComponent(input)}&operation=decode`
		},
		jsonformat: {
			name: 'JSON Formatter',
			icon: '📋',
			description: 'Format and validate JSON',
			buildUrl: (input: string) => `/jsonformat?input=${encodeURIComponent(input)}`
		}
	};

	// Color conversion helper functions
	function rgbToHex(r: number, g: number, b: number): string {
		const toHex = (c: number) => {
			const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}

	function hslToHex(h: number, s: number, l: number): string {
		// Convert HSL to RGB first, then to hex
		s /= 100;
		l /= 100;
		
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = l - c / 2;
		let r = 0, g = 0, b = 0;
		
		if (0 <= h && h < 60) {
			r = c; g = x; b = 0;
		} else if (60 <= h && h < 120) {
			r = x; g = c; b = 0;
		} else if (120 <= h && h < 180) {
			r = 0; g = c; b = x;
		} else if (180 <= h && h < 240) {
			r = 0; g = x; b = c;
		} else if (240 <= h && h < 300) {
			r = x; g = 0; b = c;
		} else if (300 <= h && h < 360) {
			r = c; g = 0; b = x;
		}
		
		r = Math.round((r + m) * 255);
		g = Math.round((g + m) * 255);
		b = Math.round((b + m) * 255);
		
		return rgbToHex(r, g, b);
	}

	function convertColorToHex(input: string): string {
		const trimmed = input.trim();
		
		// Check if it's already hex
		const hexPattern = /^#?[0-9A-Fa-f]{6}$|^#?[0-9A-Fa-f]{3}$/;
		if (hexPattern.test(trimmed)) {
			let hex = trimmed;
			if (!hex.startsWith('#')) hex = '#' + hex;
			if (hex.length === 4) {
				// Convert 3-digit hex to 6-digit
				hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
			}
			return hex;
		}
		
		// Check if it's RGB
		const rgbMatch = trimmed.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
		if (rgbMatch) {
			const r = parseInt(rgbMatch[1]);
			const g = parseInt(rgbMatch[2]);
			const b = parseInt(rgbMatch[3]);
			return rgbToHex(r, g, b);
		}
		
		// Check if it's HSL
		const hslMatch = trimmed.match(/hsl\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/i);
		if (hslMatch) {
			const h = parseInt(hslMatch[1]);
			const s = parseInt(hslMatch[2]);
			const l = parseInt(hslMatch[3]);
			return hslToHex(h, s, l);
		}
		
		// Fallback
		return trimmed;
	}

	// Time parsing helper function
	function parseTimeWithTimezone(input: string): { timeStr: string; timezone: string } {
		// Map timezone abbreviations to actual timezone names
		const timezoneMap: { [key: string]: string } = {
			'ET': 'America/New_York',
			'EST': 'America/New_York',
			'EDT': 'America/New_York',
			'PT': 'America/Los_Angeles',
			'PST': 'America/Los_Angeles',
			'PDT': 'America/Los_Angeles',
			'MT': 'America/Denver',
			'MST': 'America/Denver',
			'MDT': 'America/Denver',
			'CT': 'America/Chicago',
			'CST': 'America/Chicago',
			'CDT': 'America/Chicago',
			'GMT': 'Europe/London',
			'UTC': 'UTC'
		};

		// Parse different time formats
		const trimmed = input.trim();
		
		// Handle formats like "11AM ET", "11 AM ET", "3:30PM PST", etc.
		const timeMatch = trimmed.match(/(\d{1,2}(?::\d{2})?)\s*(AM|PM)?\s*([A-Z]{2,3})/i);
		if (timeMatch) {
			let timeStr = timeMatch[1];
			const meridian = timeMatch[2];
			const tzAbbr = timeMatch[3].toUpperCase();
			
			// Convert to 24-hour format if needed
			if (meridian) {
				if (timeStr.includes(':')) {
					const [hours, minutes] = timeStr.split(':');
					let hour = parseInt(hours);
					if (meridian.toUpperCase() === 'PM' && hour !== 12) hour += 12;
					if (meridian.toUpperCase() === 'AM' && hour === 12) hour = 0;
					timeStr = `${hour.toString().padStart(2, '0')}:${minutes}`;
				} else {
					// Handle cases like "11AM" without minutes
					let hour = parseInt(timeStr);
					if (meridian.toUpperCase() === 'PM' && hour !== 12) hour += 12;
					if (meridian.toUpperCase() === 'AM' && hour === 12) hour = 0;
					timeStr = `${hour.toString().padStart(2, '0')}:00`;
				}
			} else {
				// Add minutes if not present
				if (!timeStr.includes(':')) {
					timeStr += ':00';
				}
			}
			
			const timezone = timezoneMap[tzAbbr] || tzAbbr;
			return { timeStr, timezone };
		}
		
		// Fallback: return original input
		return { timeStr: input, timezone: 'Local' };
	}

	// Heuristic analysis functions
	function analyzeInput(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		const trimmed = input.trim();

		if (!trimmed) return suggestions;

		// Math expressions (calculator vs function drawer)
		const mathSuggestions = analyzeMath(trimmed);
		suggestions.push(...mathSuggestions);

		// Epoch time detection
		const epochSuggestions = analyzeEpoch(trimmed);
		suggestions.push(...epochSuggestions);

		// Timezone conversions
		const timezoneSuggestions = analyzeTimezone(trimmed);
		suggestions.push(...timezoneSuggestions);

		// Currency conversion
		const currencySuggestions = analyzeCurrency(trimmed);
		suggestions.push(...currencySuggestions);

		// Color detection
		const colorSuggestions = analyzeColor(trimmed);
		suggestions.push(...colorSuggestions);

		// Stock symbols
		const stockSuggestions = analyzeStock(trimmed);
		suggestions.push(...stockSuggestions);

		// Translation patterns
		const translationSuggestions = analyzeTranslation(trimmed);
		suggestions.push(...translationSuggestions);

		// URLs and curl commands
		const urlSuggestions = analyzeUrl(trimmed);
		suggestions.push(...urlSuggestions);

		// Base64 strings
		const base64Suggestions = analyzeBase64(trimmed);
		suggestions.push(...base64Suggestions);

		// JSON strings
		const jsonSuggestions = analyzeJson(trimmed);
		suggestions.push(...jsonSuggestions);

		// Sort by confidence score descending
		return suggestions.sort((a, b) => b.confidence - a.confidence);
	}

	function analyzeMath(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Check for mathematical expressions - be more precise
		const mathOperators = /[+\-*/÷×=]/;
		const hasNumbers = /\d/;
		const hasVariables = /[a-zA-Z]/;
		const hasFunctions = /(?:sin|cos|tan|log|ln|sqrt|exp|abs|floor|ceil|round|pi|e)\b/i;
		
		// Only detect math if it looks like an actual mathematical expression
		// Must have numbers and operators, and not be part of a URL or command
		if (hasNumbers.test(input) && mathOperators.test(input)) {
			// Exclude common false positives
			const isUrl = /^https?:\/\/|^www\./i.test(input);
			const isCurlCommand = /^\s*curl\s+/i.test(input);
			
			if (!isUrl && !isCurlCommand) {
				// Check if it's more likely to be a function expression
				if (hasVariables.test(input) || hasFunctions.test(input)) {
					// Has variables or functions - suggest function drawer
					suggestions.push({
						id: 'functiondrawer',
						name: appConfigs.functiondrawer.name,
						icon: appConfigs.functiondrawer.icon,
						description: appConfigs.functiondrawer.description,
						confidence: 0.9,
						url: appConfigs.functiondrawer.buildUrl(input),
						reason: 'Contains mathematical expression with variables or functions'
					});
				} else {
					// Pure arithmetic - suggest calculator
					suggestions.push({
						id: 'calculator',
						name: appConfigs.calculator.name,
						icon: appConfigs.calculator.icon,
						description: appConfigs.calculator.description,
						confidence: 0.95,
						url: appConfigs.calculator.buildUrl(input),
						reason: 'Contains arithmetic expression'
					});
				}
			}
		}
		
		return suggestions;
	}

	function analyzeEpoch(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Check for epoch timestamps (10 or 13 digits) - but only if it's a standalone number
		const epochPattern = /^\d{10}$|^\d{13}$/;
		const trimmed = input.trim();
		
		// Only match standalone timestamps, not embedded in longer strings
		if (epochPattern.test(trimmed)) {
			suggestions.push({
				id: 'datetime',
				name: appConfigs.datetime.name,
				icon: appConfigs.datetime.icon,
				description: appConfigs.datetime.description,
				confidence: 0.9,
				url: appConfigs.datetime.buildUrl(input, 'epoch'),
				reason: 'Appears to be Unix timestamp'
			});
		}
		
		return suggestions;
	}

	function analyzeTimezone(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Check for timezone patterns like "11AM ET", "3PM PST", "11 AM ET", etc.
		const timezonePattern = /\d{1,2}:\d{2}|(?:\d{1,2}\s*(?:AM|PM)?\s*(?:ET|EST|EDT|PT|PST|PDT|MT|MST|MDT|CT|CST|CDT|GMT|UTC))/i;
		if (timezonePattern.test(input)) {
			const { timeStr, timezone } = parseTimeWithTimezone(input);
			
			suggestions.push({
				id: 'datetime',
				name: appConfigs.datetime.name,
				icon: appConfigs.datetime.icon,
				description: appConfigs.datetime.description,
				confidence: 0.8,
				url: appConfigs.datetime.buildUrl(timeStr, 'time', timezone),
				reason: 'Contains time with timezone information'
			});
		}
		
		return suggestions;
	}

	function analyzeCurrency(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Check for currency patterns - be more precise to avoid false positives
		const trimmed = input.trim();
		
		// More specific currency patterns
		const currencyConversionPattern = /(?:(\d+(?:\.\d+)?)\s*([A-Z]{3})\s*(?:to|in|→)\s*([A-Z]{3}))|(?:([A-Z]{3})\s*(?:to|in|→)\s*([A-Z]{3}))/i;
		const currencyAmountPattern = /^(\d+(?:\.\d+)?)\s*([A-Z]{3})$/i;
		
		// Match conversion patterns or standalone currency amounts
		let match = trimmed.match(currencyConversionPattern);
		if (!match) {
			match = trimmed.match(currencyAmountPattern);
		}
		
		if (match) {
			const amount = match[1] || match[6];
			const from = match[2] || match[4] || match[7];
			const to = match[3] || match[5];
			
			suggestions.push({
				id: 'currencyconverter',
				name: appConfigs.currencyconverter.name,
				icon: appConfigs.currencyconverter.icon,
				description: appConfigs.currencyconverter.description,
				confidence: 0.85,
				url: appConfigs.currencyconverter.buildUrl(input, from, to),
				reason: 'Contains currency conversion pattern'
			});
		}
		
		return suggestions;
	}

	function analyzeColor(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Check for various color formats
		const hexPattern = /^#?[0-9A-Fa-f]{6}$|^#?[0-9A-Fa-f]{3}$/;
		const rgbPattern = /rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/i;
		const hslPattern = /hsl\s*\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*\)/i;
		
		if (hexPattern.test(input.trim()) || rgbPattern.test(input) || hslPattern.test(input)) {
			// Convert any color format to hex
			const hexColor = convertColorToHex(input);
			
			let reason = 'Appears to be color code';
			if (hexPattern.test(input.trim())) {
				reason = 'Appears to be hex color code';
			} else if (rgbPattern.test(input)) {
				reason = 'RGB color (converted to hex)';
			} else if (hslPattern.test(input)) {
				reason = 'HSL color (converted to hex)';
			}
			
			suggestions.push({
				id: 'colorpicker',
				name: appConfigs.colorpicker.name,
				icon: appConfigs.colorpicker.icon,
				description: appConfigs.colorpicker.description,
				confidence: 0.9,
				url: appConfigs.colorpicker.buildUrl(hexColor),
				reason: reason
			});
		}
		
		return suggestions;
	}

	function analyzeStock(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Check for stock symbols (starts with $ or 1-5 uppercase letters)
		const stockPattern = /^\$?[A-Z]{1,5}$|^\$[A-Z]{1,5}$/;
		if (stockPattern.test(input.trim())) {
			suggestions.push({
				id: 'stocktracker',
				name: appConfigs.stocktracker.name,
				icon: appConfigs.stocktracker.icon,
				description: appConfigs.stocktracker.description,
				confidence: 0.8,
				url: appConfigs.stocktracker.buildUrl(input),
				reason: 'Appears to be stock symbol'
			});
		}
		
		return suggestions;
	}

	function analyzeTranslation(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Language codes and names for translation detection
		const languageMap: { [key: string]: string } = {
			'spanish': 'es',
			'french': 'fr',
			'german': 'de',
			'italian': 'it',
			'portuguese': 'pt',
			'russian': 'ru',
			'japanese': 'ja',
			'korean': 'ko',
			'chinese': 'zh',
			'arabic': 'ar',
			'hindi': 'hi',
			'dutch': 'nl',
			'turkish': 'tr',
			'english': 'en',
			// Add language codes as well
			'es': 'es',
			'fr': 'fr',
			'de': 'de',
			'it': 'it',
			'pt': 'pt',
			'ru': 'ru',
			'ja': 'ja',
			'ko': 'ko',
			'zh': 'zh',
			'ar': 'ar',
			'hi': 'hi',
			'nl': 'nl',
			'tr': 'tr',
			'en': 'en'
		};
		
		// Check for multi-line translation patterns first
		const lines = input.split('\n');
		if (lines.length >= 2) {
			const firstLine = lines[0].trim();
			const textToTranslate = lines.slice(1).join('\n').trim();
			
			if (textToTranslate) {
				// Multi-line patterns
				const multiLinePatterns = [
					// "translate to Spanish"
					/^translate\s+to\s+([a-zA-Z]+)$/i,
					// "translate from English to Spanish"
					/^translate\s+from\s+([a-zA-Z]+)\s+to\s+([a-zA-Z]+)$/i,
					// "translate to Spanish:"
					/^translate\s+to\s+([a-zA-Z]+):?$/i,
					// "translate from English to Spanish:"
					/^translate\s+from\s+([a-zA-Z]+)\s+to\s+([a-zA-Z]+):?$/i
				];
				
				for (const pattern of multiLinePatterns) {
					const match = firstLine.match(pattern);
					if (match) {
						let sourceLangInput = '';
						let targetLangInput = '';
						
						if (match.length === 2) {
							// Pattern: "translate to Spanish"
							targetLangInput = match[1].toLowerCase();
						} else if (match.length === 3) {
							// Pattern: "translate from English to Spanish"
							sourceLangInput = match[1].toLowerCase();
							targetLangInput = match[2].toLowerCase();
						}
						
						if (targetLangInput) {
							const targetLangCode = languageMap[targetLangInput];
							const sourceLangCode = sourceLangInput ? languageMap[sourceLangInput] : 'auto';
							
							if (targetLangCode) {
								suggestions.push({
									id: 'translator',
									name: appConfigs.translator.name,
									icon: appConfigs.translator.icon,
									description: appConfigs.translator.description,
									confidence: 0.98, // Higher confidence for multi-line patterns
									url: appConfigs.translator.buildUrl(input, targetLangCode, textToTranslate, sourceLangCode),
									reason: sourceLangInput ? 
										`Translate from ${sourceLangInput} to ${targetLangInput}` : 
										`Translate to ${targetLangInput}`
								});
								return suggestions; // Return early since we found a match
							}
						}
					}
				}
			}
		}
		
		// Check for single-line translation patterns
		const patterns = [
			// "translate to Spanish"
			/^translate\s+to\s+([a-zA-Z]+)$/i,
			// "translate hello to Spanish"
			/^translate\s+(.+?)\s+to\s+([a-zA-Z]+)$/i,
			// "translate 'hello world' to spanish"
			/^translate\s+['"](.+?)['"]\s+to\s+([a-zA-Z]+)$/i,
			// "translate hello world to spanish"
			/^translate\s+([^"']+?)\s+to\s+([a-zA-Z]+)$/i
		];
		
		let matchFound = false;
		
		for (const pattern of patterns) {
			const match = input.match(pattern);
			if (match && !matchFound) {
				let targetLangInput: string = '';
				let textToTranslate = '';
				
				if (match.length === 2) {
					// Pattern: "translate to Spanish"
					targetLangInput = match[1].toLowerCase();
				} else if (match.length === 3) {
					// Pattern: "translate hello to Spanish"
					textToTranslate = match[1].trim();
					targetLangInput = match[2].toLowerCase();
				}
				
				if (targetLangInput) {
					const targetLangCode = languageMap[targetLangInput];
					
					if (targetLangCode) {
						suggestions.push({
							id: 'translator',
							name: appConfigs.translator.name,
							icon: appConfigs.translator.icon,
							description: appConfigs.translator.description,
							confidence: 0.95,
							url: appConfigs.translator.buildUrl(input, targetLangCode, textToTranslate, 'auto'),
							reason: textToTranslate ? `Translate "${textToTranslate}" to ${targetLangInput}` : `Translate to ${targetLangInput}`
						});
						matchFound = true;
					}
				}
			}
		}
		
		return suggestions;
	}

	function analyzeUrl(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Check for URLs or curl commands
		const urlPattern = /^https?:\/\/|^www\./i;
		const curlPattern = /^\s*curl\s+/i;
		
		if (urlPattern.test(input.trim()) || curlPattern.test(input)) {
			// Give curl commands higher confidence since they're more specific
			const confidence = curlPattern.test(input) ? 0.95 : 0.9;
			
			suggestions.push({
				id: 'urlexaminer',
				name: appConfigs.urlexaminer.name,
				icon: appConfigs.urlexaminer.icon,
				description: appConfigs.urlexaminer.description,
				confidence: confidence,
				url: appConfigs.urlexaminer.buildUrl(input),
				reason: curlPattern.test(input) ? 'Contains curl command' : 'Appears to be URL'
			});
		}
		
		return suggestions;
	}

	function analyzeBase64(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		// Check for Base64 patterns
		const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
		const trimmed = input.trim();
		
		// Must be at least 4 characters and divisible by 4, and match Base64 pattern
		if (trimmed.length >= 4 && trimmed.length % 4 === 0 && base64Pattern.test(trimmed)) {
			// Additional check: should have reasonable Base64 character distribution
			const base64Chars = trimmed.match(/[A-Za-z0-9+/]/g);
			if (base64Chars && base64Chars.length > trimmed.length * 0.8) {
				suggestions.push({
					id: 'base64',
					name: appConfigs.base64.name,
					icon: appConfigs.base64.icon,
					description: appConfigs.base64.description,
					confidence: 0.7,
					url: appConfigs.base64.buildUrl(input),
					reason: 'Appears to be Base64 encoded string'
				});
			}
		}
		
		return suggestions;
	}

	function analyzeJson(input: string): AppSuggestion[] {
		const suggestions: AppSuggestion[] = [];
		
		const trimmed = input.trim();
		
		// Check if it starts and ends with JSON delimiters
		if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
			(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
			
			// Try to parse as JSON
			try {
				JSON.parse(trimmed);
				suggestions.push({
					id: 'jsonformat',
					name: appConfigs.jsonformat.name,
					icon: appConfigs.jsonformat.icon,
					description: appConfigs.jsonformat.description,
					confidence: 0.9,
					url: appConfigs.jsonformat.buildUrl(input),
					reason: 'Valid JSON format detected'
				});
			} catch (e) {
				// Still suggest if it looks like JSON but might be malformed
				suggestions.push({
					id: 'jsonformat',
					name: appConfigs.jsonformat.name,
					icon: appConfigs.jsonformat.icon,
					description: appConfigs.jsonformat.description,
					confidence: 0.6,
					url: appConfigs.jsonformat.buildUrl(input),
					reason: 'Appears to be JSON (may need formatting)'
				});
			}
		}
		
		return suggestions;
	}

	// React to input changes
	$: {
		if (inputText.trim()) {
			suggestions = analyzeInput(inputText);
			showSuggestions = suggestions.length > 0;
		} else {
			suggestions = [];
			showSuggestions = false;
		}
	}

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'text-green-600';
		if (confidence >= 0.6) return 'text-yellow-600';
		return 'text-orange-600';
	}

	function getConfidenceLabel(confidence: number): string {
		if (confidence >= 0.8) return 'High';
		if (confidence >= 0.6) return 'Medium';
		return 'Low';
	}
</script>

<div class="space-y-4">
	<div class="text-center">
		<h2 class="mb-2 text-xl font-bold text-gray-800">Smart Tool Suggestions</h2>
		<p class="text-sm text-gray-600">
			Type or paste something, and I'll suggest the best tools for the job
		</p>
	</div>

	<!-- Input Area -->
	<div class="relative">
		<textarea
			bind:value={inputText}
			placeholder="Try: 2+3*4, #FF5733, translate to Spanish, multi-line translate commands, 1234567890, https://example.com, JSON, $AAPL..."
			class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 resize-none"
			rows="3"
		></textarea>
		
		{#if inputText.trim()}
			<button
				on:click={() => { inputText = ''; }}
				class="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
				title="Clear input"
				aria-label="Clear input"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Suggestions -->
	{#if showSuggestions}
		<div class="space-y-2">
			<h3 class="font-medium text-gray-700">Suggested Tools:</h3>
			<div class="space-y-2">
				{#each suggestions as suggestion}
					<a
						href={suggestion.url}
						class="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
					>
						<div class="flex items-center space-x-3">
							<div class="text-2xl">{suggestion.icon}</div>
							<div>
								<div class="font-medium text-gray-800">{suggestion.name}</div>
								<div class="text-sm text-gray-600">{suggestion.reason}</div>
							</div>
						</div>
						<div class="text-right">
							<div class="text-sm font-medium {getConfidenceColor(suggestion.confidence)}">
								{getConfidenceLabel(suggestion.confidence)}
							</div>
							<div class="text-xs text-gray-500">
								{Math.round(suggestion.confidence * 100)}% match
							</div>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{:else if inputText.trim()}
		<div class="text-center py-8 text-gray-500">
			<svg class="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
			</svg>
			<p>No specific tools detected for this input</p>
			<p class="text-sm">Try math expressions, colors, translation commands (single or multi-line), URLs, JSON, or stock symbols</p>
		</div>
	{/if}
</div> 