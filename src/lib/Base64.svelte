<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let inputText = '';
	let outputText = '';
	let mode: 'encode' | 'decode' = 'encode';
	let errorMessage = '';
	let fileInput: HTMLInputElement;

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			if (mode !== 'encode') {
				params.set('operation', mode);
			} else {
				params.delete('operation');
			}

			if (inputText) {
				params.set('input', inputText);
			} else {
				params.delete('input');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	function loadFromUrl() {
		const operation = $page.url.searchParams.get('operation');
		const input = $page.url.searchParams.get('input');

		if (operation && (operation === 'encode' || operation === 'decode')) {
			mode = operation;
		}

		if (input) {
			inputText = input;
		}
	}

	onMount(() => {
		loadFromUrl();
	});

	function encodeBase64(text: string): string {
		try {
			return btoa(unescape(encodeURIComponent(text)));
		} catch {
			throw new Error('Failed to encode text');
		}
	}

	function decodeBase64(text: string): string {
		try {
			return decodeURIComponent(escape(atob(text)));
		} catch {
			throw new Error('Invalid Base64 string');
		}
	}

	function processText() {
		errorMessage = '';
		try {
			if (mode === 'encode') {
				outputText = encodeBase64(inputText);
			} else {
				outputText = decodeBase64(inputText);
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
			outputText = '';
		}
		updateUrl();
	}

	function switchMode() {
		mode = mode === 'encode' ? 'decode' : 'encode';
		// Swap input and output when switching modes
		const temp = inputText;
		inputText = outputText;
		outputText = temp;
		processText();
	}

	function clearAll() {
		inputText = '';
		outputText = '';
		errorMessage = '';
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(outputText);
	}

	function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file) {
			const reader = new FileReader();

			if (
				file.type.startsWith('text/') ||
				file.name.endsWith('.txt') ||
				file.name.endsWith('.json') ||
				file.name.endsWith('.xml')
			) {
				// For text files, read as text
				reader.onload = (e) => {
					const result = e.target?.result as string;
					inputText = result;
					processText();
				};
				reader.readAsText(file);
			} else {
				// For binary files, read as data URL and extract base64
				reader.onload = (e) => {
					const result = e.target?.result as string;
					const base64 = result.split(',')[1]; // Remove data:type;base64, prefix
					if (mode === 'encode') {
						inputText = `[Binary file: ${file.name} (${file.type || 'unknown type'})]`;
						outputText = base64;
					} else {
						inputText = base64;
						processText();
					}
				};
				reader.readAsDataURL(file);
			}
		}
	}

	// Auto-process when input changes
	$: if (inputText !== undefined) {
		processText();
	}

	// Sample texts for demonstration
	const sampleTexts = {
		encode: 'Hello, World! 👋 This is a sample text to encode.',
		decode: 'SGVsbG8sIFdvcmxkISDwn5GLIFRoaXMgaXMgYSBzYW1wbGUgdGV4dCB0byBlbmNvZGUu'
	};

	function loadSample() {
		inputText = sampleTexts[mode];
		processText();
	}
</script>

<div class="space-y-6">
	<div class="text-center">
		<h2 class="mb-2 text-2xl font-bold text-gray-800">Base64 Encoder/Decoder</h2>
		<p class="text-gray-600">Encode and decode Base64 strings with support for files</p>
	</div>

	<!-- Mode Toggle -->
	<div class="flex justify-center">
		<div class="rounded-lg bg-gray-100 p-1">
			<button
				on:click={() => {
					mode = 'encode';
					processText();
				}}
				class="rounded-md px-4 py-2 transition-all {mode === 'encode'
					? 'bg-blue-500 text-white shadow'
					: 'text-gray-600 hover:text-gray-800'}"
			>
				Encode
			</button>
			<button
				on:click={() => {
					mode = 'decode';
					processText();
				}}
				class="rounded-md px-4 py-2 transition-all {mode === 'decode'
					? 'bg-blue-500 text-white shadow'
					: 'text-gray-600 hover:text-gray-800'}"
			>
				Decode
			</button>
		</div>
	</div>

	<!-- File Upload -->
	<div
		class="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-gray-400"
	>
		<input type="file" bind:this={fileInput} on:change={handleFileUpload} class="hidden" />
		<button
			on:click={() => fileInput.click()}
			class="inline-flex items-center rounded-lg bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600"
		>
			<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				></path>
			</svg>
			Upload File
		</button>
		<p class="mt-2 text-sm text-gray-500">
			Upload text files to {mode} or binary files to get Base64
		</p>
	</div>

	<!-- Input Area -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<label for="input-text" class="block text-sm font-medium text-gray-700">
				{mode === 'encode' ? 'Text to Encode' : 'Base64 to Decode'}
			</label>
			<button on:click={loadSample} class="text-sm text-blue-600 underline hover:text-blue-800">
				Load Sample
			</button>
		</div>

		<textarea
			id="input-text"
			bind:value={inputText}
			placeholder={mode === 'encode'
				? 'Enter text to encode...'
				: 'Enter Base64 string to decode...'}
			class="h-32 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
		></textarea>

		<!-- Action Buttons -->
		<div class="flex flex-wrap gap-2">
			<button
				on:click={switchMode}
				class="rounded-lg bg-purple-500 px-4 py-2 text-white transition-colors hover:bg-purple-600"
			>
				↕️ Switch & Process
			</button>
			<button
				on:click={copyToClipboard}
				disabled={!outputText}
				class="rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300"
			>
				📋 Copy Result
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

		<!-- Output Area -->
		<div>
			<label for="output-text" class="mb-2 block text-sm font-medium text-gray-700">
				{mode === 'encode' ? 'Encoded Base64' : 'Decoded Text'}
			</label>
			<textarea
				id="output-text"
				value={outputText}
				readonly
				class="h-32 w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm"
				placeholder={mode === 'encode'
					? 'Base64 encoded result will appear here...'
					: 'Decoded text will appear here...'}
			></textarea>
		</div>

		<!-- Info -->
		<div class="rounded-lg bg-blue-50 p-3 text-sm text-gray-600">
			<h4 class="mb-1 font-medium">ℹ️ Tips:</h4>
			<ul class="list-inside list-disc space-y-1">
				<li>Base64 encoding increases size by approximately 33%</li>
				<li>Upload text files to encode their content</li>
				<li>Upload binary files (images, documents) to get their Base64 representation</li>
				<li>Use "Switch & Process" to quickly reverse the operation</li>
			</ul>
		</div>
	</div>
</div>
