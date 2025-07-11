<script lang="ts">
	import type { ChatTopic } from './types';

	const { activeTopic, availableModels, onupdateSystemPrompt, onupdateModel, onupdateModelSource } =
		$props<{
			activeTopic: ChatTopic | undefined;
			availableModels: string[];
			onupdateSystemPrompt: (_prompt: string) => void;
			onupdateModel: (_model: string) => void;
			onupdateModelSource: (_source: 'local' | 'remote') => void;
		}>();

	function handleUpdateSystemPrompt(prompt: string) {
		onupdateSystemPrompt(prompt);
	}

	function handleUpdateModel(model: string) {
		onupdateModel(model);
	}

	function handleUpdateModelSource(source: 'local' | 'remote') {
		onupdateModelSource(source);
	}
</script>

<div class="border-b border-gray-200 bg-gray-50 p-4">
	<h3 class="mb-4 flex items-center gap-2 font-semibold text-gray-800">🔧 Chat Settings</h3>

	{#if activeTopic}
		<!-- Model Source Selection -->
		<div class="mb-4">
			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">Model Source</legend>
				<div class="flex space-x-4">
					<label class="flex items-center">
						<input
							type="radio"
							value="local"
							checked={activeTopic.modelSource === 'local'}
							onchange={() => handleUpdateModelSource('local')}
							class="mr-2"
						/>
						<span>Local Model</span>
					</label>
					<label class="flex items-center">
						<input
							type="radio"
							value="remote"
							checked={activeTopic.modelSource === 'remote'}
							onchange={() => handleUpdateModelSource('remote')}
							class="mr-2"
						/>
						<span>Remote Model (Ollama)</span>
					</label>
				</div>
			</fieldset>
		</div>

		<!-- Model Selection -->
		<div class="mb-4">
			<label for="model" class="mb-2 block text-sm font-medium text-gray-700">Model</label>
			{#if activeTopic.modelSource === 'local'}
				<input
					id="model"
					type="text"
					value="Qwen3-0.6B-ONNX (Local)"
					readonly
					class="w-full rounded border border-gray-300 bg-gray-100 p-2"
				/>
				<p class="mt-1 text-xs text-gray-500">
					ℹ️ Check Global Settings for WebGPU status and model loading
				</p>
			{:else}
				<select
					id="model"
					value={activeTopic.model}
					onchange={(e) => handleUpdateModel((e.target as HTMLSelectElement).value)}
					class="w-full rounded border border-gray-300 p-2"
				>
					{#each availableModels as model (model)}
						<option value={model}>{model}</option>
					{:else}
						<option disabled>No models available</option>
					{/each}
				</select>
				{#if availableModels.length === 0}
					<p class="mt-1 text-xs text-gray-500">
						ℹ️ Check Global Settings to configure Ollama endpoint
					</p>
				{/if}
			{/if}
		</div>

		<!-- System Prompt -->
		<div class="mb-4">
			<label for="system-prompt" class="mb-2 block text-sm font-medium text-gray-700"
				>System Prompt</label
			>
			<textarea
				id="system-prompt"
				value={activeTopic.systemPrompt}
				oninput={(e) => handleUpdateSystemPrompt((e.target as HTMLTextAreaElement).value)}
				rows="4"
				class="w-full rounded border border-gray-300 p-2"
				placeholder="Enter instructions for how the AI should behave in this chat..."
			></textarea>
			<p class="mt-1 text-xs text-gray-500">
				💡 This affects only this chat. Set defaults in Global Settings.
			</p>
		</div>
	{:else}
		<p class="py-8 text-center text-gray-600">
			📝 Select a chat to configure its specific settings
		</p>
	{/if}
</div>
