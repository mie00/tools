<script lang="ts">
	import MarkdownRenderer from '../MarkdownRenderer.svelte';

	let {
		content
	}: {
		content: string;
	} = $props();

	let collapsed = $state(true);
</script>

<div class="my-2">
	<button
		onclick={() => (collapsed = !collapsed)}
		class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
	>
		<span class="text-gray-400">{collapsed ? '▶' : '▼'}</span>
		{#if collapsed}
			<span class="italic">💭 View reasoning process</span>
		{:else}
			<span class="italic">🔍 Hide reasoning process</span>
		{/if}
	</button>
	{#if !collapsed}
		<div
			class="mt-2 rounded-r border-l-4 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 text-sm text-gray-700"
		>
			<div class="mb-2 text-xs font-semibold tracking-wide text-blue-600 uppercase">
				🧠 Model's Reasoning
			</div>
			<div class="prose prose-sm max-w-none">
				<MarkdownRenderer {content} />
			</div>
		</div>
	{/if}
</div>
