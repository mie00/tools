<script lang="ts">
	import { onMount } from 'svelte';

	interface Message {
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
	}

	let messages: Message[] = [];
	let input = '';
	let isLoading = false;
	let llmInference: any = null;
	let isModelLoaded = false;
	let loadingProgress = '';
	let chatContainer: HTMLDivElement;
	let webGpuSupported = false;

	// Model configuration
	const MODEL_CONFIG = {
		modelPath: 'https://storage.googleapis.com/mediapipe-models/llm_inference/gemma-1b-it-gpu-int4/1/gemma-1b-it-gpu-int4.task',
		maxTokens: 1000,
		topK: 40,
		temperature: 0.8,
		randomSeed: 101
	};

	onMount(async () => {
		await checkWebGpuSupport();
		if (webGpuSupported) {
			await initializeModel();
		}
	});

	async function checkWebGpuSupport() {
		if (!(navigator as any).gpu) {
			webGpuSupported = false;
			return;
		}

		try {
			const adapter = await (navigator as any).gpu.requestAdapter();
			if (adapter) {
				webGpuSupported = true;
			}
		} catch (error) {
			console.error('WebGPU not supported:', error);
			webGpuSupported = false;
		}
	}

	async function initializeModel() {
		try {
			loadingProgress = 'Initializing MediaPipe...';
			isLoading = true;

			// Import MediaPipe modules
			const { FilesetResolver, LlmInference } = await import('@mediapipe/tasks-genai');

			loadingProgress = 'Loading WASM files...';
			
			// Initialize the fileset resolver
			const genai = await FilesetResolver.forGenAiTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm'
			);

			loadingProgress = 'Downloading model... (this may take a few minutes)';

			// Create LLM inference instance
			llmInference = await LlmInference.createFromOptions(genai, {
				baseOptions: {
					modelAssetPath: MODEL_CONFIG.modelPath
				},
				maxTokens: MODEL_CONFIG.maxTokens,
				topK: MODEL_CONFIG.topK,
				temperature: MODEL_CONFIG.temperature,
				randomSeed: MODEL_CONFIG.randomSeed
			});

			loadingProgress = 'Model loaded successfully!';
			isModelLoaded = true;
			
			// Add welcome message
			const welcomeMessage: Message = {
				role: 'assistant',
				content: 'Hello! I\'m Gemma 3n running locally in your browser using MediaPipe. How can I help you today?',
				timestamp: new Date()
			};
			messages = [welcomeMessage];

		} catch (error) {
			console.error('Failed to initialize model:', error);
			loadingProgress = `Error: ${error instanceof Error ? error.message : 'Failed to initialize model'}`;
		} finally {
			isLoading = false;
		}
	}

	async function sendMessage() {
		if (!input.trim() || isLoading || !llmInference || !isModelLoaded) return;

		const userMessage: Message = {
			role: 'user',
			content: input.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		const userInput = input;
		input = '';
		isLoading = true;

		try {
			// Generate response using MediaPipe
			const response = await llmInference.generateResponse(userInput);
			
			const assistantMessage: Message = {
				role: 'assistant',
				content: response,
				timestamp: new Date()
			};

			messages = [...messages, assistantMessage];
		} catch (error) {
			const errorMessage: Message = {
				role: 'assistant',
				content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`,
				timestamp: new Date()
			};
			messages = [...messages, errorMessage];
		} finally {
			isLoading = false;
			scrollToBottom();
		}
	}

	async function sendMessageStreaming() {
		if (!input.trim() || isLoading || !llmInference || !isModelLoaded) return;

		const userMessage: Message = {
			role: 'user',
			content: input.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		const userInput = input;
		input = '';
		isLoading = true;

		// Create placeholder message for streaming
		const assistantMessage: Message = {
			role: 'assistant',
			content: '',
			timestamp: new Date()
		};
		messages = [...messages, assistantMessage];

		try {
			// Use streaming response
			await llmInference.generateResponse(userInput, (partialResult: string, done: boolean) => {
				// Update the last message with streaming content
				messages = messages.map((msg, index) => 
					index === messages.length - 1 
						? { ...msg, content: msg.content + partialResult }
						: msg
				);
				
				if (done) {
					isLoading = false;
				}
				scrollToBottom();
			});
		} catch (error) {
			// Replace the last message with error
			messages = messages.map((msg, index) => 
				index === messages.length - 1 
					? { ...msg, content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}` }
					: msg
			);
			isLoading = false;
		}
	}

	function clearChat() {
		messages = [];
		if (isModelLoaded) {
			const welcomeMessage: Message = {
				role: 'assistant',
				content: 'Chat cleared! How can I help you?',
				timestamp: new Date()
			};
			messages = [welcomeMessage];
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function scrollToBottom() {
		if (chatContainer) {
			setTimeout(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}, 10);
		}
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function downloadAlternativeModel() {
		window.open('https://www.kaggle.com/models/google/gemma-2/tensorFlow/2b-it-gpu-int8', '_blank');
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 rounded-lg bg-gray-50 p-4">
		<h2 class="mb-4 text-xl font-semibold text-gray-800">Local LLM Chat (MediaPipe)</h2>
		
		<!-- Status Information -->
		<div class="mb-4 flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<div class="h-3 w-3 rounded-full {webGpuSupported ? 'bg-green-500' : 'bg-red-500'}"></div>
				<span class="text-sm {webGpuSupported ? 'text-green-700' : 'text-red-700'}">
					{webGpuSupported ? 'WebGPU Supported' : 'WebGPU Not Supported'}
				</span>
			</div>

			{#if isModelLoaded}
				<div class="flex items-center gap-2">
					<div class="h-3 w-3 rounded-full bg-green-500"></div>
					<span class="text-sm text-green-700">Model Loaded</span>
				</div>

				<button
					on:click={clearChat}
					class="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
				>
					Clear Chat
				</button>
			{/if}
		</div>

		<!-- WebGPU Not Supported -->
		{#if !webGpuSupported}
			<div class="rounded-lg bg-red-50 p-4">
				<h3 class="mb-2 font-semibold text-red-800">WebGPU Not Supported</h3>
				<p class="mb-3 text-sm text-red-700">
					Your browser doesn't support WebGPU, which is required for local AI inference.
				</p>
				<div class="text-sm text-red-600">
					<p class="mb-1"><strong>Chrome/Edge:</strong> Enable WebGPU in chrome://flags/#enable-unsafe-webgpu</p>
					<p class="mb-1"><strong>Firefox:</strong> WebGPU support is limited</p>
					<p><strong>Safari:</strong> WebGPU is supported in recent versions</p>
				</div>
			</div>
		{/if}

		<!-- Loading Status -->
		{#if isLoading && !isModelLoaded}
			<div class="rounded-lg bg-blue-50 p-4">
				<div class="flex items-center gap-3">
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
					<div>
						<p class="font-semibold text-blue-800">Loading Model</p>
						<p class="text-sm text-blue-600">{loadingProgress}</p>
					</div>
				</div>
				<div class="mt-3 text-xs text-blue-600">
					<p>First load may take 1-3 minutes depending on your internet connection.</p>
					<p>The Gemma 3n model (~500MB) is downloaded and cached in your browser.</p>
				</div>
			</div>
		{/if}

		<!-- Model Info -->
		{#if isModelLoaded}
			<div class="rounded-lg bg-green-50 p-4">
				<h3 class="mb-2 font-semibold text-green-800">Model Information</h3>
				<div class="grid grid-cols-2 gap-4 text-sm text-green-700 md:grid-cols-4">
					<div>
						<span class="font-semibold">Model:</span>
						<br />Gemma 3n 1B
					</div>
					<div>
						<span class="font-semibold">Precision:</span>
						<br />INT4 Quantized
					</div>
					<div>
						<span class="font-semibold">Max Tokens:</span>
						<br />{MODEL_CONFIG.maxTokens}
					</div>
					<div>
						<span class="font-semibold">Temperature:</span>
						<br />{MODEL_CONFIG.temperature}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Chat Messages -->
	<div
		bind:this={chatContainer}
		class="mb-4 h-96 overflow-y-auto rounded-lg border bg-white p-4"
	>
		{#if messages.length === 0 && !isLoading}
			<div class="flex h-full items-center justify-center text-gray-500">
				<div class="text-center">
					<div class="mb-2 text-4xl">🤖</div>
					{#if !webGpuSupported}
						<p>WebGPU support required for local AI</p>
					{:else if !isModelLoaded}
						<p>Initialize the model to start chatting</p>
					{:else}
						<p>Start a conversation with your local AI!</p>
					{/if}
				</div>
			</div>
		{/if}

		{#each messages as message}
			<div class="mb-4 {message.role === 'user' ? 'text-right' : 'text-left'}">
				<div class="inline-block max-w-[80%] rounded-lg p-3 {
					message.role === 'user' 
						? 'bg-blue-500 text-white' 
						: 'bg-gray-100 text-gray-800'
				}">
					<div class="whitespace-pre-wrap">{message.content}</div>
					<div class="mt-1 text-xs opacity-70">
						{formatTime(message.timestamp)}
					</div>
				</div>
			</div>
		{/each}

		{#if isLoading && isModelLoaded}
			<div class="text-left">
				<div class="inline-block rounded-lg bg-gray-100 p-3">
					<div class="flex items-center gap-2">
						<div class="h-2 w-2 animate-bounce rounded-full bg-gray-500"></div>
						<div class="h-2 w-2 animate-bounce rounded-full bg-gray-500" style="animation-delay: 0.1s"></div>
						<div class="h-2 w-2 animate-bounce rounded-full bg-gray-500" style="animation-delay: 0.2s"></div>
						<span class="ml-2 text-sm text-gray-600">Thinking...</span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input Area -->
	<div class="flex gap-2">
		<textarea
			bind:value={input}
			on:keypress={handleKeyPress}
			placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
			class="flex-1 resize-none rounded-lg border p-3 focus:border-blue-500 focus:outline-none"
			rows="2"
			disabled={!isModelLoaded || isLoading}
		></textarea>
		<button
			on:click={sendMessage}
			disabled={!input.trim() || isLoading || !isModelLoaded}
			class="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Send
		</button>
	</div>

	<div class="mt-4 text-center text-xs text-gray-500">
		<p>🔒 This AI runs completely in your browser using WebGPU acceleration.</p>
		<p>No data is sent to external servers - everything happens locally and privately.</p>
		{#if isModelLoaded}
			<p class="mt-1 text-green-600">✅ Model loaded and ready for inference</p>
		{/if}
	</div>
</div> 