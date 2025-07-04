<script lang="ts">
	import { persistentTopics, activeTopicId } from './store';
	import type { ChatTopic } from './types';

	export let topics: ChatTopic[] = [];
	export let currentActiveTopicId: string | null = null;

	export let createNewTopic: () => void;
	export let deleteTopic: (topicId: string) => void;

	function handleSelectTopic(topicId: string) {
		activeTopicId.set(topicId);
	}
</script>

<div class="w-64 bg-gray-50 p-2 border-r border-gray-200">
	<h2 class="text-lg font-semibold mb-4 text-gray-700">Chats</h2>
	<button
		on:click={createNewTopic}
		class="w-full bg-blue-500 text-white p-2 rounded mb-4 hover:bg-blue-600"
	>
		+ New Chat
	</button>
	<ul>
		{#each topics as topic (topic.id)}
			<li
				class="flex justify-between items-center p-2 rounded {currentActiveTopicId === topic.id
					? 'bg-blue-100'
					: ''}"
			>
				<button
					class="w-full text-left truncate pr-2 {currentActiveTopicId === topic.id
						? 'text-blue-700'
						: 'text-gray-600'}"
					on:click={() => handleSelectTopic(topic.id)}
				>
					{topic.name}
				</button>
				<button
					on:click|stopPropagation={() => deleteTopic(topic.id)}
					class="text-gray-400 hover:text-red-600 p-1 rounded-full flex-shrink-0"
					title="Delete Chat"
				>
					🗑️
				</button>
			</li>
		{/each}
	</ul>
</div> 