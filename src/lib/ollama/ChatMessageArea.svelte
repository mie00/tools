<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { ChatTopic, Message } from './types';
	import ChatMessage from './ChatMessage.svelte';
	import T from '../T.svelte';

	const { activeTopic, oneditMessage, onsaveEdit, oncancelEdit } = $props<{
		activeTopic: ChatTopic | undefined;
		oneditMessage: (_detail: { index: number; content: string }) => void;
		onsaveEdit: (_detail: { index: number; content: string }) => void;
		oncancelEdit: () => void;
	}>();

	let chatContainer: HTMLElement;
	let _lastAssistantMessageIndex = -1;

	const groupedMessages = $derived.by(() => {
		const newGroupedMessages: (Message & { grouped?: Message[]; originalIndex: number })[] = [];
		if (activeTopic) {
			const messages = activeTopic.messages;
			let i = 0;
			while (i < messages.length) {
				const currentMsg = messages[i];
				const nextMsg = messages[i + 1];
				const thirdMsg = messages[i + 2];

				if (
					currentMsg.role === 'assistant' &&
					currentMsg.content.includes('<execute>') &&
					nextMsg?.role === 'user' &&
					nextMsg?.content.startsWith('<answer>') &&
					thirdMsg?.role === 'assistant'
				) {
					const combinedMessage = {
						...currentMsg,
						id: currentMsg.id,
						grouped: [currentMsg, nextMsg, thirdMsg],
						originalIndex: i
					};
					newGroupedMessages.push(combinedMessage);
					i += 3;
				} else {
					newGroupedMessages.push({ ...currentMsg, originalIndex: i });
					i++;
				}
			}
		}
		return newGroupedMessages;
	});

	$effect(() => {
		_lastAssistantMessageIndex = groupedMessages.findLastIndex((m) => m.role === 'assistant');
		tick().then(scrollToBottom);
	});

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	onMount(() => {
		scrollToBottom();
	});

	function handleEditMessage(detail: { idx: number; content: string }) {
		oneditMessage({ index: detail.idx, content: detail.content });
	}

	function handleSaveEdit(detail: { idx: number; content: string }) {
		onsaveEdit({ index: detail.idx, content: detail.content });
	}

	function handleCancelEdit() {
		oncancelEdit();
	}
</script>

<div bind:this={chatContainer} class="h-full space-y-4 overflow-y-auto bg-white p-4">
	{#if activeTopic}
		{#each groupedMessages as message, _loopIndex (message.id)}
			<ChatMessage
				{message}
				idx={message.originalIndex}
				isLoading={false}
				canRegenerate={false}
				onstartEdit={handleEditMessage}
				onsaveEdit={handleSaveEdit}
				oncancelEdit={handleCancelEdit}
			/>
		{:else}
			<p class="text-center text-gray-500 py-8">
				<T>No messages yet. Start the conversation below.</T>
			</p>
		{/each}
	{/if}
</div>
