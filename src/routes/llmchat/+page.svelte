<script lang="ts">
	import OllamaChat from '$lib/ollama/OllamaChat.svelte';
	import ToolLayout from '$lib/ToolLayout.svelte';
</script>

<ToolLayout title="LLM Chat">
	<p class="mb-4 text-gray-600">Chat with AI models - both local (WebGPU) and remote (Ollama)</p>
	<div class="min-h-0 flex-1">
		<OllamaChat />
	</div>
</ToolLayout>
