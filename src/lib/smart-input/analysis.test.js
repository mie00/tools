import { describe, expect, it } from 'vitest';
import { analyzeInput } from './analysis';
import { getShortcutMapping } from './shortcuts';

describe('Smart Input Analysis', () => {
	describe('analyzeInput', () => {
		it('should return empty array for empty input', () => {
			const result = analyzeInput('');
			expect(result).toEqual([]);
		});

		it('should return empty array for whitespace input', () => {
			const result = analyzeInput('   ');
			expect(result).toEqual([]);
		});

		it('should detect simple math expressions', () => {
			const testCases = ['2+3*4', '15-8/2', '(5+3)*2', '100/4+6', '7*8-12', '45÷5+3', '12×3-8'];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'calculator',
						name: 'Calculator',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect complex math expressions', () => {
			const testCases = ['sin(45) + cos(60)'];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'functiondrawer',
						name: 'Function Drawer',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect unit conversions', () => {
			const testCases = [
				// Length
				'10 meters to feet',
				'5 km to miles',
				'100 cm to inches',
				'2.5 yards to meters',

				// Weight
				'5 kg to pounds',
				'150 lbs to kg',
				'500 grams to ounces',

				// Temperature
				'100°F to celsius',
				'0°C to fahrenheit',

				// Speed
				'50 mph to km/h',
				'100 km/h to mph',

				// Volume
				'5 liters to gallons',
				'1 gallon to liters',

				// Different formats
				'convert 10 meters to feet',
				'25 kg in pounds'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'unitconverter',
						name: 'Unit Converter',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect color values', () => {
			const testCases = [
				// Hex colors (6-digit)
				'#FF5733',
				'#000000',
				'#FFFFFF',
				'#ff0000',
				'#00ff00',
				'#0000ff',
				'#123abc',
				'FF5733', // Without hash

				// Hex colors (3-digit)
				'#f57',
				'#000',
				'#fff',
				'#f00',
				'#0f0',
				'#00f',
				'abc', // Without hash

				// RGB colors
				'rgb(255, 87, 51)',
				'rgb(0, 0, 0)',
				'rgb(255, 255, 255)',
				'RGB(128, 64, 192)',
				'rgb(255,0,0)', // No spaces

				// HSL colors
				'hsl(120, 100%, 50%)',
				'hsl(0, 0%, 0%)',
				'hsl(0, 0%, 100%)',
				'HSL(240, 50%, 75%)',
				'hsl(60,100,50)', // No % signs
				'hsl(180, 50%, 25%)'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'colorpicker',
						name: 'Color Picker',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect stock symbols', () => {
			const testCases = [
				// Popular tech stocks
				'$AAPL',
				'$GOOGL',
				'$MSFT',
				'$TSLA',
				'$AMZN',
				'$META',
				'$NFLX',
				'$NVDA',

				// Financial stocks
				'$JPM',
				'$BAC',
				'$WFC',
				'$GS',

				// Other sectors
				'$JNJ',
				'$PG',
				'$KO',
				'$WMT',
				'$XOM',
				'$CVX',

				// Crypto-related
				'$COIN',
				'$MSTR',

				// ETFs
				'$SPY',
				'$QQQ',
				'$VTI',

				// International
				'$TSM',
				'$ASML',
				'$NVO'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'stocktracker',
						name: 'Stock Tracker',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect URLs', () => {
			const testCases = [
				// Basic URLs
				'https://example.com',
				'http://test.org',
				'https://www.google.com',
				'http://localhost:3000',
				'https://sub.domain.com',

				// URLs with paths
				'https://www.google.com/search?q=test',
				'https://github.com/user/repo',
				'https://api.example.com/v1/users',
				'https://example.com/path/to/resource',

				// URLs with parameters
				'https://example.com?param=value',
				'https://example.com?a=1&b=2',
				'https://example.com/path?query=search&page=1',

				// URLs with fragments
				'https://example.com#section',
				'https://example.com/docs#installation',

				// Different protocols
				'https://secure.example.com',
				'http://legacy.example.com',

				// www formats
				'www.example.com',
				'www.google.com',
				'www.github.com',

				// cURL commands
				'curl https://api.example.com/data',
				'curl -X POST https://api.example.com/users',
				'curl -H "Content-Type: application/json" https://api.example.com',
				'  curl https://example.com/api/v1/endpoint',

				// Complex URLs
				'https://mail.google.com/mail/u/0/#inbox',
				'https://stackoverflow.com/questions/123456/how-to-do-something',
				'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				'https://docs.google.com/spreadsheets/d/1234567890/edit'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'urlexaminer',
						name: 'URL Examiner',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect JSON', () => {
			const testCases = [
				// Simple objects
				'{"key": "value"}',
				'{"name": "John", "age": 30}',
				'{"id": 1, "active": true}',
				'{"price": 19.99, "currency": "USD"}',

				// Arrays
				'[1, 2, 3, 4, 5]',
				'["apple", "banana", "orange"]',
				'[true, false, null]',
				'[{"id": 1}, {"id": 2}]',

				// Nested structures
				'{"nested": {"key": "value"}}',
				'{"user": {"name": "John", "address": {"city": "NYC"}}}',
				'{"items": [{"name": "item1"}, {"name": "item2"}]}',

				// Complex JSON
				'{"users": [{"id": 1, "name": "John", "active": true}, {"id": 2, "name": "Jane", "active": false}]}',
				'{"config": {"database": {"host": "localhost", "port": 5432}, "cache": {"enabled": true}}}',

				// API responses
				'{"status": "success", "data": {"user": {"id": 123, "email": "user@example.com"}}}',
				'{"error": {"code": 404, "message": "Not found"}}',
				'{"results": [{"title": "Result 1"}, {"title": "Result 2"}], "total": 2}',

				// Different data types
				'{"string": "text", "number": 42, "boolean": true, "null": null, "array": [1,2,3]}',
				'{"timestamp": "2023-01-01T00:00:00Z", "uuid": "123e4567-e89b-12d3-a456-426614174000"}',

				// Minified JSON
				'{"a":1,"b":2,"c":[1,2,3]}',
				'[{"x":1,"y":2},{"x":3,"y":4}]',

				// Empty structures
				'{}',
				'[]',
				'{"empty": {}, "emptyArray": []}'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'jsonformat',
						name: 'JSON Formatter',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect Base64 strings', () => {
			const testCases = [
				// Text encoding
				'SGVsbG8gV29ybGQ=', // "Hello World"
				'VGhpcyBpcyBhIHRlc3Q=', // "This is a test"
				'QWJjZGVmZ2hpams=', // "Abcdefghijk"
				'Zm9vYmFy', // "foobar"

				// Longer Base64 strings
				'VGhpcyBpcyBhIGxvbmdlciBzdHJpbmcgdGhhdCB3aWxsIGJlIGVuY29kZWQgaW4gQmFzZTY0',
				'TG9yZW0gaXBzdW0gZG9sb3Igc2l0IGFtZXQsIGNvbnNlY3RldHVyIGFkaXBpc2NpbmcgZWxpdA==',

				// API keys simulation
				'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw',
				'dGhpc2lzYWZha2VhcGlrZXl0aGF0aXNiYXNlNjRlbmNvZGVk'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'base64',
						name: 'Base64',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect translation commands', () => {
			const testCases = [
				// Basic translation patterns
				'translate hello to spanish',
				'translate "Good morning" to french',
				'translate this text to german',
				'translate welcome to italian',

				// Different target languages
				'translate hello to russian',
				'translate hello to japanese',
				'translate hello to dutch',

				// Shorthand "tr" commands
				'tr "Hello world" en es',
				'tr goodbye en fr',
				'tr welcome en it',

				// Various quote styles
				'translate "hello world" to spanish',
				"translate 'hello world' to spanish",
				'translate hello world to spanish'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'translator',
						name: 'Language Translator',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect multi-line translation commands', () => {
			const multiLineInput = `translate to spanish:
Hello world
How are you?
Good morning`;

			const result = analyzeInput(multiLineInput);
			expect(result).toContainEqual(
				expect.objectContaining({
					id: 'translator',
					name: 'Language Translator',
					confidence: expect.any(Number)
				})
			);
		});

		it('should detect epoch timestamps', () => {
			const testCases = [
				// 10-digit timestamps (seconds since epoch)
				'1634567890', // Oct 18, 2021
				'1700000000', // Nov 14, 2023
				'1672531200', // Jan 1, 2023
				'1609459200', // Jan 1, 2021
				'1640995200', // Jan 1, 2022
				'2147483647', // Jan 19, 2038 (32-bit limit)

				// 13-digit timestamps (milliseconds since epoch)
				'1634567890123', // Oct 18, 2021 with milliseconds
				'1700000000000', // Nov 14, 2023 with milliseconds
				'1672531200000', // Jan 1, 2023 with milliseconds
				'1234567890123' // Random timestamp with milliseconds
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'datetime',
						name: 'Date & Time',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect timezone time conversions', () => {
			const testCases = [
				// AM/PM formats with timezone
				'11AM ET',
				'3:30PM PST',
				'9:15AM EST',
				'5:45PM PDT',
				'12:00PM CT',
				'8:30AM MT',
				'10:15PM GMT',
				'2:45PM UTC',

				// 24-hour formats with timezone
				'15:45 GMT',
				'09:00 UTC',
				'14:30 EST',
				'20:15 PST',
				'13:45 ET',
				'22:30 PT',
				'16:00 MT',
				'19:45 CT',

				// Different timezone abbreviations
				'11 AM EDT', // Eastern Daylight Time
				'3 PM CDT', // Central Daylight Time
				'5 PM MDT', // Mountain Daylight Time
				'8 PM PDT', // Pacific Daylight Time
				'12 PM EST', // Eastern Standard Time
				'4 PM CST', // Central Standard Time
				'6 PM MST', // Mountain Standard Time
				'9 PM PST', // Pacific Standard Time

				// With spaces
				'11 AM ET',
				'3:30 PM PST',
				'9:15 AM EST',
				'5:45 PM GMT',
				'12:00 PM UTC',

				// Mixed formats
				'1030 GMT', // Military time style
				'1445 UTC',
				'0900 EST',
				'2130 PST',

				// Edge cases
				'12:00AM ET', // Midnight
				'12:00PM ET', // Noon
				'11:59PM PST', // Just before midnight
				'00:00 GMT', // Midnight in 24-hour
				'23:59 UTC' // Just before midnight in 24-hour
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'datetime',
						name: 'Date & Time',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should detect currency conversions', () => {
			const testCases = [
				// Major currency pairs
				'100 USD to EUR',
				'50 GBP to USD',
				'25.50 CAD to USD',
				'1000 EUR to GBP',
				'500 JPY to USD',
				'75 AUD to USD',
				'200 CHF to EUR',
				'150 USD to JPY',

				// Cryptocurrency (if supported)
				'1 BTC to USD',
				'10 ETH to USD',
				'1000 USD to BTC',

				// Asian currencies
				'1000 CNY to USD',
				'50000 KRW to USD',
				'5000 INR to USD',
				'100 SGD to USD',
				'1000 THB to USD',

				// Emerging markets
				'100 BRL to USD',
				'500 MXN to USD',
				'1000 RUB to USD',
				'200 ZAR to USD',
				'150 TRY to USD',

				// Different formats
				'100.50 USD to EUR',
				'1,000 EUR to USD',
				'25 USD in EUR',
				'50 GBP → USD',

				// No amount specified
				'USD to EUR',
				'GBP to JPY',
				'EUR to CAD',

				// Regional currencies
				'100 SEK to USD',
				'200 NOK to USD',
				'150 DKK to USD',
				'75 PLN to USD',
				'300 CZK to USD',
				'10000 HUF to USD'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'currencyconverter',
						name: 'Currency Converter',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should always include Google Search as fallback', () => {
			const testCases = [
				'random text',
				'some query',
				'unrecognized input',
				'2+3*4' // Even when other suggestions exist
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);
				expect(result).toContainEqual(
					expect.objectContaining({
						id: 'googlesearch',
						name: 'Google Search',
						confidence: expect.any(Number)
					})
				);
			});
		});

		it('should return suggestions with required properties', () => {
			const result = analyzeInput('2+3*4');
			expect(result.length).toBeGreaterThan(0);

			result.forEach((suggestion) => {
				expect(suggestion).toHaveProperty('id');
				expect(suggestion).toHaveProperty('name');
				expect(suggestion).toHaveProperty('icon');
				expect(suggestion).toHaveProperty('description');
				expect(suggestion).toHaveProperty('confidence');
				expect(suggestion).toHaveProperty('url');
				expect(suggestion).toHaveProperty('reason');
				expect(typeof suggestion.confidence).toBe('number');
				expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
				expect(suggestion.confidence).toBeLessThanOrEqual(1);
			});
		});

		it('should handle boundary values correctly', () => {
			const boundaryTests = [
				// Valid detection cases
				{ input: '{}', expectedSuggestion: 'jsonformat' }, // Minimal JSON
				{ input: '[]', expectedSuggestion: 'jsonformat' }, // Minimal JSON array
				{ input: '1634567890', expectedSuggestion: 'datetime' }, // 10-digit epoch
				{ input: '1634567890123', expectedSuggestion: 'datetime' }, // 13-digit epoch
				{ input: 'TWFu', expectedSuggestion: 'base64' }, // "Man" in Base64
				{ input: '#000', expectedSuggestion: 'colorpicker' }, // Shortest valid hex
				{ input: '#000000', expectedSuggestion: 'colorpicker' }, // Longest hex
				{ input: '5 + 3', expectedSuggestion: 'calculator' } // Clear math
			];

			boundaryTests.forEach(({ input, expectedSuggestion }) => {
				const result = analyzeInput(input);
				if (expectedSuggestion) {
					const hasExpectedSuggestion = result.some((s) => s.id === expectedSuggestion);
					expect(hasExpectedSuggestion).toBe(true);
				}
				// All results should have Google Search as fallback
				const hasGoogleSearch = result.some((s) => s.id === 'googlesearch');
				expect(hasGoogleSearch).toBe(true);
			});
		});

		it('should prioritize more specific suggestions', () => {
			const result = analyzeInput('sin(x) + cos(x)');

			// Function drawer should have higher confidence than calculator for complex expressions
			const functionDrawer = result.find((s) => s.id === 'functiondrawer');
			const calculator = result.find((s) => s.id === 'calculator');

			if (functionDrawer && calculator) {
				expect(functionDrawer.confidence).toBeGreaterThan(calculator.confidence);
			}
		});

		it('should handle edge cases gracefully', () => {
			const edgeCases = [
				'',
				'   ',
				'null',
				'undefined',
				'123',
				'{invalid json',
				'random-text-123',
				'!@#$%^&*()',
				'a', // Single character
				'ab', // Two characters
				'123abc', // Mixed numbers and letters
				'special chars: àáâãäåæçèéêë',
				'unicode: 你好世界',
				'emoji: 🚀🌟✨',
				'very long text that goes on and on without any specific pattern that would match our analyzers but is still valid text input',
				'ALLUPPERCASE',
				'alllowercase',
				'MixedCaseText',
				'numbers123mixed456with789text',
				'    leading and trailing spaces    ',
				'\n\ntext with newlines\n\n',
				'\t\ttabbed text\t\t'
			];

			edgeCases.forEach((input) => {
				expect(() => analyzeInput(input)).not.toThrow();
			});
		});
	});

	describe('getShortcutMapping', () => {
		it('should return a mapping of shortcuts to app IDs', () => {
			const mapping = getShortcutMapping();
			expect(mapping).toHaveProperty('c', 'calculator');
			expect(mapping).toHaveProperty('f', 'functiondrawer');
			expect(mapping).toHaveProperty('u', 'unitconverter');
			expect(mapping).toHaveProperty('t', 'translator');
			expect(mapping).toHaveProperty('g', 'googlesearch');
			expect(mapping).toHaveProperty('d', 'datetime');
			expect(mapping).toHaveProperty('m', 'currencyconverter');
			expect(mapping).toHaveProperty('p', 'colorpicker');
			expect(mapping).toHaveProperty('s', 'stocktracker');
			expect(mapping).toHaveProperty('w', 'urlexaminer');
			expect(mapping).toHaveProperty('b', 'base64');
			expect(mapping).toHaveProperty('j', 'jsonformat');
		});

		it('should have unique shortcuts for each app', () => {
			const mapping = getShortcutMapping();
			const shortcuts = Object.keys(mapping);
			const uniqueShortcuts = [...new Set(shortcuts)];
			expect(shortcuts.length).toBe(uniqueShortcuts.length);
		});

		it('should have unique app IDs', () => {
			const mapping = getShortcutMapping();
			const appIds = Object.values(mapping);
			const uniqueAppIds = [...new Set(appIds)];
			expect(appIds.length).toBe(uniqueAppIds.length);
		});
	});
});

describe('URL Generation', () => {
	it('should generate correct URLs for different inputs', () => {
		const testCases = [
			{
				input: '2+3*4',
				expectedId: 'calculator',
				expectedUrlPattern: /calculator\?expression=/
			},
			{
				input: '10 meters to feet',
				expectedId: 'unitconverter',
				expectedUrlPattern: /unitconverter\?/
			},
			{
				input: '#FF5733',
				expectedId: 'colorpicker',
				expectedUrlPattern: /colorpicker\?hex=/
			},
			{
				input: '$AAPL',
				expectedId: 'stocktracker',
				expectedUrlPattern: /stocktracker\?stock=/
			},
			{
				input: 'https://example.com',
				expectedId: 'urlexaminer',
				expectedUrlPattern: /urlexaminer\?input=/
			},
			{
				input: '{"key": "value"}',
				expectedId: 'jsonformat',
				expectedUrlPattern: /jsonformat\?input=/
			},
			{
				input: 'SGVsbG8gV29ybGQ=',
				expectedId: 'base64',
				expectedUrlPattern: /base64\?input=/
			},
			{
				input: 'translate hello to spanish',
				expectedId: 'translator',
				expectedUrlPattern: /translator\?/
			}
		];

		testCases.forEach(({ input, expectedId, expectedUrlPattern }) => {
			const result = analyzeInput(input);
			const suggestion = result.find((s) => s.id === expectedId);

			expect(suggestion).toBeDefined();
			expect(suggestion?.url).toMatch(expectedUrlPattern);
		});
	});

	it('should properly encode URL parameters', () => {
		const result = analyzeInput('{"key with spaces": "value & more"}');
		const jsonSuggestion = result.find((s) => s.id === 'jsonformat');

		expect(jsonSuggestion?.url).toContain(
			encodeURIComponent('{"key with spaces": "value & more"}')
		);
	});
});

describe('Complex Input Ordering Tests', () => {
	describe('Multiple analyzer matches', () => {
		it('should prioritize JSON over unit conversion for {"input": "10 kg to lb"}', () => {
			const result = analyzeInput('{"input": "10 kg to lb"}');

			// Should detect JSON but NOT unit conversion (since it's inside structured data)
			const jsonSuggestion = result.find((s) => s.id === 'jsonformat');
			const unitSuggestion = result.find((s) => s.id === 'unitconverter');

			expect(jsonSuggestion).toBeDefined();
			expect(unitSuggestion).toBeUndefined(); // Should not detect patterns inside JSON

			// JSON should be the top suggestion
			expect(result[0].id).toBe('jsonformat');
			if (jsonSuggestion) {
				expect(jsonSuggestion.confidence).toBe(0.95);
			}
		});

		it('should prioritize URL over time conversion for URLs with time-like patterns', () => {
			const testCases = [
				'https://www.google.com/11amedt',
				'https://example.com/12345678',
				'https://api.test.com/endpoint?timestamp=1634567890',
				'https://site.com/path/2023-12-25'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);

				const urlSuggestion = result.find((s) => s.id === 'urlexaminer');
				const timeSuggestion = result.find((s) => s.id === 'datetime');

				expect(urlSuggestion).toBeDefined();

				// If time suggestion exists, URL should have higher confidence
				if (timeSuggestion && urlSuggestion) {
					expect(urlSuggestion.confidence).toBeGreaterThan(timeSuggestion.confidence);

					const urlIndex = result.findIndex((s) => s.id === 'urlexaminer');
					const timeIndex = result.findIndex((s) => s.id === 'datetime');
					expect(urlIndex).toBeLessThan(timeIndex);
				}
			});
		});

		it('should prioritize JSON over color detection for {"color": "#FF5733"}', () => {
			const result = analyzeInput('{"color": "#FF5733"}');

			const jsonSuggestion = result.find((s) => s.id === 'jsonformat');
			const colorSuggestion = result.find((s) => s.id === 'colorpicker');

			expect(jsonSuggestion).toBeDefined();
			expect(colorSuggestion).toBeUndefined(); // Should not detect patterns inside JSON

			// JSON should be the top suggestion
			expect(result[0].id).toBe('jsonformat');
			if (jsonSuggestion) {
				expect(jsonSuggestion.confidence).toBe(0.95);
			}
		});

		it('should prioritize JSON over stock tracking for {"stock": "$AAPL"}', () => {
			const result = analyzeInput('{"stock": "$AAPL"}');

			const jsonSuggestion = result.find((s) => s.id === 'jsonformat');
			const stockSuggestion = result.find((s) => s.id === 'stocktracker');

			expect(jsonSuggestion).toBeDefined();
			expect(stockSuggestion).toBeUndefined(); // Should not detect patterns inside JSON

			// JSON should be the top suggestion
			expect(result[0].id).toBe('jsonformat');
			if (jsonSuggestion) {
				expect(jsonSuggestion.confidence).toBe(0.95);
			}
		});

		it('should prioritize URL over math for URLs with math-like patterns', () => {
			const testCases = [
				'https://example.com/calc?expr=2+3*4',
				'https://api.math.com/calculate/5+10',
				'https://calculator.com/result?expression=100/4+6'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);

				const urlSuggestion = result.find((s) => s.id === 'urlexaminer');
				const mathSuggestion = result.find((s) => s.id === 'calculator');

				expect(urlSuggestion).toBeDefined();

				// If math suggestion exists, URL should have higher confidence
				if (mathSuggestion && urlSuggestion) {
					expect(urlSuggestion.confidence).toBeGreaterThan(mathSuggestion.confidence);

					const urlIndex = result.findIndex((s) => s.id === 'urlexaminer');
					const mathIndex = result.findIndex((s) => s.id === 'calculator');
					expect(urlIndex).toBeLessThan(mathIndex);
				}
			});
		});

		it('should prioritize cURL over URL for cURL commands', () => {
			const testCases = [
				'curl https://api.example.com/data',
				'curl -X POST https://api.example.com/users',
				'curl -H "Content-Type: application/json" https://api.example.com'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);

				const urlSuggestion = result.find((s) => s.id === 'urlexaminer');
				expect(urlSuggestion).toBeDefined();

				// cURL should have higher confidence (0.95) than plain URL (0.9)
				if (urlSuggestion) {
					expect(urlSuggestion.confidence).toBe(0.95);
					expect(urlSuggestion.reason).toContain('curl');
				}
			});
		});

		it('should prioritize translation over other analyzers for complex translation commands', () => {
			const testCases = [
				'translate "2+3*4" to spanish',
				'translate "#FF5733" to french',
				'translate "$AAPL" to german'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);

				const translationSuggestion = result.find((s) => s.id === 'translator');
				expect(translationSuggestion).toBeDefined();

				// Translation should have very high confidence (0.95)
				if (translationSuggestion) {
					expect(translationSuggestion.confidence).toBe(0.95);

					// Translation should appear first
					expect(result[0].id).toBe('translator');
				}
			});
		});

		it('should handle JSON arrays with mixed content types', () => {
			const testCases = [
				'[{"amount": "10 kg to lb"}, {"color": "#FF5733"}]',
				'[{"expression": "2+3*4"}, {"url": "https://example.com"}]',
				'[{"stock": "$AAPL"}, {"timestamp": 1634567890}]'
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);

				const jsonSuggestion = result.find((s) => s.id === 'jsonformat');
				expect(jsonSuggestion).toBeDefined();

				// JSON should be the top suggestion
				expect(result[0].id).toBe('jsonformat');
				if (jsonSuggestion) {
					expect(jsonSuggestion.confidence).toBeGreaterThanOrEqual(0.95);
				}
			});
		});

		it('should handle Base64 strings that look like other patterns', () => {
			const testCases = [
				'MjIzKzMqNA==', // "2+3*4" in Base64
				'IzAwRkY1NzMz', // "#FF5733" in Base64
				'JEFBUEw=', // "$AAPL" in Base64
				'eyJrZXkiOiAidmFsdWUifQ==' // '{"key": "value"}' in Base64
			];

			testCases.forEach((input) => {
				const result = analyzeInput(input);

				const base64Suggestion = result.find((s) => s.id === 'base64');
				expect(base64Suggestion).toBeDefined();

				// Base64 should have reasonable confidence
				if (base64Suggestion) {
					expect(base64Suggestion.confidence).toBeGreaterThanOrEqual(0.6);
				}
			});
		});

		it('should properly order suggestions by confidence for complex inputs', () => {
			const testCases = [
				{
					input: '{"math": "2+3*4", "color": "#FF5733"}',
					expectedTopSuggestion: 'jsonformat'
				},
				{
					input: 'curl https://api.example.com/calculate?expr=2+3*4',
					expectedTopSuggestion: 'urlexaminer'
				},
				{
					input: 'translate "convert 10 kg to lb" to spanish',
					expectedTopSuggestion: 'translator'
				},
				{
					input: 'sin(x) + cos(y)',
					expectedTopSuggestion: 'functiondrawer'
				},
				{
					input: '100°F to celsius',
					expectedTopSuggestion: 'unitconverter'
				}
			];

			testCases.forEach(({ input, expectedTopSuggestion }) => {
				const result = analyzeInput(input);

				expect(result.length).toBeGreaterThan(0);
				expect(result[0].id).toBe(expectedTopSuggestion);

				// Verify suggestions are ordered by confidence descending
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].confidence).toBeGreaterThanOrEqual(result[i + 1].confidence);
				}
			});
		});

		it('should handle edge cases with multiple matches', () => {
			const testCases = [
				{
					input: 'https://example.com/data.json?content={"key":"value"}',
					description: 'URL with JSON in query parameter'
				},
				{
					input: '{"url": "https://example.com", "calculation": "2+3*4"}',
					description: 'JSON containing URL and math expression'
				},
				{
					input: 'translate https://example.com/translate?text=hello to spanish',
					description: 'Translation command with URL'
				},
				{
					input: '{"timestamp": 1634567890, "base64": "SGVsbG8gV29ybGQ="}',
					description: 'JSON with timestamp and base64'
				}
			];

			testCases.forEach(({ input }) => {
				const result = analyzeInput(input);

				expect(result.length).toBeGreaterThan(0);

				// All suggestions should have valid confidence scores
				result.forEach((suggestion) => {
					expect(suggestion.confidence).toBeGreaterThan(0);
					expect(suggestion.confidence).toBeLessThanOrEqual(1);
				});

				// Results should be sorted by confidence descending
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].confidence).toBeGreaterThanOrEqual(result[i + 1].confidence);
				}

				// Google search should always be present as fallback
				const googleSuggestion = result.find((s) => s.id === 'googlesearch');
				expect(googleSuggestion).toBeDefined();
				if (googleSuggestion) {
					expect(googleSuggestion.confidence).toBe(0.1);
				}
			});
		});

		it('should maintain consistent confidence values across similar inputs', () => {
			const similarInputs = [
				'{"test": "value"}',
				'{"different": "content"}',
				'{"another": "example"}'
			];

			const confidenceValues = similarInputs.map((input) => {
				const result = analyzeInput(input);
				const jsonSuggestion = result.find((s) => s.id === 'jsonformat');
				return jsonSuggestion?.confidence;
			});

			// All should have the same confidence for valid JSON
			expect(confidenceValues.every((conf) => conf === 0.95)).toBe(true);
		});
	});

	describe('Analyzer priority verification', () => {
		it('should have expected confidence ranges for different analyzer types', () => {
			const testCases = [
				{
					input: 'curl https://api.example.com',
					expectedId: 'urlexaminer',
					expectedConfidence: 0.95
				},
				{ input: 'translate hello to spanish', expectedId: 'translator', expectedConfidence: 0.95 },
				{ input: '2+3*4', expectedId: 'calculator', expectedConfidence: 0.95 },
				{ input: 'sin(x) + cos(y)', expectedId: 'functiondrawer', expectedConfidence: 0.9 },
				{ input: '{"key": "value"}', expectedId: 'jsonformat', expectedConfidence: 0.95 },
				{ input: 'https://example.com', expectedId: 'urlexaminer', expectedConfidence: 0.9 },
				{ input: '10 kg to lb', expectedId: 'unitconverter', expectedConfidence: 0.9 },
				{ input: '$AAPL', expectedId: 'stocktracker', expectedConfidence: 0.8 },
				{ input: 'google search', expectedId: 'googlesearch', expectedConfidence: 0.1 }
			];

			testCases.forEach(({ input, expectedId, expectedConfidence }) => {
				const result = analyzeInput(input);
				const suggestion = result.find((s) => s.id === expectedId);

				expect(suggestion).toBeDefined();
				if (suggestion) {
					expect(suggestion.confidence).toBe(expectedConfidence);
				}
			});
		});
	});
});
