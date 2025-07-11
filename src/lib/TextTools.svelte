<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let inputText = $state('');
	let outputText = $state('');
	let activeOperation = $state('uppercase');

	const operations = [
		{ id: 'uppercase', name: 'UPPERCASE', description: 'Convert to uppercase' },
		{ id: 'lowercase', name: 'lowercase', description: 'Convert to lowercase' },
		{ id: 'capitalize', name: 'Capitalize', description: 'Capitalize first letter of each word' },
		{ id: 'reverse', name: 'esreveR', description: 'Reverse the text' },
		{ id: 'removeSpaces', name: 'RemoveSpaces', description: 'Remove all spaces' },
		{ id: 'slugify', name: 'slug-ify', description: 'Convert to URL-friendly slug' },
		{ id: 'wordCount', name: 'Word Count', description: 'Count words, characters, etc.' },
		{ id: 'encode', name: 'URL Encode', description: 'URL encode the text' },
		{ id: 'decode', name: 'URL Decode', description: 'URL decode the text' }
	];

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			if (activeOperation !== 'uppercase') {
				params.set('utility', activeOperation);
			} else {
				params.delete('utility');
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
		const utility = $page.url.searchParams.get('utility');
		const input = $page.url.searchParams.get('input');

		if (utility && operations.some((op) => op.id === utility)) {
			activeOperation = utility;
		}

		if (input) {
			inputText = input;
		}
	}

	onMount(() => {
		loadFromUrl();
	});

	// Watch for state changes and update URL - debounced to prevent infinite loops
	let urlUpdateTimeout: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (typeof window !== 'undefined' && (activeOperation || inputText)) {
			clearTimeout(urlUpdateTimeout);
			urlUpdateTimeout = setTimeout(() => {
				updateUrl();
			}, 100);
		}
	});

	function transformText(operation: string, text: string): string {
		switch (operation) {
			case 'uppercase':
				return text.toUpperCase();
			case 'lowercase':
				return text.toLowerCase();
			case 'capitalize':
				return text.replace(
					/\w\S*/g,
					(txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
				);
			case 'reverse':
				return text.split('').reverse().join('');
			case 'removeSpaces':
				return text.replace(/\s+/g, '');
			case 'slugify':
				return text
					.toLowerCase()
					.trim()
					.replace(/[^\w\s-]/g, '')
					.replace(/[\s_-]+/g, '-')
					.replace(/^-+|-+$/g, '');
			case 'encode':
				return encodeURIComponent(text);
			case 'decode':
				try {
					return decodeURIComponent(text);
				} catch {
					return 'Invalid encoded text';
				}
			default:
				return text;
		}
	}

	function getStats(text: string) {
		const words = text.trim() ? text.trim().split(/\s+/).length : 0;
		const characters = text.length;
		const charactersNoSpaces = text.replace(/\s/g, '').length;
		const lines = text.split('\n').length;
		const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;

		return { words, characters, charactersNoSpaces, lines, paragraphs };
	}

	$effect(() => {
		if (activeOperation === 'wordCount') {
			const stats = getStats(inputText);
			outputText = `Words: ${stats.words}
Characters: ${stats.characters}
Characters (no spaces): ${stats.charactersNoSpaces}
Lines: ${stats.lines}
Paragraphs: ${stats.paragraphs}`;
		} else {
			outputText = transformText(activeOperation, inputText);
		}
	});

	function copyToClipboard() {
		navigator.clipboard.writeText(outputText);
	}

	function clearText() {
		inputText = '';
		outputText = '';
	}
</script>

<div class="space-y-6">
	<div class="text-center">
		<h2 class="mb-2 text-2xl font-bold text-gray-800">Text Tools</h2>
		<p class="text-gray-600">Transform and analyze your text with various utilities</p>
	</div>

	<!-- Operation Selection -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
		{#each operations as operation (operation.id)}
			<button
				onclick={() => (activeOperation = operation.id)}
				class="rounded-lg border p-3 text-sm transition-all duration-200 {activeOperation ===
				operation.id
					? 'border-blue-500 bg-blue-500 text-white shadow-lg'
					: 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'}"
			>
				<div class="font-medium">{operation.name}</div>
				<div class="text-xs opacity-80">{operation.description}</div>
			</button>
		{/each}
	</div>

	<!-- Input Area -->
	<div class="space-y-4">
		<div>
			<label for="input-text" class="mb-2 block text-sm font-medium text-gray-700">
				Input Text
			</label>
			<textarea
				id="input-text"
				bind:value={inputText}
				placeholder="Enter your text here..."
				class="h-32 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
			></textarea>
		</div>

		<!-- Action Buttons -->
		<div class="flex gap-2">
			<button
				onclick={copyToClipboard}
				disabled={!outputText}
				class="rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300"
			>
				Copy Result
			</button>
			<button
				onclick={clearText}
				class="rounded-lg bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600"
			>
				Clear
			</button>
		</div>

		<!-- Output Area -->
		<div>
			<label for="output-text" class="mb-2 block text-sm font-medium text-gray-700">
				Result {activeOperation === 'wordCount'
					? '(Statistics)'
					: `(${operations.find((op) => op.id === activeOperation)?.name})`}
			</label>
			<textarea
				id="output-text"
				value={outputText}
				readonly
				class="h-32 w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 {activeOperation ===
				'wordCount'
					? 'font-mono text-sm'
					: ''}"
				placeholder="Transformed text will appear here..."
			></textarea>
		</div>
	</div>
</div>
