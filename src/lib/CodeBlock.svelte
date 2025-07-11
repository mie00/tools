<script lang="ts">
	import CodeExecutor from './CodeExecutor.svelte';
	import hljs from 'highlight.js';

	export let code: string;
	export let lang: string;

	let showExecutor = false;

	function handleClick() {
		showExecutor = !showExecutor;
	}

	$: highlightedCode = hljs.getLanguage(lang)
		? hljs.highlight(code, { language: lang }).value
		: code;
</script>

<div class="code-block-wrapper">
	<pre><code class="hljs language-{lang}">{@html highlightedCode}</code></pre>
	{#if lang === 'js' || lang === 'javascript' || lang === 'html'}
		<div class="button-container">
			<button class="exec-btn" on:click={handleClick}>
				{#if showExecutor}
					❌
				{:else if lang === 'html'}
					🖼️
				{:else}
					▶️
				{/if}
			</button>
		</div>
	{/if}

	{#if showExecutor}
		<div class="executor-container">
			<CodeExecutor {code} type={lang === 'html' ? 'html' : 'js'} />
		</div>
	{/if}
</div>

<style>
	.code-block-wrapper {
		position: relative;
		margin-bottom: 1rem;
		background-color: #f7fafc;
		padding: 1rem;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
	}
	.button-container {
		margin-top: 0.5rem;
	}
	.exec-btn {
		padding: 0.25rem 0.75rem;
		font-size: 0.9em;
		background: #2563eb;
		color: white;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
	}
	.exec-btn:hover {
		background: #1d4ed8;
	}
	.executor-container {
		margin-top: 1rem;
		border-top: 1px solid #e2e8f0;
		padding-top: 1rem;
	}
</style>
