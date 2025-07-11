<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChatTopic } from './types';

	let {
		activeTopic,
		showTopics = true,
		showSettings = false,
		isLoading = false
	}: {
		activeTopic: ChatTopic | undefined;
		showTopics: boolean;
		showSettings: boolean;
		isLoading: boolean;
	} = $props();

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

<header class="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
	<div class="flex items-center">
		<button
			onclick={toggleTopics}
			class="mr-4 text-gray-500 hover:text-gray-800"
			title="Toggle sidebar"
		>
			{showTopics ? '✕' : '☰'}
		</button>
		<h1 class="text-xl font-semibold text-gray-800">{activeTopic?.name || 'Chat'}</h1>
		{#if activeTopic?.modelSource}
			<span class="ml-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
				{activeTopic.modelSource}
			</span>
		{/if}
	</div>
	<div class="flex items-center space-x-2">
		{#if isLoading}
			<button
				onclick={stopGeneration}
				class="text-red-500 hover:text-red-700"
				title="Stop generation"
			>
				⏹️
			</button>
		{/if}
		<button onclick={toggleSettings} class="text-gray-500 hover:text-gray-800" title="Settings">
			{showSettings ? '⚙️' : '⚙️'}
		</button>
	</div>
</header>
