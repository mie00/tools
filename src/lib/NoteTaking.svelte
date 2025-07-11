<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';

	// Import our new components and utilities
	import TopicManager from './note-taking/TopicManager.svelte';
	import NoteCard from './note-taking/NoteCard.svelte';
	import MediaRecorder from './note-taking/MediaRecorder.svelte';
	import StorageInfo from './note-taking/StorageInfo.svelte';
	import {
		StorageManager,
		type StorageInfo as StorageInfoType
	} from './note-taking/StorageManager';
	import { MediaHandler, type MediaData } from './note-taking/MediaHandler';
	import { NoteOperations, type Note } from './note-taking/NoteOperations';

	// Component state
	let notes: Note[] = [];
	let topics: string[] = ['Main'];
	let selectedTopic: string = 'Main';
	let newNoteText: string = '';
	let showNewTopicInput: boolean = false;
	let editingNote: Note | null = null;
	let focusedNote: number | null = null;
	let draggedNote: Note | null = null;

	// Storage state
	let storageInfo: StorageInfoType = { used: 0, quota: 0, available: 0 };
	let showStorageWarning: boolean = false;

	// Media state
	let isRecording: boolean = false;
	let recordingType: 'audio' | 'video' | null = null;
	let showMediaControls: boolean = false;
	let videoPreview: HTMLVideoElement | null = null;

	// Manager instances
	const storageManager = StorageManager.getInstance();
	const mediaHandler = new MediaHandler();

	// Reactive filtered notes
	$: filteredNotes = NoteOperations.filterNotesByTopic(notes, selectedTopic);

	onMount(async () => {
		if (browser) {
			await storageManager.initializeStorage();
			await loadNotes();
			await updateStorageInfo();
		}
	});

	onDestroy(() => {
		mediaHandler.cleanup();
	});

	async function loadNotes() {
		try {
			notes = storageManager.loadFromLocalStorage('noteTakingNotes', []);
			topics = storageManager.loadFromLocalStorage('noteTakingTopics', ['Main']);
		} catch (error) {
			console.error('Error loading notes:', error);
		}
	}

	async function saveNotes() {
		try {
			await storageManager.validateAndSave('noteTakingNotes', notes);
			await storageManager.validateAndSave('noteTakingTopics', topics);
			await updateStorageInfo();
		} catch (error) {
			console.error('Error saving notes:', error);
			if (error instanceof Error && error.message.includes('quota')) {
				showStorageWarning = true;
			}
		}
	}

	async function updateStorageInfo() {
		storageInfo = await storageManager.getStorageInfo();
		showStorageWarning = storageManager.isStorageWarningNeeded(storageInfo);
	}

	async function addNote(mediaData?: MediaData) {
		if (newNoteText.trim() || mediaData) {
			const newNote = NoteOperations.createNote(newNoteText, selectedTopic, notes, mediaData);
			notes = NoteOperations.addNote(notes, newNote);
			newNoteText = '';
			await saveNotes();
		}
	}

	async function deleteNote(noteId: number) {
		notes = NoteOperations.deleteNote(notes, noteId);
		await saveNotes();
	}

	function startEdit(note: Note) {
		editingNote = { ...note };
	}

	async function saveEdit(updatedNote: Note) {
		notes = NoteOperations.updateNote(notes, updatedNote);
		editingNote = null;
		await saveNotes();
	}

	function cancelEdit() {
		editingNote = null;
	}

	async function moveNoteToTopic(noteId: number, newTopic: string) {
		notes = NoteOperations.moveNoteToTopic(notes, noteId, newTopic);
		await saveNotes();
	}

	function handleFocus(noteId: number) {
		focusedNote = noteId === -1 ? null : noteId;
	}

	// Topic management
	function handleTopicSelected(topic: string) {
		selectedTopic = topic;
	}

	async function handleTopicAdded(topicName: string) {
		if (!topics.includes(topicName)) {
			topics = [...topics, topicName];
			await saveNotes();
		}
	}

	async function handleTopicDeleted(topicToDelete: string) {
		if (topicToDelete === 'Main') return;

		notes = NoteOperations.deleteNotesInTopic(notes, topicToDelete);
		topics = topics.filter((t) => t !== topicToDelete);

		if (selectedTopic === topicToDelete) {
			selectedTopic = 'Main';
		}
		await saveNotes();
	}

	// Media handling
	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		if (!target?.files?.[0]) return;

		try {
			const mediaData = await mediaHandler.handleFileUpload(target.files[0], (size) =>
				storageManager.checkStorageQuota(size)
			);
			await addNote(mediaData);
		} catch (error) {
			alert((error as Error).message);
		}
		target.value = '';
	}

	async function handleStartRecording(type: 'audio' | 'video') {
		try {
			const stream = await mediaHandler.startRecording(type);
			isRecording = true;
			recordingType = type;

			if (type === 'video') {
				await tick();
				if (videoPreview) {
					videoPreview.srcObject = stream;
					videoPreview.play().catch(console.error);
				}
			}
		} catch (error) {
			alert('Failed to start recording: ' + (error as Error).message);
		}
	}

	async function handleStopRecording() {
		if (!recordingType) return;

		try {
			const mediaData = await mediaHandler.stopRecording(recordingType, (size) =>
				storageManager.checkStorageQuota(size)
			);
			await addNote(mediaData);
		} catch (error) {
			alert('Failed to stop recording: ' + (error as Error).message);
		} finally {
			isRecording = false;
			recordingType = null;
			if (videoPreview) {
				videoPreview.srcObject = null;
			}
		}
	}

	function handleToggleMediaControls() {
		showMediaControls = !showMediaControls;
	}

	// Drag and drop
	function handleDragStart(event: DragEvent, note: Note) {
		draggedNote = note;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(event: DragEvent, dropNote: Note) {
		event.preventDefault();
		if (draggedNote && dropNote && draggedNote.id !== dropNote.id) {
			notes = NoteOperations.reorderNotesInTopic(notes, draggedNote, dropNote);
			saveNotes();
		}
		draggedNote = null;
	}

	// Storage management
	async function clearAllData() {
		if (confirm('Are you sure you want to delete ALL notes and topics? This cannot be undone.')) {
			notes = [];
			topics = ['Main'];
			selectedTopic = 'Main';
			storageManager.removeFromLocalStorage('noteTakingNotes');
			storageManager.removeFromLocalStorage('noteTakingTopics');
			await updateStorageInfo();
			showStorageWarning = false;
		}
	}

	async function clearMediaNotes() {
		if (
			confirm(
				'Are you sure you want to delete all notes with media attachments? This will free up storage space but cannot be undone.'
			)
		) {
			notes = NoteOperations.deleteNotesWithMedia(notes);
			await saveNotes();
		}
	}

	// Handle keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			addNote();
		}
	}
</script>

<div class="mx-auto max-w-4xl space-y-6 p-4">
	<!-- Storage Information -->
	<StorageInfo
		{storageInfo}
		{showStorageWarning}
		{notes}
		formatBytes={storageManager.formatBytes.bind(storageManager)}
		on:clearAllData={clearAllData}
		on:clearMediaNotes={clearMediaNotes}
	/>

	<!-- Topic Management -->
	<TopicManager
		{topics}
		{selectedTopic}
		{showNewTopicInput}
		on:topicSelected={(e) => handleTopicSelected(e.detail)}
		on:topicAdded={(e) => handleTopicAdded(e.detail)}
		on:topicDeleted={(e) => handleTopicDeleted(e.detail)}
	/>

	<!-- Add Note Section -->
	<div class="rounded-xl border border-gray-200 bg-white p-6">
		<div class="space-y-4">
			<!-- Note Input -->
			<div class="space-y-3">
				<textarea
					bind:value={newNoteText}
					on:keydown={handleKeydown}
					placeholder="What's on your mind? (Ctrl+Enter to save)"
					class="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					rows="3"
				></textarea>

				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<!-- Add Note Button -->
						<button
							on:click={() => addNote()}
							disabled={!newNoteText.trim()}
							class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							title="Add note (Ctrl+Enter)"
							aria-label="Add note"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4"
								></path>
							</svg>
						</button>

						<!-- Media Controls -->
						<MediaRecorder
							{isRecording}
							{recordingType}
							{showMediaControls}
							on:fileUpload={handleFileUpload}
							on:startRecording={(e) => handleStartRecording(e.detail)}
							on:stopRecording={handleStopRecording}
							on:toggleMediaControls={handleToggleMediaControls}
						/>
					</div>

					<div class="flex items-center space-x-3">
						<span class="text-sm text-gray-500">Press Ctrl+Enter to add note</span>
					</div>
				</div>
			</div>

			<!-- Video Preview for Recording -->
			{#if isRecording && recordingType === 'video'}
				<div class="mt-4 text-center">
					<video
						bind:this={videoPreview}
						muted
						class="mx-auto w-full max-w-sm rounded-lg shadow-md"
						style="max-height: 50vh; aspect-ratio: 16/9; object-fit: cover;"
					></video>
				</div>
			{/if}
		</div>
	</div>

	<!-- Notes List -->
	<div class="space-y-4">
		{#each filteredNotes as note (note.id)}
			<NoteCard
				{note}
				{topics}
				isEditing={editingNote?.id === note.id}
				isFocused={focusedNote === note.id}
				formatFileSize={mediaHandler.formatFileSize.bind(mediaHandler)}
				downloadFile={mediaHandler.downloadFile.bind(mediaHandler)}
				on:edit={(e) => startEdit(e.detail)}
				on:delete={(e) => deleteNote(e.detail)}
				on:save={(e) => saveEdit(e.detail)}
				on:cancel={cancelEdit}
				on:focus={(e) => handleFocus(e.detail)}
				on:dragStart={(e) => handleDragStart(e.detail.event, e.detail.note)}
				on:dragOver={(e) => handleDragOver(e.detail)}
				on:drop={(e) => handleDrop(e.detail.event, e.detail.note)}
				on:moveTo={(e) => moveNoteToTopic(e.detail.noteId, e.detail.newTopic)}
			/>
		{/each}

		{#if filteredNotes.length === 0}
			<div class="py-12 text-center text-gray-500">
				<svg
					class="mx-auto mb-4 h-16 w-16 text-gray-300"
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
				<p class="mb-2 text-lg">No notes in {selectedTopic}</p>
				<p class="text-sm">Start by adding your first note above</p>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(:root) {
		--audio-level: 0%;
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
