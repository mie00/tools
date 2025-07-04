<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChatTopic } from './types';

	export let activeTopic: ChatTopic | undefined;

	const dispatch = createEventDispatcher();

	function toggleTopics() {
		dispatch('toggleTopics');
	}

	function toggleSettings() {
		dispatch('toggleSettings');
	}
</script>

<header class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
	<div class="flex items-center">
		<button on:click={toggleTopics} class="text-gray-500 hover:text-gray-800 mr-4">📂</button>
		<h1 class="text-xl font-semibold text-gray-800">{activeTopic?.name || 'Chat'}</h1>
	</div>
	<button on:click={toggleSettings} class="text-gray-500 hover:text-gray-800">⚙️</button>
</header> 