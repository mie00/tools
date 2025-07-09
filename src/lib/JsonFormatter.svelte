<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let inputJson = '';
	let outputJson = '';
	let errorMessage = '';
	let isValid = false;
	let mode: 'format' | 'minify' | 'validate' = 'format';
	let indentSize = 2;
	let errorPosition: number | null = null;
	let highlightedErrorJson = '';

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

	let stats: JsonStats = {
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

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			if (mode !== 'format') {
				params.set('operation', mode);
			} else {
				params.delete('operation');
			}

			if (inputJson) {
				params.set('input', inputJson);
			} else {
				params.delete('input');
			}

			if (indentSize !== 2) {
				params.set('indent', indentSize.toString());
			} else {
				params.delete('indent');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	function loadFromUrl() {
		const operation = $page.url.searchParams.get('operation');
		const input = $page.url.searchParams.get('input');
		const indent = $page.url.searchParams.get('indent');

		if (
			operation &&
			(operation === 'format' || operation === 'minify' || operation === 'validate')
		) {
			mode = operation;
		}

		if (input) {
			inputJson = input;
		}

		if (indent) {
			const indentValue = parseInt(indent);
			if (!isNaN(indentValue) && indentValue >= 1 && indentValue <= 8) {
				indentSize = indentValue;
			}
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
				Object.entries(value).forEach(([key, val]) => {
					stats.keys++;
					traverse(val, currentDepth + 1);
				});
			}
		}

		traverse(obj, depth);
		return stats;
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

		try {
			const parsed = JSON.parse(inputJson);
			isValid = true;
			errorPosition = null;
			highlightedErrorJson = '';

			// Generate stats
			const analyzed = analyzeJson(parsed);
			stats = {
				...analyzed,
				size: formatBytes(new Blob([inputJson]).size)
			};

			// Process based on mode
			switch (mode) {
				case 'format':
					outputJson = JSON.stringify(parsed, null, indentSize);
					break;
				case 'minify':
					outputJson = JSON.stringify(parsed);
					break;
				case 'validate':
					outputJson = `✅ Valid JSON!\n\nFormatted version:\n${JSON.stringify(parsed, null, 2)}`;
					break;
			}
		} catch (error) {
			isValid = false;
			errorMessage = error instanceof Error ? error.message : 'Invalid JSON';
			outputJson = '';

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
  ]
}`;
		processJson();
	}

	function extractKeys() {
		try {
			const parsed = JSON.parse(inputJson);
			const keys = new Set<string>();

			function extractKeysRecursive(obj: any) {
				if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
					Object.keys(obj).forEach((key) => {
						keys.add(key);
						extractKeysRecursive(obj[key]);
					});
				} else if (Array.isArray(obj)) {
					obj.forEach((item) => extractKeysRecursive(item));
				}
			}

			extractKeysRecursive(parsed);
			outputJson = Array.from(keys).sort().join('\n');
		} catch (error) {
			errorMessage = 'Cannot extract keys from invalid JSON';
		}
	}

	// Auto-process when input changes
	$: if (inputJson !== undefined) {
		processJson();
	}
</script>

<div class="space-y-6">
	<div class="text-center">
		<h2 class="mb-2 text-2xl font-bold text-gray-800">JSON Formatter</h2>
		<p class="text-gray-600">Format, validate, and analyze JSON data</p>
	</div>

	<!-- Mode Selection -->
	<div class="flex justify-center">
		<div class="flex rounded-lg bg-gray-100 p-1">
			<button
				on:click={() => {
					mode = 'format';
					processJson();
				}}
				class="rounded-md px-4 py-2 transition-all {mode === 'format'
					? 'bg-blue-500 text-white shadow'
					: 'text-gray-600 hover:text-gray-800'}"
			>
				Format
			</button>
			<button
				on:click={() => {
					mode = 'minify';
					processJson();
				}}
				class="rounded-md px-4 py-2 transition-all {mode === 'minify'
					? 'bg-blue-500 text-white shadow'
					: 'text-gray-600 hover:text-gray-800'}"
			>
				Minify
			</button>
			<button
				on:click={() => {
					mode = 'validate';
					processJson();
				}}
				class="rounded-md px-4 py-2 transition-all {mode === 'validate'
					? 'bg-blue-500 text-white shadow'
					: 'text-gray-600 hover:text-gray-800'}"
			>
				Validate
			</button>
		</div>
	</div>

	<!-- Settings -->
	{#if mode === 'format'}
		<div class="flex justify-center">
			<div class="flex items-center gap-2">
				<label for="indent-size" class="text-sm font-medium text-gray-700">Indent Size:</label>
				<select
					id="indent-size"
					bind:value={indentSize}
					on:change={processJson}
					class="rounded border border-gray-300 px-3 py-1"
				>
					<option value={2}>2 spaces</option>
					<option value={4}>4 spaces</option>
					<option value={8}>8 spaces</option>
				</select>
			</div>
		</div>
	{/if}

	<!-- Input Area -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<label for="json-input" class="block text-sm font-medium text-gray-700"> JSON Input </label>
			<button on:click={loadSample} class="text-sm text-blue-600 underline hover:text-blue-800">
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
				on:click={copyToClipboard}
				disabled={!outputJson || !isValid}
				class="rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300"
			>
				📋 Copy Result
			</button>
			<button
				on:click={extractKeys}
				disabled={!isValid}
				class="rounded-lg bg-purple-500 px-4 py-2 text-white transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-gray-300"
			>
				🔑 Extract Keys
			</button>
			<button
				on:click={clearAll}
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
					<div class="text-sm text-gray-600">Objects</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{stats.arrays}</div>
					<div class="text-sm text-gray-600">Arrays</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{stats.keys}</div>
					<div class="text-sm text-gray-600">Keys</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{stats.values}</div>
					<div class="text-sm text-gray-600">Values</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{stats.strings}</div>
					<div class="text-sm text-gray-600">Strings</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{stats.numbers}</div>
					<div class="text-sm text-gray-600">Numbers</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{stats.maxDepth}</div>
					<div class="text-sm text-gray-600">Max Depth</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{stats.size}</div>
					<div class="text-sm text-gray-600">Size</div>
				</div>
			</div>
		{/if}

		<!-- Output Area -->
		<div>
			<label for="json-output" class="mb-2 block text-sm font-medium text-gray-700">
				Result ({mode === 'format' ? 'Formatted' : mode === 'minify' ? 'Minified' : 'Validation'} JSON)
			</label>
			{#if !isValid && inputJson.trim()}
				<div
					class="h-40 w-full resize-none overflow-auto rounded-lg border border-red-300 bg-red-50 px-3 py-2 font-mono text-sm"
				>
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
