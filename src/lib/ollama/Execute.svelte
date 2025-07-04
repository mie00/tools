<script lang="ts">
	import MarkdownRenderer from '../MarkdownRenderer.svelte';

	export let code: string;
	export let answer: string | null;

	let collapsed = true;
</script>

<div class="my-2">
	<button
		on:click={() => (collapsed = !collapsed)}
		class="text-sm text-gray-500 hover:text-gray-700 w-full text-left flex items-center"
	>
		{#if collapsed}
			<span>[Show code]</span>
		{:else}
			<span>[Hide code]</span>
		{/if}
	</button>
	{#if !collapsed}
		<div class="mt-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
			<h4 class="font-semibold text-gray-700">Code to be executed:</h4>
			<MarkdownRenderer content={code} />
			<h4 class="font-semibold text-gray-700 mt-2">Answer:</h4>
			{#if answer === null}
				<p>Executing...</p>
			{:else}
				<pre
					class="p-2 mt-2 text-sm bg-gray-100 border rounded max-h-64 overflow-auto whitespace-pre-wrap"
				>{answer}</pre>
			{/if}
		</div>
	{/if}
</div> 