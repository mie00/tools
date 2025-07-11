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

<div class="flex h-full w-full flex-col border-r border-gray-200 bg-gray-50 p-2">
	<div class="mb-4 flex items-center justify-between">
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
		<div class="min-h-0 flex-1 overflow-y-auto">
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
			class="mb-4 w-full rounded bg-blue-500 p-2 text-white hover:bg-blue-600"
		>
			+ New Chat
		</button>
		<div class="flex-1 overflow-y-auto">
			<ul>
				{#each topics as topic (topic.id)}
					<li class="relative">
						<div
							class="w-full rounded text-left {currentActiveTopicId === topic.id
								? 'bg-blue-100'
								: ''} cursor-pointer hover:bg-gray-100"
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
							<div class="flex items-center justify-between p-2">
								<div
									class="flex items-center gap-2 truncate {currentActiveTopicId === topic.id
										? 'text-blue-700'
										: 'text-gray-600'}"
								>
									{#if topic.isDraft}
										<span class="text-xs text-orange-500">●</span>
									{/if}
									<span class="truncate">{topic.name}</span>
								</div>
								<button
									on:click|stopPropagation={() => handleDeleteTopic(topic.id)}
									class="z-10 flex-shrink-0 rounded-full p-1 text-gray-400 hover:text-red-600"
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
