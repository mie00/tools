<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { marked } from 'marked';
	import { markedHighlight } from 'marked-highlight';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/atom-one-light.css';

	import { persistentTopics, persistentConfig, activeTopicId } from './store';
	import type { Message, ChatTopic, ChatConfig, ModelLoadingProgress, FileProgress } from './types';

	import ChatSidebar from './ChatSidebar.svelte';
	import ChatHeader from './ChatHeader.svelte';
	import ChatSettings from './ChatSettings.svelte';
	import ChatMessageArea from './ChatMessageArea.svelte';
	import ChatInput from './ChatInput.svelte';
	import { executeCode } from './executor';

	marked.use(
		markedHighlight({
			langPrefix: 'hljs language-',
			highlight(code: string, lang: string) {
				const language = hljs.getLanguage(lang) ? lang : 'plaintext';
				return hljs.highlight(code, { language, ignoreIllegals: true }).value;
			}
		})
	);

	const TITLE_GENERATION_THRESHOLD = 300; // Character count to trigger title generation
	const TITLE_GENERATION_PROMPT = `Based on the following conversation, create a short, concise title.
The title should be a single short sentence with no extra descriptions, prefixes like "Title:", or quotation marks.
Just return the title and nothing else.

Examples of good titles:
- "Planning a Trip to Japan"
- "SvelteKit Local Storage"
- "Dutch Health Insurance Requirements"

CONVERSATION:
`;

	// State
	let topics: ChatTopic[] = [];
	let draftTopic: ChatTopic | undefined = undefined; // Track current draft topic
	let config: ChatConfig;
	let currentActiveTopicId: string | null = null;

	// Remote model state
	let availableModels: string[] = [];
	let abortController: AbortController | null = null;

	// Local model state
	let worker: Worker | null = null;
	let isModelLoaded = false;
	let loadingProgress: ModelLoadingProgress = {
		status: 'loading',
		file: '...',
		progress: 0
	};
	let fileProgress: Record<string, FileProgress> = {};
	let hasInitializationError = false;

	// Common state
	let isLoading = false;
	let _error: string | null = null;
	let showSettings = false;
	let showTopics = false; // Default to false (collapsed)
	let mathJaxLoaded = false;

	let activeTopic: ChatTopic | undefined;
	$: activeTopic =
		topics.find((t) => t.id === currentActiveTopicId) ||
		(draftTopic?.id === currentActiveTopicId ? draftTopic : undefined);

	// Sort topics by last updated (newest first)
	$: sortedTopics = [...topics].sort((a, b) => {
		const aTime = a.lastUpdated || a.createdAt;
		const bTime = b.lastUpdated || b.createdAt;
		return new Date(bTime).getTime() - new Date(aTime).getTime();
	});

	// Editing state
	let _editingIndex: number | null = null;
	let _editingContent: string = '';

	// MathJax configuration
	const initMathJax = () => {
		if (typeof window !== 'undefined' && !(window as any).MathJax) {
			(window as any).MathJax = {
				tex: {
					inlineMath: [
						['$', '$'],
						['\\(', '\\)']
					],
					displayMath: [
						['$$', '$$'],
						['\\[', '\\]']
					],
					packages: { '[+]': ['ams', 'newcommand', 'configMacros'] },
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

	// Render math when switching topics
	$: if (activeTopic) {
		setTimeout(() => typesetMath(), 100);
	}

	onMount(async () => {
		// Load from localStorage and migrate old data
		const savedTopics = localStorage.getItem('ollamaChatTopics');
		if (savedTopics) {
			const loadedTopics: ChatTopic[] = JSON.parse(savedTopics);
			// Migration: Ensure all messages have a unique ID and modelSource
			loadedTopics.forEach((topic) => {
				topic.messages.forEach((message) => {
					if (!message.id) {
						message.id = crypto.randomUUID();
					}
				});
				// Migration: Add modelSource if it doesn't exist
				if (!topic.modelSource) {
					topic.modelSource = 'remote'; // Default to remote for existing topics
				}
				// Migration: Add lastUpdated if it doesn't exist
				if (!topic.lastUpdated) {
					topic.lastUpdated = topic.createdAt;
				}
			});
			persistentTopics.set(loadedTopics);
		}

		const savedConfig = localStorage.getItem('ollamaChatConfig');
		if (savedConfig) {
			try {
				const parsedConfig = JSON.parse(savedConfig);
				// Migration: Handle old config structure
				if (parsedConfig.endpoint) {
					// Old structure, migrate to new structure
					const migratedConfig: ChatConfig = {
						ollama: {
							endpoint: parsedConfig.endpoint,
							temperature: parsedConfig.temperature || 0.8,
							topK: parsedConfig.topK || 40
						},
						local: {
							modelPath: 'onnx-community/Qwen3-0.6B-ONNX',
							maxTokens: 1000,
							topK: 40,
							temperature: 0.8,
							randomSeed: 101
						},
						webGpuSupported: false,
						shaderF16Supported: false,
						defaultModelSource: 'local'
					};
					persistentConfig.set(migratedConfig);
				} else {
					persistentConfig.set(parsedConfig);
				}
			} catch (e) {
				console.error('Failed to parse config:', e);
			}
		}

		persistentTopics.subscribe((value) => {
			topics = value;
			if (!currentActiveTopicId && topics.length > 0) {
				activeTopicId.set(topics[0].id);
			}
			localStorage.setItem('ollamaChatTopics', JSON.stringify(value));
		});

		persistentConfig.subscribe((value) => {
			config = value;
			localStorage.setItem('ollamaChatConfig', JSON.stringify(value));
		});

		activeTopicId.subscribe((value) => {
			currentActiveTopicId = value;
		});

		if (topics.length === 0 && !draftTopic) {
			createNewTopic();
		}

		// Check WebGPU support
		await checkWebGpuSupport();

		// Initialize local model if WebGPU is supported
		if (config.webGpuSupported) {
			await initializeLocalModel();
		}

		// Fetch available remote models
		await fetchAvailableModels();

		// Initialize MathJax
		initMathJax();
	});

	async function checkWebGpuSupport() {
		if (!(navigator as any).gpu) {
			config.webGpuSupported = false;
			return;
		}

		try {
			const adapter = await (navigator as any).gpu.requestAdapter();
			if (adapter) {
				config.webGpuSupported = true;
				config.shaderF16Supported = adapter.features.has('shader-f16');
				persistentConfig.set(config);
			}
		} catch (error) {
			console.error('WebGPU not supported:', error);
			config.webGpuSupported = false;
			persistentConfig.set(config);
		}
	}

	async function initializeLocalModel() {
		if (!config.webGpuSupported) return;

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
					handleLocalModelUpdate(data);
					break;
				case 'complete':
					handleLocalModelComplete();
					break;
				case 'generate_error':
					handleLocalModelError(data);
					break;
			}
		};

		worker.postMessage({ type: 'init', data: { modelPath: config.local.modelPath } });
	}

	function handleLocalModelUpdate(data: string) {
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
				persistentTopics.set(topics);
				// Render math equations
				setTimeout(() => typesetMath(), 100);
			}
		}
	}

	function handleLocalModelComplete() {
		if (activeTopic && activeTopic.messages.length > 0) {
			const lastMessage = activeTopic.messages[activeTopic.messages.length - 1];
			if (lastMessage.role === 'assistant') {
				lastMessage.isLoading = false;
				lastMessage.isThinking = false;
				topics = [...topics];
				persistentTopics.set(topics);
				// Render math equations
				setTimeout(() => typesetMath(), 100);
			}
		}
		isLoading = false;
	}

	function handleLocalModelError(data: string) {
		if (activeTopic && activeTopic.messages.length > 0) {
			const lastMessage = activeTopic.messages[activeTopic.messages.length - 1];
			if (lastMessage.role === 'assistant') {
				lastMessage.content = `Error: ${data}`;
				lastMessage.error = true;
				lastMessage.isLoading = false;
				lastMessage.isThinking = false;
				topics = [...topics];
				persistentTopics.set(topics);
				// Render math equations
				setTimeout(() => typesetMath(), 100);
			}
		}
		isLoading = false;
	}

	async function fetchAvailableModels() {
		try {
			const response = await fetch(`${config.ollama.endpoint}/api/tags`);
			if (!response.ok) {
				throw new Error('Failed to fetch models');
			}
			const data = await response.json();
			availableModels = data.models.map((m: any) => m.name);
		} catch (err) {
			console.error('Failed to fetch Ollama models:', err);
			// This is not a critical error, just log it
		}
	}

	function createNewTopic() {
		// If there's already a draft topic, save it first (empty draft)
		if (draftTopic) {
			// Only save if it has messages, otherwise just discard
			if (draftTopic.messages.length > 0) {
				const topicToSave = { ...draftTopic };
				topicToSave.isDraft = false;
				persistentTopics.update((currentTopics) => [...currentTopics, topicToSave]);
			}
		}

		const newTopic: ChatTopic = {
			id: crypto.randomUUID(),
			name: `Chat ${topics.length + 1}`,
			messages: [],
			systemPrompt: `You are a helpful assistant. You go into conversation with the user so you answer. Keep your answers short unless the user says otherwise.

Sometimes you need to know things that can easily be programmed, like the length of a string or the current date and time, etc.
In that case you can create a code snippet in javascript that calculates the answer and logs it,
make sure to log it to see the result, and the user will respond back with the output,
use this output to write back the actual answer and don't answer by yourself, you need to encapsulate the snippets in <execute> tags,
the user will respond with the results enclosed with the tag <answer> so you can continue your answer based on this.
Do not ask the user to provide an answer or anything after wards, this happens automatically.
Also do not answer immediately after asking for code execution, instead stop after the closing tag and wait for a user response with the answer.

Think before answering, this usually holds better quality answers. Use <think> tags to enclose your thinking process, this will not be shown to the user as a part of the answer. Make sure that the thinking process is enclosed in a <think> tag and not sent as is.

Note that the actual user of the system doesn't see execute or answer tags or what's inside, so you'd need to continue your answer as if these do not exist.
You don't know anything about "now", the date you have is incorrect, so you'd always need to calculate it.`,
			model: availableModels[0] || 'local',
			modelSource: config.defaultModelSource, // Use default from config
			createdAt: new Date().toISOString(),
			lastUpdated: new Date().toISOString(),
			isDraft: true
		};
		draftTopic = newTopic;
		activeTopicId.set(newTopic.id);
	}

	function stopGeneration() {
		if (activeTopic?.modelSource === 'local') {
			if (worker) {
				worker.postMessage({ type: 'interrupt' });
			}
		} else {
			if (abortController) {
				abortController.abort();
			}
		}
	}

	function deleteTopic(topicIdToDelete: string) {
		if (!confirm('Are you sure you want to delete this chat?')) {
			return;
		}

		// Check if it's a draft topic
		if (draftTopic && draftTopic.id === topicIdToDelete) {
			draftTopic = undefined;

			// If the active topic was the draft, select another one
			if (currentActiveTopicId === topicIdToDelete) {
				if (topics.length > 0) {
					activeTopicId.set(topics[0].id);
				} else {
					createNewTopic();
				}
			}
			return;
		}

		const topicIndex = topics.findIndex((t) => t.id === topicIdToDelete);
		if (topicIndex === -1) return;

		// Remove the topic
		topics.splice(topicIndex, 1);

		// If the active topic was the one deleted, select another one
		if (currentActiveTopicId === topicIdToDelete) {
			if (topics.length > 0) {
				// Select the previous topic or the first one if the deleted one was the first
				activeTopicId.set(topics[Math.max(0, topicIndex - 1)].id);
			} else if (draftTopic) {
				// If no saved topics but there's a draft, switch to it
				activeTopicId.set(draftTopic.id);
			} else {
				// If no topics are left, create a new one
				createNewTopic();
			}
		}

		// Persist the changes
		persistentTopics.set(topics);
	}

	async function submitUserInput(event: CustomEvent<string>) {
		const userInput = event.detail;
		if (!userInput.trim() || isLoading) return;
		if (!activeTopic) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: userInput.trim(),
			timestamp: new Date().toISOString()
		};

		activeTopic.messages.push(userMessage);
		activeTopic.lastUpdated = new Date().toISOString();

		// If this is a draft topic, save it to persistent storage
		if (activeTopic.isDraft && draftTopic) {
			const topicToSave = { ...draftTopic };
			topicToSave.isDraft = false;
			draftTopic = undefined;
			persistentTopics.update((currentTopics) => [...currentTopics, topicToSave]);
		} else {
			persistentTopics.set(topics);
		}

		// Generate response based on model source
		if (activeTopic.modelSource === 'local') {
			await generateLocalResponse();
		} else {
			await generateRemoteResponse();
		}
	}

	async function generateLocalResponse() {
		if (!activeTopic || !worker || !isModelLoaded) return;

		isLoading = true;
		_error = null;

		const assistantMessage: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			timestamp: new Date().toISOString(),
			isLoading: true
		};

		activeTopic.messages.push(assistantMessage);
		activeTopic.lastUpdated = new Date().toISOString();
		persistentTopics.set(topics);

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
				userInput: activeTopic.messages[activeTopic.messages.length - 2].content,
				chat_history: messagesToSend,
				maxTokens: config.local.maxTokens,
				topK: config.local.topK,
				temperature: config.local.temperature
			}
		});
	}

	async function generateRemoteResponse() {
		if (!activeTopic) return;

		isLoading = true;
		_error = null;

		abortController = new AbortController();

		const messagesToSend = activeTopic.messages
			.filter((m) => !m.error) // Exclude previous error messages from history
			.map(({ role, content }) => ({ role, content }));

		if (activeTopic.systemPrompt) {
			messagesToSend.unshift({ role: 'system', content: activeTopic.systemPrompt });
		}

		const placeholderMessage: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			timestamp: new Date().toISOString(),
			isLoading: true
		};
		activeTopic.messages.push(placeholderMessage);
		const placeholderIndex = activeTopic.messages.length - 1;
		activeTopic.lastUpdated = new Date().toISOString();
		persistentTopics.set(topics);

		try {
			const response = await fetch(`${config.ollama.endpoint}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: activeTopic.model,
					messages: messagesToSend,
					stream: true,
					options: {
						temperature: config.ollama.temperature,
						top_k: config.ollama.topK
					}
				}),
				signal: abortController.signal
			});

			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(`Ollama API error: ${response.status} ${errorData}`);
			}
			if (!response.body) {
				throw new Error('Response body is missing');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let content = '';
			let firstChunk = true;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n').filter((line) => line.trim() !== '');

				for (const line of lines) {
					const parsed = JSON.parse(line);

					if (parsed.message?.content) {
						if (firstChunk) {
							firstChunk = false;
							activeTopic.messages[placeholderIndex].isLoading = false;
						}
						content += parsed.message.content;
						activeTopic.messages[placeholderIndex].content = content;

						// Handle thinking state
						const openThink = (
							activeTopic.messages[placeholderIndex].content.match(/<think>/g) || []
						).length;
						const closeThink = (
							activeTopic.messages[placeholderIndex].content.match(/<\/think>/g) || []
						).length;
						activeTopic.messages[placeholderIndex].isThinking = openThink > closeThink;

						persistentTopics.set(topics);
						// Render math equations
						setTimeout(() => typesetMath(), 100);
					}
				}
			}

			// Handle Code Execution
			const wasExecuted = await handleCodeExecution(placeholderIndex);

			// Title Generation
			if (!wasExecuted && activeTopic.name.startsWith('Chat ')) {
				const conversationLength = activeTopic.messages.reduce(
					(acc, msg) => acc + msg.content.length,
					0
				);
				if (conversationLength > TITLE_GENERATION_THRESHOLD) {
					generateTitle(activeTopic);
				}
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				console.log('Fetch aborted by user.');
				if (
					activeTopic &&
					activeTopic.messages[placeholderIndex] &&
					!activeTopic.messages[placeholderIndex].content.trim()
				) {
					// If user stops generation and the message is empty, remove it.
					activeTopic.messages.splice(placeholderIndex, 1);
				}
			} else {
				const errorMessage: Message = {
					id: placeholderMessage.id,
					role: 'assistant',
					content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
					timestamp: placeholderMessage.timestamp,
					error: true,
					isLoading: false
				};
				activeTopic.messages[placeholderIndex] = errorMessage;
			}
		} finally {
			isLoading = false;
			if (activeTopic.messages[placeholderIndex]) {
				activeTopic.messages[placeholderIndex].isThinking = false;
				activeTopic.messages[placeholderIndex].isLoading = false;
			}
			abortController = null;
			persistentTopics.set(topics);
			await tick();
		}
	}

	async function handleCodeExecution(messageIndex: number): Promise<boolean> {
		if (!activeTopic) return false;
		const message = activeTopic.messages[messageIndex];
		if (!message || message.role !== 'assistant') return false;

		const executeRegex = /<execute>([\s\S]*?)<\/execute>/;
		const match = message.content.match(executeRegex);

		if (match && match[1]) {
			const executeContent = match[1].trim();
			const codeBlockRegex = /```(?:js|javascript)?\s*([\s\S]*?)\s*```/im;
			const codeMatch = executeContent.match(codeBlockRegex);

			// First, try to get code from a markdown block. If that fails, use the raw content.
			const codeToExecute = codeMatch ? codeMatch[1].trim() : executeContent;

			if (codeToExecute) {
				// Set isLoading to false on the message that has the <execute> tag.
				message.isLoading = false;
				persistentTopics.set(topics);

				const result = await executeCode(codeToExecute);
				const answerContent = `<answer>${result.trim()}</answer>`;

				const answerMessage: Message = {
					id: crypto.randomUUID(),
					role: 'user',
					content: answerContent,
					timestamp: new Date().toISOString()
				};

				activeTopic.messages.push(answerMessage);
				activeTopic.lastUpdated = new Date().toISOString();
				persistentTopics.set(topics);

				// Generate the next response
				if (activeTopic.modelSource === 'local') {
					await generateLocalResponse();
				} else {
					await generateRemoteResponse();
				}
				return true;
			}
		}
		return false;
	}

	async function generateTitle(topic: ChatTopic) {
		if (!topic || topic.messages.length === 0) return;

		const conversationText = topic.messages
			.slice(0, 10) // Use first 10 messages
			.map((msg) => `${msg.role}: ${msg.content}`)
			.join('\n');

		const titlePrompt = TITLE_GENERATION_PROMPT + conversationText;

		try {
			if (topic.modelSource === 'local') {
				// For local models, we'd need to implement a separate title generation
				// For now, skip title generation for local models
				return;
			} else {
				const response = await fetch(`${config.ollama.endpoint}/api/generate`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model: topic.model,
						prompt: titlePrompt,
						stream: false,
						options: {
							temperature: 0.3,
							top_k: 20,
							num_predict: 50
						}
					})
				});

				if (response.ok) {
					const data = await response.json();
					const title = data.response?.trim();
					if (title && title.length > 0) {
						topic.name = title.replace(/^["']|["']$/g, '').substring(0, 50);
						topic.lastUpdated = new Date().toISOString();
						persistentTopics.set(topics);
					}
				}
			}
		} catch (err) {
			console.error('Failed to generate title:', err);
		}
	}

	// Pass through functions for child components
	function handleEditMessage(event: CustomEvent<{ index: number; content: string }>) {
		_editingIndex = event.detail.index;
		_editingContent = event.detail.content;
	}

	function handleSaveEdit(event: CustomEvent<{ index: number; content: string }>) {
		const { index, content } = event.detail;
		if (activeTopic && activeTopic.messages[index]) {
			activeTopic.messages[index].content = content;
			activeTopic.lastUpdated = new Date().toISOString();
			persistentTopics.set(topics);
		}
		_editingIndex = null;
		_editingContent = '';
	}

	function handleCancelEdit() {
		_editingIndex = null;
		_editingContent = '';
	}

	function handleUpdateSystemPrompt(event: CustomEvent<string>) {
		if (activeTopic) {
			activeTopic.systemPrompt = event.detail;
			activeTopic.lastUpdated = new Date().toISOString();
			persistentTopics.set(topics);
		}
	}

	function handleUpdateModel(event: CustomEvent<string>) {
		if (activeTopic) {
			activeTopic.model = event.detail;
			activeTopic.lastUpdated = new Date().toISOString();
			persistentTopics.set(topics);
		}
	}

	function handleUpdateModelSource(event: CustomEvent<'local' | 'remote'>) {
		if (activeTopic) {
			activeTopic.modelSource = event.detail;
			// Update model to appropriate default
			if (event.detail === 'local') {
				activeTopic.model = 'local';
			} else {
				activeTopic.model = availableModels[0] || 'llama2';
			}
			activeTopic.lastUpdated = new Date().toISOString();
			persistentTopics.set(topics);
		}
	}

	function handleUpdateConfig(event: CustomEvent<Partial<ChatConfig>>) {
		const updatedConfig = { ...config, ...event.detail };
		persistentConfig.set(updatedConfig);
	}

	function handleRetryInitialization() {
		if (config.webGpuSupported) {
			hasInitializationError = false;
			loadingProgress = { status: 'loading', file: '...', progress: 0 };
			fileProgress = {};
			initializeLocalModel();
		}
	}
</script>

<div class="flex h-screen bg-gray-100">
	<!-- Sidebar -->
	{#if showTopics}
		<!-- Backdrop overlay to close sidebar -->
		<div
			class="bg-opacity-50 fixed inset-0 z-10 bg-black lg:hidden"
			role="button"
			tabindex="0"
			aria-label="Close sidebar"
			on:click={() => (showTopics = false)}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					showTopics = false;
				}
			}}
		></div>

		<!-- Sidebar panel -->
		<div class="fixed top-0 bottom-0 left-0 z-20 w-80 bg-white shadow-lg lg:relative lg:z-0">
			<ChatSidebar
				topics={draftTopic ? [draftTopic, ...sortedTopics] : sortedTopics}
				{currentActiveTopicId}
				{config}
				{isModelLoaded}
				{hasInitializationError}
				{loadingProgress}
				{fileProgress}
				on:selectTopic={(e) => activeTopicId.set(e.detail)}
				on:deleteTopic={(e) => deleteTopic(e.detail)}
				on:createTopic={createNewTopic}
				on:toggleTopics={() => (showTopics = !showTopics)}
				on:updateConfig={handleUpdateConfig}
				on:retryInitialization={handleRetryInitialization}
			/>
		</div>
	{/if}

	<!-- Main Chat Area -->
	<div class="flex min-h-0 flex-1 flex-col">
		<!-- Header -->
		<div class="flex-shrink-0">
			<ChatHeader
				{activeTopic}
				{showTopics}
				{showSettings}
				{isLoading}
				on:toggleTopics={() => (showTopics = !showTopics)}
				on:toggleSettings={() => (showSettings = !showSettings)}
				on:stopGeneration={stopGeneration}
			/>
		</div>

		<!-- Settings Panel -->
		{#if showSettings}
			<div class="flex-shrink-0 border-b border-gray-200 bg-white">
				<div class="max-h-80 overflow-y-auto">
					<ChatSettings
						{activeTopic}
						{availableModels}
						on:updateSystemPrompt={handleUpdateSystemPrompt}
						on:updateModel={handleUpdateModel}
						on:updateModelSource={handleUpdateModelSource}
					/>
				</div>
			</div>
		{/if}

		<!-- Chat Messages -->
		<div class="min-h-0 flex-1 overflow-hidden bg-white">
			<ChatMessageArea
				{activeTopic}
				on:editMessage={handleEditMessage}
				on:saveEdit={handleSaveEdit}
				on:cancelEdit={handleCancelEdit}
			/>
		</div>

		<!-- Input Area -->
		<div class="flex-shrink-0 border-t border-gray-200 bg-white p-4">
			<ChatInput
				{isLoading}
				disabled={(!isModelLoaded && activeTopic?.modelSource === 'local') ||
					(activeTopic?.modelSource === 'remote' && availableModels.length === 0)}
				on:submit={submitUserInput}
			/>
		</div>
	</div>
</div>
