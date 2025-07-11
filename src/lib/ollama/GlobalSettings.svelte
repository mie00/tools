<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChatConfig, ModelLoadingProgress, FileProgress } from './types';

	const dispatch = createEventDispatcher();

	export let config: ChatConfig;
	export let isModelLoaded: boolean = false;
	export let hasInitializationError: boolean = false;
	export let loadingProgress: ModelLoadingProgress;
	export let fileProgress: Record<string, FileProgress> = {};

	function handleUpdateConfig(updates: Partial<ChatConfig>) {
		dispatch('updateConfig', updates);
	}

	function handleRetryInitialization() {
		dispatch('retryInitialization');
	}

	function updateOllamaEndpoint(endpoint: string) {
		handleUpdateConfig({
			ollama: { ...config.ollama, endpoint }
		});
	}

	function updateOllamaTemperature(temperature: number) {
		handleUpdateConfig({
			ollama: { ...config.ollama, temperature }
		});
	}

	function updateOllamaTopK(topK: number) {
		handleUpdateConfig({
			ollama: { ...config.ollama, topK }
		});
	}

	function updateLocalTemperature(temperature: number) {
		handleUpdateConfig({
			local: { ...config.local, temperature }
		});
	}

	function updateLocalTopK(topK: number) {
		handleUpdateConfig({
			local: { ...config.local, topK }
		});
	}

	function updateLocalMaxTokens(maxTokens: number) {
		handleUpdateConfig({
			local: { ...config.local, maxTokens }
		});
	}

	function updateDefaultModelSource(source: 'local' | 'remote') {
		handleUpdateConfig({
			defaultModelSource: source
		});
	}
</script>

<div class="overflow-y-auto border-b border-gray-200 bg-gray-50 p-4">
	<h3 class="mb-4 flex items-center gap-2 font-semibold text-gray-800">⚙️ Global Settings</h3>

	<!-- Default Model Source -->
	<div class="mb-4">
		<label for="default-model-source" class="mb-2 block text-sm font-medium text-gray-700">
			Default Model Source for New Chats
		</label>
		<select
			id="default-model-source"
			value={config.defaultModelSource}
			on:change={(e) =>
				updateDefaultModelSource((e.target as HTMLSelectElement).value as 'local' | 'remote')}
			class="w-full rounded border border-gray-300 p-2"
		>
			<option value="local">Local Model</option>
			<option value="remote">Remote Model (Ollama)</option>
		</select>
	</div>

	<!-- Ollama Global Settings -->
	<div class="mb-4">
		<h4 class="mb-2 font-medium text-gray-700">🌐 Ollama Defaults</h4>
		<div class="grid grid-cols-1 gap-3">
			<div>
				<label for="ollama-endpoint" class="block text-sm text-gray-600">Endpoint</label>
				<input
					id="ollama-endpoint"
					type="text"
					value={config.ollama.endpoint}
					on:input={(e) => updateOllamaEndpoint((e.target as HTMLInputElement).value)}
					class="w-full rounded border border-gray-300 p-2"
					placeholder="http://localhost:11434"
				/>
			</div>
			<div>
				<label for="ollama-temperature" class="block text-sm text-gray-600">
					Default Temperature: {config.ollama.temperature}
				</label>
				<input
					id="ollama-temperature"
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={config.ollama.temperature}
					on:input={(e) =>
						updateOllamaTemperature(parseFloat((e.target as HTMLInputElement).value))}
					class="w-full"
				/>
			</div>
			<div>
				<label for="ollama-top-k" class="block text-sm text-gray-600">Default Top K</label>
				<input
					id="ollama-top-k"
					type="number"
					min="1"
					max="100"
					value={config.ollama.topK}
					on:input={(e) => updateOllamaTopK(parseInt((e.target as HTMLInputElement).value))}
					class="w-full rounded border border-gray-300 p-2"
				/>
			</div>
		</div>
	</div>

	<!-- Local Model Global Settings -->
	<div class="mb-4">
		<h4 class="mb-2 font-medium text-gray-700">🏠 Local Model Defaults</h4>
		<div class="grid grid-cols-1 gap-3">
			<div>
				<label for="local-temperature" class="block text-sm text-gray-600">
					Default Temperature: {config.local.temperature}
				</label>
				<input
					id="local-temperature"
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={config.local.temperature}
					on:input={(e) => updateLocalTemperature(parseFloat((e.target as HTMLInputElement).value))}
					class="w-full"
				/>
			</div>
			<div>
				<label for="local-top-k" class="block text-sm text-gray-600">Default Top K</label>
				<input
					id="local-top-k"
					type="number"
					min="1"
					max="100"
					value={config.local.topK}
					on:input={(e) => updateLocalTopK(parseInt((e.target as HTMLInputElement).value))}
					class="w-full rounded border border-gray-300 p-2"
				/>
			</div>
			<div>
				<label for="local-max-tokens" class="block text-sm text-gray-600">Default Max Tokens</label>
				<input
					id="local-max-tokens"
					type="number"
					min="1"
					max="4096"
					value={config.local.maxTokens}
					on:input={(e) => updateLocalMaxTokens(parseInt((e.target as HTMLInputElement).value))}
					class="w-full rounded border border-gray-300 p-2"
				/>
			</div>
		</div>
	</div>

	<!-- Local Model Status -->
	<div class="mb-4">
		<h4 class="mb-2 font-medium text-gray-700">💻 WebGPU & Local Model Status</h4>
		{#if !config.webGpuSupported}
			<div class="rounded bg-red-50 p-3 text-sm text-red-600">
				<p class="font-medium">❌ WebGPU not supported</p>
				<p class="mt-1">
					Local models cannot be used. Please use a WebGPU-compatible browser like Chrome 113+ or
					Edge 113+.
				</p>
			</div>
		{:else}
			<div class="mb-3 rounded bg-green-50 p-3 text-sm text-green-600">
				<p class="font-medium">✅ WebGPU supported</p>
				<p>F16 Shaders: {config.shaderF16Supported ? '✅ Supported' : '❌ Not supported'}</p>
			</div>

			{#if hasInitializationError}
				<div class="rounded bg-red-50 p-3 text-sm text-red-600">
					<p class="font-medium">❌ Local model error</p>
					<p>{loadingProgress.status}</p>
					<button
						on:click={handleRetryInitialization}
						class="mt-2 rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
					>
						🔄 Retry Loading
					</button>
				</div>
			{:else if isModelLoaded}
				<div class="rounded bg-green-50 p-3 text-sm text-green-600">
					<p class="font-medium">✅ Local model loaded</p>
					<p>Qwen3-0.6B-ONNX is ready for use</p>
				</div>
			{:else}
				<div class="rounded bg-blue-50 p-3 text-sm text-blue-600">
					<p class="font-medium">⏳ Loading local model</p>
					<p>{loadingProgress.status}</p>
					{#if Object.keys(fileProgress).length > 0}
						<div class="mt-2">
							{#each Object.values(fileProgress) as file}
								<div class="mb-1">
									<div class="flex justify-between text-xs">
										<span>{file.name}</span>
										<span>{Math.round(file.progress)}%</span>
									</div>
									<div class="h-2 w-full rounded-full bg-gray-200">
										<div
											class="h-2 rounded-full bg-blue-600 transition-all duration-300"
											style="width: {file.progress}%"
										></div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
