<script>
	import { onMount, onDestroy, tick } from 'svelte';

	let notes = [];
	let topics = ['Main'];
	let selectedTopic = 'Main';
	let newNoteText = '';
	let editingNote = null;
	let draggedNote = null;
	let newTopicName = '';
	let showNewTopicInput = false;
	let focusedNote = null;
	let mediaRecorder = null;
	let isRecording = false;
	let recordingType = null; // 'audio' or 'video'
	let recordedChunks = [];
	let showMediaControls = false;
	let currentStream = null;
	let videoPreview = null;
	let audioContext = null;
	let analyser = null;
	let audioLevelArray = null;
	let animationFrame = null;
	let storageInfo = { used: 0, quota: 0, available: 0 };
	let showStorageWarning = false;

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

	function formatBytes(bytes) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	async function checkStorageQuota(additionalSize = 0) {
		await updateStorageInfo();
		const wouldExceed = (storageInfo.used + additionalSize) > storageInfo.quota * 0.9; // 90% threshold
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
		} catch (error) {
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
		} catch (error) {
			console.error('Error saving notes:', error);
			
			if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
				alert(`Storage quota exceeded! Current usage: ${formatBytes(storageInfo.used)}/${formatBytes(storageInfo.quota)}. Please delete some notes or media files to free up space.`);
				showStorageWarning = true;
			} else {
				alert('Error saving notes: ' + error.message);
			}
		}
	}

	async function addNote(mediaData = null) {
		if (newNoteText.trim() || mediaData) {
			// Estimate the size of the new note
			const noteSize = (newNoteText.length * 2) + (mediaData ? mediaData.data.length : 0);
			
			// Check storage quota before adding
			const hasSpace = await checkStorageQuota(noteSize);
			if (!hasSpace) {
				alert(`Cannot add note: Storage quota would be exceeded. Current usage: ${formatBytes(storageInfo.used)}/${formatBytes(storageInfo.quota)}`);
				return;
			}
			
			const note = {
				id: Date.now(),
				text: newNoteText.trim(),
				topic: selectedTopic,
				timestamp: new Date().toISOString(),
				order: notes.filter(n => n.topic === selectedTopic).length,
				media: mediaData
			};
			notes = [...notes, note];
			newNoteText = '';
			await saveNotes();
		}
	}

	async function deleteNote(noteId) {
		notes = notes.filter(n => n.id !== noteId);
		await saveNotes();
	}

	async function startEdit(note) {
		editingNote = { ...note };
	}

	async function saveEdit() {
		if (editingNote) {
			notes = notes.map(n => n.id === editingNote.id ? editingNote : n);
			editingNote = null;
			await saveNotes();
		}
	}

	function cancelEdit() {
		editingNote = null;
	}

	async function moveNoteToTopic(noteId, newTopic) {
		notes = notes.map(n => {
			if (n.id === noteId) {
				return { ...n, topic: newTopic, order: notes.filter(note => note.topic === newTopic).length };
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

	async function deleteTopic(topicToDelete) {
		if (topicToDelete === 'Main') return; // Can't delete main
		
		// Move all notes from deleted topic to Main
		notes = notes.map(n => n.topic === topicToDelete ? { ...n, topic: 'Main' } : n);
		topics = topics.filter(t => t !== topicToDelete);
		
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
		if (confirm('Are you sure you want to delete all notes with media attachments? This will free up storage space but cannot be undone.')) {
			notes = notes.filter(n => !n.media);
			await saveNotes();
		}
	}

	function handleDragStart(event, note) {
		draggedNote = note;
		event.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
	}

	function handleDrop(event, dropNote) {
		event.preventDefault();
		if (draggedNote && dropNote && draggedNote.id !== dropNote.id && draggedNote.topic === dropNote.topic) {
			// Reorder notes within the same topic
			const topicNotes = notes.filter(n => n.topic === draggedNote.topic);
			const draggedIndex = topicNotes.findIndex(n => n.id === draggedNote.id);
			const dropIndex = topicNotes.findIndex(n => n.id === dropNote.id);
			
			// Update order values
			topicNotes.splice(draggedIndex, 1);
			topicNotes.splice(dropIndex, 0, draggedNote);
			
			topicNotes.forEach((note, index) => {
				note.order = index;
			});
			
			notes = [...notes.filter(n => n.topic !== draggedNote.topic), ...topicNotes];
			saveNotes();
		}
		draggedNote = null;
	}

	function makeLinksClickable(text) {
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>');
	}

	function formatTimestamp(timestamp) {
		return new Date(timestamp).toLocaleString();
	}

	// Media handling functions
	async function handleFileUpload(event) {
		const file = event.target.files[0];
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
			alert(`Cannot upload file: Storage quota would be exceeded. Current usage: ${formatBytes(storageInfo.used)}/${formatBytes(storageInfo.quota)}`);
			return;
		}

		const reader = new FileReader();
		reader.onload = async (e) => {
			const mediaData = {
				type: file.type.startsWith('image/') ? 'image' : 'file',
				name: file.name,
				size: file.size,
				data: e.target.result,
				mimeType: file.type
			};
			await addNote(mediaData);
		};
		reader.readAsDataURL(file);
		
		// Reset file input
		event.target.value = '';
	}

	async function startRecording(type) {
		try {
			const constraints = type === 'video' 
				? { video: true, audio: true }
				: { audio: true };
			
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
					alert(`Cannot save recording: Storage quota would be exceeded. Current usage: ${formatBytes(storageInfo.used)}/${formatBytes(storageInfo.quota)}`);
					cleanupRecording();
					return;
				}
				
				const reader = new FileReader();
				reader.onload = async (e) => {
					const mediaData = {
						type: type,
						name: `${type}_${Date.now()}.webm`,
						size: blob.size,
						data: e.target.result,
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

	function setupAudioVisualization(stream) {
		try {
			// Clean up any existing audio context
			if (audioContext) {
				audioContext.close();
			}

			audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
		if (!analyser || !isRecording || recordingType !== 'audio') return;
		
		analyser.getByteFrequencyData(audioLevelArray);
		
		// Calculate average audio level
		let sum = 0;
		for (let i = 0; i < audioLevelArray.length; i++) {
			sum += audioLevelArray[i];
		}
		const average = sum / audioLevelArray.length;
		
		// Update CSS custom property for audio level indicator
		if (typeof document !== 'undefined') {
			document.documentElement.style.setProperty('--audio-level', `${average / 255 * 100}%`);
		}
		
		animationFrame = requestAnimationFrame(updateAudioLevels);
	}

	function cleanupRecording() {
		try {
			// Stop all tracks
			if (currentStream) {
				currentStream.getTracks().forEach(track => track.stop());
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

	function formatFileSize(bytes) {
		return formatBytes(bytes); // Use the same function with different name for compatibility
	}

	function downloadFile(mediaData) {
		const link = document.createElement('a');
		link.href = mediaData.data;
		link.download = mediaData.name;
		link.click();
	}

	$: filteredNotes = notes
		.filter(n => n.topic === selectedTopic)
		.sort((a, b) => a.order - b.order);

	// Reactive statement to set up video preview when both element and stream are available
	$: if (videoPreview && currentStream && recordingType === 'video' && isRecording) {
		videoPreview.srcObject = currentStream;
		videoPreview.play().catch(console.error);
	}
</script>

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

<div class="max-w-4xl mx-auto">
	<!-- Storage Warning Banner -->
	{#if showStorageWarning}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
			<div class="flex items-start">
				<svg class="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
				</svg>
				<div class="flex-1">
					<h4 class="text-yellow-800 font-medium">Storage Almost Full</h4>
					<p class="text-yellow-700 text-sm mt-1">
						You're using {formatBytes(storageInfo.used)} of {formatBytes(storageInfo.quota)} available storage. 
						Consider deleting some notes or media files to free up space.
					</p>
					<div class="flex gap-2 mt-3">
						<button
							on:click={clearMediaNotes}
							class="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
						>
							Clear Media Notes
						</button>
						<button
							on:click={clearAllData}
							class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
						>
							Clear All Data
						</button>
						<button
							on:click={() => showStorageWarning = false}
							class="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
						>
							Dismiss
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="flex flex-col md:flex-row gap-6">
		<!-- Topics Sidebar -->
		<div class="md:w-64 bg-gray-50 rounded-lg p-4">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-800">Topics</h3>
				<button
					on:click={() => showNewTopicInput = !showNewTopicInput}
					class="text-blue-600 hover:text-blue-800"
					title="Add new topic"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
					</svg>
				</button>
			</div>

			{#if showNewTopicInput}
				<div class="mb-4">
					<input
						bind:value={newTopicName}
						placeholder="Topic name"
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
						on:keydown={(e) => e.key === 'Enter' && addTopic()}
					/>
					<div class="flex gap-2 mt-2">
						<button
							on:click={addTopic}
							class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
						>
							Add
						</button>
						<button
							on:click={() => {showNewTopicInput = false; newTopicName = '';}}
							class="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				{#each topics as topic}
					<div class="flex items-center justify-between group">
						<button
							on:click={() => selectedTopic = topic}
							class="flex-1 text-left px-3 py-2 rounded-md transition-colors {selectedTopic === topic ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-200'}"
						>
							{topic}
							<span class="text-sm text-gray-500 ml-2">
								({notes.filter(n => n.topic === topic).length})
							</span>
						</button>
						{#if topic !== 'Main'}
							<button
								on:click={() => deleteTopic(topic)}
								class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1"
								title="Delete topic"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
								</svg>
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Storage Info Section -->
			{#if storageInfo.quota > 0}
				<div class="mt-6 pt-4 border-t border-gray-200">
					<h4 class="text-sm font-medium text-gray-700 mb-2">Storage Usage</h4>
					<div class="space-y-2">
						<div class="flex justify-between text-xs text-gray-600">
							<span>Used: {formatBytes(storageInfo.used)}</span>
							<span>Available: {formatBytes(storageInfo.quota)}</span>
						</div>
						<div class="w-full bg-gray-200 rounded-full h-2">
							<div 
								class="h-2 rounded-full transition-all duration-300 {(storageInfo.used / storageInfo.quota) > 0.8 ? 'bg-red-500' : (storageInfo.used / storageInfo.quota) > 0.6 ? 'bg-yellow-500' : 'bg-green-500'}"
								style="width: {Math.min((storageInfo.used / storageInfo.quota) * 100, 100)}%"
							></div>
						</div>
						<div class="text-xs text-gray-500 text-center">
							{((storageInfo.used / storageInfo.quota) * 100).toFixed(1)}% used
						</div>
						
						{#if storageInfo.used / storageInfo.quota > 0.7}
							<div class="mt-3 space-y-1">
								<button
									on:click={clearMediaNotes}
									class="w-full px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs hover:bg-yellow-200 transition-colors"
								>
									Clear Media Notes
								</button>
								<button
									on:click={updateStorageInfo}
									class="w-full px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors"
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
				<h3 class="text-xl font-semibold text-gray-800 mb-4">
					{selectedTopic} ({filteredNotes.length} notes)
				</h3>
				
				<!-- Add New Note -->
				<div class="bg-blue-50 rounded-lg p-4 mb-6">
					<textarea
						bind:value={newNoteText}
						placeholder="Write a note to yourself..."
						class="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						rows="3"
						on:keydown={(e) => {
							if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
								addNote();
							}
						}}
					></textarea>
					
					<!-- Media Controls -->
					<div class="flex items-center justify-between mt-3">
						<div class="flex items-center space-x-2">
							<!-- Toggle media controls -->
							<button
								on:click={() => showMediaControls = !showMediaControls}
								class="text-gray-500 hover:text-blue-600 transition-colors"
								title="Media options"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a2 2 0 00-2.828-2.828z"></path>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"></path>
								</svg>
							</button>
							
							{#if showMediaControls}
								<!-- File upload -->
								<label class="cursor-pointer text-gray-500 hover:text-blue-600 transition-colors" title="Upload file/image">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
									</svg>
									<input type="file" class="hidden" on:change={handleFileUpload} accept="*/*">
								</label>
								
								<!-- Voice recording -->
								<button
									on:click={() => isRecording && recordingType === 'audio' ? stopRecording() : startRecording('audio')}
									class="text-gray-500 hover:text-blue-600 transition-colors {isRecording && recordingType === 'audio' ? 'text-red-500' : ''}"
									title={isRecording && recordingType === 'audio' ? 'Stop recording' : 'Record audio'}
									disabled={isRecording && recordingType !== 'audio'}
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
									</svg>
								</button>
								
								<!-- Video recording -->
								<button
									on:click={() => isRecording && recordingType === 'video' ? stopRecording() : startRecording('video')}
									class="text-gray-500 hover:text-blue-600 transition-colors {isRecording && recordingType === 'video' ? 'text-red-500' : ''}"
									title={isRecording && recordingType === 'video' ? 'Stop recording' : 'Record video'}
									disabled={isRecording && recordingType !== 'video'}
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
									</svg>
								</button>
								

							{/if}
						</div>
						
						<div class="flex items-center space-x-3">
							<span class="text-sm text-gray-500">Press Ctrl+Enter to add note</span>
							<button
								on:click={() => addNote()}
								disabled={!newNoteText.trim()}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Add Note
							</button>
						</div>
					</div>
					
					<!-- Recording Preview -->
					{#if isRecording}
						<div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
							{#if recordingType === 'video'}
								<!-- Video preview -->
								<div class="text-center">
									<p class="text-red-600 font-medium mb-2 flex items-center justify-center">
										<svg class="w-5 h-5 mr-2 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
											<circle cx="10" cy="10" r="3" />
										</svg>
										Recording Video...
									</p>
									<video
										bind:this={videoPreview}
										muted
										class="rounded-lg shadow-md w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto"
										style="max-height: 50vh; aspect-ratio: 16/9; object-fit: cover;"
									></video>
								</div>
							{:else if recordingType === 'audio'}
								<!-- Audio level indicator -->
								<div class="text-center">
									<p class="text-red-600 font-medium mb-3 flex items-center justify-center">
										<svg class="w-5 h-5 mr-2 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
											<circle cx="10" cy="10" r="3" />
										</svg>
										Recording Audio...
									</p>
									
									<!-- Audio level bars -->
									<div class="flex items-center justify-center space-x-1 mb-2">
										{#each Array(20) as _, i}
											<div 
												class="audio-bar bg-red-400 rounded-full"
												style="width: 3px; height: {4 + i * 2}px; animation-delay: {i * 50}ms;"
											></div>
										{/each}
									</div>
									
									<!-- Pulsing microphone icon -->
									<div class="flex justify-center">
										<div class="relative">
											<svg class="w-12 h-12 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
											</svg>
											<!-- Ripple effect -->
											<div class="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30"></div>
											<div class="absolute inset-2 rounded-full border-2 border-red-300 animate-ping opacity-20" style="animation-delay: 0.5s;"></div>
										</div>
									</div>
								</div>
							{/if}
							
							<div class="text-center mt-3">
								<button
									on:click={stopRecording}
									class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
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
						class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all duration-200 cursor-move group"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, note)}
						on:dragover={handleDragOver}
						on:drop={(e) => handleDrop(e, note)}
						on:click={() => focusedNote = focusedNote === note.id ? null : note.id}
						on:keydown={(e) => e.key === 'Enter' && (focusedNote = focusedNote === note.id ? null : note.id)}
						tabindex="0"
					>
						<!-- Always visible: Date and content -->
						<div class="flex items-start justify-between">
							<span class="text-sm text-gray-500">{formatTimestamp(note.timestamp)}</span>
							
							<!-- Controls - only visible when focused or hovered -->
							<div class="flex items-center space-x-2 {focusedNote === note.id || editingNote?.id === note.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200">
								<!-- Move to topic dropdown -->
								<select
									on:change={(e) => moveNoteToTopic(note.id, e.target.value)}
									value={note.topic}
									class="text-sm border border-gray-300 rounded px-2 py-1"
									on:click|stopPropagation
								>
									{#each topics as topic}
										<option value={topic}>{topic}</option>
									{/each}
								</select>
								
								<button
									on:click|stopPropagation={() => startEdit(note)}
									class="text-gray-500 hover:text-blue-600"
									title="Edit note"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
									</svg>
								</button>
								
								<button
									on:click|stopPropagation={() => deleteNote(note.id)}
									class="text-gray-500 hover:text-red-600"
									title="Delete note"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
									</svg>
								</button>
							</div>
						</div>
						
						{#if editingNote && editingNote.id === note.id}
							<!-- Edit mode -->
							<div class="space-y-3">
								<textarea
									bind:value={editingNote.text}
									class="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									rows="4"
								></textarea>
								<div class="flex gap-2">
									<button
										on:click={saveEdit}
										class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
									>
										Save
									</button>
									<button
										on:click={cancelEdit}
										class="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
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
										<p class="text-gray-800 whitespace-pre-wrap">{@html makeLinksClickable(note.text)}</p>
									</div>
								{/if}
								
								<!-- Media content -->
								{#if note.media}
									<div class="mt-3">
										{#if note.media.type === 'image'}
											<!-- Image display -->
											<div class="max-w-md">
												<img 
													src={note.media.data} 
													alt={note.media.name}
													class="rounded-lg shadow-sm max-w-full h-auto cursor-pointer hover:shadow-md transition-shadow"
													on:click={() => {
														const img = new Image();
														img.src = note.media.data;
														const win = window.open('', '_blank');
														win.document.write(`<img src="${note.media.data}" style="max-width: 100%; height: auto;">`);
													}}
												/>
												<p class="text-xs text-gray-500 mt-1">{note.media.name} ({formatFileSize(note.media.size)})</p>
											</div>
										{:else if note.media.type === 'audio'}
											<!-- Audio player -->
											<div class="bg-gray-50 rounded-lg p-3 max-w-md">
												<div class="flex items-center space-x-2 mb-2">
													<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
													</svg>
													<span class="text-sm font-medium text-gray-700">Audio Note</span>
												</div>
												<audio controls class="w-full mb-2">
													<source src={note.media.data} type={note.media.mimeType}>
													Your browser does not support the audio element.
												</audio>
												<p class="text-xs text-gray-500">{note.media.name} ({formatFileSize(note.media.size)})</p>
											</div>
										{:else if note.media.type === 'video'}
											<!-- Video player -->
											<div class="bg-gray-50 rounded-lg p-3 max-w-lg">
												<div class="flex items-center space-x-2 mb-2">
													<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
													</svg>
													<span class="text-sm font-medium text-gray-700">Video Note</span>
												</div>
												<video controls class="w-full rounded mb-2">
													<source src={note.media.data} type={note.media.mimeType}>
													Your browser does not support the video element.
												</video>
												<p class="text-xs text-gray-500">{note.media.name} ({formatFileSize(note.media.size)})</p>
											</div>
										{:else if note.media.type === 'file'}
											<!-- File download -->
											<div class="bg-gray-50 rounded-lg p-3 max-w-md">
												<div class="flex items-center justify-between">
													<div class="flex items-center space-x-2">
														<svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
														</svg>
														<div>
															<p class="text-sm font-medium text-gray-700">{note.media.name}</p>
															<p class="text-xs text-gray-500">{formatFileSize(note.media.size)}</p>
														</div>
													</div>
													<button
														on:click={() => downloadFile(note.media)}
														class="text-blue-600 hover:text-blue-800"
														title="Download file"
													>
														<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
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
					<div class="text-center py-12 text-gray-500">
						<svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
						</svg>
						<p class="text-lg mb-2">No notes in {selectedTopic}</p>
						<p class="text-sm">Start by adding your first note above</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div> 