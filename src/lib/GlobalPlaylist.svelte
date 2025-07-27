<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { globalPlaylistStore, type AudioFile } from './stores/globalPlaylist';
	import T from './T.svelte';

	// Define the playback state type (matching the store interface)
	interface PlaybackState {
		currentFileId: string | null;
		currentAudio: HTMLAudioElement | null;
		isPlaying: boolean;
		currentTime: number;
		duration: number;
		volume: number;
		repeatMode: 'none' | 'one' | 'all';
		currentPlaylist: AudioFile[];
		currentIndex: number;
		showPlaylistPanel: boolean;
		playlistCollapsed: boolean;
		playbackStateLoaded: boolean;
		isActiveAudioTab: boolean;
	}

	// Subscribe to the global playlist store
	let playlistState: PlaybackState | null = $state(null);
	let unsubscribe: (() => void) | null = null;

	// Drag and drop state
	let dragOverPlaylist = $state(false);

	// Format duration helper
	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.floor(seconds % 60);
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	}

	// Audio event handlers are now handled by the SharedWorker
	// Time updates, duration updates, and ended events are all managed by the worker

	// Drag and drop handlers for playlist
	function handlePlaylistDragOver(event: DragEvent) {
		// Check if this is an internal drag from the sound library
		const hasJsonData = event.dataTransfer?.types.includes('text/json');
		const hasPlainData = event.dataTransfer?.types.includes('text/plain');

		if (hasJsonData || hasPlainData) {
			event.preventDefault();
			event.dataTransfer!.dropEffect = 'copy';
			dragOverPlaylist = true;
		}
	}

	function handlePlaylistDragLeave(event: DragEvent) {
		// Only clear if we're actually leaving the playlist area
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = event.clientX;
		const y = event.clientY;

		if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
			dragOverPlaylist = false;
		}
	}

	function handlePlaylistDrop(event: DragEvent) {
		event.preventDefault();
		dragOverPlaylist = false;

		// Handle internal drag from sound library
		const draggedFileData = event.dataTransfer?.getData('text/json');
		if (draggedFileData) {
			try {
				const fileData = JSON.parse(draggedFileData);
				// Add the file to the playlist
				globalPlaylistStore.addToPlaylist([fileData]);
				return;
			} catch (error) {
				console.warn('Failed to parse dragged file data:', error);
			}
		}

		// Fallback: check for file ID in plain text data
		const fileId = event.dataTransfer?.getData('text/plain');
		if (fileId) {
			// Dispatch a custom event to request the file data from SoundLibrary
			const requestEvent = new CustomEvent('playlist-drop-request', {
				detail: { fileId },
				bubbles: true
			});
			window.dispatchEvent(requestEvent);
		}
	}

	// Audio event listeners are now handled by the SharedWorker in globalPlaylist.ts
	// The $effect for currentAudio changes is no longer needed here

	onMount(() => {
		unsubscribe = globalPlaylistStore.subscribe((state) => {
			playlistState = { ...state }; // Force a new object to trigger reactivity
		});
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
		// Audio cleanup is now handled by the SharedWorker
	});
</script>

{#if playlistState?.showPlaylistPanel}
	<!-- Collapsible Playlist Panel -->
	<div
		class="fixed top-0 right-0 z-40 h-full bg-white shadow-lg transition-transform duration-300 ease-in-out"
		class:translate-x-0={!playlistState.playlistCollapsed}
		class:translate-x-full={playlistState.playlistCollapsed}
		style="width: 320px;"
	>
		<div class="flex h-full flex-col">
			<!-- Playlist header -->
			<div class="border-b border-gray-200 p-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-2">
						<h3 class="font-medium text-gray-800">
							<T>Current Playlist</T> ({playlistState.currentPlaylist.length})
						</h3>
						<!-- Active audio tab indicator -->
						{#if playlistState.isActiveAudioTab}
							<div
								class="flex items-center space-x-1 rounded-full bg-green-100 px-2 py-1"
								title="This tab is controlling audio playback"
							>
								<div class="h-2 w-2 rounded-full bg-green-500"></div>
								<span class="text-xs text-green-700"><T>Audio Active</T></span>
							</div>
						{:else}
							<div
								class="flex items-center space-x-1 rounded-full bg-gray-100 px-2 py-1"
								title="Audio is playing in another tab"
							>
								<div class="h-2 w-2 rounded-full bg-gray-400"></div>
								<span class="text-xs text-gray-600"><T>Audio Remote</T></span>
							</div>
						{/if}
					</div>
					<div class="flex items-center space-x-2">
						<!-- Collapse button -->
						<button
							onclick={() => globalPlaylistStore.setPlaylistCollapsed(true)}
							class="text-gray-400 hover:text-gray-600"
							title="Collapse playlist"
							aria-label="Collapse playlist"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								></path>
							</svg>
						</button>
						<!-- Close button -->
						<button
							onclick={() => globalPlaylistStore.togglePlaylistPanel()}
							class="text-gray-400 hover:text-gray-600"
							title="Close playlist"
							aria-label="Close playlist"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								></path>
							</svg>
						</button>
					</div>
				</div>
				{#if playlistState.currentPlaylist.length > 0}
					<div class="mt-2 flex justify-end">
						<button
							onclick={() => globalPlaylistStore.clearPlaylist()}
							class="text-sm text-red-600 hover:text-red-800"
							title="Clear playlist"
						>
							<T>Clear</T>
						</button>
					</div>
				{/if}
			</div>

			<!-- Playlist content -->
			<div
				role="list"
				class="flex-1 overflow-hidden"
				class:bg-blue-50={dragOverPlaylist}
				class:border-2={dragOverPlaylist}
				class:border-dashed={dragOverPlaylist}
				class:border-blue-400={dragOverPlaylist}
				ondragover={handlePlaylistDragOver}
				ondragleave={handlePlaylistDragLeave}
				ondrop={handlePlaylistDrop}
			>
				{#if playlistState.currentPlaylist.length === 0}
					<div class="p-4 text-center text-gray-500">
						<p class="text-sm"><T>No songs in playlist</T></p>
						<p class="mt-1 text-xs">
							<T>Add songs from the Sound Library to start building your playlist</T>
						</p>
						{#if dragOverPlaylist}
							<p class="mt-2 text-sm font-medium text-blue-600">
								<T>Drop files here to add to playlist</T>
							</p>
						{/if}
					</div>
				{:else}
					<div
						class="h-full overflow-y-auto"
						class:bg-blue-50={dragOverPlaylist}
						style="padding-bottom: {playlistState.currentFileId && playlistState.currentAudio
							? '200px'
							: '0'};"
					>
						{#if dragOverPlaylist}
							<div
								class="bg-opacity-90 absolute inset-0 z-10 flex items-center justify-center bg-blue-50"
							>
								<div class="rounded-lg bg-white p-4 shadow-lg">
									<p class="text-sm font-medium text-blue-600">
										<T>Drop here to add to playlist</T>
									</p>
								</div>
							</div>
						{/if}
						{#each playlistState.currentPlaylist as file, index (file.id)}
							<div
								class="flex items-center space-x-3 border-b border-gray-100 p-3 hover:bg-gray-50"
								class:bg-blue-50={playlistState.currentFileId === file.id}
							>
								<!-- Track number and play indicator -->
								<div class="flex h-6 w-6 items-center justify-center text-xs">
									{#if playlistState.currentFileId === file.id && playlistState.isPlaying}
										<svg class="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zM11 8a1 1 0 012 0v4a1 1 0 11-2 0V8z"
											></path>
										</svg>
									{:else if playlistState.currentFileId === file.id}
										<svg class="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
											></path>
										</svg>
									{:else}
										<span class="text-gray-400">{index + 1}</span>
									{/if}
								</div>

								<!-- File info -->
								<button
									onclick={() => {
										if (!playlistState) return;
										if (playlistState.currentFileId === file.id) {
											globalPlaylistStore.togglePlayPause();
										} else {
											// Find the file in the playlist and play it
											const fileIndex = playlistState.currentPlaylist.findIndex(
												(f) => f.id === file.id
											);
											if (fileIndex !== -1) {
												globalPlaylistStore.replacePlaylist(
													playlistState.currentPlaylist,
													fileIndex
												);
											}
										}
									}}
									class="flex-1 text-left"
								>
									<div class="truncate text-sm font-medium text-gray-900">
										{file.name}
									</div>
									<div class="text-xs text-gray-500">
										{formatDuration(file.metadata.duration)}
									</div>
								</button>

								<!-- Remove from playlist -->
								<button
									onclick={() => globalPlaylistStore.removeFromPlaylist(file.id)}
									class="text-gray-400 hover:text-red-600"
									title="Remove from playlist"
									aria-label="Remove from playlist"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										></path>
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Audio player integrated at bottom of playlist -->
			{#if playlistState.currentFileId}
				<div
					class="absolute right-0 bottom-0 left-0 border-t border-gray-200 bg-white p-4 shadow-lg"
					class:opacity-60={!playlistState.isActiveAudioTab}
				>
					<!-- Audio tab status indicator for inactive tabs -->
					{#if !playlistState.isActiveAudioTab}
						<div class="mb-2 rounded bg-yellow-50 p-2 text-center">
							<p class="text-xs text-yellow-700">
								<T>Audio is playing in another tab. Controls are synced but limited.</T>
							</p>
						</div>
					{/if}

					<!-- Current track info -->
					<div class="mb-3 flex items-center space-x-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
							{#if playlistState.isActiveAudioTab}
								<svg class="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"
									></path>
								</svg>
							{:else}
								<svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"
									></path>
								</svg>
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<h4 class="truncate text-sm font-medium text-gray-900">
								{playlistState?.currentPlaylist.find((f) => f.id === playlistState?.currentFileId)
									?.name || 'Unknown'}
							</h4>
							<p class="text-xs text-gray-500">
								{formatDuration(playlistState.currentTime)} / {formatDuration(
									playlistState.duration
								)}
							</p>
						</div>
					</div>

					<!-- Progress bar -->
					<div class="mb-3">
						<input
							type="range"
							min="0"
							max={playlistState.duration || 0}
							value={playlistState.currentTime}
							oninput={(e) =>
								globalPlaylistStore.seekTo(parseFloat((e.target as HTMLInputElement).value))}
							class="w-full"
							title="Seek to position"
						/>
					</div>

					<!-- Playback controls -->
					<div class="mb-3 flex items-center justify-center space-x-3">
						<button
							onclick={() => globalPlaylistStore.playPrevious()}
							class="text-gray-600 hover:text-gray-800"
							class:opacity-50={!playlistState.isActiveAudioTab}
							disabled={playlistState.currentIndex <= 0 && playlistState.repeatMode !== 'all'}
							aria-label="Previous track"
							title={playlistState.isActiveAudioTab
								? 'Previous track'
								: 'Previous track (controlled from active audio tab)'}
						>
							<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path
									d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"
								></path>
							</svg>
						</button>

						<button
							onclick={() => globalPlaylistStore.togglePlayPause()}
							class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
							class:opacity-75={!playlistState.isActiveAudioTab}
							title={playlistState.isActiveAudioTab
								? playlistState.isPlaying
									? 'Pause'
									: 'Play'
								: 'Play/Pause (controlled from active audio tab)'}
						>
							{#if playlistState.isPlaying}
								<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zM11 8a1 1 0 012 0v4a1 1 0 11-2 0V8z"
									></path>
								</svg>
							{:else}
								<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
									></path>
								</svg>
							{/if}
						</button>

						<button
							onclick={() => globalPlaylistStore.playNext()}
							class="text-gray-600 hover:text-gray-800"
							class:opacity-50={!playlistState.isActiveAudioTab}
							disabled={playlistState.currentIndex >= playlistState.currentPlaylist.length - 1 &&
								playlistState.repeatMode !== 'all'}
							aria-label="Next track"
							title={playlistState.isActiveAudioTab
								? 'Next track'
								: 'Next track (controlled from active audio tab)'}
						>
							<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
								<path
									d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z"
								></path>
							</svg>
						</button>
					</div>

					<!-- Volume and repeat controls -->
					<div class="flex items-center justify-between">
						<!-- Volume -->
						<div class="flex items-center space-x-2">
							<svg class="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
								<path
									d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.784L4.5 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.5l3.883-3.784z"
								></path>
								<path d="M12 8a1 1 0 012 0v4a1 1 0 11-2 0V8zM14 6a1 1 0 012 0v8a1 1 0 11-2 0V6z"
								></path>
							</svg>
							<input
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={playlistState.volume}
								oninput={(e) =>
									globalPlaylistStore.changeVolume(
										parseFloat((e.target as HTMLInputElement).value)
									)}
								class="w-16"
								title="Adjust volume"
							/>
						</div>

						<!-- Repeat mode -->
						<button
							onclick={() => globalPlaylistStore.cycleRepeatMode()}
							class="text-gray-600 hover:text-gray-800"
							class:text-blue-600={playlistState.repeatMode !== 'none'}
							class:opacity-50={!playlistState.isActiveAudioTab}
							title="Repeat mode: {playlistState.repeatMode}{!playlistState.isActiveAudioTab
								? ' (controlled from active audio tab)'
								: ''}"
						>
							{#if playlistState.repeatMode === 'none'}
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									></path>
								</svg>
							{:else if playlistState.repeatMode === 'one'}
								<div class="relative">
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
										></path>
									</svg>
									<span class="absolute -top-1 -right-1 text-xs font-bold">1</span>
								</div>
							{:else}
								<div class="relative">
									<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
										<path
											d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
										></path>
									</svg>
								</div>
							{/if}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Expand handle when collapsed -->
	{#if playlistState.playlistCollapsed}
		<button
			onclick={() => globalPlaylistStore.setPlaylistCollapsed(false)}
			class="fixed top-1/2 right-0 z-50 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-l-lg bg-gray-800 text-white shadow-lg transition-colors hover:bg-gray-700"
			title="Expand playlist"
			aria-label="Expand playlist"
		>
			<svg class="h-4 w-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
				></path>
			</svg>
		</button>
	{/if}

	<!-- Overlay when expanded (for mobile) -->
	{#if !playlistState.playlistCollapsed}
		<div
			class="bg-opacity-25 fixed inset-0 z-30 bg-black md:hidden"
			role="button"
			tabindex="0"
			onclick={() => globalPlaylistStore.setPlaylistCollapsed(true)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					globalPlaylistStore.setPlaylistCollapsed(true);
				}
			}}
			aria-label="Close playlist panel"
		></div>
	{/if}
{/if}

<!-- Global playlist toggle button (when panel is hidden) -->
{#if playlistState && !playlistState.showPlaylistPanel && playlistState.currentPlaylist.length > 0}
	<button
		onclick={() => globalPlaylistStore.togglePlaylistPanel()}
		class="fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-700"
		title="Show playlist"
		aria-label="Show playlist"
	>
		<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
			<path
				d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"
			></path>
		</svg>
	</button>
{/if}
