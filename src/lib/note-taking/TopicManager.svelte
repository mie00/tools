<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import T from '../T.svelte';

	let {
		topics = ['Main'],
		selectedTopic = 'Main',
		showNewTopicInput = false
	}: {
		topics: string[];
		selectedTopic: string;
		showNewTopicInput: boolean;
	} = $props();

	const dispatch = createEventDispatcher<{
		topicSelected: string;
		topicAdded: string;
		topicDeleted: string;
		noteMoved: { noteId: number; newTopic: string };
	}>();

	let newTopicName = $state('');

	function selectTopic(topic: string) {
		selectedTopic = topic;
		dispatch('topicSelected', topic);
	}

	function addTopic() {
		if (newTopicName.trim() && !topics.includes(newTopicName.trim())) {
			const topicName = newTopicName.trim();
			newTopicName = '';
			showNewTopicInput = false;
			dispatch('topicAdded', topicName);
		}
	}

	function deleteTopic(topicToDelete: string) {
		if (topicToDelete === 'Main') return; // Can't delete main

		if (confirm(`Delete topic "${topicToDelete}"? All notes will be moved to Main.`)) {
			dispatch('topicDeleted', topicToDelete);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			addTopic();
		} else if (event.key === 'Escape') {
			showNewTopicInput = false;
			newTopicName = '';
		}
	}
</script>

<!-- Topic Tabs -->
<div class="mb-6">
	<div class="flex flex-wrap items-center gap-2">
		{#each topics as topic (topic)}
			<div class="flex items-center">
				<button
					onclick={() => selectTopic(topic)}
					class="rounded-full px-4 py-2 text-sm font-medium transition-colors {selectedTopic ===
					topic
						? 'bg-blue-600 text-white'
						: 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
				>
					{topic}
				</button>
				{#if topic !== 'Main'}
					<button
						onclick={() => deleteTopic(topic)}
						class="ml-2 text-red-500 hover:text-red-700"
						title="Delete topic"
						aria-label="Delete topic {topic}"
					>
						×
					</button>
				{/if}
			</div>
		{/each}

		{#if showNewTopicInput}
			<input
				bind:value={newTopicName}
				onkeydown={handleKeydown}
				placeholder="Topic name"
				class="rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
			<div class="flex gap-1">
				<button
					onclick={addTopic}
					disabled={!newTopicName.trim()}
					class="rounded-full bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
					title="Add topic"
					aria-label="Add new topic"
				>
					✓
				</button>
				<button
					onclick={() => {
						showNewTopicInput = false;
						newTopicName = '';
					}}
					class="rounded-full bg-gray-500 px-3 py-2 text-sm text-white hover:bg-gray-600"
					title="Cancel"
					aria-label="Cancel adding topic"
				>
					×
				</button>
			</div>
		{:else}
			<button
				onclick={() => (showNewTopicInput = true)}
				class="rounded-full bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
				title="Add new topic"
				aria-label="Add new topic"
			>
				+ Add Topic
			</button>
		{/if}
	</div>
</div>

<!-- Topic Move Dropdown for Notes (only show when multiple topics exist) -->
{#if topics.length > 1}
	<div class="mb-4">
		<details class="text-sm text-gray-600">
			<summary class="cursor-pointer hover:text-gray-800"><T>Move notes between topics</T></summary>
			<div class="mt-2 text-xs">
				To move a note to a different topic, drag and drop it, or use the move button when editing a
				note.
			</div>
		</details>
	</div>
{/if}
