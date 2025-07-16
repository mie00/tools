<script lang="ts">
	import type { ChatTopic, ChatConfig, ModelLoadingProgress, FileProgress } from './types';
	import GlobalSettings from './GlobalSettings.svelte';
	import T from '../T.svelte';

	const {
		topics = [],
		currentActiveTopicId = null,
		config,
		isModelLoaded = false,
		hasInitializationError = false,
		loadingProgress,
		fileProgress = {},
		onselectTopic,
		oncreateTopic,
		ondeleteTopic,
		ontoggleTopics,
		onupdateConfig,
		onretryInitialization
	} = $props<{
		topics?: ChatTopic[];
		currentActiveTopicId?: string | null;
		config: ChatConfig;
		isModelLoaded?: boolean;
		hasInitializationError?: boolean;
		loadingProgress: ModelLoadingProgress;
		fileProgress?: Record<string, FileProgress>;
		onselectTopic: (_topicId: string) => void;
		oncreateTopic: () => void;
		ondeleteTopic: (_topicId: string) => void;
		ontoggleTopics: () => void;
		onupdateConfig: (_updates: Partial<ChatConfig>) => void;
		onretryInitialization: () => void;
	}>();

	let showGlobalSettings = $state(false);

	function handleSelectTopic(topicId: string) {
		onselectTopic(topicId);
	}

	function handleCreateTopic() {
		oncreateTopic();
	}

	function handleDeleteTopic(topicId: string) {
		ondeleteTopic(topicId);
	}

	function handleToggleTopics() {
		ontoggleTopics();
	}

	function handleUpdateConfig(updates: Partial<ChatConfig>) {
		onupdateConfig(updates);
	}

	function handleRetryInitialization() {
		onretryInitialization();
	}
</script>

<div class="flex h-full w-full flex-col border-r border-gray-200 bg-gray-50 p-2">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-gray-700"><T>Chats</T></h2>
		<div class="flex items-center gap-2">
			<button
				onclick={() => (showGlobalSettings = !showGlobalSettings)}
				class="text-gray-600 hover:text-gray-800"
				title="Global Settings"
			>
				⚙️
			</button>
			<button
				onclick={handleToggleTopics}
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
				onupdateConfig={handleUpdateConfig}
				onretryInitialization={handleRetryInitialization}
			/>
		</div>
	{:else}
		<button
			onclick={handleCreateTopic}
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
							onclick={() => handleSelectTopic(topic.id)}
							onkeydown={(e) => {
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
									onclick={(e) => {
										e.stopPropagation();
										handleDeleteTopic(topic.id);
									}}
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
