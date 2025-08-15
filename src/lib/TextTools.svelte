<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import T from './T.svelte';

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
		{ id: 'cleanupPaste', name: 'Fix Pasted Text', description: 'Fix clipped lines and trailing spaces' },
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
			case 'cleanupPaste':
				return fixClippedLinesAndTrailingSpaces(text);
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
	
	function fixClippedLinesAndTrailingSpaces(text: string): string {
		// Split the text into lines
		let lines = text.split('\n');
		
		// Skip if there aren't enough lines to analyze
		if (lines.length < 3) {
			return text.replace(/[ \t]+$/gm, '');
		}
		
		// Step 1: Check if all lines (except first and last) have the same length with spaces
		const linesWithSpaces = lines.slice(1, -1).map(line => line.length);
		const commonLength = linesWithSpaces[0];
		const allSameLength = linesWithSpaces.every(len => len === commonLength);
		
		if (allSameLength && commonLength > 2) {
			// Step 2: Check if lines should be combined based on the specified conditions
			const processedLines = [];
			let i = 0;
			
			// Always keep the first line as is
			processedLines.push(lines[0]);
			i = 1;
			
			// Process middle lines
			while (i < lines.length - 1) {
				const currentLine = lines[i];
				
				// Check if this line should be combined with the next
				if (currentLine.length === commonLength) {
					const lastChar = currentLine.charAt(currentLine.length - 1);
					const secondLastChar = currentLine.length > 1 ? currentLine.charAt(currentLine.length - 2) : '';
					
					// Combine if last char is not space OR second-last char is not space
					if (lastChar !== ' ' || secondLastChar !== ' ') {
						const nextLine = lines[i + 1];
						processedLines.push(currentLine + nextLine.trimStart());
						i += 2; // Skip the next line
						continue;
					}
				}
				
				// If no combining was done, add the line as is
				processedLines.push(currentLine);
				i++;
			}
			
			// Add the last line if we didn't combine it
			if (i < lines.length) {
				processedLines.push(lines[i]);
			}
			
			lines = processedLines;
		}
		
		// Step 3: Always remove trailing spaces from all lines
		return lines.map(line => line.replace(/[ \t]+$/g, '')).join('\n');
	}

	function getStats(text: string) {
		const words = text.trim() ? text.trim().split(/\s+/).length : 0;
		const characters = text.length;
		const charactersNoSpaces = text.replace(/\s/g, '').length;
		const lines = text.split('\n').length;
		const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
		const bytes = new TextEncoder().encode(text).length;

		return { words, characters, charactersNoSpaces, lines, paragraphs, bytes };
	}

	$effect(() => {
		if (activeOperation === 'wordCount') {
			const stats = getStats(inputText);
			outputText = `Words: ${stats.words}
Characters: ${stats.characters}
Characters (no spaces): ${stats.charactersNoSpaces}
Bytes: ${stats.bytes}
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
		<p class="text-gray-600"><T>Transform and analyze your text with various utilities</T></p>
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
				<div class="font-medium"><T key={operation.name} /></div>
				<div class="text-xs opacity-80"><T key={operation.description} /></div>
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
