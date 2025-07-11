<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChatTopic } from './types';

	const dispatch = createEventDispatcher();

	export let activeTopic: ChatTopic | undefined;
	export let availableModels: string[];

	function handleUpdateSystemPrompt(prompt: string) {
		dispatch('updateSystemPrompt', prompt);
	}

	function handleUpdateModel(model: string) {
		dispatch('updateModel', model);
	}

	function handleUpdateModelSource(source: 'local' | 'remote') {
		dispatch('updateModelSource', source);
	}
</script>

<div class="p-4 bg-gray-50 border-b border-gray-200">
	<h3 class="font-semibold mb-4 text-gray-800 flex items-center gap-2">
		🔧 Chat Settings
	</h3>
	
	{#if activeTopic}
		<!-- Model Source Selection -->
		<div class="mb-4">
			<fieldset>
				<legend class="block text-sm font-medium text-gray-700 mb-2">Model Source</legend>
				<div class="flex space-x-4">
					<label class="flex items-center">
						<input
							type="radio"
							value="local"
							checked={activeTopic.modelSource === 'local'}
							on:change={() => handleUpdateModelSource('local')}
							class="mr-2"
						/>
						<span>Local Model</span>
					</label>
					<label class="flex items-center">
						<input
							type="radio"
							value="remote"
							checked={activeTopic.modelSource === 'remote'}
							on:change={() => handleUpdateModelSource('remote')}
							class="mr-2"
						/>
						<span>Remote Model (Ollama)</span>
					</label>
				</div>
			</fieldset>
		</div>

		<!-- Model Selection -->
		<div class="mb-4">
			<label for="model" class="block text-sm font-medium text-gray-700 mb-2">Model</label>
			{#if activeTopic.modelSource === 'local'}
				<input
					id="model"
					type="text"
					value="Qwen3-0.6B-ONNX (Local)"
					readonly
					class="w-full p-2 border rounded border-gray-300 bg-gray-100"
				/>
				<p class="text-xs text-gray-500 mt-1">
					ℹ️ Check Global Settings for WebGPU status and model loading
				</p>
			{:else}
				<select
					id="model"
					value={activeTopic.model}
					on:change={(e) => handleUpdateModel((e.target as HTMLSelectElement).value)}
					class="w-full p-2 border rounded border-gray-300"
				>
					{#each availableModels as model}
						<option value={model}>{model}</option>
					{:else}
						<option disabled>No models available</option>
					{/each}
				</select>
				{#if availableModels.length === 0}
					<p class="text-xs text-gray-500 mt-1">
						ℹ️ Check Global Settings to configure Ollama endpoint
					</p>
				{/if}
			{/if}
		</div>

		<!-- System Prompt -->
		<div class="mb-4">
			<label for="system-prompt" class="block text-sm font-medium text-gray-700 mb-2">System Prompt</label>
			<textarea
				id="system-prompt"
				value={activeTopic.systemPrompt}
				on:input={(e) => handleUpdateSystemPrompt((e.target as HTMLTextAreaElement).value)}
				rows="4"
				class="w-full p-2 border rounded border-gray-300"
				placeholder="Enter instructions for how the AI should behave in this chat..."
			></textarea>
			<p class="text-xs text-gray-500 mt-1">
				💡 This affects only this chat. Set defaults in Global Settings.
			</p>
		</div>
	{:else}
		<p class="text-gray-600 text-center py-8">
			📝 Select a chat to configure its specific settings
		</p>
	{/if}
</div> 