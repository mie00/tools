<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto, replaceState } from '$app/navigation';
	import { browser } from '$app/environment';
	import { analyzeInput } from './smart-input/analysis';
	import {
		appConfigs,
		getShortcutMapping,
		getConfidenceColor,
		getConfidenceLabel
	} from './smart-input/shortcuts';
	import type { AppSuggestion } from './smart-input/analysis';
	import AiAssistant from './smart-input/AiAssistant.svelte';
	import T from './T.svelte';

	let inputText = $state('');
	let suggestions: AppSuggestion[] = $state([]);
	let showSuggestions = $state(false);
	let inputElement: HTMLTextAreaElement | undefined = $state();
	let selectedSuggestionIndex = $state(-1);
	let shortcutsActive = $state(false);
	let lastProcessedInput = '';

	// Enhance onMount to load URL params
	onMount(() => {
		if (browser) {
			const urlParams = new URLSearchParams($page.url.search);
			const queryParam = urlParams.get('q');
			if (queryParam) {
				inputText = queryParam;
				shortcutsActive = true; // Auto-enable shortcuts when loaded from URL
				// Focus the textarea to enable keyboard shortcuts immediately
				tick().then(() => {
					if (inputElement) {
						inputElement.focus();
					}
				});
			}
		}
	});

	// Debounced URL update
	let urlUpdateTimeout: ReturnType<typeof setTimeout>;

	// Update URL params when input changes
	function updateUrlParams(value: string) {
		if (!browser) return;

		const url = new URL(window.location.href);
		if (value.trim()) {
			url.searchParams.set('q', value);
		} else {
			url.searchParams.delete('q');
		}

		// Use SvelteKit's replaceState to properly update URL
		replaceState(url.toString(), {});
	}

	// Handle keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		// Handle Ctrl+Enter to toggle shortcut mode
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			shortcutsActive = !shortcutsActive;
			if (shortcutsActive) {
				selectedSuggestionIndex = -1; // Reset selection when entering shortcut mode
			}
			return;
		}

		// Handle Escape to exit shortcut mode
		if (event.key === 'Escape') {
			event.preventDefault();
			shortcutsActive = false;
			selectedSuggestionIndex = -1;
			return;
		}

		// If shortcuts are not active, only handle Ctrl+Enter and Escape
		if (!shortcutsActive) {
			return;
		}

		if (!showSuggestions || suggestions.length === 0) return;

		// Handle letter shortcuts for direct selection (only when shortcuts are active)
		if (event.key.length === 1 && event.key >= 'a' && event.key <= 'z') {
			const shortcutMapping = getShortcutMapping();
			const suggestionId = shortcutMapping[event.key];

			if (suggestionId) {
				// Find the suggestion with this ID
				const suggestionIndex = suggestions.findIndex((s) => s.id === suggestionId);
				if (suggestionIndex >= 0) {
					event.preventDefault();
					selectSuggestion(suggestionIndex);
					return;
				}
			}
			// If it's a letter but not a valid shortcut, exit shortcut mode
			shortcutsActive = false;
			selectedSuggestionIndex = -1;
			return;
		}

		// Handle arrow keys for navigation
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
			return;
		}

		// Handle Enter to select highlighted suggestion
		if (event.key === 'Enter' && selectedSuggestionIndex >= 0) {
			event.preventDefault();
			selectSuggestion(selectedSuggestionIndex);
			return;
		}

		// If shortcuts are active and user types anything other than the above keys, exit shortcut mode
		// (excluding special keys like Shift, Ctrl, Alt, etc.)
		if (
			event.key.length === 1 ||
			event.key === 'Backspace' ||
			event.key === 'Delete' ||
			event.key === 'Tab'
		) {
			shortcutsActive = false;
			selectedSuggestionIndex = -1;
		}
	}

	// Function to select a suggestion and navigate to it
	function selectSuggestion(index: number) {
		if (index >= 0 && index < suggestions.length) {
			const suggestion = suggestions[index];
			// Check if URL is external (starts with http/https) or internal
			if (suggestion.url.startsWith('http://') || suggestion.url.startsWith('https://')) {
				// External URL - use window.location
				window.location.href = suggestion.url;
			} else {
				// Internal URL - use goto
				goto(suggestion.url);
			}
		}
	}

	// React to input changes for suggestions only
	$effect(() => {
		// Prevent redundant processing to avoid potential loops
		if (inputText === lastProcessedInput) return;
		lastProcessedInput = inputText;

		if (inputText.trim()) {
			suggestions = analyzeInput(inputText);
			showSuggestions = suggestions.length > 0;
			selectedSuggestionIndex = -1; // Reset selection when suggestions change

			// Auto-redirect for high-confidence suggestions (like bang shortcuts) ONLY when shortcuts are active
			if (shortcutsActive) {
				const autoRedirectSuggestion = suggestions.find((s) => s.confidence >= 1.0);
				if (autoRedirectSuggestion) {
					// Automatically navigate to the suggestion
					if (
						autoRedirectSuggestion.url.startsWith('http://') ||
						autoRedirectSuggestion.url.startsWith('https://')
					) {
						// External URL - use window.location
						window.location.href = autoRedirectSuggestion.url;
					} else {
						// Internal URL - use goto
						goto(autoRedirectSuggestion.url);
					}
					return; // Exit early to prevent further processing
				}
			}
		} else {
			suggestions = [];
			showSuggestions = false;
			selectedSuggestionIndex = -1;
			shortcutsActive = false; // Reset shortcuts when input is empty
		}
	});

	// Handle input changes for URL updates (separate from $effect)
	function handleInputChange(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		inputText = target.value;

		// Debounce URL updates to avoid excessive navigation (only on client side)
		if (browser) {
			clearTimeout(urlUpdateTimeout);
			urlUpdateTimeout = setTimeout(() => {
				updateUrlParams(inputText);
			}, 300);
		}
	}
</script>

<div class="space-y-4">
	<div class="text-center">
		<h2 class="mb-2 text-xl font-bold text-gray-800"><T>Smart Tool Suggestions</T></h2>
		<p class="text-sm text-gray-600">
			Type or paste something, and I'll suggest the best tools for the job
		</p>
	</div>

	<!-- Input Area -->
	<div class="relative">
		<textarea
			bind:this={inputElement}
			value={inputText}
			oninput={handleInputChange}
			onkeydown={handleKeydown}
			placeholder="Try: 2+3*4, 10 meters to feet, 5 kg in pounds, 100°F to celsius, #FF5733, translate to Spanish, multi-line translate commands, 1234567890, https://example.com, JSON, $AAPL... (Press Ctrl+Enter when ready to select)"
			class="focus:ring-opacity-50 w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 {shortcutsActive
				? 'border-blue-300 bg-blue-50'
				: ''}"
			rows="3"
		></textarea>

		{#if inputText.trim()}
			<div class="absolute top-2 right-2 flex items-center space-x-2">
				{#if shortcutsActive}
					<div
						class="rounded border border-blue-300 bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
					>
						Shortcuts Active
					</div>
				{/if}
				<button
					onclick={() => {
						inputText = '';
						// Clear URL parameter when clearing input
						if (browser) {
							clearTimeout(urlUpdateTimeout);
							updateUrlParams('');
						}
					}}
					class="text-gray-400 hover:text-gray-600"
					title="Clear input"
					aria-label="Clear input"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<!-- AI Assistant Component -->
	<AiAssistant {inputText} {suggestions} />

	<!-- Suggestions -->
	{#if showSuggestions}
		<div class="space-y-2">
			<h3 class="font-medium text-gray-700">
				Suggested Tools:
				<span class="ml-2 text-xs text-gray-500">
					{#if shortcutsActive}
						Press letter shortcuts to select, ↑↓ to navigate, Enter to open, Esc to exit
					{:else}
						Press Ctrl+Enter to activate shortcuts
					{/if}
				</span>
			</h3>
			<div class="space-y-2">
				{#each suggestions as suggestion, index (suggestion.id)}
					<a
						href={suggestion.url}
						class="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50 {shortcutsActive &&
						index === selectedSuggestionIndex
							? 'border-blue-500 bg-blue-50'
							: ''}"
						data-sveltekit-preload-data={suggestion.id === 'googlesearch' ||
						suggestion.id === 'bangsearch'
							? 'false'
							: 'hover'}
						onmouseenter={() => shortcutsActive && (selectedSuggestionIndex = index)}
						onmouseleave={() => shortcutsActive && (selectedSuggestionIndex = -1)}
					>
						<div class="flex items-center space-x-3">
							<div class="text-2xl">{suggestion.icon}</div>
							<div>
								<div class="font-medium text-gray-800"><T key={suggestion.name} /></div>
								<div class="text-sm text-gray-600"><T key={suggestion.reason} /></div>
							</div>
						</div>
						<div class="flex items-center space-x-3">
							<div class="text-right">
								<div class="text-sm font-medium {getConfidenceColor(suggestion.confidence)}">
									{getConfidenceLabel(suggestion.confidence)}
								</div>
								<div class="text-xs text-gray-500">
									{Math.round(suggestion.confidence * 100)}% match
								</div>
							</div>
							{#if shortcutsActive}
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full border bg-gray-100 text-xs font-medium text-gray-600 {index ===
									selectedSuggestionIndex
										? 'border-blue-300 bg-blue-100 text-blue-600'
										: ''}"
								>
									{(appConfigs as any)[suggestion.id]?.shortcut || '?'}
								</div>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</div>
	{:else if inputText.trim()}
		<div class="py-8 text-center text-gray-500">
			<svg class="mx-auto mb-2 h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
				></path>
			</svg>
			<p><T>No specific tools detected for this input</T></p>
			<p class="text-sm">
				Try math expressions, unit conversions, colors, translation commands (single or multi-line),
				URLs, JSON, or stock symbols
			</p>
		</div>
	{/if}
</div>
