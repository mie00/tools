<script lang="ts">
	// T component for inline translation
	// Usage: <T>Hello World</T> or <T key="hello_world" />

	import { onMount } from 'svelte';
	import { translationStore, type Language } from './translation';

	// Props
	interface Props {
		key?: string;
		children?: any;
	}

	let { key, children }: Props = $props();

	// Component state
	let translatedText = $state('');
	let isLoading = $state(false);
	let currentLanguage: Language = $state({
		code: 'en',
		name: 'English',
		nativeName: 'English',
		rtl: false
	});

	// Get the source text from either key prop or slot content
	let sourceText = $state('');
	let slotElement = $state<HTMLElement>();

	// Function to extract text content from slot
	function extractTextContent(): string {
		if (key) {
			return key;
		}

		if (slotElement) {
			return slotElement.textContent || '';
		}

		// Fallback to children if available
		if (typeof children === 'string') {
			return children;
		}

		return '';
	}

	// Update source text when props change
	$effect(() => {
		const newSourceText = extractTextContent();
		if (newSourceText !== sourceText) {
			sourceText = newSourceText;
		}
	});

	// Subscribe to translation store
	$effect(() => {
		const unsubscribe = translationStore.subscribe((state) => {
			currentLanguage = translationStore.getCurrentLanguage();

			// Trigger translation when language or source text changes
			if (sourceText && state.isReady) {
				translateText();
			}
		});

		return unsubscribe;
	});

	// Translation function
	async function translateText() {
		if (!sourceText.trim()) {
			translatedText = sourceText;
			return;
		}

		isLoading = true;

		try {
			const result = await translationStore.translate(sourceText);
			translatedText = result;
		} catch (error) {
			console.warn('Translation failed:', error);
			translatedText = sourceText; // Fallback to original
		} finally {
			isLoading = false;
		}
	}

	// Initialize on mount
	onMount(() => {
		sourceText = extractTextContent();
		if (sourceText) {
			translateText();
		}
	});

	// Update text when slot content changes
	$effect(() => {
		if (slotElement) {
			const observer = new MutationObserver(() => {
				const newText = extractTextContent();
				if (newText !== sourceText) {
					sourceText = newText;
				}
			});

			observer.observe(slotElement, {
				childList: true,
				subtree: true,
				characterData: true
			});

			return () => observer.disconnect();
		}
	});
</script>

<!-- 
	Simple inline translation component
	RTL is handled at page level, not per element
-->
<span class="t-component" lang={currentLanguage.code}>
	{#if key}
		<!-- Key-based translation -->
		{#if isLoading}
			<span class="t-loading" aria-label="Translating...">{sourceText}</span>
		{:else}
			{translatedText || sourceText}
		{/if}
	{:else}
		<!-- Slot-based translation -->
		{#if isLoading}
			<span class="t-loading" aria-label="Translating...">
				<span bind:this={slotElement} style="display: none;">
					{@render children?.()}
				</span>
				{translatedText || sourceText}
			</span>
		{:else if translatedText && translatedText !== sourceText}
			{translatedText}
		{:else}
			<span bind:this={slotElement}>
				{@render children?.()}
			</span>
		{/if}
	{/if}
</span>

<style>
	.t-component {
		/* Base styles for translation component */
		display: inline;
	}

	.t-loading {
		/* Subtle loading indicator */
		opacity: 0.8;
		transition: opacity 0.2s ease;
	}

	/* Optional: Add a subtle animation for loading state */
	.t-loading::after {
		content: '';
		display: inline-block;
		width: 3px;
		height: 3px;
		margin-inline-start: 2px;
		background-color: currentColor;
		border-radius: 50%;
		opacity: 0.5;
		animation: t-pulse 1.5s ease-in-out infinite;
	}

	@keyframes t-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}
</style>
