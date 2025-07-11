<script lang="ts">
	import MarkdownRenderer from '../MarkdownRenderer.svelte';
	export let content: string;
	let collapsed = true;
</script>

<div class="my-2">
	<button
		on:click={() => (collapsed = !collapsed)}
		class="text-sm text-gray-500 hover:text-gray-700 w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
	>
		<span class="text-gray-400">{collapsed ? '▶' : '▼'}</span>
		{#if collapsed}
			<span class="italic">💭 View reasoning process</span>
		{:else}
			<span class="italic">🔍 Hide reasoning process</span>
		{/if}
	</button>
	{#if !collapsed}
		<div class="mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-300 rounded-r text-sm text-gray-700">
			<div class="mb-2 text-xs uppercase tracking-wide text-blue-600 font-semibold">
				🧠 Model's Reasoning
			</div>
			<div class="prose prose-sm max-w-none">
				<MarkdownRenderer content={content} />
			</div>
		</div>
	{/if}
</div> 