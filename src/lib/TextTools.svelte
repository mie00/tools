<script lang="ts">
	let inputText = '';
	let outputText = '';
	let activeOperation = 'uppercase';

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

	function transformText(operation: string, text: string): string {
		switch (operation) {
			case 'uppercase':
				return text.toUpperCase();
			case 'lowercase':
				return text.toLowerCase();
			case 'capitalize':
				return text.replace(/\w\S*/g, (txt) => 
					txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
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
		const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
		
		return { words, characters, charactersNoSpaces, lines, paragraphs };
	}

	$: {
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
	}

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
		<h2 class="text-2xl font-bold text-gray-800 mb-2">Text Tools</h2>
		<p class="text-gray-600">Transform and analyze your text with various utilities</p>
	</div>

	<!-- Operation Selection -->
	<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
		{#each operations as operation}
			<button
				on:click={() => activeOperation = operation.id}
				class="p-3 rounded-lg border text-sm transition-all duration-200 {
					activeOperation === operation.id
						? 'bg-blue-500 text-white border-blue-500 shadow-lg'
						: 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
				}"
			>
				<div class="font-medium">{operation.name}</div>
				<div class="text-xs opacity-80">{operation.description}</div>
			</button>
		{/each}
	</div>

	<!-- Input Area -->
	  <div class="space-y-4">
    <div>
      <label for="input-text" class="block text-sm font-medium text-gray-700 mb-2">
        Input Text
      </label>
      <textarea
        id="input-text"
				bind:value={inputText}
				placeholder="Enter your text here..."
				class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
			></textarea>
		</div>

		<!-- Action Buttons -->
		<div class="flex gap-2">
			<button
				on:click={copyToClipboard}
				disabled={!outputText}
				class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
			>
				Copy Result
			</button>
			<button
				on:click={clearText}
				class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
			>
				Clear
			</button>
		</div>

		    <!-- Output Area -->
    <div>
      <label for="output-text" class="block text-sm font-medium text-gray-700 mb-2">
        Result {activeOperation === 'wordCount' ? '(Statistics)' : `(${operations.find(op => op.id === activeOperation)?.name})`}
      </label>
      <textarea
        id="output-text"
				value={outputText}
				readonly
				class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 resize-none {
					activeOperation === 'wordCount' ? 'font-mono text-sm' : ''
				}"
				placeholder="Transformed text will appear here..."
			></textarea>
		</div>
	</div>
</div> 