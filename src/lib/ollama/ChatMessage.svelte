<script lang="ts">
	import type { Message } from './types';
	import MarkdownRenderer from '../MarkdownRenderer.svelte';
	import Thinking from './Thinking.svelte';
	import Execute from './Execute.svelte';

	const {
		message,
		idx,
		isLoading,
		canRegenerate,
		onstartEdit,
		oncancelEdit,
		onsaveEdit,
		ondeleteMessage,
		onretryLastMessage,
		onregenerateFromUser
	}: {
		message: Message & { grouped?: Message[] };
		idx: number;
		isLoading: boolean;
		canRegenerate: boolean;
		onstartEdit?: (_detail: { idx: number; content: string }) => void;
		oncancelEdit?: () => void;
		onsaveEdit?: (_detail: { idx: number; content: string }) => void;
		ondeleteMessage?: (_detail: { idx: number }) => void;
		onretryLastMessage?: () => void;
		onregenerateFromUser?: (_detail: { idx: number }) => void;
	} = $props();

	let editingContent = $state('');
	let editingIndex: number | null = $state(null);

	type Part =
		| { type: 'text'; content: string }
		| { type: 'think'; content: string }
		| { type: 'execute'; code: string; answer: string | null };

	let parts: Part[] = $state([]);

	$effect(() => {
		const newParts: Part[] = [];
		let contentToRender = '';
		let answerForExecute: string | null = null;

		if (message.grouped && message.grouped.length === 3) {
			const firstAssistantMsg = message.grouped[0];
			const userAnswerMsg = message.grouped[1];
			const secondAssistantMsg = message.grouped[2];

			// Combine content from both assistant messages for rendering
			contentToRender = firstAssistantMsg.content + '\\n' + secondAssistantMsg.content;

			const answerMatch = userAnswerMsg.content.match(/<answer>([\s\S]*?)<\/answer>/);
			answerForExecute = answerMatch ? answerMatch[1].trim() : null;
		} else {
			contentToRender = message.content;
		}

		if (contentToRender) {
			const regex = /(<think>[\s\S]*?<\/think>|<execute>[\s\S]*?<\/execute>)/g;
			const rawParts = contentToRender.split(regex);

			for (const part of rawParts) {
				if (part.startsWith('<think>')) {
					newParts.push({ type: 'think', content: part.slice(7, -8).trim() });
				} else if (part.startsWith('<execute>')) {
					const executeMatch = part.match(/<execute>([\s\S]*?)<\/execute>/);
					const code = executeMatch ? executeMatch[1].trim() : '';
					if (code) {
						newParts.push({ type: 'execute', code, answer: answerForExecute });
					}
				} else if (part) {
					newParts.push({ type: 'text', content: part });
				}
			}
		}
		parts = newParts;
	});

	function startEdit() {
		editingIndex = idx;
		editingContent = message.content;
		onstartEdit?.({ idx, content: message.content });
	}

	function cancelEdit() {
		editingIndex = null;
		oncancelEdit?.();
	}

	function saveEdit() {
		onsaveEdit?.({ idx, content: editingContent });
		editingIndex = null;
	}

	function deleteMessage() {
		ondeleteMessage?.({ idx });
	}

	function retryLastMessage() {
		onretryLastMessage?.();
	}

	function regenerateFromUser() {
		onregenerateFromUser?.({ idx });
	}
</script>

<div class="flex items-start gap-3 {message.role === 'user' ? 'justify-end' : ''}">
	{#if message.role === 'assistant'}
		<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-green-500">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 text-white"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M12 8V4H8" />
				<rect x="4" y="12" width="16" height="8" rx="2" />
				<path d="M2 12h2" />
				<path d="M20 12h2" />
				<path d="M12 12v-2" />
			</svg>
		</div>
	{/if}
	<div
		class="max-w-xl rounded-lg p-3 {message.role === 'user'
			? 'bg-blue-500 text-white'
			: message.error
				? 'bg-red-100 text-red-800'
				: 'bg-gray-100 text-gray-800'}"
	>
		{#if message.role === 'assistant'}
			{#if message.isLoading && !message.content}
				<div class="typing-indicator">
					<span></span>
					<span></span>
					<span></span>
				</div>
			{:else}
				{#each parts as part, index (index)}
					{#if part.type === 'text'}
						<MarkdownRenderer content={part.content} />
					{:else if part.type === 'think'}
						<Thinking content={part.content} />
					{:else if part.type === 'execute'}
						<Execute code={part.code} answer={part.answer} />
					{/if}
				{/each}

				{#if message.error}
					<button
						onclick={retryLastMessage}
						class="mt-2 text-sm font-semibold text-red-700 hover:underline"
					>
						Try again
					</button>
				{/if}
			{/if}

			{#if !message.grouped && message.role === 'assistant'}
				{#if editingIndex === idx}
					<textarea
						bind:value={editingContent}
						class="w-full rounded border border-gray-300 bg-white p-2 text-gray-800"
						rows="2"
					></textarea>
					<div class="mt-2 flex gap-2">
						<button
							onclick={saveEdit}
							class="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
							>💾</button
						>
						<button
							onclick={cancelEdit}
							class="rounded bg-gray-300 px-2 py-1 text-xs text-gray-800 hover:bg-gray-400"
							>❌</button
						>
					</div>
				{:else}
					<div class="mt-2 flex justify-end gap-2">
						<button onclick={startEdit} class="text-xs text-yellow-700 hover:underline">✏️</button>
						<button onclick={deleteMessage} class="text-xs text-red-700 hover:underline">🗑️</button>
					</div>
				{/if}
			{/if}
		{:else}
			<!-- User Message -->
			{#if editingIndex === idx}
				<textarea
					bind:value={editingContent}
					class="w-full rounded border-gray-300 bg-blue-400 p-2 text-white placeholder-gray-200"
					rows="2"
				></textarea>
				<div class="mt-2 flex gap-2">
					<button
						onclick={saveEdit}
						class="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600">💾</button
					>
					<button
						onclick={cancelEdit}
						class="rounded bg-gray-300 px-2 py-1 text-xs text-gray-800 hover:bg-gray-400">❌</button
					>
				</div>
			{:else}
				<MarkdownRenderer content={message.content} proseClass="prose-invert" />
				<div class="mt-2 flex items-center justify-end gap-2">
					<button
						onclick={startEdit}
						class="text-xs text-white opacity-70 hover:underline hover:opacity-100">✏️</button
					>
					<button
						onclick={deleteMessage}
						class="text-xs text-white opacity-70 hover:underline hover:opacity-100">🗑️</button
					>
					{#if canRegenerate}
						<button
							onclick={regenerateFromUser}
							class="text-xs text-white opacity-70 hover:underline hover:opacity-100"
							disabled={isLoading}
						>
							🔄
						</button>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
	{#if message.role === 'user' && !message.content.startsWith('<answer>')}
		<div
			class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-purple-500 font-semibold text-white"
		>
			U
		</div>
	{/if}
</div>

<style>
	.typing-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 24px;
	}
	.typing-indicator span {
		height: 8px;
		width: 8px;
		background-color: #9ca3af;
		border-radius: 50%;
		display: inline-block;
		margin: 0 2px;
		animation: bounce 1.4s infinite ease-in-out both;
	}
	.typing-indicator span:nth-child(1) {
		animation-delay: -0.32s;
	}
	.typing-indicator span:nth-child(2) {
		animation-delay: -0.16s;
	}
	.typing-indicator span:nth-child(3) {
		animation-delay: 0s;
	}
	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}
</style>
