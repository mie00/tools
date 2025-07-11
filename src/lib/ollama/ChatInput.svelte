<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	let {
		isLoading,
		disabled = false
	}: {
		isLoading: boolean;
		disabled: boolean;
	} = $props();

	let userInput = $state('');
	let textareaElement: HTMLTextAreaElement;

	const dispatch = createEventDispatcher();

	function submit() {
		if (!userInput.trim() || isLoading || disabled) return;
		dispatch('submit', userInput.trim());
		userInput = '';
		if (textareaElement) {
			textareaElement.style.height = 'auto'; // Reset height
		}
	}

	function stop() {
		dispatch('stop');
	}

	function autoResize(event: Event) {
		const textarea = event.target as HTMLTextAreaElement;
		textarea.style.height = 'auto';
		textarea.style.height = `${textarea.scrollHeight}px`;
	}
</script>

<div class="border-t border-gray-200 bg-gray-50 p-4">
	<div class="relative mx-auto max-w-2xl">
		<textarea
			bind:this={textareaElement}
			bind:value={userInput}
			oninput={autoResize}
			onkeydown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					submit();
				}
			}}
			class="w-full resize-none rounded-lg border border-gray-300 bg-white p-3 pr-12 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			placeholder={disabled ? 'Model not ready...' : 'Ask anything...'}
			rows="1"
			style="max-height: 200px;"
			disabled={isLoading || disabled}
		></textarea>
		{#if isLoading}
			<button
				onclick={stop}
				class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md bg-red-500 p-2 text-white hover:bg-red-600"
			>
				⏹️
			</button>
		{:else}
			<button
				onclick={submit}
				disabled={!userInput.trim() || disabled}
				class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md bg-blue-500 p-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
			>
				▶️
			</button>
		{/if}
	</div>
</div>
