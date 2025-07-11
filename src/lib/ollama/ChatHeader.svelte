<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChatTopic } from './types';

	export let activeTopic: ChatTopic | undefined;
	export let showTopics: boolean = true;
	export let showSettings: boolean = false;
	export let isLoading: boolean = false;

	const dispatch = createEventDispatcher();

	function toggleTopics() {
		dispatch('toggleTopics');
	}

	function toggleSettings() {
		dispatch('toggleSettings');
	}

	function stopGeneration() {
		dispatch('stopGeneration');
	}
</script>

<header class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
	<div class="flex items-center">
		<button on:click={toggleTopics} class="text-gray-500 hover:text-gray-800 mr-4" title="Toggle sidebar">
			{showTopics ? '✕' : '☰'}
		</button>
		<h1 class="text-xl font-semibold text-gray-800">{activeTopic?.name || 'Chat'}</h1>
		{#if activeTopic?.modelSource}
			<span class="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
				{activeTopic.modelSource}
			</span>
		{/if}
	</div>
	<div class="flex items-center space-x-2">
		{#if isLoading}
			<button on:click={stopGeneration} class="text-red-500 hover:text-red-700" title="Stop generation">
				⏹️
			</button>
		{/if}
		<button on:click={toggleSettings} class="text-gray-500 hover:text-gray-800" title="Settings">
			{showSettings ? '⚙️' : '⚙️'}
		</button>
	</div>
</header> 