<script lang="ts">
	import { persistentTopics, persistentConfig } from './store';
	import type { ChatTopic, OllamaConfig } from './types';

	export let activeTopic: ChatTopic;
	export let config: OllamaConfig;
	export let availableModels: string[];

	function save() {
		persistentConfig.set(config);
		persistentTopics.update((topics) => {
			const index = topics.findIndex((t) => t.id === activeTopic.id);
			if (index !== -1) {
				topics[index] = activeTopic;
			}
			return topics;
		});
	}
</script>

<div class="p-4 bg-gray-50 border-b border-gray-200">
	<h3 class="font-semibold mb-2 text-gray-800">Configuration</h3>
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="endpoint" class="text-gray-700">Ollama Endpoint</label>
			<input
				type="text"
				id="endpoint"
				bind:value={config.endpoint}
				class="w-full p-2 border rounded border-gray-300"
			/>
		</div>
		<div>
			<label for="model" class="text-gray-700">Model</label>
			<select
				id="model"
				bind:value={activeTopic.model}
				class="w-full p-2 border rounded border-gray-300"
			>
				{#each availableModels as model}
					<option value={model}>{model}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="temp" class="text-gray-700">Temperature: {config.temperature}</label>
			<input
				type="range"
				id="temp"
				min="0"
				max="1"
				step="0.1"
				bind:value={config.temperature}
				class="w-full"
			/>
		</div>
		<div>
			<label for="topk" class="text-gray-700">Top K</label>
			<input
				type="number"
				id="topk"
				bind:value={config.topK}
				class="w-full p-2 border rounded border-gray-300"
			/>
		</div>
	</div>
	<div class="mt-4">
		<label for="system-prompt" class="text-gray-700">System Prompt</label>
		<textarea
			id="system-prompt"
			bind:value={activeTopic.systemPrompt}
			on:input={save}
			rows="3"
			class="w-full p-2 border rounded border-gray-300"
		></textarea>
	</div>
	<button on:click={save} class="mt-2 bg-green-500 hover:bg-green-600 text-white p-2 rounded">
		Save Config
	</button>
</div> 