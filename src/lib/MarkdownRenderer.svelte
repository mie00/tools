<script lang="ts">
	import { marked } from 'marked';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/github.css';
	import CodeExecutor from './CodeExecutor.svelte';
	import { onMount } from 'svelte';
	import CodeBlock from './CodeBlock.svelte';

	export let content: string;
	export let proseClass: string = '';

	let mainEl: HTMLElement;
	let activeExecutors: Record<string, { code: string; type: 'js' | 'html'; wrapper: HTMLElement }> =
		{};

	let parts: { type: 'markdown' | 'code'; content: string; lang?: string }[] = [];

	$: {
		parts = [];
		const regex = /(```(\w*)\n([\s\S]*?)\n```)/g;
		let lastIndex = 0;
		let match;

		while ((match = regex.exec(content)) !== null) {
			// Add the markdown part before the code block
			if (match.index > lastIndex) {
				parts.push({
					type: 'markdown',
					content: content.substring(lastIndex, match.index)
				});
			}
			// Add the code block
			parts.push({
				type: 'code',
				content: match[3],
				lang: match[2] || 'plaintext'
			});
			lastIndex = match.index + match[0].length;
		}

		// Add any remaining markdown part
		if (lastIndex < content.length) {
			parts.push({ type: 'markdown', content: content.substring(lastIndex) });
		}
	}

	const renderer = new marked.Renderer();
	renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
		const language = (lang || '').trim().toLowerCase();
		const id = `codeblock-${Math.random().toString(36).substr(2, 9)}`;

		let btn = '';
		if (language === 'js' || language === 'javascript') {
			btn = `<button class='exec-btn' data-type='js' data-id='${id}'>Execute</button>`;
		} else if (language === 'html') {
			btn = `<button class='exec-btn' data-type='html' data-id='${id}'>Render</button>`;
		}

		return `<div class='code-block-wrapper' data-id='${id}'>
                <pre><code class='hljs language-${language}'>${text}</code></pre>
                <div class="button-container">${btn}</div>
            </div>`;
	};

	let rawHtml: string | Promise<string> = '';
	$: try {
		rawHtml = marked(content, { renderer });
	} catch (e) {
		rawHtml = `<p>Error parsing markdown.</p>`;
	}

	async function handleClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		handleButtonClick(target);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const target = event.target as HTMLElement;
			handleButtonClick(target);
		}
	}

	function handleButtonClick(target: HTMLElement) {
		if (target.classList.contains('exec-btn')) {
			const id = target.dataset.id;
			if (!id) return;

			const wrapper = target.closest('.code-block-wrapper') as HTMLElement;
			const codeBlock = wrapper?.querySelector('code');

			if (codeBlock) {
				const code = codeBlock.textContent || '';
				activeExecutors = {
					...activeExecutors,
					[id]: {
						code,
						type: target.dataset.type as 'js' | 'html',
						wrapper
					}
				};
			}
		}
	}

	function handleClose(id: string) {
		const { [id]: _, ...rest } = activeExecutors;
		activeExecutors = rest;
	}
</script>

<div
	class="prose {proseClass}"
	bind:this={mainEl}
	role="button"
	tabindex="0"
	on:click={handleClick}
	on:keydown={handleKeyDown}
>
	{#each parts as part}
		{#if part.type === 'markdown'}
			{@html marked(part.content)}
		{:else if part.type === 'code'}
			<CodeBlock code={part.content} lang={part.lang || ''} />
		{/if}
	{/each}
</div>

{#each Object.entries(activeExecutors) as [id, { code, type, wrapper }]}
	<div
		class="executor-portal"
		style:position="absolute"
		style:top="{wrapper.offsetTop + wrapper.offsetHeight}px"
		style:left="{wrapper.offsetLeft}px"
		style:width="{wrapper.offsetWidth}px"
	>
		<CodeExecutor {code} {type} on:close={() => handleClose(id)} />
	</div>
{/each}

<style>
	:global(.code-block-wrapper) {
		position: relative;
		margin-bottom: 1rem;
	}
	:global(.button-container) {
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
	.executor-portal {
		z-index: 10;
	}
</style>
