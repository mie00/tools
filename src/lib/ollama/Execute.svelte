<script lang="ts">
	import MarkdownRenderer from '../MarkdownRenderer.svelte';

	let {
		code,
		answer
	}: {
		code: string;
		answer: string | null;
	} = $props();

	let collapsed = $state(true);
</script>

<div class="my-2">
	<button
		onclick={() => (collapsed = !collapsed)}
		class="flex w-full items-center text-left text-sm text-gray-500 hover:text-gray-700"
	>
		{#if collapsed}
			<span>[Show code]</span>
		{:else}
			<span>[Hide code]</span>
		{/if}
	</button>
	{#if !collapsed}
		<div class="mt-1 rounded border border-gray-200 bg-gray-50 p-2 text-sm text-gray-600">
			<h4 class="font-semibold text-gray-700">Code to be executed:</h4>
			<MarkdownRenderer content={code} />
			<h4 class="mt-2 font-semibold text-gray-700">Answer:</h4>
			{#if answer === null}
				<p>Executing...</p>
			{:else}
				<pre
					class="mt-2 max-h-64 overflow-auto rounded border bg-gray-100 p-2 text-sm whitespace-pre-wrap">{answer}</pre>
			{/if}
		</div>
	{/if}
</div>
