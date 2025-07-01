<script lang="ts">
	let inputText = '';
	let outputText = '';
	let mode: 'encode' | 'decode' = 'encode';
	let errorMessage = '';
	let fileInput: HTMLInputElement;

	function encodeBase64(text: string): string {
		try {
			return btoa(unescape(encodeURIComponent(text)));
		} catch (error) {
			throw new Error('Failed to encode text');
		}
	}

	function decodeBase64(text: string): string {
		try {
			return decodeURIComponent(escape(atob(text)));
		} catch (error) {
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
			
			if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.xml')) {
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
		<h2 class="text-2xl font-bold text-gray-800 mb-2">Base64 Encoder/Decoder</h2>
		<p class="text-gray-600">Encode and decode Base64 strings with support for files</p>
	</div>

	<!-- Mode Toggle -->
	<div class="flex justify-center">
		<div class="bg-gray-100 p-1 rounded-lg">
			<button
				on:click={() => {mode = 'encode'; processText();}}
				class="px-4 py-2 rounded-md transition-all {
					mode === 'encode' 
						? 'bg-blue-500 text-white shadow' 
						: 'text-gray-600 hover:text-gray-800'
				}"
			>
				Encode
			</button>
			<button
				on:click={() => {mode = 'decode'; processText();}}
				class="px-4 py-2 rounded-md transition-all {
					mode === 'decode' 
						? 'bg-blue-500 text-white shadow' 
						: 'text-gray-600 hover:text-gray-800'
				}"
			>
				Decode
			</button>
		</div>
	</div>

	<!-- File Upload -->
	<div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
		<input
			type="file"
			bind:this={fileInput}
			on:change={handleFileUpload}
			class="hidden"
		/>
		<button
			on:click={() => fileInput.click()}
			class="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
		>
			<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
			</svg>
			Upload File
		</button>
		<p class="mt-2 text-sm text-gray-500">
			Upload text files to {mode} or binary files to get Base64
		</p>
	</div>

	<!-- Input Area -->
	<div class="space-y-4">
		<div class="flex justify-between items-center">
			<label class="block text-sm font-medium text-gray-700">
				{mode === 'encode' ? 'Text to Encode' : 'Base64 to Decode'}
			</label>
			<button
				on:click={loadSample}
				class="text-sm text-blue-600 hover:text-blue-800 underline"
			>
				Load Sample
			</button>
		</div>
		
		<textarea
			bind:value={inputText}
			placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 string to decode...'}
			class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
		></textarea>

		<!-- Action Buttons -->
		<div class="flex gap-2 flex-wrap">
			<button
				on:click={switchMode}
				class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
			>
				↕️ Switch & Process
			</button>
			<button
				on:click={copyToClipboard}
				disabled={!outputText}
				class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
			>
				📋 Copy Result
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

		    <!-- Output Area -->
    <div>
      <label for="output-text" class="block text-sm font-medium text-gray-700 mb-2">
        {mode === 'encode' ? 'Encoded Base64' : 'Decoded Text'}
      </label>
      <textarea
        id="output-text"
				value={outputText}
				readonly
				class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 resize-none font-mono text-sm"
				placeholder={mode === 'encode' ? 'Base64 encoded result will appear here...' : 'Decoded text will appear here...'}
			></textarea>
		</div>

		<!-- Info -->
		<div class="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
			<h4 class="font-medium mb-1">ℹ️ Tips:</h4>
			<ul class="list-disc list-inside space-y-1">
				<li>Base64 encoding increases size by approximately 33%</li>
				<li>Upload text files to encode their content</li>
				<li>Upload binary files (images, documents) to get their Base64 representation</li>
				<li>Use "Switch & Process" to quickly reverse the operation</li>
			</ul>
		</div>
	</div>
</div> 