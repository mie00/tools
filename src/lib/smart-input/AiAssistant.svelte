<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { llmState, persistentLlmState, persistentConfig } from '../ollama/store';
	import MarkdownRenderer from '../MarkdownRenderer.svelte';

	const { inputText = '', suggestions = [] } = $props<{
		inputText?: string;
		suggestions?: Array<{ id: string; [key: string]: any }>;
	}>();

	// LLM-related state
	let llmAnswer = $state('');
	let llmLoading = $state(false);
	let llmExpanded = $state(false);
	let llmFollowupInput = $state('');
	let llmStreaming = $state(false);
	let llmModelInitializing = $state(false);
	let llmAnswerTimeout: ReturnType<typeof setTimeout> | null = null;
	let pendingInput = $state(''); // Store input to process after model loads
	let currentLlmState = $state<{
		isModelLoaded: boolean;
		worker: SharedWorker | null;
		hasInitializationError: boolean;
	}>({ isModelLoaded: false, worker: null, hasInitializationError: false });
	let _persistentLlmStateValue = $state<{
		isModelLoaded: boolean;
		hasInitializationError: boolean;
	}>({ isModelLoaded: false, hasInitializationError: false });
	let config = $state<any>(null);
	let localWorker: SharedWorker | null = null;
	let llmManualTriggered = $state(false);

	// Track LLM state
	$effect(() => {
		const unsubscribe = llmState.subscribe((state) => {
			currentLlmState = state;
		});
		return unsubscribe;
	});

	// Track persistent LLM state
	$effect(() => {
		const unsubscribe = persistentLlmState.subscribe((state) => {
			_persistentLlmStateValue = state;
		});
		return unsubscribe;
	});

	// Track config
	$effect(() => {
		const unsubscribe = persistentConfig.subscribe((state) => {
			config = state;
		});
		return unsubscribe;
	});

	// Enhance onMount to load config and check WebGPU support
	onMount(() => {
		// NEW: Load saved config from localStorage and detect WebGPU support
		if (browser) {
			const savedConfig = localStorage.getItem('ollamaChatConfig');
			if (savedConfig) {
				try {
					const parsedConfig = JSON.parse(savedConfig);
					persistentConfig.set(parsedConfig);
				} catch (e) {
					console.error('Failed to parse saved config:', e);
				}
			}

			// Check WebGPU support and update config
			checkWebGpuSupport();
		}
	});

	// Function to detect WebGPU support
	async function checkWebGpuSupport() {
		if (!browser) return;

		if (!(navigator as any).gpu) {
			persistentConfig.update((cfg) => ({ ...cfg, webGpuSupported: false }));
			return;
		}

		try {
			const adapter = await (navigator as any).gpu.requestAdapter();
			if (adapter) {
				persistentConfig.update((cfg) => ({
					...cfg,
					webGpuSupported: true,
					shaderF16Supported: adapter.features.has('shader-f16')
				}));
			}
		} catch (error) {
			console.error('WebGPU detection failed:', error);
			persistentConfig.update((cfg) => ({ ...cfg, webGpuSupported: false }));
		}
	}

	// Cleanup on component destruction
	onDestroy(() => {
		if (llmAnswerTimeout) {
			clearTimeout(llmAnswerTimeout);
		}
	});

	// Function to initialize the local model if needed
	async function initializeLocalModelIfNeeded() {
		if (!browser || !config) return;

		// Check if model should be available
		if (!config.webGpuSupported || config.defaultModelSource !== 'local') return;

		// If model is already loaded in shared state, we don't need to initialize locally
		if (currentLlmState.isModelLoaded && currentLlmState.worker) {
			return;
		}

		// PREVENT CONCURRENT INITIALIZATION: If already initializing, don't start again
		if (llmModelInitializing) {
			return;
		}

		// If model is not loaded and we don't have a local worker, try to initialize
		if (!currentLlmState.isModelLoaded && !currentLlmState.worker && !localWorker) {
			try {
				llmModelInitializing = true;
				localWorker = new SharedWorker(new URL('../ollama/worker.ts', import.meta.url), {
					type: 'module'
				});

				localWorker.port.onmessage = (event) => {
					const { type, data } = event.data;

					switch (type) {
						case 'init_done':
							// Update both the local state and shared stores
							llmState.set({
								isModelLoaded: true,
								worker: localWorker,
								hasInitializationError: false
							});
							persistentLlmState.set({
								isModelLoaded: true,
								hasInitializationError: false
							});
							llmModelInitializing = false;
							// Process pending input if any
							if (pendingInput) {
								getLlmAnswer(pendingInput);
								pendingInput = ''; // Clear pending input
							}
							break;
						case 'init_error':
							console.error('Local model initialization error:', data);
							llmState.set({
								isModelLoaded: false,
								worker: null,
								hasInitializationError: true
							});
							persistentLlmState.set({
								isModelLoaded: false,
								hasInitializationError: true
							});
							if (localWorker) {
								localWorker = null;
							}
							llmModelInitializing = false;
							pendingInput = ''; // Clear pending input on error
							break;
					}
				};

				localWorker.port.postMessage({ type: 'init', data: { modelPath: config.local.modelPath } });
			} catch (error) {
				console.error('Failed to initialize local model:', error);
				llmState.set({
					isModelLoaded: false,
					worker: null,
					hasInitializationError: true
				});
				persistentLlmState.set({
					isModelLoaded: false,
					hasInitializationError: true
				});
				if (localWorker) {
					localWorker = null;
				}
				llmModelInitializing = false;
				pendingInput = ''; // Clear pending input on error
			}
		}
	}

	// Function to get a quick LLM answer
	async function getLlmAnswer(input: string) {
		// Try to initialize model if needed
		await initializeLocalModelIfNeeded();

		// Use worker from shared state if available, otherwise use local worker
		const worker = currentLlmState.worker || localWorker;

		if (!currentLlmState.isModelLoaded || !worker) {
			// If model is initializing, store the input for later processing
			if (llmModelInitializing) {
				pendingInput = input;
			}
			return;
		}

		try {
			// Clear any pending input since we're processing now
			pendingInput = '';

			// --- NEW: Gracefully reset any previous generation ---
			if (llmStreaming) {
				await new Promise<void>((resolve) => {
					// Listen for reset_done once
					const interruptHandler = (event: MessageEvent) => {
						// If a generation is ongoing, only resolve on 'complete'
						if (event.data?.type === 'complete') {
							worker.port.removeEventListener('message', interruptHandler);
							resolve();
						}
					};
					worker.port.addEventListener('message', interruptHandler);
					// Interrupt current generation & clear caches
					worker.port.postMessage({ type: 'interrupt' });
				});
			}

			await new Promise<void>((resolve) => {
				// Listen for reset_done once
				const resetHandler = (event: MessageEvent) => {
					if (event.data?.type === 'reset_done') {
						worker.port.removeEventListener('message', resetHandler);
						resolve();
					}
				};
				worker.port.addEventListener('message', resetHandler);
				// Interrupt current generation & clear caches
				worker.port.postMessage({ type: 'reset' });
			});
			// --- END RESET LOGIC ---

			llmLoading = true;
			llmStreaming = false;
			llmAnswer = '';

			// Keep reference to remove when complete/error
			let handleMessage: (_e: MessageEvent) => void;

			const response = await new Promise<string>((resolve, reject) => {
				let accumulatedResponse = '';

				handleMessage = (event: MessageEvent) => {
					const { type, data } = event.data;

					switch (type) {
						case 'start_generate':
							accumulatedResponse = '';
							llmLoading = false;
							llmStreaming = true;
							break;
						case 'update':
							accumulatedResponse += data;
							llmAnswer = accumulatedResponse;
							break;
						case 'complete':
							llmStreaming = false;
							cleanup();
							resolve(accumulatedResponse);
							break;
						case 'generate_error':
							llmStreaming = false;
							cleanup();
							reject(new Error(data));
							break;
					}
				};

				const cleanup = () => {
					worker.port.removeEventListener('message', handleMessage);
				};

				worker.port.addEventListener('message', handleMessage);

				// Send the query to the worker
				worker.port.postMessage({
					type: 'generate',
					data: {
						userInput: input,
						chat_history: [
							{
								role: 'system',
								content:
									`You are a helpful assistant that suggests answers based on the user search query in a search engine.
									Do not spend too much time thinking.
									Be concise and to the point.

									If the user is looking for a website, suggest the website using the markdown link format.
									If you think the website has a typo or incorrect, do not ask the user, instead suggest the correct website.
									For example if the user types facebook, suggest https://www.facebook.com/
									If the user types yt, suggest https://www.youtube.com/
									Do not answer with an explanation, just suggest the website in one line.
									If there are multiple websites, suggest them with the highest probability first.

									If the user is looking for some information, like if they ask for a city name, a history event or a scientific fact,
									explain the information in a few sentences.

									If the user is asking a question, answer with a few sentences.

									If you cannot answer the question directly but you can write a javascript code to answer the question,
									write the javascript code in a code block. In such case, do not answer with illustrative examples or just an explanation.
									In such case, make sure you also write the code in a way that it can be executed.

									The time now is ${new Date().toLocaleString()}. Do not use any other time.
									If the user asks for the time, answer with the time.
									You may use a different format depending on the user's request.
									`.replace(/\t/g, '')
							}
						],
						maxTokens: config?.local?.maxTokens || 2000,
						topK: 40,
						temperature: 0.7
					}
				});
			});

			llmAnswer = response;
		} catch (error) {
			console.error('LLM query error:', error);
			llmAnswer = 'Sorry, I encountered an error while generating a response.';
			llmStreaming = false;
		} finally {
			llmLoading = false;
		}
	}

	// Function to handle expanding LLM answer
	function expandLlmAnswer() {
		llmExpanded = true;
	}

	// Function to handle follow-up input
	function handleLlmFollowup() {
		if (llmFollowupInput.trim()) {
			// Navigate to LLM chat with the original input, answer, and followup as conversation
			const params = new URLSearchParams();
			params.set('q', inputText);
			params.set('answer', llmAnswer);
			params.set('followup', llmFollowupInput);
			goto(`/llmchat/ollamachat?${params.toString()}`);
		}
	}

	// Function to process LLM answer and extract thinking sections
	function processLlmAnswer(answer: string, isStreaming: boolean = false) {
		// Extract thinking sections
		const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
		const thinkingSections: string[] = [];
		let match;

		while ((match = thinkRegex.exec(answer)) !== null) {
			thinkingSections.push(match[1].trim());
		}

		// For streaming, handle incomplete think tags
		let cleanAnswer = answer.replace(thinkRegex, '');
		let hasIncompleteThink = false;
		let incompleteThinkContent = '';

		if (isStreaming) {
			// Check for unclosed think tag
			const openThinkCount = (answer.match(/<think>/g) || []).length;
			const closeThinkCount = (answer.match(/<\/think>/g) || []).length;
			hasIncompleteThink = openThinkCount > closeThinkCount;

			// If there's an incomplete think tag, handle it properly
			if (hasIncompleteThink) {
				const lastThinkIndex = answer.lastIndexOf('<think>');
				if (lastThinkIndex !== -1) {
					// Extract content before the incomplete think tag
					const beforeIncompleteThink = answer.substring(0, lastThinkIndex);
					// Extract the incomplete thinking content
					incompleteThinkContent = answer.substring(lastThinkIndex + 7); // +7 for '<think>'

					// Clean the answer to remove completed think tags from the part before incomplete think
					cleanAnswer = beforeIncompleteThink.replace(thinkRegex, '').trim();
				}
			}
		}

		cleanAnswer = cleanAnswer.trim();

		return {
			mainContent: cleanAnswer,
			thinkingSections,
			hasIncompleteThink,
			incompleteThinkContent
		};
	}

	// Function to get a debounced LLM answer
	function debouncedGetLlmAnswer(input: string) {
		// Clear any existing timeout
		if (llmAnswerTimeout) {
			clearTimeout(llmAnswerTimeout);
		}

		// Clear current answer while user is typing
		llmAnswer = '';
		llmLoading = false;

		// Set a new timeout for 500ms after user stops typing
		llmAnswerTimeout = setTimeout(() => {
			getLlmAnswer(input);
		}, 500);
	}

	// React to input changes for LLM suggestions
	$effect(() => {
		llmManualTriggered = false; // Reset manual trigger on input change

		if (inputText.trim()) {
			// Check if we should get an LLM answer
			// Only show LLM answer if no tools are suggested (except Google search)
			const nonGoogleSuggestions = suggestions.filter(
				(s: { id: string; [key: string]: any }) => s.id !== 'googlesearch'
			);
			if (
				nonGoogleSuggestions.length === 0 &&
				inputText.trim().length > 3 &&
				config &&
				config.webGpuSupported &&
				config.defaultModelSource === 'local'
			) {
				// Reset LLM state for new query
				llmExpanded = false;
				llmFollowupInput = '';
				debouncedGetLlmAnswer(inputText.trim());
			} else {
				// Clear LLM answer if we have other suggestions
				if (llmAnswerTimeout) {
					clearTimeout(llmAnswerTimeout);
					llmAnswerTimeout = null;
				}
				llmAnswer = '';
				llmLoading = false;
				llmStreaming = false;
				llmExpanded = false;
				pendingInput = ''; // Clear pending input
			}
		} else {
			// Clear LLM answer timeout and state
			if (llmAnswerTimeout) {
				clearTimeout(llmAnswerTimeout);
				llmAnswerTimeout = null;
			}
			llmAnswer = '';
			llmLoading = false;
			llmStreaming = false;
			llmExpanded = false;
			pendingInput = ''; // Clear pending input
		}
	});
</script>

<!-- Manual LLM Answer Button at the top -->
{#if inputText.trim().length > 3 && config && config.webGpuSupported && config.defaultModelSource === 'local' && !llmManualTriggered && !llmLoading && !llmStreaming && !llmModelInitializing && !llmAnswer}
	<div class="mt-4 text-center">
		<button
			onclick={() => {
				llmManualTriggered = true;
				getLlmAnswer(inputText.trim());
			}}
			class="inline-flex items-center space-x-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
				></path>
			</svg>
			<span>Ask AI Assistant</span>
		</button>
	</div>
{/if}

<!-- LLM Answer Preview -->
{#if llmModelInitializing || llmLoading || llmStreaming || llmAnswer}
	<div class="space-y-2">
		<h3 class="font-medium text-gray-700">Local AI Assistant:</h3>
		<div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
			{#if llmModelInitializing}
				<div class="flex items-center space-x-2">
					<div
						class="flex h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"
					></div>
					<div class="text-sm text-purple-600">Loading AI model...</div>
				</div>
			{:else if llmLoading}
				<div class="flex items-center space-x-2">
					<div
						class="flex h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"
					></div>
					<div class="text-sm text-purple-600">Generating response...</div>
				</div>
			{:else if llmStreaming || llmAnswer}
				<div class="space-y-3">
					{#if llmExpanded}
						{@const processed = processLlmAnswer(llmAnswer, llmStreaming)}
						<div class="space-y-3">
							{#if processed.thinkingSections.length > 0}
								<details class="rounded border border-gray-300 bg-gray-50 p-3">
									<summary
										class="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800"
									>
										💭 View AI's thinking process ({processed.thinkingSections.length} section{processed
											.thinkingSections.length > 1
											? 's'
											: ''})
									</summary>
									<div class="mt-2 space-y-2">
										{#each processed.thinkingSections as thinking, index (index)}
											<div
												class="rounded border-l-4 border-blue-200 bg-white p-2 text-sm text-gray-700"
											>
												<MarkdownRenderer content={thinking} llmMode={true} />
											</div>
										{/each}
									</div>
								</details>
							{/if}
							{#if processed.hasIncompleteThink && llmStreaming}
								<details class="rounded border border-gray-300 bg-gray-50 p-3" open>
									<summary
										class="flex cursor-pointer items-center space-x-2 text-sm font-medium text-gray-600 hover:text-gray-800"
									>
										<div
											class="flex h-3 w-3 animate-spin rounded-full border border-purple-500 border-t-transparent"
										></div>
										<span>💭 AI is thinking...</span>
									</summary>
									{#if processed.incompleteThinkContent}
										<div class="mt-2">
											<div
												class="rounded border-l-4 border-blue-200 bg-white p-2 text-sm text-gray-700"
											>
												<MarkdownRenderer
													content={processed.incompleteThinkContent}
													llmMode={true}
												/>
												<span class="ml-1 inline-block h-4 w-2 animate-pulse bg-purple-500"></span>
											</div>
										</div>
									{/if}
								</details>
							{/if}
							<div class="text-sm text-gray-700">
								<MarkdownRenderer content={processed.mainContent} llmMode={true} />
								{#if llmStreaming && processed.mainContent && !processed.hasIncompleteThink}
									<span class="ml-1 inline-block h-4 w-2 animate-pulse bg-purple-500"></span>
								{/if}
							</div>
						</div>
					{:else}
						{@const processed = processLlmAnswer(llmAnswer, llmStreaming)}
						<div class="text-sm text-gray-700">
							{#if processed.hasIncompleteThink && llmStreaming}
								<div class="mb-2 flex items-center space-x-2 text-purple-600">
									<div
										class="flex h-3 w-3 animate-spin rounded-full border border-purple-500 border-t-transparent"
									></div>
									<span class="text-xs">Thinking...</span>
								</div>
							{/if}
							<div class="line-clamp-3">
								{#if processed.mainContent.length > 200}
									<MarkdownRenderer
										content={processed.mainContent.substring(0, 200) + '...'}
										llmMode={true}
									/>
								{:else}
									<MarkdownRenderer content={processed.mainContent} llmMode={true} />
								{/if}
								{#if llmStreaming && (processed.mainContent || processed.hasIncompleteThink)}
									<span class="ml-1 inline-block h-4 w-2 animate-pulse bg-purple-500"></span>
								{/if}
							</div>
						</div>
					{/if}

					{#if !llmExpanded && (llmAnswer || !llmStreaming)}
						<button
							onclick={expandLlmAnswer}
							class="text-sm text-purple-600 underline hover:text-purple-800"
						>
							Click to expand and ask follow-up questions
						</button>
					{:else if llmExpanded}
						<div class="space-y-2">
							<div class="text-sm text-gray-600">Ask a follow-up question:</div>
							<div class="flex space-x-2">
								<input
									type="text"
									bind:value={llmFollowupInput}
									placeholder="Ask anything..."
									class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
									onkeydown={(e) => {
										if (e.key === 'Enter' && llmFollowupInput.trim()) {
											handleLlmFollowup();
										}
									}}
								/>
								<button
									onclick={handleLlmFollowup}
									disabled={!llmFollowupInput.trim()}
									class="rounded bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Continue in Chat
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
