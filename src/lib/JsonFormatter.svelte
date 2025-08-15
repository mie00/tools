<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import T from './T.svelte';

	let inputJson = $state('');
	let outputJson = $state('');
	let errorMessage = $state('');
	let isValid = $state(false);
	let indentSize = $state(2);
	let minified = $state(false);
	let rawOutput = $state(false);
	let jqQuery = $state('');
	let errorPosition: number | null = $state(null);
	let highlightedErrorJson = $state('');

	interface JsonStats {
		keys: number;
		values: number;
		arrays: number;
		objects: number;
		strings: number;
		numbers: number;
		booleans: number;
		nulls: number;
		maxDepth: number;
		size: string;
	}

	let stats: JsonStats = $state({
		keys: 0,
		values: 0,
		arrays: 0,
		objects: 0,
		strings: 0,
		numbers: 0,
		booleans: 0,
		nulls: 0,
		maxDepth: 0,
		size: '0 B'
	});

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			// Store input JSON
			if (inputJson) {
				params.set('input', inputJson);
			} else {
				params.delete('input');
			}

			// Store formatting preferences
			if (indentSize !== 2) {
				params.set('indent', indentSize.toString());
			} else {
				params.delete('indent');
			}

			if (minified) {
				params.set('minified', 'true');
			} else {
				params.delete('minified');
			}
			
			// Store JQ parameters
			if (jqQuery) {
				params.set('jq', jqQuery);
			} else {
				params.delete('jq');
			}

			if (rawOutput) {
				params.set('raw', 'true');
			} else {
				params.delete('raw');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	function loadFromUrl() {
		const input = $page.url.searchParams.get('input');
		const indent = $page.url.searchParams.get('indent');
		const minifiedParam = $page.url.searchParams.get('minified');
		const jqParam = $page.url.searchParams.get('jq');
		const rawParam = $page.url.searchParams.get('raw');

		// Load input JSON
		if (input) {
			inputJson = input;
		}

		// Load formatting preferences
		if (indent) {
			const indentValue = parseInt(indent);
			if (!isNaN(indentValue) && indentValue >= 1 && indentValue <= 8) {
				indentSize = indentValue;
			}
		}

		if (minifiedParam === 'true') {
			minified = true;
		}

		// Load JQ parameters
		if (jqParam) {
			jqQuery = jqParam;
		}

		if (rawParam === 'true') {
			rawOutput = true;
		}
	}

	onMount(() => {
		loadFromUrl();
		if (inputJson) {
			processJson();
		}
	});

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function analyzeJson(obj: any, depth = 0): JsonStats {
		const stats: JsonStats = {
			keys: 0,
			values: 0,
			arrays: 0,
			objects: 0,
			strings: 0,
			numbers: 0,
			booleans: 0,
			nulls: 0,
			maxDepth: depth,
			size: '0 B'
		};

		function traverse(value: any, currentDepth: number) {
			stats.maxDepth = Math.max(stats.maxDepth, currentDepth);

			if (value === null) {
				stats.nulls++;
				stats.values++;
			} else if (typeof value === 'string') {
				stats.strings++;
				stats.values++;
			} else if (typeof value === 'number') {
				stats.numbers++;
				stats.values++;
			} else if (typeof value === 'boolean') {
				stats.booleans++;
				stats.values++;
			} else if (Array.isArray(value)) {
				stats.arrays++;
				stats.values++;
				value.forEach((item) => traverse(item, currentDepth + 1));
			} else if (typeof value === 'object') {
				stats.objects++;
				stats.values++;
				Object.entries(value).forEach(([_key, val]) => {
					stats.keys++;
					traverse(val, currentDepth + 1);
				});
			}
		}

		traverse(obj, depth);
		return stats;
	}

	interface PathSegment {
		type: 'property' | 'index' | 'array';
		value: string | number;
	}

	export function applyJqQuery(parsed: any, query: string, rawOutput = false): string {
		// Return the entire object if query is empty or just a dot
		if (!query || query === '.') {
			return minified || rawOutput ? 
				JSON.stringify(parsed) : 
				JSON.stringify(parsed, null, indentSize);
		}
		
		try {
			// Helper function to extract value using a path
			function extractValue(obj: any, path: string): any {
				// Special case: root object
				if (path === '.' || path === '') {
					return obj;
				}
				
				// Handle paths starting with a dot
				if (path.startsWith('.')) {
					path = path.substring(1);
				}
				
				// Process path segments
				let current = obj;
				const segments: PathSegment[] = [];
				let temp = '';
				let inBracket = false;
				let bracketContent = '';
				
				// Parse path into segments handling both dot notation and bracket notation
				for (let i = 0; i < path.length; i++) {
					const char = path[i];
					
					if (char === '.' && !inBracket) {
						if (temp) {
							segments.push({ type: 'property', value: temp });
							temp = '';
						}
					} else if (char === '[' && !inBracket) {
						if (temp) {
							segments.push({ type: 'property', value: temp });
							temp = '';
						}
						inBracket = true;
						bracketContent = '';
					} else if (char === ']' && inBracket) {
						inBracket = false;
						
						// Handle array notation []
						if (bracketContent === '') {
							// Empty brackets mean iterate over array elements
							// This will be processed to extract each item individually in the output
							segments.push({ type: 'array', value: '' });
						}
						// Handle quoted key ["key-name"]
						else if (bracketContent.startsWith('"') && bracketContent.endsWith('"')) {
							segments.push({ type: 'property', value: bracketContent.substring(1, bracketContent.length - 1) });
						}
						// Handle array index [0]
						else if (/^\d+$/.test(bracketContent)) {
							segments.push({ type: 'index', value: parseInt(bracketContent, 10) });
						}
					} else if (inBracket) {
						bracketContent += char;
					} else {
						temp += char;
					}
				}
				
				// Add the last segment if any
				if (temp) {
					segments.push({ type: 'property', value: temp });
				}
				
				// Process segments to navigate through the object
				for (let i = 0; i < segments.length; i++) {
					const segment = segments[i];
					
					if (segment.type === 'property') {
						if (current === null || typeof current !== 'object') {
							throw new Error(`Cannot access property '${segment.value}' of ${current === null ? 'null' : typeof current}`);
						}
						current = current[segment.value as string];
					} else if (segment.type === 'index') {
						if (!Array.isArray(current)) {
							throw new Error(`Cannot access index of non-array type: ${typeof current}`);
						}
						if (typeof segment.value === 'number' && segment.value >= current.length) {
							throw new Error(`Array index out of bounds: ${segment.value}, length: ${current.length}`);
						}
						current = current[segment.value as number];
					} else if (segment.type === 'array') {
						// Array iteration - get next segment if it exists
						const nextSegment = i < segments.length - 1 ? segments[i + 1] : null;
						
						if (!Array.isArray(current)) {
							throw new Error(`Expected array but got: ${typeof current}`);
						}
						
						
						if (nextSegment) {
							// Apply the next segment to each array element
							current = current.map((item: any) => {
								if (nextSegment.type === 'property') {
									return item[nextSegment.value];
								} else if (nextSegment.type === 'array' && Array.isArray(item)) {
									// This handles nested array iteration like .children[].name
									return item;
								} else {
									return item;
								}
							});
							
							// Handle arrays of arrays by flattening when necessary
							if (Array.isArray(current) && current.some(Array.isArray)) {
								// Flatten for complex arrays
								current = current.flat();
							}
							
							i++; // Skip the next segment as we've already processed it
						}
					}
				}
				
				return current;
			}
			
			// Apply the query to extract the result
			const result = extractValue(parsed, query);
			
			// Keep undefined values as undefined
			// No conversion to null needed
			
			// Handle array results specially to match jq behavior
			if (Array.isArray(result)) {
				// Check if the query ends with [] to determine how to format the result
				const endsWithArrayNotation = query.trim().endsWith('[]');
				
				if (endsWithArrayNotation) {
					// For queries ending with [], we should return each item individually concatenated
					if (rawOutput) {
						// In raw mode, arrays are output as one item per line
						return result.map((item: any) => {
							if (typeof item === 'string') {
								return item; // Return string directly without quotes
							} else {
								return JSON.stringify(item); // JSON encode non-string values
							}
						}).join('\n');
					} else {
						// In normal mode, format each array item individually
						return result.map((item: any) => 
							minified ? JSON.stringify(item) : JSON.stringify(item, null, indentSize)
						).join('\n');
					}
				} else {
					// For queries not ending with [], we should return the whole array as JSON
					return minified ? 
						JSON.stringify(result) : 
						JSON.stringify(result, null, indentSize);
				}
			}
			
			// Handle raw output mode for non-array results (-r flag)
			if (rawOutput && typeof result === 'string') {
				return result; // Return raw string without quotes
			}
			
			// Default: Format the result as JSON
			return minified ? 
				JSON.stringify(result) : 
				JSON.stringify(result, null, indentSize);
		} catch (error) {
			return `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	}

	interface ParseResult {
		objects: any[];
		success: boolean;
		partialSuccess?: boolean; // Indicates some objects parsed but others failed
		errors?: { line: number, content: string, error: string }[];
	}

	/**
	 * Parse input that might contain multiple JSON objects
	 * Returns an array of parsed JSON objects and error information
	 */
	function parseMultipleJson(text: string): ParseResult {
		// If empty, return empty array
		if (!text.trim()) {
			return { objects: [], success: false };
		}
		
		// Try to parse as a single JSON object or array first
		try {
			const parsed = JSON.parse(text);
			return { objects: [parsed], success: true };
		} catch (e) {
			// Not a single valid JSON, try multiple JSON objects
		}
		
		// Try to parse as NDJSON (newline-delimited JSON)
		const lines = text.split(/\r?\n/);
		const objects: any[] = [];
		const errors: { line: number, content: string, error: string }[] = [];
		let success = false;
		let partialSuccess = false;
		let hasContent = false;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;
			
			// Check if this line looks like it might be JSON (starts with { or [)
			if (line.startsWith('{') || line.startsWith('[')) {
				hasContent = true;
				
				try {
					const obj = JSON.parse(line);
					objects.push(obj);
					success = true;
				} catch (e) {
					// Record the error without attempting to fix it
					errors.push({
						line: i + 1,
						content: line,
						error: e instanceof Error ? e.message : 'Invalid JSON'
					});
				}
			}
		}
		
		// Check for partial success - some objects parsed but others failed
		if (objects.length > 0 && errors.length > 0) {
			partialSuccess = true;
		}
		
		if (objects.length > 0) {
			return { 
				objects, 
				success, 
				partialSuccess: partialSuccess || undefined, 
				errors: errors.length > 0 ? errors : undefined 
			};
		}
		
		// Only if we didn't find any JSON-like content with the line-by-line approach,
		// try the regex pattern matching as a fallback for embedded JSON objects
		if (!hasContent) {
			const jsonPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g;
			const matches = text.match(jsonPattern);
			
			if (matches) {
				const parsedObjects: any[] = [];
				const regexErrors: { line: number, content: string, error: string }[] = [];
				
				for (let i = 0; i < matches.length; i++) {
					const match = matches[i];
					try {
						const obj = JSON.parse(match);
						parsedObjects.push(obj);
						success = true;
					} catch (e) {
						// Record the error
						regexErrors.push({
							line: 0, // We don't know the line number here
							content: match,
							error: e instanceof Error ? e.message : 'Invalid JSON'
						});
					}
				}
				
				// Check for partial success - some objects parsed but others failed
				if (parsedObjects.length > 0 && regexErrors.length > 0) {
					partialSuccess = true;
				}
				
				if (parsedObjects.length > 0) {
					return { 
						objects: parsedObjects, 
						success,
						partialSuccess: partialSuccess || undefined,
						errors: regexErrors.length > 0 ? regexErrors : undefined 
					};
				}
				
				if (regexErrors.length > 0) {
					return { 
						objects: [], 
						success: false, 
						errors: regexErrors
					};
				}
			}
		}
		
		return { 
			objects: [], 
			success: false,
			errors: errors.length > 0 ? errors : undefined
		};
	}

	function processJson() {
		errorMessage = '';
		isValid = false;
		outputJson = '';
		errorPosition = null;
		highlightedErrorJson = '';

		if (!inputJson.trim()) {
			stats = {
				keys: 0,
				values: 0,
				arrays: 0,
				objects: 0,
				strings: 0,
				numbers: 0,
				booleans: 0,
				nulls: 0,
				maxDepth: 0,
				size: '0 B'
			};
			return;
		}

		// Parse multiple JSON objects if present
		const parseResult = parseMultipleJson(inputJson);
		
		// Check for complete failure or partial success
		if (parseResult.objects.length === 0) {
			// Complete failure - no valid JSON objects
			isValid = false;
			
			// Provide helpful error message about invalid JSON
			if (parseResult.errors && parseResult.errors.length > 0) {
				// Show information about specific errors
				const errorList = parseResult.errors.map(e => `Line ${e.line}: ${e.error}`).join('\n');
				errorMessage = `Invalid JSON found in input:\n${errorList}`;
				
				// Suggest fixes for common issues
				if (parseResult.errors.some(e => e.error.includes('Expected'))) {
					errorMessage += '\n\nCommon issues to check:\n- Missing quotes around property names\n- Single quotes instead of double quotes\n- Missing commas between properties';
				}
			} else {
				errorMessage = 'Invalid JSON: Could not parse input';
			}
			
			// Try to find the position of the error for better visual feedback
			try {
				JSON.parse(inputJson);
			} catch (error) {
				if (error instanceof SyntaxError) {
					const match = /at position (\d+)/.exec(error.message);
					if (match) {
						errorPosition = parseInt(match[1], 10);
					}
				}
				
				const escapeHtml = (unsafe: string) =>
					unsafe
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&#039;');
	
				if (errorPosition !== null && errorPosition < inputJson.length) {
					const before = escapeHtml(inputJson.substring(0, errorPosition));
					const char = escapeHtml(inputJson[errorPosition]);
					const after = escapeHtml(inputJson.substring(errorPosition + 1));
					highlightedErrorJson = `${before}<span class="bg-red-500 text-white px-1">${char}</span>${after}`;
				} else {
					highlightedErrorJson = escapeHtml(inputJson);
				}
			}
			return;
		} else if (parseResult.partialSuccess) {
			// Partial success - some objects parsed, others failed
			// Still mark as valid since we have some objects to work with
			isValid = true;
			
			// But show warning about partial failures
			if (parseResult.errors && parseResult.errors.length > 0) {
				const errorList = parseResult.errors.map(e => `Line ${e.line}: ${e.error}`).join('\n');
				errorMessage = `Warning: Some JSON objects failed to parse:\n${errorList}`;
			}
		} else if (!parseResult.success) {
			// This case shouldn't happen with our parser, but just to be safe
			isValid = false;
			errorMessage = 'Invalid JSON: Parser reported failure';
			return;
		}
		
		try {
			// Successfully parsed JSON
			isValid = true;
			const jsonObjects = parseResult.objects;
			const multipleObjects = jsonObjects.length > 1;
			const firstObject = jsonObjects[0];
			
			// Generate stats based on the first object
			const analyzed = analyzeJson(firstObject);
			stats = {
				...analyzed,
				size: formatBytes(new Blob([inputJson]).size)
			};
			
			// Process JSON output
			if (jqQuery) {
				// Apply JQ query if a query is provided
				if (multipleObjects) {
					// Process each object individually and join with newlines
					outputJson = jsonObjects.map((obj: any) => applyJqQuery(obj, jqQuery, rawOutput)).join('\n');
				} else {
					outputJson = applyJqQuery(firstObject, jqQuery, rawOutput);
				}
			} else {
				// Default formatting with minification option
				if (multipleObjects) {
					outputJson = jsonObjects.map((obj: any) => 
						minified ? JSON.stringify(obj) : JSON.stringify(obj, null, indentSize)
					).join('\n');
				} else {
					outputJson = minified ? JSON.stringify(firstObject) : JSON.stringify(firstObject, null, indentSize);
				}
			}
		} catch (error) {
			isValid = false;
			errorMessage = error instanceof Error ? error.message : 'Invalid JSON processing error';
			outputJson = '';

			// Handle the error display
			const escapeHtml = (unsafe: string) =>
				unsafe
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#039;');

			highlightedErrorJson = escapeHtml(inputJson);
		}
		
		updateUrl();
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(outputJson);
	}

	function clearAll() {
		inputJson = '';
		outputJson = '';
		errorMessage = '';
		isValid = false;
	}

	function loadSample() {
		inputJson = `{
  "name": "John Doe",
  "age": 30,
  "isActive": true,
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "zipCode": "10001"
  },
  "hobbies": ["reading", "swimming", "coding"],
  "spouse": null,
  "children": [
    {
      "name": "Jane",
      "age": 5
    },
    {
      "name": "Bob",
      "age": 8
    }
  ],
  "some-value1": "Special key with hyphen"
}`;
		processJson();
	}

	function extractJqPaths(obj: any, currentPath: string = '', paths: string[] = []): string[] {
		if (obj === null || typeof obj !== 'object') {
			paths.push(currentPath);
			return paths;
		}

		if (Array.isArray(obj)) {
			if (obj.length === 0) {
				paths.push(currentPath + '[]');
			} else {
				for (let i = 0; i < obj.length; i++) {
					extractJqPaths(obj[i], currentPath + '[]', paths);
				}
			}
		} else {
			const keys = Object.keys(obj);
			if (keys.length === 0) {
				paths.push(currentPath);
			} else {
				for (const key of keys) {
					const newPath = currentPath + 
						(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? 
							(currentPath ? '.' : '') + key : 
							(currentPath ? '.' : '') + '["' + key + '"]');
					extractJqPaths(obj[key], newPath, paths);
				}
			}
		}
		
		return paths;
	}

	function extractKeys() {
		// Use our multiple JSON parser to handle the input
		const parseResult = parseMultipleJson(inputJson);
		
		if (!parseResult.success || parseResult.objects.length === 0) {
			errorMessage = 'Cannot extract keys: Invalid JSON input';
			return;
		}
		
		try {
			// Collect all paths from all objects
			const allPaths = new Set<string>();
			
			// Process each JSON object
			for (const jsonObject of parseResult.objects) {
				const objectPaths = extractJqPaths(jsonObject);
				
				// Format paths in jq style and add to the combined set
				for (const path of objectPaths) {
					allPaths.add(path ? path : '.');
				}
			}
			
			// Sort and join all unique paths
			outputJson = Array.from(allPaths).sort().join('\n');
			isValid = true;
			
			// Clear any existing jqQuery to avoid processing
			jqQuery = '';
			updateUrl();
		} catch (error) {
			console.warn('Failed to extract keys from JSON:', error);
			errorMessage = 'Cannot extract keys from invalid JSON';
		}
	}

	// Auto-process when input changes - debounced
	let processTimeout: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (inputJson !== undefined) {
			clearTimeout(processTimeout);
			processTimeout = setTimeout(() => {
				processJson();
			}, 100);
		}
	});
</script>

<div class="space-y-6">
	<div class="text-center">
		<p class="text-gray-600">Format, validate, and analyze JSON data</p>
	</div>

	<!-- Title area - no mode selection needed -->

	<!-- Settings & JQ Input -->
	<div class="space-y-4">
		<!-- Common settings row -->
		<div class="flex justify-center">
			<div class="flex flex-wrap items-center gap-4">
				<!-- Formatting settings -->
				<div class="flex items-center gap-2">
					<label for="indent-size" class="text-sm font-medium text-gray-700"
						><T>Indent Size:</T></label
					>
					<select
						id="indent-size"
						bind:value={indentSize}
						onchange={processJson}
						class="rounded border border-gray-300 px-3 py-1"
					>
						<option value={2}>2 spaces</option>
						<option value={4}>4 spaces</option>
						<option value={8}>8 spaces</option>
					</select>
				</div>

				<div class="flex items-center gap-2">
					<label for="minify" class="text-sm font-medium text-gray-700"
						><T>Minify:</T></label
					>
					<input
						type="checkbox"
						id="minify"
						bind:checked={minified}
						onchange={processJson}
						class="h-4 w-4 rounded border-gray-300"
					/>
				</div>

				<!-- JQ specific settings -->
				<div class="flex items-center gap-2">
					<label for="raw-output" class="text-sm font-medium text-gray-700"
						><T>Raw Output (-r):</T></label
					>
					<input
						type="checkbox"
						id="raw-output"
						bind:checked={rawOutput}
						onchange={processJson}
						class="h-4 w-4 rounded border-gray-300"
					/>
				</div>
			</div>
		</div>

		<!-- JQ Query Input -->
		<div class="flex justify-center">
			<div class="w-full max-w-3xl">
				<label for="jq-query" class="mb-1 block text-sm font-medium text-gray-700"
					><T>JQ Query (optional):</T></label>
				<div class="flex gap-2">
					<input
						id="jq-query"
						type="text"
						bind:value={jqQuery}
						placeholder="e.g. .name, .children (full array), .children[] (elements concatenated)"
						onkeydown={(e) => { if (e.key === 'Enter') processJson(); }}
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
					/>
					<button
						onclick={processJson}
						class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
					>
						<T>Run</T>
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Input Area -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<label for="json-input" class="block text-sm font-medium text-gray-700"> JSON Input </label>
			<button onclick={loadSample} class="text-sm text-blue-600 underline hover:text-blue-800">
				Load Sample
			</button>
		</div>

		<textarea
			id="json-input"
			bind:value={inputJson}
			placeholder="Paste your JSON here..."
			class="h-40 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
		></textarea>

		<!-- Status Indicator -->
		<div class="flex items-center gap-2">
			{#if inputJson.trim()}
				<div class="flex items-center gap-1">
					{#if isValid}
						<span class="text-green-600">✅ Valid JSON</span>
					{:else}
						<span class="text-red-600">❌ Invalid JSON</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-wrap gap-2">
			<button
				onclick={copyToClipboard}
				disabled={!outputJson || !isValid}
				class="rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300"
			>
				📋 Copy Result
			</button>
			<button
				onclick={extractKeys}
				disabled={!isValid}
				class="rounded-lg bg-purple-500 px-4 py-2 text-white transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-gray-300"
			>
				🔑 Extract JQ Paths
			</button>
			<button
				onclick={clearAll}
				class="rounded-lg bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600"
			>
				🗑️ Clear All
			</button>
		</div>

		<!-- Error Message -->
		{#if errorMessage}
			<div class="rounded-lg border border-red-300 bg-red-100 p-3 text-red-700">
				⚠️ {errorMessage}
			</div>
		{/if}

		<!-- JSON Statistics -->
		{#if isValid && inputJson.trim()}
			<div class="grid grid-cols-2 gap-4 rounded-lg bg-blue-50 p-4 md:grid-cols-4">
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{stats.objects}</div>
					<div class="text-sm text-gray-600"><T>Objects</T></div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{stats.arrays}</div>
					<div class="text-sm text-gray-600"><T>Arrays</T></div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{stats.keys}</div>
					<div class="text-sm text-gray-600"><T>Keys</T></div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{stats.values}</div>
					<div class="text-sm text-gray-600"><T>Values</T></div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{stats.strings}</div>
					<div class="text-sm text-gray-600"><T>Strings</T></div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{stats.numbers}</div>
					<div class="text-sm text-gray-600"><T>Numbers</T></div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{stats.maxDepth}</div>
					<div class="text-sm text-gray-600"><T>Max Depth</T></div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{stats.size}</div>
					<div class="text-sm text-gray-600"><T>Size</T></div>
				</div>
			</div>
		{/if}

		<!-- Output Area -->
		<div>
			<label for="json-output" class="mb-2 block text-sm font-medium text-gray-700">
				{#if jqQuery}
					Result (JQ Query: {jqQuery} {rawOutput ? '(Raw Output)' : ''})
				{:else}
					Result ({minified ? 'Minified' : 'Formatted'} JSON)
				{/if}
			</label>
			{#if !isValid && inputJson.trim()}
				<div
					class="h-40 w-full resize-none overflow-auto rounded-lg border border-red-300 bg-red-50 px-3 py-2 font-mono text-sm"
				>
					<!-- Safe: highlightedErrorJson is escaped using escapeHtml() function -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<pre class="whitespace-pre-wrap">{@html highlightedErrorJson}</pre>
				</div>
			{:else}
				<textarea
					id="json-output"
					value={outputJson}
					readonly
					class="h-40 w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm"
					placeholder="Processed JSON will appear here..."
				></textarea>
			{/if}
		</div>
	</div>
</div>