<script lang="ts">
	import { marked } from 'marked';
	import 'highlight.js/styles/github.css';
	import CodeExecutor from './CodeExecutor.svelte';
	import CodeBlock from './CodeBlock.svelte';

	const {
		content,
		proseClass = '',
		llmMode = false
	} = $props<{
		content: string;
		proseClass?: string;
		llmMode?: boolean;
	}>();

	let mainEl: HTMLElement;
	let activeExecutors: Record<string, { code: string; type: 'js' | 'html'; wrapper: HTMLElement }> =
		$state({});

	const parts = $derived.by(() => {
		const newParts: { type: 'markdown' | 'code'; content: string; lang?: string }[] = [];
		const regex = /(```(\w*)\n([\s\S]*?)\n```)/g;
		let lastIndex = 0;
		let match;

		while ((match = regex.exec(content)) !== null) {
			// Add the markdown part before the code block
			if (match.index > lastIndex) {
				newParts.push({
					type: 'markdown',
					content: content.substring(lastIndex, match.index)
				});
			}
			// Add the code block
			newParts.push({
				type: 'code',
				content: match[3],
				lang: match[2] || 'plaintext'
			});
			lastIndex = match.index + match[0].length;
		}

		// Add any remaining markdown part
		if (lastIndex < content.length) {
			newParts.push({ type: 'markdown', content: content.substring(lastIndex) });
		}

		return newParts;
	});

	const renderer = new marked.Renderer();
	renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
		const language = (lang || '').trim().toLowerCase();
		const id = `codeblock-${Math.random().toString(36).substr(2, 9)}`;

		let btn = '';
		if (!llmMode) {
			if (language === 'js' || language === 'javascript') {
				btn = `<button class='exec-btn' data-type='js' data-id='${id}'><T>Execute</T></button>`;
			} else if (language === 'html') {
				btn = `<button class='exec-btn' data-type='html' data-id='${id}'><T>Render</T></button>`;
			}
		}

		return `<div class='code-block-wrapper' data-id='${id}'>
                <pre><code class='hljs language-${language}'>${text}</code></pre>
                <div class="button-container">${btn}</div>
            </div>`;
	};

	// Note: rawHtml was removed as the component now uses parts-based rendering

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

	function _handleClose(id: string) {
		const { [id]: _, ...rest } = activeExecutors;
		activeExecutors = rest;
	}
</script>

<div
	class="prose {proseClass}"
	bind:this={mainEl}
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeydown={handleKeyDown}
>
	{#each parts as part, index (index)}
		{#if part.type === 'markdown'}
			<!-- Safe: marked library sanitizes markdown content -->
			{@html marked(part.content, { renderer })}<!-- eslint-disable-line svelte/no-at-html-tags -->
		{:else if part.type === 'code'}
			<CodeBlock code={part.content} lang={part.lang || ''} />
		{/if}
	{/each}
</div>

{#each Object.entries(activeExecutors) as [id, { code, type, wrapper }] (id)}
	<div
		class="executor-portal"
		style:position="absolute"
		style:top="{wrapper.offsetTop + wrapper.offsetHeight}px"
		style:left="{wrapper.offsetLeft}px"
		style:width="{wrapper.offsetWidth}px"
	>
		<CodeExecutor {code} {type} />
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
	/* Style all links in markdown content */
	:global(.prose a) {
		color: #2563eb;
		text-decoration: underline;
		font-weight: 500;
		transition: color 0.2s;
		word-break: break-all;
	}
	:global(.prose a:hover) {
		color: #1d4ed8;
		text-decoration: underline wavy;
	}
	/* External link indicator */
	:global(.prose a[href^="http://"]::after),
	:global(.prose a[href^="https://"]::after)
	{
		content: ' ↗';
		font-size: 0.8em;
		color: #2563eb;
	}
</style>
