<script lang="ts">
	import MarkdownRenderer from '../MarkdownRenderer.svelte';
	export let content: string;
	let collapsed = true;
</script>

<div class="my-2">
	<button
		on:click={() => (collapsed = !collapsed)}
		class="text-sm text-gray-500 hover:text-gray-700 w-full text-left flex items-center"
	>
		{#if collapsed}
			<span>[Model was thinking]</span>
		{:else}
			<span>[Hide model's thoughts]</span>
		{/if}
	</button>
	{#if !collapsed}
		<div class="mt-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 prose">
			<MarkdownRenderer content={content} />
		</div>
	{/if}
</div> 