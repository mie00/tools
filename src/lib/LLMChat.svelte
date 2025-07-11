<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { marked } from 'marked';
	import { markedHighlight } from 'marked-highlight';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/atom-one-light.css';

	interface Message {
		id: string;
		role: 'user' | 'assistant' | 'system';
		content: string;
		timestamp: string;
		isLoading?: boolean;
		isThinking?: boolean;
		error?: boolean;
	}

	interface ChatTopic {
		id: string;
		name: string;
		messages: Message[];
		systemPrompt: string;
		createdAt: string;
	}

	marked.use(
		markedHighlight({
			langPrefix: 'hljs language-',
			highlight(code: string, lang: string) {
				const language = hljs.getLanguage(lang) ? lang : 'plaintext';
				return hljs.highlight(code, { language, ignoreIllegals: true }).value;
			}
		})
	);

	const TITLE_GENERATION_THRESHOLD = 300;

	// State
	let topics: ChatTopic[] = [];
	let currentActiveTopicId: string | null = null;
	let worker: Worker | null = null;
	let isModelLoaded = false;
	let loadingProgress = {
		status: 'loading',
		file: '...',
		progress: 0
	};
	let fileProgress: Record<string, { name: string; progress: number; loaded: number; total: number }> = {};
	let hasInitializationError = false;
	let webGpuSupported = false;
	let shaderF16Supported = false;
	let isLoading = false;
	let showTopics = true;
	let showSettings = false;
	let input = '';
	let chatContainer: HTMLDivElement;
	let mathJaxLoaded = false;

	// MathJax configuration
	const initMathJax = () => {
		if (typeof window !== 'undefined' && !(window as any).MathJax) {
			(window as any).MathJax = {
				tex: {
					inlineMath: [['$', '$'], ['\\(', '\\)']],
					displayMath: [['$$', '$$'], ['\\[', '\\]']],
					packages: {'[+]': ['ams', 'newcommand', 'configMacros']},
					processEscapes: true,
					processEnvironments: true
				},
				svg: {
					fontCache: 'global'
				},
				startup: {
					ready: () => {
						(window as any).MathJax.startup.defaultReady();
						mathJaxLoaded = true;
					}
				}
			};

			// Load MathJax script
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
			script.async = true;
			document.head.appendChild(script);
		} else if ((window as any).MathJax) {
			mathJaxLoaded = true;
		}
	};

	const typesetMath = async () => {
		if (mathJaxLoaded && (window as any).MathJax && (window as any).MathJax.typesetPromise) {
			try {
				await (window as any).MathJax.typesetPromise();
			} catch (error) {
				console.error('MathJax typeset error:', error);
			}
		}
	};

	// Model configuration
	const MODEL_CONFIG = {
		modelPath: 'onnx-community/Qwen3-0.6B-ONNX',
		maxTokens: 1000,
		topK: 40,
		temperature: 0.8,
		randomSeed: 101
	};

	$: activeTopic = topics.find((t) => t.id === currentActiveTopicId);
	
	// Render math when switching topics
	$: if (activeTopic) {
		setTimeout(() => typesetMath(), 100);
	}

	onMount(async () => {
		// Load topics from localStorage
		const savedTopics = localStorage.getItem('llmChatTopics');
		if (savedTopics) {
			topics = JSON.parse(savedTopics);
			if (topics.length > 0) {
				currentActiveTopicId = topics[0].id;
			}
		}

		if (topics.length === 0) {
			createNewTopic();
		}

		await checkWebGpuSupport();
		if (webGpuSupported) {
			await initializeWorker();
		}
		
		// Initialize MathJax
		initMathJax();
	});

	function saveTopics() {
		localStorage.setItem('llmChatTopics', JSON.stringify(topics));
	}

	function createNewTopic() {
		const newTopic: ChatTopic = {
			id: crypto.randomUUID(),
			name: `Chat ${topics.length + 1}`,
			messages: [],
			systemPrompt: `You are a helpful assistant. You go into conversation with the user so you answer. Keep your answers short unless the user says otherwise.

Think before answering, this usually holds better quality answers. Use <think> tags to enclose your thinking process, this will not be shown to the user as a part of the answer. Make sure that the thinking process is enclosed in a <think> tag and not sent as is.`,
			createdAt: new Date().toISOString()
		};
		topics = [...topics, newTopic];
		currentActiveTopicId = newTopic.id;
		saveTopics();
	}

	function deleteTopic(topicIdToDelete: string) {
		if (!confirm('Are you sure you want to delete this chat?')) {
			return;
		}

		const topicIndex = topics.findIndex((t) => t.id === topicIdToDelete);
		if (topicIndex === -1) return;

		topics.splice(topicIndex, 1);

		if (currentActiveTopicId === topicIdToDelete) {
			if (topics.length > 0) {
				currentActiveTopicId = topics[Math.max(0, topicIndex - 1)].id;
			} else {
				createNewTopic();
			}
		}

		topics = [...topics];
		saveTopics();
	}

	async function checkWebGpuSupport() {
		if (!(navigator as any).gpu) {
			webGpuSupported = false;
			return;
		}

		try {
			const adapter = await (navigator as any).gpu.requestAdapter();
			if (adapter) {
				webGpuSupported = true;
				shaderF16Supported = adapter.features.has('shader-f16');
			}
		} catch (error) {
			console.error('WebGPU not supported:', error);
			webGpuSupported = false;
		}
	}

	async function initializeWorker() {
		isLoading = true;
		worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (event) => {
			const { type, data } = event.data;

			switch (type) {
				case 'progress':
					loadingProgress = data;
					if (data.file && data.file !== 'complete') {
						fileProgress[data.file] = {
							name: data.file,
							progress: data.progress || 0,
							loaded: data.loaded || 0,
							total: data.total || 0
						};
						fileProgress = { ...fileProgress };
					}
					break;
				case 'init_done':
					loadingProgress.status = 'Model loaded successfully!';
					isModelLoaded = true;
					isLoading = false;
					fileProgress = {};
					break;
				case 'init_error':
					loadingProgress.status = `Error: ${data}`;
					hasInitializationError = true;
					isLoading = false;
					fileProgress = {};
					break;
				case 'start_generate':
					break;
				case 'update':
					console.log('update', data);
					if (activeTopic && activeTopic.messages.length > 0) {
						const lastMessage = activeTopic.messages[activeTopic.messages.length - 1];
						if (lastMessage.role === 'assistant') {
							lastMessage.content += data;
							lastMessage.isLoading = false;
							
							// Handle thinking state
							const openThink = (lastMessage.content.match(/<think>/g) || []).length;
							const closeThink = (lastMessage.content.match(/<\/think>/g) || []).length;
							lastMessage.isThinking = openThink > closeThink;
							
							topics = [...topics];
							saveTopics();
							scrollToBottom();
							// Render math equations
							setTimeout(() => typesetMath(), 100);
						}
					}
					break;
				case 'complete':
					if (activeTopic && activeTopic.messages.length > 0) {
						const lastMessage = activeTopic.messages[activeTopic.messages.length - 1];
						if (lastMessage.role === 'assistant') {
							lastMessage.isLoading = false;
							lastMessage.isThinking = false;
							topics = [...topics];
							saveTopics();
							// Render math equations
							setTimeout(() => typesetMath(), 100);
						}
					}
					isLoading = false;
					break;
				case 'generate_error':
					if (activeTopic && activeTopic.messages.length > 0) {
						const lastMessage = activeTopic.messages[activeTopic.messages.length - 1];
						if (lastMessage.role === 'assistant') {
							lastMessage.content = `Error: ${data}`;
							lastMessage.error = true;
							lastMessage.isLoading = false;
							lastMessage.isThinking = false;
							topics = [...topics];
							saveTopics();
							// Render math equations
							setTimeout(() => typesetMath(), 100);
						}
					}
					isLoading = false;
					break;
			}
		};

		worker.postMessage({ type: 'init', data: { modelPath: MODEL_CONFIG.modelPath } });
	}

	async function sendMessage() {
		if (!input.trim() || isLoading || !worker || !isModelLoaded || !activeTopic) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: input.trim(),
			timestamp: new Date().toISOString()
		};

		activeTopic.messages = [...activeTopic.messages, userMessage];
		const userInput = input;
		input = '';
		isLoading = true;

		const assistantMessage: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			timestamp: new Date().toISOString(),
			isLoading: true
		};

		activeTopic.messages = [...activeTopic.messages, assistantMessage];
		topics = [...topics];
		saveTopics();
		
		// Render math equations for user message
		setTimeout(() => typesetMath(), 100);

		const chat_history = activeTopic.messages.slice(0, -1).map((msg) => ({
			role: msg.role,
			content: msg.content
		}));

		// Add system prompt
		const messagesToSend = [...chat_history];
		if (activeTopic.systemPrompt) {
			messagesToSend.unshift({ role: 'system', content: activeTopic.systemPrompt });
		}

		worker.postMessage({
			type: 'generate',
			data: {
				userInput,
				chat_history: messagesToSend,
				maxTokens: MODEL_CONFIG.maxTokens,
				topK: MODEL_CONFIG.topK,
				temperature: MODEL_CONFIG.temperature
			}
		});
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

	function formatTime(date: string): string {
		return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function interrupt() {
		if (worker) {
			worker.postMessage({ type: 'interrupt' });
		}
	}

	function resetChat() {
		if (worker) {
			worker.postMessage({ type: 'reset' });
		}
	}

	async function retryInitialization() {
		hasInitializationError = false;
		loadingProgress = { status: 'loading', file: '...', progress: 0 };
		fileProgress = {};
		if (worker) {
			worker.postMessage({ type: 'init' });
		}
	}

	function processMessageContent(content: string): string {
		// Remove complete <think> tags from display
		let processed = content.replace(/<think>[\s\S]*?<\/think>/g, '');
		
		// Also remove partial thinking content (unclosed <think> tags)
		processed = processed.replace(/<think>[\s\S]*?$/, '');
		
		return processed;
	}

	function extractThinkingContent(content: string): string {
		// First try to match complete thinking tags
		const completeMatch = content.match(/<think>([\s\S]*?)<\/think>/);
		if (completeMatch) {
			return completeMatch[1].trim();
		}
		
		// If no complete match, try to match partial thinking (unclosed tag)
		const partialMatch = content.match(/<think>([\s\S]*?)$/);
		if (partialMatch) {
			return partialMatch[1].trim();
		}
		
		return '';
	}

	function hasThinkingContent(content: string): boolean {
		// Check for complete thinking tags OR partial thinking tags
		return /<think>/.test(content);
	}

	// State for collapsible thinking sections
	let collapsedThinking: Record<string, boolean> = {};

	function toggleThinking(messageId: string) {
		collapsedThinking[messageId] = !collapsedThinking[messageId];
		collapsedThinking = { ...collapsedThinking };
	}
</script>

<div class="flex h-full bg-white rounded-lg shadow-md">
	<!-- Sidebar for topics -->
	{#if showTopics}
		<div class="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
			<div class="p-4 border-b border-gray-200">
				<button
					on:click={createNewTopic}
					class="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
				>
					New Chat
				</button>
			</div>
			<div class="flex-1 overflow-y-auto">
				{#each topics as topic}
					<div
						class="p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-100 {currentActiveTopicId === topic.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}"
						role="button"
						tabindex="0"
						on:click={() => (currentActiveTopicId = topic.id)}
						on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { currentActiveTopicId = topic.id; } }}
					>
						<div class="flex justify-between items-center">
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium text-gray-900 truncate">{topic.name}</div>
								<div class="text-xs text-gray-500">
									{formatTime(topic.createdAt)}
								</div>
							</div>
							<button
								on:click|stopPropagation={() => deleteTopic(topic.id)}
								aria-label="Delete topic {topic.name}"
								class="ml-2 text-gray-400 hover:text-red-500 transition-colors"
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Main chat area -->
	<div class="flex flex-col flex-1 h-screen">
		<!-- Header -->
		<div class="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
			<div class="flex items-center gap-4">
				<button
					on:click={() => (showTopics = !showTopics)}
					aria-label="Toggle topics sidebar"
					class="p-2 text-gray-500 hover:text-gray-700 transition-colors"
				>
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
					</svg>
				</button>
				<h1 class="text-lg font-semibold text-gray-900">
					{activeTopic?.name || 'Local LLM Chat'}
				</h1>
			</div>
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-2">
					<div class="h-3 w-3 rounded-full {webGpuSupported ? 'bg-green-500' : 'bg-red-500'}"></div>
					<span class="text-sm {webGpuSupported ? 'text-green-700' : 'text-red-700'}">
						{webGpuSupported ? 'WebGPU' : 'No WebGPU'}
					</span>
				</div>
				{#if isModelLoaded}
					<div class="flex items-center gap-2">
						<div class="h-3 w-3 rounded-full bg-green-500"></div>
						<span class="text-sm text-green-700">Model Loaded</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Loading Status -->
		{#if isLoading && !isModelLoaded}
			<div class="p-4 bg-blue-50 border-b border-blue-200">
				<div class="flex items-center gap-3">
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
					<div class="flex-1">
						<p class="font-semibold text-blue-800">Loading Model</p>
						<p class="text-sm text-blue-600">{loadingProgress.status}</p>
					</div>
				</div>
				
				{#if Object.keys(fileProgress).length > 0}
					<div class="mt-4 space-y-2">
						{#each Object.values(fileProgress) as file}
							<div class="space-y-1">
								<div class="flex justify-between text-xs text-blue-600">
									<span>{file.name}</span>
									<span>{Math.round(file.progress)}%</span>
								</div>
								<div class="w-full rounded-full bg-gray-200">
									<div
										class="rounded-full bg-blue-600 p-0.5 text-center text-xs font-medium leading-none text-blue-100 transition-all duration-300"
										style="width: {file.progress}%"
									>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Error Status -->
		{#if hasInitializationError}
			<div class="p-4 bg-red-50 border-b border-red-200">
				<div class="flex items-center gap-3">
					<svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
					</svg>
					<div class="flex-1">
						<h3 class="font-semibold text-red-800">Model Initialization Failed</h3>
						<p class="text-sm text-red-700">{loadingProgress.status}</p>
					</div>
					<button
						on:click={retryInitialization}
						class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
					>
						Retry
					</button>
				</div>
			</div>
		{/if}

		<!-- Chat Messages -->
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4 space-y-4">
			{#if activeTopic && activeTopic.messages.length === 0}
				<div class="flex items-center justify-center h-full text-gray-500">
					<div class="text-center">
						<div class="text-4xl mb-2">🤖</div>
						<p>Start a conversation with your local AI!</p>
					</div>
				</div>
			{/if}

			{#if activeTopic}
				{#each activeTopic.messages as message}
					<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div class="max-w-[80%] {message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'} rounded-lg p-3">
							{#if message.role === 'assistant'}
								{#if hasThinkingContent(message.content)}
									<div class="mb-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
										<button 
											class="flex items-center gap-2 text-gray-500 hover:text-gray-700 w-full text-left"
											on:click={() => toggleThinking(message.id)}
										>
											{#if message.isThinking}
												<div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></div>
												<span class="font-medium">Thinking...</span>
											{:else}
												<div class="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
												<span class="font-medium text-gray-400">Thought process:</span>
											{/if}
											<svg class="w-3 h-3 ml-auto transform transition-transform {collapsedThinking[message.id] ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
											</svg>
										</button>
										{#if collapsedThinking[message.id]}
											<div class="mt-1 text-gray-400 text-xs whitespace-pre-wrap">
												{extractThinkingContent(message.content)}
											</div>
										{/if}
									</div>
								{/if}
								<div class="prose prose-sm max-w-none">
									{@html marked(processMessageContent(message.content))}
								</div>
							{:else}
								<div class="whitespace-pre-wrap">{message.content}</div>
							{/if}
							<div class="text-xs opacity-70 mt-1">
								{formatTime(message.timestamp)}
							</div>
							{#if message.isLoading}
								<div class="flex items-center gap-2 mt-2">
									<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
									<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
									<div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Input Area -->
		<div class="border-t border-gray-200 p-4">
			<div class="flex gap-2">
				<textarea
					bind:value={input}
					on:keypress={handleKeyPress}
					placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
					class="flex-1 resize-none rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
					rows="2"
					disabled={!isModelLoaded || isLoading}
				></textarea>
				<button
					on:click={sendMessage}
					disabled={!input.trim() || isLoading || !isModelLoaded}
					class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					Send
				</button>
				{#if isLoading}
					<button
						on:click={interrupt}
						class="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
					>
						Stop
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	:global(.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6) {
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}
	
	:global(.prose p) {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}
	
	:global(.prose ul, .prose ol) {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}
	
	:global(.prose pre) {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		background-color: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 0.375rem;
		padding: 1rem;
	}
	
	:global(.prose code) {
		background-color: #f8f9fa;
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}
</style>
