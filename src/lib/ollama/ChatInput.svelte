<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let isLoading: boolean;
	export let disabled: boolean = false;

	let userInput = '';
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

<div class="p-4 bg-gray-50 border-t border-gray-200">
	<div class="relative max-w-2xl mx-auto">
		<textarea
			bind:this={textareaElement}
			bind:value={userInput}
			on:input={autoResize}
			on:keydown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					submit();
				}
			}}
			class="w-full p-3 pr-12 border rounded-lg bg-white text-gray-800 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
			placeholder={disabled ? "Model not ready..." : "Ask anything..."}
			rows="1"
			style="max-height: 200px;"
			disabled={isLoading || disabled}
		></textarea>
		{#if isLoading}
			<button
				on:click={stop}
				class="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-md bg-red-500 hover:bg-red-600 text-white"
			>
				⏹️
			</button>
		{:else}
			<button
				on:click={submit}
				disabled={!userInput.trim() || disabled}
				class="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				▶️
			</button>
		{/if}
	</div>
</div> 