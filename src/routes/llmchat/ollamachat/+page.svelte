<script lang="ts">
	import OllamaChat from '$lib/ollama/OllamaChat.svelte';
	import { T } from '$lib';
</script>

<svelte:head>
	<title>Ollama Chat - Tools App</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
	<div class="container mx-auto px-4 py-8">
		<header class="mb-8">
			<a href="/" class="mb-4 inline-flex items-center text-blue-600 hover:text-blue-800">
				<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"
					></path>
				</svg>
				Back to Tools
			</a>
			<h1 class="text-3xl font-bold text-gray-800"><T>Ollama Chat</T></h1>
		</header>

		<div class="rounded-2xl bg-white p-6 shadow-lg">
			<OllamaChat />
		</div>
	</div>
</div>
