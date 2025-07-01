<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';

	// Type definitions
	interface MediaData {
		type: string;
		name: string;
		size: number;
		data: string;
		mimeType: string;
	}

	interface Note {
		id: number;
		text: string;
		topic: string;
		timestamp: string;
		order: number;
		media?: MediaData;
	}

	interface StorageInfo {
		used: number;
		quota: number;
		available: number;
	}

	let notes: Note[] = [];
	let topics: string[] = ['Main'];
	let selectedTopic: string = 'Main';
	let newNoteText: string = '';
	let editingNote: Note | null = null;
	let draggedNote: Note | null = null;
	let newTopicName: string = '';
	let showNewTopicInput: boolean = false;
	let focusedNote: number | null = null;
	let mediaRecorder: MediaRecorder | null = null;
	let isRecording: boolean = false;
	let recordingType: 'audio' | 'video' | null = null;
	let recordedChunks: Blob[] = [];
	let showMediaControls: boolean = false;
	let currentStream: MediaStream | null = null;
	let videoPreview: HTMLVideoElement | null = null;
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let audioLevelArray: Uint8Array | null = null;
	let animationFrame: number | null = null;
	let storageInfo: StorageInfo = { used: 0, quota: 0, available: 0 };
	let showStorageWarning: boolean = false;

	onMount(async () => {
		await initializeStorage();
		loadNotes();
		await updateStorageInfo();
	});

	onDestroy(() => {
		cleanupRecording();
	});

	async function initializeStorage() {
		try {
			// Request persistent storage to prevent automatic cleanup
			if ('storage' in navigator && 'persist' in navigator.storage) {
				const isPersistent = await navigator.storage.persist();
				console.log('Persistent storage:', isPersistent ? 'granted' : 'denied');
			}
		} catch (error) {
			console.warn('Storage persistence API not supported:', error);
		}
	}

	async function updateStorageInfo() {
		try {
			if ('storage' in navigator && 'estimate' in navigator.storage) {
				const estimate = await navigator.storage.estimate();
				storageInfo = {
					used: estimate.usage || 0,
					quota: estimate.quota || 0,
					available: (estimate.quota || 0) - (estimate.usage || 0)
				};

				// Show warning if storage is getting full (>80%)
				const usagePercentage = (storageInfo.used / storageInfo.quota) * 100;
				showStorageWarning = usagePercentage > 80;
			}
		} catch (error) {
			console.warn('Storage estimate API not supported:', error);
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	async function checkStorageQuota(additionalSize = 0): Promise<boolean> {
		await updateStorageInfo();
		const wouldExceed = storageInfo.used + additionalSize > storageInfo.quota * 0.9; // 90% threshold
		return !wouldExceed;
	}

	function loadNotes() {
		try {
			const savedNotes = localStorage.getItem('noteTakingNotes');
			const savedTopics = localStorage.getItem('noteTakingTopics');

			if (savedNotes) {
				notes = JSON.parse(savedNotes);
			}
			if (savedTopics) {
				topics = JSON.parse(savedTopics);
			}
		} catch (error: unknown) {
			console.error('Error loading notes:', error);
			alert('Error loading saved notes. Storage may be corrupted.');
		}
	}

	async function saveNotes() {
		try {
			const notesData = JSON.stringify(notes);
			const topicsData = JSON.stringify(topics);

			// Estimate size of data to be stored
			const estimatedSize = (notesData.length + topicsData.length) * 2; // rough estimate for UTF-16

			// Check if we have enough storage space
			const hasSpace = await checkStorageQuota(estimatedSize);
			if (!hasSpace) {
				throw new Error('Storage quota would be exceeded');
			}

			localStorage.setItem('noteTakingNotes', notesData);
			localStorage.setItem('noteTakingTopics', topicsData);

			// Update storage info after saving
			await updateStorageInfo();
		} catch (error: unknown) {
			console.error('Error saving notes:', error);
			const err = error as Error;

			if (err.name === 'QuotaExceededError' || err.message?.includes('quota')) {
				alert(
					`Storage quota exceeded! Current usage: ${formatBytes(storageInfo.used)}/${formatBytes(storageInfo.quota)}. Please delete some notes or media files to free up space.`
				);
				showStorageWarning = true;
			} else {
				alert('Error saving notes: ' + (err.message || 'Unknown error'));
			}
		}
	}

	async function addNote(mediaData?: MediaData) {
		if (newNoteText.trim() || mediaData) {
			// Estimate the size of the new note
			const noteSize = newNoteText.length * 2 + (mediaData ? mediaData.data.length : 0);

			// Check storage quota before adding
			const hasSpace = await checkStorageQuota(noteSize);
			if (!hasSpace) {
				alert(
					`Cannot add note: Storage quota would be exceeded. Current usage: ${formatBytes(storageInfo.used)}/${formatBytes(storageInfo.quota)}`
				);
				return;
			}

			const note: Note = {
				id: Date.now(),
				text: newNoteText.trim(),
				topic: selectedTopic,
				timestamp: new Date().toISOString(),
				order: notes.filter((n) => n.topic === selectedTopic).length,
				media: mediaData
			};
			notes = [...notes, note];
			newNoteText = '';
			await saveNotes();
		}
	}

	async function deleteNote(noteId: number) {
		notes = notes.filter((n) => n.id !== noteId);
		await saveNotes();
	}

	async function startEdit(note: Note) {
		editingNote = { ...note };
	}

	async function saveEdit() {
		if (editingNote) {
			notes = notes.map((n) => (n.id === editingNote!.id ? editingNote! : n));
			editingNote = null;
			await saveNotes();
		}
	}

	function cancelEdit() {
		editingNote = null;
	}

	async function moveNoteToTopic(noteId: number, newTopic: string) {
		notes = notes.map((n) => {
			if (n.id === noteId) {
				return {
					...n,
					topic: newTopic,
					order: notes.filter((note) => note.topic === newTopic).length
				};
			}
			return n;
		});
		await saveNotes();
	}

	async function addTopic() {
		if (newTopicName.trim() && !topics.includes(newTopicName.trim())) {
			topics = [...topics, newTopicName.trim()];
			newTopicName = '';
			showNewTopicInput = false;
			await saveNotes();
		}
	}

	async function deleteTopic(topicToDelete: string) {
		if (topicToDelete === 'Main') return; // Can't delete main

		// Move all notes from deleted topic to Main
		notes = notes.map((n) => (n.topic === topicToDelete ? { ...n, topic: 'Main' } : n));
		topics = topics.filter((t) => t !== topicToDelete);

		if (selectedTopic === topicToDelete) {
			selectedTopic = 'Main';
		}
		await saveNotes();
	}

	async function clearAllData() {
		if (confirm('Are you sure you want to delete ALL notes and topics? This cannot be undone.')) {
			notes = [];
			topics = ['Main'];
			selectedTopic = 'Main';
			localStorage.removeItem('noteTakingNotes');
			localStorage.removeItem('noteTakingTopics');
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
			notes = notes.filter((n) => !n.media);
			await saveNotes();
		}
	}

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
		if (
			draggedNote &&
			dropNote &&
			draggedNote.id !== dropNote.id &&
			draggedNote.topic === dropNote.topic
		) {
			// Reorder notes within the same topic
			const topicNotes = notes.filter((n) => n.topic === draggedNote!.topic);
			const draggedIndex = topicNotes.findIndex((n) => n.id === draggedNote!.id);
			const dropIndex = topicNotes.findIndex((n) => n.id === dropNote.id);

			// Update order values
			topicNotes.splice(draggedIndex, 1);
			topicNotes.splice(dropIndex, 0, draggedNote!);

			topicNotes.forEach((note, index) => {
				note.order = index;
			});

			notes = [...notes.filter((n) => n.topic !== draggedNote!.topic), ...topicNotes];
			saveNotes();
		}
		draggedNote = null;
	}

	function formatTimestamp(timestamp: string): string {
		return new Date(timestamp).toLocaleString();
	}

	// Media handling functions
	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		if (!target || !target.files) return;

		const file = target.files[0];
		if (!file) return;

		// Check file size (limit to 5MB for localStorage)
		if (file.size > 5 * 1024 * 1024) {
			alert('File size too large. Please select a file smaller than 5MB.');
			return;
		}

		// Estimate the storage needed (base64 encoding increases size by ~33%)
		const estimatedSize = file.size * 1.33;
		const hasSpace = await checkStorageQuota(estimatedSize);
		if (!hasSpace) {
			alert(
				`Cannot upload file: Storage quota would be exceeded. Current usage: ${formatBytes(storageInfo.used)}/${formatBytes(storageInfo.quota)}`
			);
			return;
		}

		const reader = new FileReader();
		reader.onload = async (e) => {
			const mediaData: MediaData = {
				type: file.type.startsWith('image/') ? 'image' : 'file',
				name: file.name,
				size: file.size,
				data: e.target?.result as string,
				mimeType: file.type
			};
			await addNote(mediaData);
		};
		reader.readAsDataURL(file);

		// Reset file input
		target.value = '';
	}

	async function startRecording(type: 'audio' | 'video') {
		try {
			const constraints = type === 'video' ? { video: true, audio: true } : { audio: true };

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			currentStream = stream;
			recordingType = type;
			isRecording = true;

			// Wait for DOM to update before setting up preview
			await tick();

			// Set up video preview for video recording
			if (type === 'video' && videoPreview) {
				videoPreview.srcObject = stream;
				videoPreview.play().catch(console.error);
			}

			// Set up audio visualization for audio recording
			if (type === 'audio') {
				// Small delay to ensure DOM is ready
				setTimeout(() => setupAudioVisualization(stream), 100);
			}

			recordedChunks = [];
			mediaRecorder = new MediaRecorder(stream);

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					recordedChunks.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				const blob = new Blob(recordedChunks, {
					type: type === 'video' ? 'video/webm' : 'audio/webm'
				});

				// Check storage quota before saving recorded media
				const estimatedSize = blob.size * 1.33; // base64 encoding overhead
				const hasSpace = await checkStorageQuota(estimatedSize);
				if (!hasSpace) {
					alert(
						`Cannot save recording: Storage quota would be exceeded. Current usage: ${formatBytes(storageInfo.used)}/${formatBytes(storageInfo.quota)}`
					);
					cleanupRecording();
					return;
				}

				const reader = new FileReader();
				reader.onload = async (e) => {
					const mediaData: MediaData = {
						type: type,
						name: `${type}_${Date.now()}.webm`,
						size: blob.size,
						data: e.target?.result as string,
						mimeType: blob.type
					};
					await addNote(mediaData);
				};
				reader.readAsDataURL(blob);

				// Cleanup
				cleanupRecording();
			};

			mediaRecorder.start();
		} catch (error) {
			console.error('Error starting recording:', error);
			alert('Could not access camera/microphone. Please check permissions.');
			// Reset state on error
			isRecording = false;
			recordingType = null;
			cleanupRecording();
		}
	}

	function stopRecording() {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
			isRecording = false;
			recordingType = null;
		}
	}

	function setupAudioVisualization(stream: MediaStream) {
		try {
			// Clean up any existing audio context
			if (audioContext) {
				audioContext.close();
			}

			const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
			audioContext = new AudioContext();
			analyser = audioContext.createAnalyser();
			const source = audioContext.createMediaStreamSource(stream);

			analyser.fftSize = 256;
			analyser.smoothingTimeConstant = 0.8;
			const bufferLength = analyser.frequencyBinCount;
			audioLevelArray = new Uint8Array(bufferLength);

			source.connect(analyser);

			// Ensure audio context is resumed (required by some browsers)
			if (audioContext.state === 'suspended') {
				audioContext.resume();
			}

			// Start audio level animation
			updateAudioLevels();
		} catch (error) {
			console.error('Error setting up audio visualization:', error);
		}
	}

	function updateAudioLevels() {
		if (!analyser || !isRecording || recordingType !== 'audio' || !audioLevelArray) return;

		analyser.getByteFrequencyData(audioLevelArray);

		// Calculate average audio level
		let sum = 0;
		for (let i = 0; i < audioLevelArray.length; i++) {
			sum += audioLevelArray[i];
		}
		const average = sum / audioLevelArray.length;

		// Update CSS custom property for audio level indicator
		if (typeof document !== 'undefined') {
			document.documentElement.style.setProperty('--audio-level', `${(average / 255) * 100}%`);
		}

		animationFrame = requestAnimationFrame(updateAudioLevels);
	}

	function cleanupRecording() {
		try {
			// Stop all tracks
			if (currentStream) {
				currentStream.getTracks().forEach((track) => track.stop());
				currentStream = null;
			}

			// Clean up video preview
			if (videoPreview) {
				videoPreview.srcObject = null;
			}

			// Clean up audio visualization
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}

			if (audioContext && audioContext.state !== 'closed') {
				audioContext.close().catch(console.error);
				audioContext = null;
			}

			analyser = null;
			audioLevelArray = null;

			// Reset state
			isRecording = false;
			recordingType = null;

			// Reset CSS custom property
			if (typeof document !== 'undefined') {
				document.documentElement.style.setProperty('--audio-level', '0%');
			}
		} catch (error) {
			console.error('Error during cleanup:', error);
		}
	}

	function formatFileSize(bytes: number): string {
		return formatBytes(bytes); // Use the same function with different name for compatibility
	}

	function downloadFile(mediaData: MediaData) {
		const link = document.createElement('a');
		link.href = mediaData.data;
		link.download = mediaData.name;
		link.click();
	}

	$: filteredNotes = notes
		.filter((n) => n.topic === selectedTopic)
		.sort((a, b) => a.order - b.order);

	// Reactive statement to set up video preview when both element and stream are available
	$: if (videoPreview && currentStream && recordingType === 'video' && isRecording) {
		videoPreview.srcObject = currentStream;
		videoPreview.play().catch(console.error);
	}
</script>

<div class="mx-auto max-w-4xl">
	<!-- Storage Warning Banner -->
	{#if showStorageWarning}
		<div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
			<div class="flex items-start">
				<svg
					class="mt-0.5 mr-3 h-5 w-5 text-yellow-600"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
					></path>
				</svg>
				<div class="flex-1">
					<h4 class="font-medium text-yellow-800">Storage Almost Full</h4>
					<p class="mt-1 text-sm text-yellow-700">
						You're using {formatBytes(storageInfo.used)} of {formatBytes(storageInfo.quota)} available
						storage. Consider deleting some notes or media files to free up space.
					</p>
					<div class="mt-3 flex gap-2">
						<button
							on:click={clearMediaNotes}
							class="rounded bg-yellow-600 px-3 py-1 text-sm text-white hover:bg-yellow-700"
						>
							Clear Media Notes
						</button>
						<button
							on:click={clearAllData}
							class="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
						>
							Clear All Data
						</button>
						<button
							on:click={() => (showStorageWarning = false)}
							class="rounded bg-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-400"
						>
							Dismiss
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="flex flex-col gap-6 md:flex-row">
		<!-- Topics Sidebar -->
		<div class="rounded-lg bg-gray-50 p-4 md:w-64">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="font-semibold text-gray-800">Topics</h3>
				<button
					on:click={() => (showNewTopicInput = !showNewTopicInput)}
					aria-label="Add new topic"
					class="text-blue-600 hover:text-blue-800"
					title="Add new topic"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6v6m0 0v6m0-6h6m-6 0H6"
						></path>
					</svg>
				</button>
			</div>

			{#if showNewTopicInput}
				<div class="mb-4">
					<input
						bind:value={newTopicName}
						placeholder="Topic name"
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
						on:keydown={(e) => e.key === 'Enter' && addTopic()}
					/>
					<div class="mt-2 flex gap-2">
						<button
							on:click={addTopic}
							class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
						>
							Add
						</button>
						<button
							on:click={() => {
								showNewTopicInput = false;
								newTopicName = '';
							}}
							class="rounded bg-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-400"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				{#each topics as topic (topic)}
					<div class="group flex items-center justify-between">
						<button
							on:click={() => (selectedTopic = topic)}
							class="flex-1 rounded-md px-3 py-2 text-left transition-colors {selectedTopic ===
							topic
								? 'bg-blue-100 text-blue-800'
								: 'hover:bg-gray-200'}"
						>
							{topic}
							<span class="ml-2 text-sm text-gray-500">
								({notes.filter((n) => n.topic === topic).length})
							</span>
						</button>
						{#if topic !== 'Main'}
							<button
								on:click={() => deleteTopic(topic)}
								aria-label="Delete topic {topic}"
								class="p-1 text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-700"
								title="Delete topic"
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
						{/if}
					</div>
				{/each}
			</div>

			<!-- Storage Info Section -->
			{#if storageInfo.quota > 0}
				<div class="mt-6 border-t border-gray-200 pt-4">
					<h4 class="mb-2 text-sm font-medium text-gray-700">Storage Usage</h4>
					<div class="space-y-2">
						<div class="flex justify-between text-xs text-gray-600">
							<span>Used: {formatBytes(storageInfo.used)}</span>
							<span>Available: {formatBytes(storageInfo.quota)}</span>
						</div>
						<div class="h-2 w-full rounded-full bg-gray-200">
							<div
								class="h-2 rounded-full transition-all duration-300 {storageInfo.used /
									storageInfo.quota >
								0.8
									? 'bg-red-500'
									: storageInfo.used / storageInfo.quota > 0.6
										? 'bg-yellow-500'
										: 'bg-green-500'}"
								style="width: {Math.min((storageInfo.used / storageInfo.quota) * 100, 100)}%"
							></div>
						</div>
						<div class="text-center text-xs text-gray-500">
							{((storageInfo.used / storageInfo.quota) * 100).toFixed(1)}% used
						</div>

						{#if storageInfo.used / storageInfo.quota > 0.7}
							<div class="mt-3 space-y-1">
								<button
									on:click={clearMediaNotes}
									class="w-full rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800 transition-colors hover:bg-yellow-200"
								>
									Clear Media Notes
								</button>
								<button
									on:click={updateStorageInfo}
									class="w-full rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200"
								>
									Refresh Storage Info
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Notes Section -->
		<div class="flex-1">
			<div class="mb-6">
				<h3 class="mb-4 text-xl font-semibold text-gray-800">
					{selectedTopic} ({filteredNotes.length} notes)
				</h3>

				<!-- Add New Note -->
				<div class="mb-6 rounded-lg bg-blue-50 p-4">
					<textarea
						bind:value={newNoteText}
						placeholder="Write a note to yourself..."
						class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
						rows="3"
						on:keydown={(e) => {
							if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
								addNote();
							}
						}}
					></textarea>

					<!-- Media Controls -->
					<div class="mt-3 flex items-center justify-between">
						<div class="flex items-center space-x-2">
							<!-- Toggle media controls -->
							<button
								on:click={() => (showMediaControls = !showMediaControls)}
								aria-label="Toggle media controls"
								class="text-gray-500 transition-colors hover:text-blue-600"
								title="Media options"
							>
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a2 2 0 00-2.828-2.828z"
									></path>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12l2 2 4-4"
									></path>
								</svg>
							</button>

							{#if showMediaControls}
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
							{/if}
						</div>

						<div class="flex items-center space-x-3">
							<span class="text-sm text-gray-500">Press Ctrl+Enter to add note</span>
							<button
								on:click={() => addNote()}
								disabled={!newNoteText.trim()}
								class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Add Note
							</button>
						</div>
					</div>

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
				</div>
			</div>

			<!-- Notes List -->
			<div class="space-y-4">
				{#each filteredNotes as note (note.id)}
					<div
						class="group cursor-move rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md"
						draggable="true"
						role="button"
						tabindex="0"
						on:dragstart={(e) => handleDragStart(e, note)}
						on:dragover={handleDragOver}
						on:drop={(e) => handleDrop(e, note)}
						on:click={() => (focusedNote = focusedNote === note.id ? null : note.id)}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								focusedNote = focusedNote === note.id ? null : note.id;
							}
						}}
						aria-label="Note from {formatTimestamp(note.timestamp)}"
					>
						<!-- Always visible: Date and content -->
						<div class="flex items-start justify-between">
							<span class="text-sm text-gray-500">{formatTimestamp(note.timestamp)}</span>

							<!-- Controls - only visible when focused or hovered -->
							<div
								class="flex items-center space-x-2 {focusedNote === note.id ||
								editingNote?.id === note.id
									? 'opacity-100'
									: 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200"
							>
								<!-- Move to topic dropdown -->
								<select
									on:change={(e) => {
										const target = e.target as HTMLSelectElement;
										moveNoteToTopic(note.id, target.value);
									}}
									value={note.topic}
									class="rounded border border-gray-300 px-2 py-1 text-sm"
									on:click|stopPropagation
								>
									{#each topics as topic (topic)}
										<option value={topic}>{topic}</option>
									{/each}
								</select>

								<button
									on:click|stopPropagation={() => startEdit(note)}
									aria-label="Edit note"
									class="text-gray-500 hover:text-blue-600"
									title="Edit note"
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

								<button
									on:click|stopPropagation={() => deleteNote(note.id)}
									aria-label="Delete note"
									class="text-gray-500 hover:text-red-600"
									title="Delete note"
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

						{#if editingNote && editingNote.id === note.id}
							<!-- Edit mode -->
							<div class="space-y-3">
								<textarea
									bind:value={editingNote.text}
									class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
									rows="4"
								></textarea>
								<div class="flex gap-2">
									<button
										on:click={saveEdit}
										class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
									>
										Save
									</button>
									<button
										on:click={cancelEdit}
										class="rounded bg-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-400"
									>
										Cancel
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
													on:click={() => {
														if (note.media) {
															const img = new Image();
															img.src = note.media.data;
															const win = window.open('', '_blank');
															if (win) {
																win.document.write(
																	`<img src="${note.media.data}" style="max-width: 100%; height: auto;">`
																);
															}
														}
													}}
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
														on:click={() => note.media && downloadFile(note.media)}
														class="text-blue-600 hover:text-blue-800"
														title="Download file"
														aria-label="Download file {note.media?.name || 'file'}"
													>
														<svg
															class="h-5 w-5"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
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
							</div>
						{/if}
					</div>
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
	</div>
</div>

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
