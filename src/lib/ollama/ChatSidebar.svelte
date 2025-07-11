<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChatTopic, ChatConfig, ModelLoadingProgress, FileProgress } from './types';
	import GlobalSettings from './GlobalSettings.svelte';

	const dispatch = createEventDispatcher();

	export let topics: ChatTopic[] = [];
	export let currentActiveTopicId: string | null = null;
	export let config: ChatConfig;
	export let isModelLoaded: boolean = false;
	export let hasInitializationError: boolean = false;
	export let loadingProgress: ModelLoadingProgress;
	export let fileProgress: Record<string, FileProgress> = {};

	let showGlobalSettings = false;

	function handleSelectTopic(topicId: string) {
		dispatch('selectTopic', topicId);
	}

	function handleCreateTopic() {
		dispatch('createTopic');
	}

	function handleDeleteTopic(topicId: string) {
		dispatch('deleteTopic', topicId);
	}

	function handleToggleTopics() {
		dispatch('toggleTopics');
	}

	function handleUpdateConfig(event: CustomEvent<Partial<ChatConfig>>) {
		dispatch('updateConfig', event.detail);
	}

	function handleRetryInitialization() {
		dispatch('retryInitialization');
	}
</script>

<div class="w-full bg-gray-50 p-2 border-r border-gray-200 h-full flex flex-col">
	<div class="flex justify-between items-center mb-4">
		<h2 class="text-lg font-semibold text-gray-700">Chats</h2>
		<div class="flex items-center gap-2">
			<button
				on:click={() => (showGlobalSettings = !showGlobalSettings)}
				class="text-gray-600 hover:text-gray-800"
				title="Global Settings"
			>
				⚙️
			</button>
			<button
				on:click={handleToggleTopics}
				class="text-gray-600 hover:text-gray-800"
				title="Close sidebar"
			>
				✕
			</button>
		</div>
	</div>

	{#if showGlobalSettings}
		<div class="flex-1 min-h-0 overflow-y-auto">
			<GlobalSettings 
				{config}
				{isModelLoaded}
				{hasInitializationError}
				{loadingProgress}
				{fileProgress}
				on:updateConfig={handleUpdateConfig}
				on:retryInitialization={handleRetryInitialization}
			/>
		</div>
	{:else}
		<button
			on:click={handleCreateTopic}
			class="w-full bg-blue-500 text-white p-2 rounded mb-4 hover:bg-blue-600"
		>
			+ New Chat
		</button>
		<div class="flex-1 overflow-y-auto">
			<ul>
				{#each topics as topic (topic.id)}
					<li class="relative">
						<div
							class="w-full text-left rounded {currentActiveTopicId === topic.id
								? 'bg-blue-100'
								: ''} hover:bg-gray-100 cursor-pointer"
							role="button"
							tabindex="0"
							on:click={() => handleSelectTopic(topic.id)}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleSelectTopic(topic.id);
								}
							}}
						>
							<div class="flex justify-between items-center p-2">
								<div class="flex items-center gap-2 truncate {currentActiveTopicId === topic.id
									? 'text-blue-700'
									: 'text-gray-600'}">
									{#if topic.isDraft}
										<span class="text-orange-500 text-xs">●</span>
									{/if}
									<span class="truncate">{topic.name}</span>
								</div>
								<button
									on:click|stopPropagation={() => handleDeleteTopic(topic.id)}
									class="text-gray-400 hover:text-red-600 p-1 rounded-full flex-shrink-0 z-10"
									title="Delete Chat"
								>
									🗑️
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div> 