<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let isRecording: boolean = false;
	export let recordingType: 'audio' | 'video' | null = null;
	export let showMediaControls: boolean = false;

	const dispatch = createEventDispatcher<{
		fileUpload: Event;
		startRecording: 'audio' | 'video';
		stopRecording: void;
		toggleMediaControls: void;
	}>();

	let videoPreview: HTMLVideoElement | null = null;

	function handleFileUpload(event: Event) {
		dispatch('fileUpload', event);
	}

	function startRecording(type: 'audio' | 'video') {
		dispatch('startRecording', type);
	}

	function stopRecording() {
		dispatch('stopRecording');
	}

	function toggleMediaControls() {
		dispatch('toggleMediaControls');
	}
</script>

<!-- Media Controls Toggle -->
<button
	on:click={toggleMediaControls}
	class="text-gray-500 transition-colors hover:text-blue-600"
	title="Media options"
	aria-label="Toggle media options"
>
	<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
		></path>
	</svg>
</button>

{#if showMediaControls}
	<div class="flex items-center space-x-3">
		<!-- File upload -->
		<label
			class="cursor-pointer text-gray-500 transition-colors hover:text-blue-600"
			title="Upload file/image"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				></path>
			</svg>
			<input type="file" class="hidden" on:change={handleFileUpload} accept="*/*" />
		</label>

		<!-- Voice recording -->
		<button
			on:click={() =>
				isRecording && recordingType === 'audio'
					? stopRecording()
					: startRecording('audio')}
			class="text-gray-500 transition-colors hover:text-blue-600 {isRecording &&
			recordingType === 'audio'
				? 'text-red-500'
				: ''}"
			title={isRecording && recordingType === 'audio'
				? 'Stop recording'
				: 'Record audio'}
			aria-label={isRecording && recordingType === 'audio'
				? 'Stop recording'
				: 'Record audio'}
			disabled={isRecording && recordingType !== 'audio'}
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
				></path>
			</svg>
		</button>

		<!-- Video recording -->
		<button
			on:click={() =>
				isRecording && recordingType === 'video'
					? stopRecording()
					: startRecording('video')}
			class="text-gray-500 transition-colors hover:text-blue-600 {isRecording &&
			recordingType === 'video'
				? 'text-red-500'
				: ''}"
			title={isRecording && recordingType === 'video'
				? 'Stop recording'
				: 'Record video'}
			aria-label={isRecording && recordingType === 'video'
				? 'Stop recording'
				: 'Record video'}
			disabled={isRecording && recordingType !== 'video'}
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
				></path>
			</svg>
		</button>
	</div>
{/if}

<!-- Recording Preview -->
{#if isRecording}
	<div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
		{#if recordingType === 'video'}
			<!-- Video preview -->
			<div class="text-center">
				<p class="mb-2 flex items-center justify-center font-medium text-red-600">
					<svg class="mr-2 h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
						<circle cx="10" cy="10" r="3" />
					</svg>
					Recording Video...
				</p>
				<video
					bind:this={videoPreview}
					muted
					class="mx-auto w-full max-w-sm rounded-lg shadow-md sm:max-w-md md:max-w-lg lg:max-w-xl"
					style="max-height: 50vh; aspect-ratio: 16/9; object-fit: cover;"
				></video>
			</div>
		{:else if recordingType === 'audio'}
			<!-- Audio level indicator -->
			<div class="text-center">
				<p class="mb-3 flex items-center justify-center font-medium text-red-600">
					<svg class="mr-2 h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
						<circle cx="10" cy="10" r="3" />
					</svg>
					Recording Audio...
				</p>

				<!-- Audio level bars -->
				<div class="mb-2 flex items-center justify-center space-x-1">
					{#each Array.from({ length: 20 }) as _item, i (i)}
						<div
							class="audio-bar rounded-full bg-red-400"
							style="width: 3px; height: {4 + i * 2}px; animation-delay: {i * 50}ms;"
						></div>
					{/each}
				</div>

				<!-- Pulsing microphone icon -->
				<div class="flex justify-center">
					<div class="relative">
						<svg
							class="h-12 w-12 animate-pulse text-red-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
							></path>
						</svg>
						<!-- Ripple effect -->
						<div
							class="absolute inset-0 animate-ping rounded-full border-2 border-red-400 opacity-30"
						></div>
						<div
							class="absolute inset-2 animate-ping rounded-full border-2 border-red-300 opacity-20"
							style="animation-delay: 0.5s;"
						></div>
					</div>
				</div>
			</div>
		{/if}

		<div class="mt-3 text-center">
			<button
				on:click={stopRecording}
				class="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
			>
				Stop Recording
			</button>
		</div>
	</div>
{/if}

<style>
	:global(:root) {
		--audio-level: 0%;
	}

	.audio-bar {
		animation: audioLevel 150ms ease-in-out infinite alternate;
	}

	@keyframes audioLevel {
		0% {
			transform: scaleY(0.3);
			opacity: 0.4;
		}
		100% {
			transform: scaleY(calc(0.3 + var(--audio-level) / 100 * 0.7));
			opacity: calc(0.4 + var(--audio-level) / 100 * 0.6);
		}
	}
</style> 