<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { marked } from 'marked';
	import { markedHighlight } from 'marked-highlight';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/atom-one-light.css';

	import { persistentTopics, persistentConfig, activeTopicId } from './store';
	import type { Message, ChatTopic, OllamaConfig } from './types';

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
	let config: OllamaConfig;
	let currentActiveTopicId: string | null = null;

	let availableModels: string[] = [];
	let isLoading = false;
	let error: string | null = null;
	let showSettings = false;
	let showTopics = true;

	let abortController: AbortController | null = null;

	let activeTopic: ChatTopic | undefined;
	$: activeTopic = topics.find((t) => t.id === currentActiveTopicId);

	// Add state for editing
	let editingIndex: number | null = null;
	let editingContent = '';

	onMount(() => {
		// Load from localStorage and migrate old data
		const savedTopics = localStorage.getItem('ollamaChatTopics');
		if (savedTopics) {
			const loadedTopics: ChatTopic[] = JSON.parse(savedTopics);
			// Migration: Ensure all messages have a unique ID
			loadedTopics.forEach((topic) => {
				topic.messages.forEach((message) => {
					if (!message.id) {
						message.id = crypto.randomUUID();
					}
				});
			});
			persistentTopics.set(loadedTopics);
		}

		const savedConfig = localStorage.getItem('ollamaChatConfig');
		if (savedConfig) {
			persistentConfig.set(JSON.parse(savedConfig));
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

		if (topics.length === 0) {
			createNewTopic();
		}

		fetchAvailableModels();
	});

	async function fetchAvailableModels() {
		try {
			const response = await fetch(`${config.endpoint}/api/tags`);
			if (!response.ok) {
				throw new Error('Failed to fetch models');
			}
			const data = await response.json();
			availableModels = data.models.map((m: any) => m.name);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unknown error occurred';
			console.error(err);
		}
	}

	function createNewTopic() {
		const newTopic: ChatTopic = {
			id: crypto.randomUUID(),
			name: `Chat ${topics.length + 1}`,
			messages: [],
			systemPrompt: `You are a helpful assistant.
You go into conversation with the user so you answer.
Keep your answers short unless the user says otherwise.

Sometimes you need to know things that can easily be programmed, like the length of a string or the current date and time, etc.
In that case you can create a code snippet in javascript that calculates the answer and logs it,
make sure to log it to see the result, and the user will respond back with the output,
, use this output to write back the actual answer and don't answer by yourself, you need to encapsulate the snippets in <execute> tags,
the user will respond with the results enclosed with the tag <answer> so you can continue your answer based on this.
Do not ask the user to provide an answer or anything after wards, this happens automatically.
Also do not answer immediately after asking for code execution, instead stop after the closing tag and wait for a user response with the answer.
For instance, this can be an example conversion (commented, anything in parenthesis, except for console.log(), is meant for explanation in the prompt, do not use it):
User: how many characters are in the sentence "Hi, my name is mohamed"?
Assistant: Hmm, let me think... (the user sees this)
<execute> (the actual user doesn't see this)
\`\`\` (nor this)
console.log("Hi, my name is mohamed".length) (nor this, etc)
\`\`\`
</execute> (the user doesn't see this and you stop here)
User: <answer> (the user also doesn't see this)
22 (nor this)
</answer>
Assistant: It seems that the sentence you've mentioned contains 22 characters. (the user sees this as if it's in the same message as the first line "Hmm,")

Think before answering or coding, this usually holds better quality answers. Use <think> tags to enclose your thinking process, this will not be shown to the user as a part of the answer. Make sure that the thinking process is enclosed in a <think> tag and not sent as is. Do not send something like "the user is asking..." without enclosing them in a think tag. For example (with comments):
User: how many Wenesdays are there usually in one month.
Assistant:
<think> (note the think tag here, this is important)
The user is asking about ... the user probably means one calendar month. The user probably means Wednesdays and it's a typo. how many Wednesdays is equivalent to how many weeks. We can calculate the average number of days in a month and divide by 7 to get the ...
<think>
The average ...

Note that the actual user of the system doesn't see execute or answer tags or what's inside, so you'd need to continue your answer as if these do not exist.
You don't know anything about "now", the date you have is incorrect, so you'd always need to calculate it.`,
			model: availableModels[0] || 'llama2',
			createdAt: new Date().toISOString()
		};
		persistentTopics.update((currentTopics) => [...currentTopics, newTopic]);
		activeTopicId.set(newTopic.id);
	}

	function stopGeneration() {
		if (abortController) {
			abortController.abort();
		}
	}

	function deleteTopic(topicIdToDelete: string) {
		if (!confirm('Are you sure you want to delete this chat?')) {
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
		persistentTopics.set(topics);

		await generateAssistantResponse();
	}

	async function generateAssistantResponse(/*options?: { appendToMessageIndex?: number }*/) {
		if (!activeTopic) return;

		isLoading = true;
		error = null;

		abortController = new AbortController();

		const messagesToSend = activeTopic.messages
			.filter((m) => !m.error) // Exclude previous error messages from history
			.map(({ role, content }) => ({ role, content }));

		if (activeTopic.systemPrompt) {
			messagesToSend.unshift({ role: 'system', content: activeTopic.systemPrompt });
		}

		let placeholderIndex: number;
		let placeholderMessage: Message;
		// let baseContent = '';

		// if (options?.appendToMessageIndex !== undefined) {
		// 	placeholderIndex = options.appendToMessageIndex;
		// 	placeholderMessage = activeTopic.messages[placeholderIndex];
		// 	baseContent = placeholderMessage.content;
		// 	activeTopic.messages[placeholderIndex].isLoading = true;
		// } else {
		placeholderMessage = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			timestamp: new Date().toISOString(),
			isLoading: true
		};
		activeTopic.messages.push(placeholderMessage);
		placeholderIndex = activeTopic.messages.length - 1;
		// }
		persistentTopics.set(topics);

		try {
			const response = await fetch(`${config.endpoint}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: activeTopic.model,
					messages: messagesToSend,
					stream: true,
					options: {
						temperature: config.temperature,
						top_k: config.topK
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
							// if (options?.appendToMessageIndex === undefined) {
							activeTopic.messages[placeholderIndex].isLoading = false;
							// }
						}
						content += parsed.message.content;
						activeTopic.messages[placeholderIndex].content = content; // baseContent + content;

						// Handle thinking state
						const openThink = (
							activeTopic.messages[placeholderIndex].content.match(/<think>/g) || []
						).length;
						const closeThink = (
							activeTopic.messages[placeholderIndex].content.match(/<\/think>/g) || []
						).length;
						activeTopic.messages[placeholderIndex].isThinking = openThink > closeThink;

						persistentTopics.set(topics);
					}
				}
			}

			// --- Handle Code Execution ---
			const wasExecuted = await handleCodeExecution(placeholderIndex);
			// --- End Handle Code Execution ---

			// --- Title Generation ---
			if (!wasExecuted && activeTopic.name.startsWith('Chat ')) {
				const conversationLength = activeTopic.messages.reduce(
					(acc, msg) => acc + msg.content.length,
					0
				);
				if (conversationLength > TITLE_GENERATION_THRESHOLD) {
					generateTitle(activeTopic);
				}
			}
			// --- End Title Generation ---
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
			// Do NOT scroll to bottom here, let user read the response.
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
				persistentTopics.set(topics);

				// Regenerate assistant response, as a new message
				await generateAssistantResponse();
				return true;
			}
		}
		return false;
	}

	async function retryLastMessage() {
		if (!activeTopic) return;

		const lastMessage = activeTopic.messages[activeTopic.messages.length - 1];
		if (lastMessage?.error) {
			activeTopic.messages.pop(); // Remove the error message
			persistentTopics.set(topics);
			await generateAssistantResponse();
		}
	}

	async function generateTitle(topic: ChatTopic) {
		try {
			const conversationForTitle = topic.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
			const prompt = `${TITLE_GENERATION_PROMPT}\n${conversationForTitle}`;

			const response = await fetch(`${config.endpoint}/api/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: topic.model,
					prompt: prompt,
					stream: false,
					options: {
						temperature: 0.2
					}
				})
			});

			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(`Title generation failed: ${response.status} ${errorData}`);
			}

			const data = await response.json();
			let title = data.response.trim().replace(/["']/g, '');

			// Additional cleaning
			if (title.toLowerCase().startsWith('title:')) {
				title = title.substring(6).trim();
			}

			const topicIndex = topics.findIndex((t) => t.id === topic.id);
			if (topicIndex !== -1) {
				topics[topicIndex].name = title;
				persistentTopics.set(topics);
			}
		} catch (err) {
			console.error('Error generating title:', err);
			// Fail silently so it doesn't interrupt user
		}
	}

	function startEdit(event: CustomEvent<{ idx: number }>) {
		const index = event.detail.idx;
		editingIndex = index;
		editingContent = activeTopic?.messages[index]?.content || '';
	}

	function cancelEdit() {
		editingIndex = null;
		editingContent = '';
	}

	async function saveAndResubmit(event: CustomEvent<{ idx: number; content: string }>) {
		if (!activeTopic || isLoading) return;
		const { idx, content } = event.detail;

		// 1. Update the user's message
		activeTopic.messages[idx].content = content.trim();

		// 2. Remove all subsequent messages
		activeTopic.messages.splice(idx + 1);

		// 3. Reset editing state
		editingIndex = null;
		editingContent = '';

		// 4. Regenerate the assistant's response
		await generateAssistantResponse();
	}

	function deleteMessage(event: CustomEvent<{ idx: number }>) {
		const { idx } = event.detail;
		if (!activeTopic) return;
		// Remove user message and its assistant response if present
		activeTopic.messages.splice(idx, 1);
		if (activeTopic.messages[idx]?.role === 'assistant') {
			activeTopic.messages.splice(idx, 1);
		}
		persistentTopics.set(topics);
	}

	async function regenerateAssistant(event: CustomEvent<{ idx: number }>) {
		if (!activeTopic || isLoading) return;

		const { idx } = event.detail;

		// remove the assistant message
		activeTopic.messages.splice(idx);
		persistentTopics.set(topics);

		await generateAssistantResponse();
	}

	async function regenerateFromUserMessage(event: CustomEvent<{ idx: number }>) {
		if (!activeTopic || isLoading) return;
		const { idx } = event.detail;

		// Remove all subsequent messages
		activeTopic.messages.splice(idx + 1);
		persistentTopics.set(topics);

		// Regenerate the assistant's response
		await generateAssistantResponse();
	}
</script>

<div class="flex h-full bg-white rounded-lg shadow-md">
	<!-- Sidebar for topics -->
	{#if showTopics}
		<ChatSidebar {topics} {currentActiveTopicId} {createNewTopic} {deleteTopic} />
	{/if}

	<!-- Main chat area -->
	<div class="flex flex-col flex-1 h-screen">
		<ChatHeader
			{activeTopic}
			on:toggleTopics={() => (showTopics = !showTopics)}
			on:toggleSettings={() => (showSettings = !showSettings)}
		/>

		<!-- Settings -->
		{#if showSettings && activeTopic}
			<ChatSettings {activeTopic} {config} {availableModels} />
		{/if}

		<!-- Chat messages -->
		{#if config}
			<ChatMessageArea
				{activeTopic}
				{isLoading}
				on:startEdit={startEdit}
				on:cancelEdit={cancelEdit}
				on:saveEdit={saveAndResubmit}
				on:deleteMessage={deleteMessage}
				on:regenerateAssistant={regenerateAssistant}
				on:regenerateFromUser={regenerateFromUserMessage}
			/>
		{/if}

		<!-- Chat input -->
		<ChatInput {isLoading} on:submit={submitUserInput} on:stop={stopGeneration} />
	</div>
</div>

<style>
</style> 