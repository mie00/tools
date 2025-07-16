export interface AppSuggestion {
	id: string;
	name: string;
	icon: string;
	description: string;
	confidence: number;
	url: string;
	reason: string;
}

import { appConfigs } from './shortcuts';

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
	let r = 0,
		g = 0,
		b = 0;

	if (0 <= h && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (60 <= h && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (120 <= h && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (180 <= h && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (240 <= h && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (300 <= h && h < 360) {
		r = c;
		g = 0;
		b = x;
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

// Helper function to normalize unit names to match the converter's expected format
function normalizeUnit(unit: string, category: string): string {
	const normalizations: Record<string, Record<string, string>> = {
		length: {
			meters: 'meter',
			m: 'meter',
			kilometers: 'kilometer',
			km: 'kilometer',
			centimeters: 'centimeter',
			cm: 'centimeter',
			millimeters: 'millimeter',
			mm: 'millimeter',
			inches: 'inch',
			in: 'inch',
			foot: 'feet',
			ft: 'feet',
			yards: 'yard',
			yd: 'yard',
			miles: 'mile',
			mi: 'mile'
		},
		weight: {
			kilograms: 'kilogram',
			kg: 'kilogram',
			grams: 'gram',
			g: 'gram',
			pounds: 'pound',
			lb: 'pound',
			lbs: 'pound',
			ounces: 'ounce',
			oz: 'ounce',
			tons: 'ton',
			t: 'ton',
			st: 'stone'
		},
		temperature: {
			'°c': 'celsius',
			'°f': 'fahrenheit',
			k: 'kelvin'
		},
		volume: {
			liters: 'liter',
			l: 'liter',
			milliliters: 'milliliter',
			ml: 'milliliter',
			gallons: 'gallon',
			gal: 'gallon',
			quarts: 'quart',
			qt: 'quart',
			pints: 'pint',
			pt: 'pint',
			cups: 'cup',
			fl_oz: 'fluid_ounce',
			floz: 'fluid_ounce'
		},
		area: {
			square_meters: 'square_meter',
			'm²': 'square_meter',
			square_kilometers: 'square_kilometer',
			'km²': 'square_kilometer',
			square_centimeters: 'square_centimeter',
			'cm²': 'square_centimeter',
			square_feet: 'square_foot',
			'ft²': 'square_foot',
			square_inches: 'square_inch',
			'in²': 'square_inch',
			acres: 'acre',
			hectares: 'hectare',
			ha: 'hectare'
		},
		speed: {
			mph: 'miles_per_hour',
			miles_per_hour: 'miles_per_hour',
			kmh: 'kilometers_per_hour',
			'km/h': 'kilometers_per_hour',
			kph: 'kilometers_per_hour',
			kilometers_per_hour: 'kilometers_per_hour',
			mps: 'meters_per_second',
			'm/s': 'meters_per_second',
			meters_per_second: 'meters_per_second',
			fps: 'feet_per_second',
			'ft/s': 'feet_per_second',
			feet_per_second: 'feet_per_second',
			knots: 'knot',
			kt: 'knot'
		}
	};

	const categoryNormalizations = normalizations[category] || {};
	return categoryNormalizations[unit.toLowerCase()] || unit.toLowerCase();
}

// Time parsing helper function
function parseTimeWithTimezone(input: string): { timeStr: string; timezone: string } {
	// Map timezone abbreviations to actual timezone names
	const timezoneMap: { [key: string]: string } = {
		ET: 'America/New_York',
		EST: 'America/New_York',
		EDT: 'America/New_York',
		PT: 'America/Los_Angeles',
		PST: 'America/Los_Angeles',
		PDT: 'America/Los_Angeles',
		MT: 'America/Denver',
		MST: 'America/Denver',
		MDT: 'America/Denver',
		CT: 'America/Chicago',
		CST: 'America/Chicago',
		CDT: 'America/Chicago',
		GMT: 'Europe/London',
		UTC: 'UTC'
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

// Main heuristic analysis function
export function analyzeInput(input: string): AppSuggestion[] {
	const suggestions: AppSuggestion[] = [];
	const trimmed = input.trim();

	if (!trimmed) return suggestions;

	// Check for bang shortcuts (like DuckDuckGo bangs) anywhere in the query
	const bangShortcuts: Record<string, { name: string; url: string; icon: string }> = {
		'!g': { name: 'Google', url: 'https://www.google.com/search?q=', icon: '🔍' },
		'!w': {
			name: 'Wikipedia',
			url: 'https://en.wikipedia.org/wiki/Special:Search?search=',
			icon: '📖'
		},
		'!tw': { name: 'Twitter', url: 'https://twitter.com/search?q=', icon: '🐦' },
		'!imdb': { name: 'IMDB', url: 'https://www.imdb.com/find?q=', icon: '🎬' },
		'!a': { name: 'Amazon', url: 'https://www.amazon.com/s?k=', icon: '📦' },
		'!e': { name: 'eBay', url: 'https://www.ebay.com/sch/i.html?_nkw=', icon: '🏪' },
		'!so': { name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=', icon: '💻' },
		'!gh': { name: 'GitHub', url: 'https://github.com/search?q=', icon: '🐙' },
		'!r': { name: 'Reddit', url: 'https://www.reddit.com/search/?q=', icon: '🤖' },
		'!ste': { name: 'Steam', url: 'https://store.steampowered.com/search/?term=', icon: '🎮' },
		'!nf': { name: 'Netflix', url: 'https://www.netflix.com/search?q=', icon: '📺' },
		'!p': { name: 'Pinterest', url: 'https://www.pinterest.com/search/pins/?q=', icon: '📌' },
		'!wa': { name: 'Wolfram Alpha', url: 'https://www.wolframalpha.com/input/?i=', icon: '🧮' },
		'!yt': { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=', icon: '📹' },
		'!maps': { name: 'Google Maps', url: 'https://www.google.com/maps/search/', icon: '🗺️' },
		'!translate': {
			name: 'Google Translate',
			url: 'https://translate.google.com/?sl=auto&tl=en&text=',
			icon: '🔤'
		}
	};

	// Look for bang shortcuts anywhere in the input
	// Bang must be at start or preceded by whitespace, and followed by whitespace or end of string
	const bangPattern =
		/(?:^|\s)(!(?:g|w|tw|imdb|a|e|so|gh|r|ste|nf|p|wa|yt|maps|translate))(?:\s|$)/i;
	const bangMatch = trimmed.match(bangPattern);

	if (bangMatch) {
		const bang = bangMatch[1].toLowerCase();
		const bangConfig = bangShortcuts[bang];

		if (bangConfig) {
			// Extract the search query by removing the bang and cleaning up spaces
			// Handle cases where bang is at beginning, middle, or end
			const escapedBang = bangMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex chars
			let searchQuery = trimmed
				.replace(new RegExp(`\\s*${escapedBang}\\s*`, 'i'), ' ') // Replace the bang with space
				.trim(); // Remove leading/trailing spaces

			// Clean up multiple spaces
			searchQuery = searchQuery.replace(/\s+/g, ' ');

			// Only create suggestion if we have a non-empty search query
			if (searchQuery && searchQuery.length > 0) {
				// Create a high-priority suggestion for bang shortcuts
				suggestions.push({
					id: 'bangsearch',
					name: `${bangConfig.name} Search`,
					icon: bangConfig.icon,
					description: `Search ${bangConfig.name}`,
					confidence: 1.0, // Maximum confidence for potential auto-redirect
					url: bangConfig.url + encodeURIComponent(searchQuery),
					reason: `Search "${searchQuery}" on ${bangConfig.name}`
				});
				return suggestions; // Return immediately, don't analyze other patterns
			}
		}
	}

	// Check for structured data first (JSON, Base64) - these should have priority
	const jsonSuggestions = analyzeJson(trimmed);
	suggestions.push(...jsonSuggestions);

	const base64Suggestions = analyzeBase64(trimmed);
	suggestions.push(...base64Suggestions);

	// If we detected JSON or Base64, we should still check for URLs and translations
	// but skip other pattern-based analyzers to avoid false positives
	const isStructuredData = jsonSuggestions.length > 0 || base64Suggestions.length > 0;

	// URLs and curl commands (always check - can contain structured data)
	const urlSuggestions = analyzeUrl(trimmed);
	suggestions.push(...urlSuggestions);

	// Translation patterns (always check - can translate structured data)
	const translationSuggestions = analyzeTranslation(trimmed);
	suggestions.push(...translationSuggestions);

	// Only run content-based analyzers if we haven't detected structured data
	if (!isStructuredData) {
		// Math expressions (calculator vs function drawer)
		const mathSuggestions = analyzeMath(trimmed);
		suggestions.push(...mathSuggestions);

		// Unit conversions
		const unitSuggestions = analyzeUnit(trimmed);
		suggestions.push(...unitSuggestions);

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
	}

	// Google search (always available as fallback)
	const googleSuggestions = analyzeGoogleSearch(trimmed);
	suggestions.push(...googleSuggestions);

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

	// Exclude unit conversion patterns first
	const isUnitConversion = /\d+(?:\.\d+)?\s*[a-zA-Z°²³/]+\s*(?:to|in|→)\s*[a-zA-Z°²³/]+/i;

	// Only detect math if it looks like an actual mathematical expression
	// Must have (numbers and operators) OR (functions/variables and operators)
	const hasBasicMath = hasNumbers.test(input) && mathOperators.test(input);
	const hasFunctionMath =
		(hasVariables.test(input) || hasFunctions.test(input)) && mathOperators.test(input);

	if ((hasBasicMath || hasFunctionMath) && !isUnitConversion.test(input)) {
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

function analyzeUnit(input: string): AppSuggestion[] {
	const suggestions: AppSuggestion[] = [];

	// Unit mappings for different categories
	const unitMappings = {
		length: {
			units: [
				'meter',
				'meters',
				'm',
				'km',
				'kilometer',
				'kilometers',
				'cm',
				'centimeter',
				'centimeters',
				'mm',
				'millimeter',
				'millimeters',
				'inch',
				'inches',
				'in',
				'feet',
				'foot',
				'ft',
				'yard',
				'yards',
				'yd',
				'mile',
				'miles',
				'mi'
			],
			category: 'length'
		},
		weight: {
			units: [
				'kilogram',
				'kilograms',
				'kg',
				'gram',
				'grams',
				'g',
				'pound',
				'pounds',
				'lb',
				'lbs',
				'ounce',
				'ounces',
				'oz',
				'ton',
				'tons',
				't',
				'stone',
				'st'
			],
			category: 'weight'
		},
		temperature: {
			units: ['celsius', 'fahrenheit', 'kelvin', '°c', '°f', 'k', 'degrees'],
			category: 'temperature'
		},
		volume: {
			units: [
				'liter',
				'liters',
				'l',
				'milliliter',
				'milliliters',
				'ml',
				'gallon',
				'gallons',
				'gal',
				'quart',
				'quarts',
				'qt',
				'pint',
				'pints',
				'pt',
				'cup',
				'cups',
				'fluid_ounce',
				'fl_oz',
				'floz'
			],
			category: 'volume'
		},
		area: {
			units: [
				'square_meter',
				'square_meters',
				'm²',
				'square_kilometer',
				'square_kilometers',
				'km²',
				'square_centimeter',
				'square_centimeters',
				'cm²',
				'square_foot',
				'square_feet',
				'ft²',
				'square_inch',
				'square_inches',
				'in²',
				'acre',
				'acres',
				'hectare',
				'hectares',
				'ha'
			],
			category: 'area'
		},
		speed: {
			units: [
				'mph',
				'miles_per_hour',
				'kmh',
				'km/h',
				'kph',
				'kilometers_per_hour',
				'mps',
				'meters_per_second',
				'm/s',
				'fps',
				'feet_per_second',
				'ft/s',
				'knot',
				'knots',
				'kt'
			],
			category: 'speed'
		}
	};

	// Convert patterns: "10 meters to feet", "5 kg in pounds", "100°F to celsius", "50 mph to km/h"
	const conversionPatterns = [
		// Pattern: "10 meters to feet" or "50 mph to km/h"
		/(\d+(?:\.\d+)?)\s*([a-zA-Z°²³/]+)\s*(?:to|in|→)\s*([a-zA-Z°²³/]+)/i,
		// Pattern: "convert 10 meters to feet"
		/convert\s+(\d+(?:\.\d+)?)\s*([a-zA-Z°²³/]+)\s*(?:to|in|→)\s*([a-zA-Z°²³/]+)/i,
		// Pattern: "10 meters"
		/(\d+(?:\.\d+)?)\s*([a-zA-Z°²³/]+)$/i
	];

	let match = null;
	let patternIndex = -1;

	for (let i = 0; i < conversionPatterns.length; i++) {
		match = input.match(conversionPatterns[i]);
		if (match) {
			patternIndex = i;
			break;
		}
	}

	if (match) {
		const value = match[1];
		const fromUnit = match[2].toLowerCase();
		const toUnit = match[3] ? match[3].toLowerCase() : '';

		// Find which category the units belong to
		let category = '';
		let fromUnitNormalized = '';
		let toUnitNormalized = '';

		// Check each category to find matching units
		for (const [cat, data] of Object.entries(unitMappings)) {
			const fromMatch = data.units.find((unit) => unit.toLowerCase() === fromUnit);
			const toMatch = toUnit ? data.units.find((unit) => unit.toLowerCase() === toUnit) : null;

			if (fromMatch && (toMatch || patternIndex === 3)) {
				// Last pattern doesn't need 'to' unit
				category = data.category;
				fromUnitNormalized = normalizeUnit(fromUnit, category);
				toUnitNormalized = toUnit ? normalizeUnit(toUnit, category) : '';
				break;
			}
		}

		if (category) {
			const confidence = toUnit ? 0.9 : 0.75; // Higher confidence if both units are specified
			const reason = toUnit
				? `Convert ${value} ${fromUnit} to ${toUnit}`
				: `Convert ${value} ${fromUnit} to another unit`;

			suggestions.push({
				id: 'unitconverter',
				name: appConfigs.unitconverter.name,
				icon: appConfigs.unitconverter.icon,
				description: appConfigs.unitconverter.description,
				confidence: confidence,
				url: appConfigs.unitconverter.buildUrl(
					input,
					category,
					fromUnitNormalized,
					toUnitNormalized
				),
				reason: reason
			});
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
	const timezonePattern =
		/\d{1,2}:\d{2}|(?:\d{1,2}\s*(?:AM|PM)?\s*(?:ET|EST|EDT|PT|PST|PDT|MT|MST|MDT|CT|CST|CDT|GMT|UTC))/i;
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

	// More specific currency patterns - case insensitive but normalize to uppercase
	const currencyConversionPattern =
		/(?:(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*(?:to|in|→)\s*([A-Za-z]{3}))|(?:([A-Za-z]{3})\s*(?:to|in|→)\s*([A-Za-z]{3}))/i;
	const currencyAmountPattern = /^(\d+(?:\.\d+)?)\s*([A-Za-z]{3})$/i;

	// Match conversion patterns or standalone currency amounts
	let match = trimmed.match(currencyConversionPattern);
	if (!match) {
		match = trimmed.match(currencyAmountPattern);
	}

	if (match) {
		const amount = match[1] || match[6];
		const from = (match[2] || match[4] || match[7])?.toUpperCase();
		const to = (match[3] || match[5])?.toUpperCase();

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
		spanish: 'es',
		french: 'fr',
		german: 'de',
		italian: 'it',
		portuguese: 'pt',
		russian: 'ru',
		japanese: 'ja',
		korean: 'ko',
		chinese: 'zh',
		arabic: 'ar',
		hindi: 'hi',
		dutch: 'nl',
		turkish: 'tr',
		english: 'en',
		// Add language codes as well
		es: 'es',
		fr: 'fr',
		de: 'de',
		it: 'it',
		pt: 'pt',
		ru: 'ru',
		ja: 'ja',
		ko: 'ko',
		zh: 'zh',
		ar: 'ar',
		hi: 'hi',
		nl: 'nl',
		tr: 'tr',
		en: 'en'
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
								url: appConfigs.translator.buildUrl(
									input,
									targetLangCode,
									textToTranslate,
									sourceLangCode
								),
								reason: sourceLangInput
									? `Translate from ${sourceLangInput} to ${targetLangInput}`
									: `Translate to ${targetLangInput}`
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
		/^translate\s+([^"']+?)\s+to\s+([a-zA-Z]+)$/i,
		// "tr 'hello world' en es" or "tr hello en es"
		/^tr\s+['"](.+?)['"]\s+([a-zA-Z]{2})\s+([a-zA-Z]{2})$/i,
		// "tr hello en es"
		/^tr\s+(\w+)\s+([a-zA-Z]{2})\s+([a-zA-Z]{2})$/i
	];

	let matchFound = false;

	for (const pattern of patterns) {
		const match = input.match(pattern);
		if (match && !matchFound) {
			let targetLangInput: string = '';
			let sourceLangInput: string = '';
			let textToTranslate = '';

			if (match.length === 2) {
				// Pattern: "translate to Spanish"
				targetLangInput = match[1].toLowerCase();
			} else if (match.length === 3) {
				// Pattern: "translate hello to Spanish"
				textToTranslate = match[1].trim();
				targetLangInput = match[2].toLowerCase();
			} else if (match.length === 4) {
				// Pattern: "tr 'hello world' en es" or "tr hello en es"
				textToTranslate = match[1].trim();
				sourceLangInput = match[2].toLowerCase();
				targetLangInput = match[3].toLowerCase();
			}

			if (targetLangInput) {
				const targetLangCode = languageMap[targetLangInput];
				const sourceLangCode = sourceLangInput ? languageMap[sourceLangInput] : 'auto';

				if (targetLangCode) {
					let reason = '';
					if (textToTranslate && sourceLangInput) {
						reason = `Translate "${textToTranslate}" from ${sourceLangInput} to ${targetLangInput}`;
					} else if (textToTranslate) {
						reason = `Translate "${textToTranslate}" to ${targetLangInput}`;
					} else {
						reason = `Translate to ${targetLangInput}`;
					}

					suggestions.push({
						id: 'translator',
						name: appConfigs.translator.name,
						icon: appConfigs.translator.icon,
						description: appConfigs.translator.description,
						confidence: 0.95,
						url: appConfigs.translator.buildUrl(
							input,
							targetLangCode,
							textToTranslate,
							sourceLangCode || 'auto'
						),
						reason: reason
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
	if (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	) {
		// Try to parse as JSON
		try {
			JSON.parse(trimmed);
			suggestions.push({
				id: 'jsonformat',
				name: appConfigs.jsonformat.name,
				icon: appConfigs.jsonformat.icon,
				description: appConfigs.jsonformat.description,
				confidence: 0.95, // Higher confidence for structured data
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
				confidence: 0.7, // Higher confidence for malformed JSON too
				url: appConfigs.jsonformat.buildUrl(input),
				reason: 'Appears to be JSON (may need formatting)'
			});
		}
	}

	return suggestions;
}

function analyzeGoogleSearch(input: string): AppSuggestion[] {
	const suggestions: AppSuggestion[] = [];

	// Always suggest Google search as a fallback option with very low confidence
	// This ensures it appears at the bottom of the suggestions list
	suggestions.push({
		id: 'googlesearch',
		name: appConfigs.googlesearch.name,
		icon: appConfigs.googlesearch.icon,
		description: appConfigs.googlesearch.description,
		confidence: 0.1, // Very low confidence to ensure it appears last
		url: appConfigs.googlesearch.buildUrl(input),
		reason: `Search "${input}" on Google`
	});

	return suggestions;
}
