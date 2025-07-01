<script lang="ts">
	let inputJson = '';
	let outputJson = '';
	let errorMessage = '';
	let isValid = false;
	let mode: 'format' | 'minify' | 'validate' = 'format';
	let indentSize = 2;

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
				value.forEach(item => traverse(item, currentDepth + 1));
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
		}
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
					Object.keys(obj).forEach(key => {
						keys.add(key);
						extractKeysRecursive(obj[key]);
					});
				} else if (Array.isArray(obj)) {
					obj.forEach(item => extractKeysRecursive(item));
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
		<h2 class="text-2xl font-bold text-gray-800 mb-2">JSON Formatter</h2>
		<p class="text-gray-600">Format, validate, and analyze JSON data</p>
	</div>

	<!-- Mode Selection -->
	<div class="flex justify-center">
		<div class="bg-gray-100 p-1 rounded-lg flex">
			<button
				on:click={() => {mode = 'format'; processJson();}}
				class="px-4 py-2 rounded-md transition-all {
					mode === 'format' 
						? 'bg-blue-500 text-white shadow' 
						: 'text-gray-600 hover:text-gray-800'
				}"
			>
				Format
			</button>
			<button
				on:click={() => {mode = 'minify'; processJson();}}
				class="px-4 py-2 rounded-md transition-all {
					mode === 'minify' 
						? 'bg-blue-500 text-white shadow' 
						: 'text-gray-600 hover:text-gray-800'
				}"
			>
				Minify
			</button>
			<button
				on:click={() => {mode = 'validate'; processJson();}}
				class="px-4 py-2 rounded-md transition-all {
					mode === 'validate' 
						? 'bg-blue-500 text-white shadow' 
						: 'text-gray-600 hover:text-gray-800'
				}"
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
        <select id="indent-size" bind:value={indentSize} on:change={processJson} class="px-3 py-1 border border-gray-300 rounded">
					<option value={2}>2 spaces</option>
					<option value={4}>4 spaces</option>
					<option value={8}>8 spaces</option>
				</select>
			</div>
		</div>
	{/if}

	<!-- Input Area -->
	<div class="space-y-4">
		<div class="flex justify-between items-center">
			<label for="json-input" class="block text-sm font-medium text-gray-700">
				JSON Input
			</label>
			<button
				on:click={loadSample}
				class="text-sm text-blue-600 hover:text-blue-800 underline"
			>
				Load Sample
			</button>
		</div>
		
		<textarea
			id="json-input"
			bind:value={inputJson}
			placeholder="Paste your JSON here..."
			class="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
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
		<div class="flex gap-2 flex-wrap">
			<button
				on:click={copyToClipboard}
				disabled={!outputJson || !isValid}
				class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
			>
				📋 Copy Result
			</button>
			<button
				on:click={extractKeys}
				disabled={!isValid}
				class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
			>
				🔑 Extract Keys
			</button>
			<button
				on:click={clearAll}
				class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
			>
				🗑️ Clear All
			</button>
		</div>

		<!-- Error Message -->
		{#if errorMessage}
			<div class="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
				⚠️ {errorMessage}
			</div>
		{/if}

		<!-- JSON Statistics -->
		{#if isValid && inputJson.trim()}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
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
      <label for="json-output" class="block text-sm font-medium text-gray-700 mb-2">
        Result ({mode === 'format' ? 'Formatted' : mode === 'minify' ? 'Minified' : 'Validation'} JSON)
      </label>
      <textarea
        id="json-output"
				value={outputJson}
				readonly
				class="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 resize-none font-mono text-sm"
				placeholder="Processed JSON will appear here..."
			></textarea>
		</div>
	</div>
</div> 