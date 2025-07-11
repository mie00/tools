<script lang="ts">
	import OllamaChat from '$lib/ollama/OllamaChat.svelte';
</script>

<svelte:head>
	<title>LLM Chat - Tools App</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<div class="container mx-auto px-4 py-8 h-screen flex flex-col">
		<header class="mb-8 flex-shrink-0">
			<a href="/" class="mb-4 inline-flex items-center text-blue-600 hover:text-blue-800">
				<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"
					></path>
				</svg>
				Back to Tools
			</a>
			<h1 class="text-3xl font-bold text-gray-800">LLM Chat</h1>
			<p class="text-gray-600 mt-2">
				Chat with AI models - both local (WebGPU) and remote (Ollama)
			</p>
		</header>

		<div class="rounded-2xl bg-white shadow-lg flex-1 min-h-0">
			<OllamaChat />
		</div>
	</div>
</div>
