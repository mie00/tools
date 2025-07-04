<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { ChatTopic, Message } from './types';
	import ChatMessage from './ChatMessage.svelte';
	import { createEventDispatcher } from 'svelte';

	export let activeTopic: ChatTopic | undefined;
	export let isLoading: boolean;

	let chatContainer: HTMLElement;
	let groupedMessages: (Message & { grouped?: Message[]; originalIndex: number })[] = [];
	let lastAssistantMessageIndex = -1;

	const dispatch = createEventDispatcher();

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	onMount(() => {
		scrollToBottom();
	});

	$: {
		const newGroupedMessages = [];
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
		groupedMessages = newGroupedMessages;
		lastAssistantMessageIndex = groupedMessages.findLastIndex((m) => m.role === 'assistant');

		tick().then(scrollToBottom);
	}

	function forward(event: any) {
		dispatch(event.type, event.detail);
	}
</script>

<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
	{#if activeTopic}
		{#each groupedMessages as message, loopIndex (message.id)}
			<ChatMessage
				{message}
				idx={message.originalIndex}
				{isLoading}
				canRegenerate={!isLoading &&
					!message.error &&
					((message.role === 'user' && loopIndex < groupedMessages.length - 1) ||
						(message.role === 'assistant' && loopIndex === lastAssistantMessageIndex))}
				on:startEdit={forward}
				on:cancelEdit={forward}
				on:saveEdit={forward}
				on:deleteMessage={forward}
				on:regenerateAssistant={forward}
				on:retryLastMessage={forward}
				on:generateAssistantResponse={forward}
				on:regenerateFromUser={forward}
			/>
		{:else}
			<p class="text-center text-gray-500">No messages yet. Start the conversation below.</p>
		{/each}
	{/if}
</div> 