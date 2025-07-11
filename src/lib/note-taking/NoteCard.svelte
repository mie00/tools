<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Note } from './NoteOperations';
	import type { MediaData } from './MediaHandler';

	let {
		note,
		topics = ['Main'],
		isEditing = false,
		isFocused = false,
		formatFileSize,
		downloadFile
	}: {
		note: Note;
		topics: string[];
		isEditing: boolean;
		isFocused: boolean;
		formatFileSize: (_size: number) => string;
		downloadFile: (_media: MediaData) => void;
	} = $props();

	const dispatch = createEventDispatcher<{
		edit: Note;
		delete: number;
		save: Note;
		cancel: void;
		focus: number;
		dragStart: { event: DragEvent; note: Note };
		dragOver: DragEvent;
		drop: { event: DragEvent; note: Note };
		moveTo: { noteId: number; newTopic: string };
	}>();

	let editingText = $state('');
	let editingTopic = $state('');

	$effect(() => {
		if (isEditing && note) {
			editingText = note.text;
			editingTopic = note.topic;
		}
	});

	function startEdit() {
		dispatch('edit', note);
	}

	function saveEdit() {
		const updatedNote: Note = {
			...note,
			text: editingText.trim(),
			topic: editingTopic
		};
		dispatch('save', updatedNote);
	}

	function cancelEdit() {
		dispatch('cancel');
	}

	function deleteNote() {
		if (confirm('Delete this note?')) {
			dispatch('delete', note.id);
		}
	}

	function handleFocus() {
		dispatch('focus', isFocused ? -1 : note.id);
	}

	function handleDragStart(event: DragEvent) {
		dispatch('dragStart', { event, note });
	}

	function handleDragOver(event: DragEvent) {
		dispatch('dragOver', event);
	}

	function handleDrop(event: DragEvent) {
		dispatch('drop', { event, note });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleFocus();
		}
	}

	function moveToTopic(newTopic: string) {
		if (newTopic !== note.topic) {
			dispatch('moveTo', { noteId: note.id, newTopic });
		}
	}

	function openImageInNewWindow(media: MediaData) {
		const img = new Image();
		img.src = media.data;
		const win = window.open('', '_blank');
		if (win) {
			win.document.write(`<img src="${media.data}" style="max-width: 100%; height: auto;">`);
		}
	}

	function formatTimestamp(timestamp: string): string {
		return new Date(timestamp).toLocaleString();
	}
</script>

<div
	class="group cursor-move rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md"
	draggable="true"
	role="button"
	tabindex="0"
	ondragstart={handleDragStart}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	onclick={handleFocus}
	onkeydown={handleKeydown}
	aria-label="Note from {formatTimestamp(note.timestamp)}"
>
	<!-- Always visible: Date and content -->
	<div class="flex items-start justify-between">
		<span class="text-sm text-gray-500">{formatTimestamp(note.timestamp)}</span>

		<!-- Controls - only visible when focused or hovered -->
		<div
			class="flex space-x-2 {isFocused
				? 'opacity-100'
				: 'opacity-0 group-hover:opacity-100'} transition-opacity"
		>
			{#if !isEditing}
				<button
					onclick={(e) => {
						e.stopPropagation();
						startEdit();
					}}
					class="text-gray-400 hover:text-blue-600"
					title="Edit note"
					aria-label="Edit note"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						></path>
					</svg>
				</button>
			{/if}

			<button
				onclick={(e) => {
					e.stopPropagation();
					deleteNote();
				}}
				class="text-gray-400 hover:text-red-600"
				title="Delete note"
				aria-label="Delete note"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
					></path>
				</svg>
			</button>
		</div>
	</div>

	{#if isEditing}
		<!-- Edit mode -->
		<div class="mt-3 space-y-3">
			<textarea
				bind:value={editingText}
				placeholder="Enter your note..."
				class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				rows="3"
			></textarea>

			{#if topics.length > 1}
				<select
					bind:value={editingTopic}
					class="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				>
					{#each topics as topic (topic)}
						<option value={topic}>{topic}</option>
					{/each}
				</select>
			{/if}

			<div class="flex justify-end space-x-2">
				<button
					onclick={cancelEdit}
					class="rounded-md bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
				>
					Cancel
				</button>
				<button
					onclick={saveEdit}
					class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
				>
					Save
				</button>
			</div>
		</div>
	{:else}
		<!-- View mode -->
		<div class="space-y-3">
			<!-- Text content -->
			{#if note.text}
				<div class="prose prose-sm max-w-none">
					<p class="whitespace-pre-wrap text-gray-800">
						{note.text}
					</p>
				</div>
			{/if}

			<!-- Media content -->
			{#if note.media}
				<div class="mt-3">
					{#if note.media.type === 'image'}
						<!-- Image display -->
						<div class="max-w-md">
							<button
								class="block cursor-pointer rounded-lg transition-shadow hover:shadow-md"
								onclick={() => note.media && openImageInNewWindow(note.media)}
								aria-label="Open image {note.media?.name || 'image'} in new window"
							>
								<img
									src={note.media.data}
									alt={note.media.name}
									class="h-auto max-w-full rounded-lg shadow-sm"
								/>
							</button>
							<p class="mt-1 text-xs text-gray-500">
								{note.media.name} ({formatFileSize(note.media.size)})
							</p>
						</div>
					{:else if note.media.type === 'audio'}
						<!-- Audio player -->
						<div class="max-w-md rounded-lg bg-gray-50 p-3">
							<div class="mb-2 flex items-center space-x-2">
								<svg
									class="h-5 w-5 text-gray-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
									></path>
								</svg>
								<span class="text-sm font-medium text-gray-700">Audio Note</span>
							</div>
							<audio controls class="mb-2 w-full">
								<source src={note.media.data} type={note.media.mimeType} />
								Your browser does not support the audio element.
							</audio>
							<p class="text-xs text-gray-500">
								{note.media.name} ({formatFileSize(note.media.size)})
							</p>
						</div>
					{:else if note.media.type === 'video'}
						<!-- Video player -->
						<div class="max-w-lg rounded-lg bg-gray-50 p-3">
							<div class="mb-2 flex items-center space-x-2">
								<svg
									class="h-5 w-5 text-gray-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
									></path>
								</svg>
								<span class="text-sm font-medium text-gray-700">Video Note</span>
							</div>
							<video controls class="mb-2 w-full rounded">
								<source src={note.media.data} type={note.media.mimeType} />
								<track kind="captions" label="No captions available" default />
								Your browser does not support the video element.
							</video>
							<p class="text-xs text-gray-500">
								{note.media.name} ({formatFileSize(note.media.size)})
							</p>
						</div>
					{:else if note.media.type === 'file'}
						<!-- File download -->
						<div class="max-w-md rounded-lg bg-gray-50 p-3">
							<div class="flex items-center justify-between">
								<div class="flex items-center space-x-2">
									<svg
										class="h-8 w-8 text-gray-600"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										></path>
									</svg>
									<div>
										<p class="text-sm font-medium text-gray-700">{note.media.name}</p>
										<p class="text-xs text-gray-500">{formatFileSize(note.media.size)}</p>
									</div>
								</div>
								<button
									onclick={() => note.media && downloadFile(note.media)}
									class="text-blue-600 hover:text-blue-800"
									title="Download file"
									aria-label="Download file {note.media?.name || 'file'}"
								>
									<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										></path>
									</svg>
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Move to topic buttons (only visible when focused and multiple topics exist) -->
			{#if isFocused && topics.length > 1 && !isEditing}
				<div class="mt-3 border-t pt-3">
					<p class="mb-2 text-xs text-gray-500">Move to topic:</p>
					<div class="flex flex-wrap gap-1">
						{#each topics.filter((t) => t !== note.topic) as topic (topic)}
							<button
								onclick={(e) => {
									e.stopPropagation();
									moveToTopic(topic);
								}}
								class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
							>
								{topic}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
