<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import T from './T.svelte';
	import { globalPlaylistStore, type AudioFile } from './stores/globalPlaylist';

	interface Folder {
		id: string;
		name: string;
		parentId: string | null;
		children: string[];
	}

	// State - keeping only Sound Library specific state
	let files: AudioFile[] = $state([]);
	let folders: Folder[] = $state([{ id: 'root', name: 'Library', parentId: null, children: [] }]);
	let currentFolderId = $state('root');
	let selectedTags: string[] = $state([]);
	let showUploadModal = $state(false);
	let showNewFolderModal = $state(false);
	let showMetadataModal = $state(false);
	let selectedFileForMetadata: AudioFile | null = $state(null);
	let editingTags: string | null = $state(null);
	let newTagInput = $state('');
	let newFolderName = $state('');
	let draggedFile: AudioFile | null = $state(null);
	let draggedFolder: Folder | null = $state(null);
	let dragOverFolderId: string | null = $state(null);
	let searchQuery = $state('');
	let recursiveTagFilter = $state(false);

	// Add new state variables for folder operations
	let showRenameFolderModal = $state(false);
	let selectedFolderForRename: Folder | null = $state(null);
	let renameFolderName = $state('');

	// Drag and drop for playlist (now handled by global component)

	// Get playback state from global store
	let playlistState: any = $state(null); // TODO: Import proper type from store
	let unsubscribePlaylist: (() => void) | null = null;

	// Computed properties using $state for proper reactivity
	let allTags: string[] = $state([]);
	let filteredFiles: AudioFile[] = $state([]);
	let currentFolder: Folder | null = $state(null);
	let breadcrumbs: Folder[] = $state([]);

	let dragOverExternal = $state(false);

	// Helper function to get all descendant folder IDs recursively
	function getDescendantFolderIds(folderId: string): string[] {
		const result = [folderId];
		const folder = folders.find((f) => f.id === folderId);
		if (folder) {
			folder.children.forEach((childId) => {
				result.push(...getDescendantFolderIds(childId));
			});
		}
		return result;
	}

	// getFilesFromFolder removed - drag and drop to playlist now handled by global component

	// Subscribe to global playlist store
	$effect(() => {
		if (unsubscribePlaylist) {
			unsubscribePlaylist();
		}
		unsubscribePlaylist = globalPlaylistStore.subscribe((state) => {
			playlistState = state;
		});
	});

	// Update computed values reactively
	$effect(() => {
		if (
			(files || !files) &&
			(folders || !folders) &&
			(selectedTags || !selectedTags) &&
			(searchQuery || !searchQuery) &&
			(currentFolderId || !currentFolderId) &&
			(recursiveTagFilter || !recursiveTagFilter)
		) {
			// track these variables
		}
		untrack(() => {
			// Update allTags
			const tags = new Set<string>();
			files.forEach((file) => file.tags.forEach((tag) => tags.add(tag)));
			allTags = Array.from(tags).sort();

			// Update currentFolder
			currentFolder = folders.find((f) => f.id === currentFolderId) || folders[0];

			// Update breadcrumbs
			const path: Folder[] = [];
			let current: Folder | null = currentFolder;
			while (current) {
				path.unshift(current);
				current = current.parentId ? folders.find((f) => f.id === current!.parentId) || null : null;
			}
			breadcrumbs = path;

			// Update filteredFiles
			let result = files.filter((file) => {
				// If there's a search query, search across all directories
				if (searchQuery.trim()) {
					const query = searchQuery.toLowerCase();
					return (
						file.name.toLowerCase().includes(query) ||
						file.tags.some((tag) => tag.toLowerCase().includes(query))
					);
				}

				// When using recursive tag filter with selected tags, include descendant folders
				const useRecursiveFilter = recursiveTagFilter && selectedTags.length > 0;
				const allowedFolderIds = useRecursiveFilter
					? getDescendantFolderIds(currentFolderId)
					: [currentFolderId];

				// Filter by current folder and its descendants (if recursive mode is enabled)
				if (!allowedFolderIds.includes(file.folderId)) return false;

				// Filter by selected tags
				if (selectedTags.length > 0) {
					return selectedTags.every((tag) => file.tags.includes(tag));
				}

				return true;
			});
			filteredFiles = result;
		});
	});

	// Playlist management functions - now using global store
	function playFile(file: AudioFile) {
		globalPlaylistStore.playFile(file);
	}

	function playAllFiltered() {
		globalPlaylistStore.replacePlaylist(filteredFiles, 0);
	}

	function addAllFilteredToPlaylist() {
		globalPlaylistStore.addToPlaylist(filteredFiles);
	}

	// Audio functions - now handled by global store
	// All audio playback is now managed by the globalPlaylistStore

	// File processing helper function
	async function processFiles(fileList: FileList | File[]) {
		const filesToProcess = Array.from(fileList);
		const newAudioFiles: AudioFile[] = [];

		for (const file of filesToProcess) {
			if (file.type.startsWith('audio/')) {
				const audioFile: AudioFile = {
					id: crypto.randomUUID(),
					name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
					file,
					url: URL.createObjectURL(file),
					tags: [],
					folderId: currentFolderId,
					metadata: {
						duration: 0,
						size: file.size,
						type: file.type,
						lastModified: file.lastModified
					}
				};

				// Get duration from audio
				const audio = new Audio(audioFile.url);
				audio.addEventListener('loadedmetadata', async () => {
					audioFile.metadata.duration = audio.duration;
					files = [...files];
					await saveToStorage();
				});

				files = [...files, audioFile];
				newAudioFiles.push(audioFile);
			}
		}

		await saveToStorage(newAudioFiles);
	}

	// File management functions
	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const uploadedFiles = target.files;

		if (!uploadedFiles) return;

		await processFiles(uploadedFiles);
		showUploadModal = false;
		target.value = '';
	}

	async function deleteFile(fileId: string) {
		const file = files.find((f) => f.id === fileId);
		if (file) {
			URL.revokeObjectURL(file.url);
			files = files.filter((f) => f.id !== fileId);

			// Remove from global playlist if it exists there
			if (playlistState?.currentPlaylist.some((f: AudioFile) => f.id === fileId)) {
				globalPlaylistStore.removeFromPlaylist(fileId);
			}

			await saveToStorage();
		}
	}

	async function addTag(fileId: string, tag: string) {
		const trimmedTag = tag.trim();
		if (!trimmedTag) return;

		files = files.map((file) => {
			if (file.id === fileId && !file.tags.includes(trimmedTag)) {
				return { ...file, tags: [...file.tags, trimmedTag] };
			}
			return file;
		});

		await saveToStorage();
	}

	async function removeTag(fileId: string, tag: string) {
		files = files.map((file) => {
			if (file.id === fileId) {
				return { ...file, tags: file.tags.filter((t) => t !== tag) };
			}
			return file;
		});

		await saveToStorage();
	}

	function toggleTagFilter(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	// Folder management
	async function createFolder() {
		if (!newFolderName.trim()) return;

		const trimmedName = newFolderName.trim();

		// Check for duplicate names in the current directory
		const existingFolder = folders.find(
			(f) => f.parentId === currentFolderId && f.name === trimmedName
		);

		if (existingFolder) {
			alert(`A folder named "${trimmedName}" already exists in this location.`);
			return;
		}

		const folder: Folder = {
			id: crypto.randomUUID(),
			name: trimmedName,
			parentId: currentFolderId,
			children: []
		};

		// Add to parent's children
		folders = folders.map((f) => {
			if (f.id === currentFolderId) {
				return { ...f, children: [...f.children, folder.id] };
			}
			return f;
		});

		folders = [...folders, folder];
		newFolderName = '';
		showNewFolderModal = false;
		await saveToStorage();
	}

	// Add new folder operation functions
	async function renameFolder() {
		if (!selectedFolderForRename || !renameFolderName.trim()) return;

		const trimmedName = renameFolderName.trim();

		// Check for duplicate names in the same parent directory
		const parentId = selectedFolderForRename.parentId;
		const existingFolder = folders.find(
			(f) =>
				f.parentId === parentId && f.name === trimmedName && f.id !== selectedFolderForRename!.id
		);

		if (existingFolder) {
			alert(`A folder named "${trimmedName}" already exists in this location.`);
			return;
		}

		folders = folders.map((f) => {
			if (f.id === selectedFolderForRename!.id) {
				return { ...f, name: trimmedName };
			}
			return f;
		});

		showRenameFolderModal = false;
		selectedFolderForRename = null;
		renameFolderName = '';
		await saveToStorage();
	}

	async function deleteFolder(folderId: string) {
		if (folderId === 'root') return; // Can't delete root

		const folder = folders.find((f) => f.id === folderId);
		if (!folder) return;

		// Get all descendant folder IDs
		const descendantIds = getDescendantFolderIds(folderId);

		// Move all files from this folder and its descendants to root
		files = files.map((file) => {
			if (descendantIds.includes(file.folderId)) {
				return { ...file, folderId: 'root' };
			}
			return file;
		});

		// Remove folder and all descendants from folders array
		folders = folders.filter((f) => !descendantIds.includes(f.id));

		// Remove folder from parent's children
		if (folder.parentId) {
			folders = folders.map((f) => {
				if (f.id === folder.parentId) {
					return { ...f, children: f.children.filter((childId) => childId !== folderId) };
				}
				return f;
			});
		}

		// Navigate to parent if we're in the deleted folder
		if (currentFolderId === folderId || descendantIds.includes(currentFolderId)) {
			currentFolderId = folder.parentId || 'root';
		}

		await saveToStorage();
	}

	async function moveFolder(folderId: string, newParentId: string) {
		if (folderId === 'root' || folderId === newParentId) return;

		// Check if newParentId is a descendant of folderId (prevent circular reference)
		const descendantIds = getDescendantFolderIds(folderId);
		if (descendantIds.includes(newParentId)) return;

		const folder = folders.find((f) => f.id === folderId);
		if (!folder) return;

		// Check for duplicate names in the target directory
		const existingFolder = folders.find(
			(f) => f.parentId === newParentId && f.name === folder.name && f.id !== folderId
		);

		if (existingFolder) {
			alert(`A folder named "${folder.name}" already exists in the target location.`);
			return;
		}

		// Remove from old parent's children
		if (folder.parentId) {
			folders = folders.map((f) => {
				if (f.id === folder.parentId) {
					return { ...f, children: f.children.filter((childId) => childId !== folderId) };
				}
				return f;
			});
		}

		// Add to new parent's children
		folders = folders.map((f) => {
			if (f.id === newParentId) {
				return { ...f, children: [...f.children, folderId] };
			}
			return f;
		});

		// Update folder's parentId
		folders = folders.map((f) => {
			if (f.id === folderId) {
				return { ...f, parentId: newParentId };
			}
			return f;
		});

		await saveToStorage();
	}

	function navigateToFolder(folderId: string) {
		currentFolderId = folderId;
		selectedTags = [];
		recursiveTagFilter = false;
	}

	async function moveFileToFolder(fileId: string, folderId: string) {
		files = files.map((file) => {
			if (file.id === fileId) {
				return { ...file, folderId };
			}
			return file;
		});
		await saveToStorage();
	}

	// Drag and drop
	function handleDragStart(event: DragEvent, file: AudioFile) {
		draggedFile = file;
		if (event.dataTransfer) {
			// Allow both copy and move so that any dropEffect assigned later is accepted.
			event.dataTransfer.effectAllowed = 'copyMove';
			// Some browsers (e.g. Firefox) ignore drag operations unless data is set.
			// Using the file id as arbitrary data enables cross-browser compatibility.
			event.dataTransfer.setData('text/plain', file.id);
			// Also set file data for playlist drop handling
			event.dataTransfer.setData('text/json', JSON.stringify(file));
		}
	}

	function handleFolderDragOver(event: DragEvent, folderId: string) {
		event.preventDefault();
		if (event.dataTransfer) {
			// Indicate a move operation so it matches effectAllowed.
			event.dataTransfer.dropEffect = 'move';
		}

		// Don't allow dropping folder on itself or descendants
		if (
			draggedFolder &&
			(draggedFolder.id === folderId || getDescendantFolderIds(draggedFolder.id).includes(folderId))
		) {
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'none';
			}
			return;
		}

		if (draggedFile || draggedFolder) {
			dragOverFolderId = folderId;
		}
	}

	function handleFolderDragLeave(event: DragEvent) {
		// Only clear drag over if we're actually leaving the element
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const isInside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!isInside) {
			dragOverFolderId = null;
		}
	}

	function handleDragEnd() {
		draggedFile = null;
		draggedFolder = null;
		dragOverFolderId = null;
	}

	async function handleFolderDrop(event: DragEvent, folderId: string) {
		event.preventDefault();
		event.stopPropagation();

		if (draggedFile && draggedFile.folderId !== folderId) {
			await moveFileToFolder(draggedFile.id, folderId);
		}
		if (draggedFolder && draggedFolder.id !== folderId) {
			await moveFolder(draggedFolder.id, folderId);
		}
		draggedFile = null;
		draggedFolder = null;
		dragOverFolderId = null;
	}

	function handleFolderDragStart(event: DragEvent, folder: Folder) {
		draggedFolder = folder;
		if (event.dataTransfer) {
			// Allow both copy and move so that any dropEffect assigned later is accepted.
			event.dataTransfer.effectAllowed = 'copyMove';
			// Similar cross-browser fix as above – set dummy data so the drag is recognised.
			event.dataTransfer.setData('text/plain', folder.id);
		}
	}

	// Playlist drag handlers are now handled by the global GlobalPlaylist component

	// Playback state management is now handled by the global store

	// Storage
	async function saveToStorage(filesToSave?: AudioFile[]) {
		try {
			// Check if OPFS is supported
			if (!navigator.storage?.getDirectory) {
				console.warn('OPFS not supported, falling back to localStorage metadata only');
				saveToLocalStorageOnly();
				return;
			}

			const opfsRoot = await navigator.storage.getDirectory();

			// Create soundLibrary directory if it doesn't exist
			const soundLibraryDir = await opfsRoot.getDirectoryHandle('soundLibrary', { create: true });

			// Save files with actual File objects
			const targetFiles = filesToSave || files;
			for (const file of targetFiles) {
				if (file.file) {
					try {
						const fileHandle = await soundLibraryDir.getFileHandle(`${file.id}.audio`, {
							create: true
						});
						const writable = await fileHandle.createWritable();
						await writable.write(file.file);
						await writable.close();
					} catch (error) {
						console.error(`Failed to save file ${file.id}:`, error);
					}
				}
			}

			// Save metadata to OPFS as well
			const metadataHandle = await soundLibraryDir.getFileHandle('metadata.json', { create: true });
			const metadataWritable = await metadataHandle.createWritable();
			const metadata = {
				files: files.map((f) => ({
					...f,
					file: null, // Don't duplicate file in metadata
					url: null // URLs will be recreated
				})),
				folders
			};
			await metadataWritable.write(JSON.stringify(metadata));
			await metadataWritable.close();

			// Also save to localStorage as fallback
			saveToLocalStorageOnly();
		} catch (error) {
			console.error('Failed to save to OPFS:', error);
			// Fallback to localStorage
			saveToLocalStorageOnly();
		}
	}

	function saveToLocalStorageOnly() {
		try {
			localStorage.setItem(
				'soundLibrary_files',
				JSON.stringify(
					files.map((f) => ({
						...f,
						file: null, // Don't store File objects
						url: null // Don't store URLs
					}))
				)
			);
			localStorage.setItem('soundLibrary_folders', JSON.stringify(folders));
		} catch (error) {
			console.error('Failed to save to localStorage:', error);
		}
	}

	async function loadFromStorage() {
		try {
			// Check if OPFS is supported
			if (!navigator.storage?.getDirectory) {
				console.warn('OPFS not supported, loading from localStorage only');
				loadFromLocalStorageOnly();
				return;
			}

			const opfsRoot = await navigator.storage.getDirectory();

			try {
				const soundLibraryDir = await opfsRoot.getDirectoryHandle('soundLibrary');

				// Load metadata
				const metadataHandle = await soundLibraryDir.getFileHandle('metadata.json');
				const metadataFile = await metadataHandle.getFile();
				const metadataText = await metadataFile.text();
				const metadata = JSON.parse(metadataText);

				if (metadata.folders) {
					folders = metadata.folders;
				}

				// Load files with actual File objects
				const restoredFiles: AudioFile[] = [];

				for (const fileMetadata of metadata.files || []) {
					try {
						const fileHandle = await soundLibraryDir.getFileHandle(`${fileMetadata.id}.audio`);
						const file = await fileHandle.getFile();

						const audioFile: AudioFile = {
							...fileMetadata,
							file,
							url: URL.createObjectURL(file)
						};

						// Re-extract duration from the restored audio file
						const audio = new Audio(audioFile.url);
						audio.addEventListener('loadedmetadata', () => {
							audioFile.metadata.duration = audio.duration;
							files = [...files]; // Trigger reactivity
						});

						restoredFiles.push(audioFile);
					} catch (fileError) {
						console.warn(`Failed to restore file ${fileMetadata.id}:`, fileError);
						// Keep the metadata even if file is missing
						restoredFiles.push({
							...fileMetadata,
							file: null,
							url: ''
						});
					}
				}

				files = restoredFiles;
			} catch (_dirError) {
				console.warn('No soundLibrary directory found in OPFS, loading from localStorage');
				loadFromLocalStorageOnly();
			}
		} catch (error) {
			console.error('Failed to load from OPFS:', error);
			// Fallback to localStorage
			loadFromLocalStorageOnly();
		}
	}

	function loadFromLocalStorageOnly() {
		try {
			const savedFiles = localStorage.getItem('soundLibrary_files');
			const savedFolders = localStorage.getItem('soundLibrary_folders');

			if (savedFolders) {
				folders = JSON.parse(savedFolders);
			}

			if (savedFiles) {
				const fileMetadata = JSON.parse(savedFiles);
				// Can't restore actual File objects from localStorage, only metadata
				files = fileMetadata.map((f: any) => ({
					...f,
					file: null,
					url: ''
				}));
			}
		} catch (error) {
			console.error('Failed to load from localStorage:', error);
		}
	}

	// Storage
	function formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.floor(seconds % 60);
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	onMount(() => {
		loadFromStorage().then(() => {
			// Load files into global playlist store after they are loaded
			globalPlaylistStore.loadPlaybackState(files);
		});

		// Listen for playlist drop requests
		const handlePlaylistDropRequest = (event: Event) => {
			const customEvent = event as CustomEvent;
			const { fileId } = customEvent.detail;
			const file = files.find((f) => f.id === fileId);
			if (file) {
				globalPlaylistStore.addToPlaylist([file]);
			}
		};

		window.addEventListener('playlist-drop-request', handlePlaylistDropRequest);

		return () => {
			// Clean up playlist store subscription
			if (unsubscribePlaylist) {
				unsubscribePlaylist();
			}

			// Clean up object URLs
			files.forEach((file) => {
				if (file.url) {
					URL.revokeObjectURL(file.url);
				}
			});

			// Clean up event listener
			window.removeEventListener('playlist-drop-request', handlePlaylistDropRequest);
		};
	});

	// Old playback state effects removed - now handled by global store

	// External drag and drop handlers
	function handleExternalDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		// Only handle external files, not internal drag operations
		if (!draggedFile && !draggedFolder && event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
			dragOverExternal = true;
		}
	}

	function handleExternalDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		// Only clear external drag if we're leaving the main container
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const isInside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;

		if (!isInside) {
			dragOverExternal = false;
		}
	}

	async function handleExternalDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();

		dragOverExternal = false;

		// Only handle external files, not internal drag operations
		if (!draggedFile && !draggedFolder && event.dataTransfer?.files) {
			const droppedFiles = event.dataTransfer.files;
			if (droppedFiles.length > 0) {
				await processFiles(droppedFiles);
			}
		}
	}
</script>

<div
	class="relative mx-auto max-w-7xl space-y-6"
	class:bg-blue-50={dragOverExternal}
	class:border-2={dragOverExternal}
	class:border-dashed={dragOverExternal}
	class:border-blue-400={dragOverExternal}
	ondragover={handleExternalDragOver}
	ondragleave={handleExternalDragLeave}
	ondrop={handleExternalDrop}
	role="application"
	aria-label="Sound Library with file drop zone"
>
	<!-- External file drop overlay -->
	{#if dragOverExternal}
		<div
			class="bg-opacity-90 absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-blue-50"
		>
			<div class="text-center">
				<svg
					class="mx-auto mb-4 h-16 w-16 text-blue-500"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
					></path>
				</svg>
				<h3 class="mb-2 text-xl font-semibold text-blue-700">
					<T>Drop audio files here</T>
				</h3>
				<p class="text-blue-600">
					<T>Release to add files to your sound library</T>
				</p>
			</div>
		</div>
	{/if}

	<!-- Header with controls -->
	<div class="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
		<div class="flex items-center space-x-4">
			<h1 class="text-2xl font-bold text-gray-800">
				<T>Sound Library</T>
			</h1>

			<!-- Breadcrumb navigation -->
			<nav
				class="flex items-center space-x-2 text-sm"
				class:bg-green-100={dragOverFolderId === currentFolderId}
				class:rounded={dragOverFolderId === currentFolderId}
				class:px-2={dragOverFolderId === currentFolderId}
				class:py-1={dragOverFolderId === currentFolderId}
				ondragover={(e) => handleFolderDragOver(e, currentFolderId)}
				ondrop={(e) => handleFolderDrop(e, currentFolderId)}
				ondragleave={handleFolderDragLeave}
			>
				{#each breadcrumbs as folder, index (folder.id)}
					<button
						onclick={() => navigateToFolder(folder.id)}
						class="text-blue-600 hover:text-blue-800"
						class:font-semibold={index === breadcrumbs.length - 1}
					>
						{folder.name}
					</button>
					{#if index < breadcrumbs.length - 1}
						<span class="text-gray-400">/</span>
					{/if}
				{/each}
			</nav>
		</div>

		<div class="flex items-center space-x-2">
			<!-- Search -->
			<input
				type="text"
				placeholder="Search files..."
				bind:value={searchQuery}
				class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
			/>

			<!-- Playlist controls -->
			{#if filteredFiles.length > 0}
				<button
					onclick={playAllFiltered}
					class="rounded-lg bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
					title="Replace playlist and play all filtered files"
				>
					<T>Play All</T>
				</button>
				<button
					onclick={addAllFilteredToPlaylist}
					class="rounded-lg bg-purple-100 px-3 py-2 text-sm text-purple-700 hover:bg-purple-200"
					title="Add all filtered files to playlist"
				>
					<T>Add All</T>
				</button>
			{/if}

			<!-- Upload button -->
			<button
				onclick={() => (showUploadModal = true)}
				class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
			>
				<T>Upload</T>
			</button>

			<!-- New folder button -->
			<button
				onclick={() => (showNewFolderModal = true)}
				class="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
			>
				<T>New Folder</T>
			</button>
		</div>
	</div>

	<!-- Tag filters -->
	{#if allTags.length > 0}
		<div class="rounded-lg bg-gray-50 p-4">
			<div class="mb-2 flex items-center justify-between">
				<h3 class="text-sm font-medium text-gray-700"><T>Filter by tags:</T></h3>
				<div class="flex items-center space-x-2">
					<label class="flex items-center space-x-2 text-sm text-gray-600">
						<input
							type="checkbox"
							bind:checked={recursiveTagFilter}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span><T>Recursive filter</T></span>
					</label>
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each allTags as tag (tag)}
					<button
						onclick={() => toggleTagFilter(tag)}
						class="rounded-full px-3 py-1 text-sm transition-colors"
						class:bg-blue-600={selectedTags.includes(tag)}
						class:text-white={selectedTags.includes(tag)}
						class:bg-gray-200={!selectedTags.includes(tag)}
						class:text-gray-700={!selectedTags.includes(tag)}
						class:hover:bg-blue-700={selectedTags.includes(tag)}
						class:hover:bg-gray-300={!selectedTags.includes(tag)}
					>
						{tag}
					</button>
				{/each}
				{#if selectedTags.length > 0}
					<button
						onclick={() => (selectedTags = [])}
						class="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
					>
						<T>Clear filters</T>
					</button>
					{#if recursiveTagFilter}
						<span class="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
							<T>Recursive search</T>
						</span>
					{/if}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Main content area -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
		<!-- Sidebar with folders -->
		<div class="lg:col-span-1">
			<div class="rounded-lg bg-white p-4 shadow-sm">
				<h3 class="mb-3 font-medium text-gray-800"><T>Folders</T></h3>
				<div class="space-y-1">
					<!-- Parent directory navigation -->
					{#if currentFolderId !== 'root'}
						<div
							class="rounded"
							class:bg-green-50={dragOverFolderId === (currentFolder?.parentId || 'root')}
							role="button"
							tabindex="0"
							ondragover={(e) => handleFolderDragOver(e, currentFolder?.parentId || 'root')}
							ondrop={(e) => handleFolderDrop(e, currentFolder?.parentId || 'root')}
							ondragleave={handleFolderDragLeave}
						>
							<button
								onclick={() => navigateToFolder(currentFolder?.parentId || 'root')}
								class="flex w-full items-center space-x-2 rounded p-2 text-left hover:bg-gray-50"
							>
								<svg class="h-4 w-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M7.707 14.707a1 1 0 01-1.414 0L2.586 11H18a1 1 0 110 2H2.586l3.707 3.707a1 1 0 01-1.414 1.414l-5.414-5.414a1 1 0 010-1.414l5.414-5.414a1 1 0 011.414 1.414L2.586 9H18a1 1 0 110 2H7.707z"
									></path>
								</svg>
								<span class="text-sm text-gray-600">..</span>
							</button>
						</div>
					{/if}

					{#each folders.filter((f) => f.parentId === currentFolderId) as folder (folder.id)}
						<div
							class="group relative rounded"
							class:bg-blue-50={draggedFolder?.id === folder.id}
							class:bg-green-50={dragOverFolderId === folder.id}
							role="button"
							tabindex="0"
							draggable="true"
							ondragstart={(e) => handleFolderDragStart(e, folder)}
							ondragover={(e) => handleFolderDragOver(e, folder.id)}
							ondrop={(e) => handleFolderDrop(e, folder.id)}
							ondragleave={handleFolderDragLeave}
							ondragend={handleDragEnd}
						>
							<button
								onclick={() => navigateToFolder(folder.id)}
								class="flex w-full items-center space-x-2 rounded p-2 pr-16 text-left hover:bg-gray-50"
							>
								<svg class="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
									<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
									></path>
								</svg>
								<span class="text-sm">{folder.name}</span>
							</button>

							<!-- Folder actions menu -->
							<div
								class="absolute top-1/2 right-2 flex -translate-y-1/2 items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<!-- Rename button -->
								<button
									onclick={() => {
										selectedFolderForRename = folder;
										renameFolderName = folder.name;
										showRenameFolderModal = true;
									}}
									class="p-1 text-gray-400 hover:text-blue-600"
									title="Rename folder"
									aria-label="Rename folder"
								>
									<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										></path>
									</svg>
								</button>

								<!-- Delete button -->
								<button
									onclick={async () => {
										if (
											confirm(
												`Are you sure you want to delete the folder "${folder.name}"? All files inside will be moved to the root folder.`
											)
										) {
											await deleteFolder(folder.id);
										}
									}}
									class="p-1 text-gray-400 hover:text-red-600"
									title="Delete folder"
									aria-label="Delete folder"
								>
									<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
					{/each}
				</div>
			</div>
		</div>

		<!-- File list -->
		<div class="lg:col-span-3">
			<div class="rounded-lg bg-white shadow-sm">
				{#if filteredFiles.length === 0}
					<div class="p-8 text-center text-gray-500">
						{#if files.length === 0}
							<p><T>No audio files uploaded yet.</T></p>
							<p class="mt-2 text-sm"><T>Click Upload to add your first audio file.</T></p>
						{:else if selectedTags.length > 0 || searchQuery}
							<p><T>No files match the current filters.</T></p>
						{:else}
							<p><T>No files in this folder.</T></p>
						{/if}
					</div>
				{:else}
					<div class="divide-y divide-gray-200">
						{#each filteredFiles as file (file.id)}
							<div
								class="flex items-center space-x-4 p-4 hover:bg-gray-50"
								role="listitem"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, file)}
								ondragend={handleDragEnd}
								class:bg-blue-50={playlistState?.currentFileId === file.id}
							>
								<!-- Play controls -->
								<div class="flex items-center space-x-2">
									<!-- Main play/pause button -->
									<button
										onclick={() => {
											if (playlistState?.currentFileId === file.id) {
												globalPlaylistStore.togglePlayPause();
											} else {
												playFile(file);
											}
										}}
										class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
										title="Play now (replaces playlist)"
									>
										{#if playlistState?.currentFileId === file.id && playlistState?.isPlaying}
											<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
												<path
													d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zM11 8a1 1 0 012 0v4a1 1 0 11-2 0V8z"
												></path>
											</svg>
										{:else}
											<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
												<path
													d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
												></path>
											</svg>
										{/if}
									</button>

									<!-- Add to playlist button -->
									<button
										onclick={() => globalPlaylistStore.addToPlaylist([file])}
										class="flex h-8 w-8 items-center justify-center rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
										title="Add to playlist"
										aria-label="Add to playlist"
										class:bg-purple-200={playlistState?.currentPlaylist.some(
											(p: AudioFile) => p.id === file.id
										)}
									>
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 6v6m0 0v6m0-6h6m-6 0H6"
											></path>
										</svg>
									</button>
								</div>

								<!-- File info -->
								<div class="flex-1">
									<h4 class="font-medium text-gray-900">{file.name}</h4>
									<div class="flex items-center space-x-2 text-sm text-gray-500">
										<span>{formatDuration(file.metadata.duration)}</span>
										<span>•</span>
										<span>{formatFileSize(file.metadata.size)}</span>
									</div>

									<!-- Tags -->
									<div class="mt-1 flex flex-wrap gap-1">
										{#each file.tags as tag (tag)}
											<span class="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
												{tag}
												<button
													onclick={async () => await removeTag(file.id, tag)}
													class="ml-1 text-gray-500 hover:text-red-600"
												>
													×
												</button>
											</span>
										{/each}

										<!-- Add tag input -->
										{#if editingTags === file.id}
											<div class="flex items-center space-x-1">
												<input
													type="text"
													bind:value={newTagInput}
													placeholder="Tag name"
													class="w-20 rounded border border-gray-300 px-2 py-0.5 text-xs"
													onkeydown={async (e) => {
														if (e.key === 'Enter') {
															await addTag(file.id, newTagInput);
															newTagInput = '';
															editingTags = null;
														} else if (e.key === 'Escape') {
															editingTags = null;
															newTagInput = '';
														}
													}}
												/>
												<button
													onclick={async () => {
														await addTag(file.id, newTagInput);
														newTagInput = '';
														editingTags = null;
													}}
													class="text-xs text-blue-600 hover:text-blue-800"
												>
													<T>Add</T>
												</button>
											</div>
										{:else}
											<button
												onclick={() => (editingTags = file.id)}
												class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-200"
											>
												+ <T>Tag</T>
											</button>
										{/if}
									</div>
								</div>

								<!-- Actions -->
								<div class="flex items-center space-x-2">
									<button
										onclick={() => {
											selectedFileForMetadata = file;
											showMetadataModal = true;
										}}
										class="text-gray-400 hover:text-gray-600"
										title="Show metadata"
										aria-label="Show metadata"
									>
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											></path>
										</svg>
									</button>
									<button
										onclick={async () => await deleteFile(file.id)}
										class="text-gray-400 hover:text-red-600"
										title="Delete file"
										aria-label="Delete file"
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
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Playlist panel is now handled by the global GlobalPlaylist component -->
</div>

<!-- Upload Modal -->
{#if showUploadModal}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="mx-4 w-full max-w-md rounded-lg bg-white p-6">
			<h3 class="mb-4 text-lg font-medium"><T>Upload Audio Files</T></h3>

			<div class="mb-4">
				<input
					type="file"
					multiple
					accept="audio/*"
					onchange={handleFileUpload}
					class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
				/>
			</div>

			<div class="flex justify-end space-x-2">
				<button
					onclick={() => (showUploadModal = false)}
					class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
				>
					<T>Cancel</T>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- New Folder Modal -->
{#if showNewFolderModal}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="mx-4 w-full max-w-md rounded-lg bg-white p-6">
			<h3 class="mb-4 text-lg font-medium"><T>Create New Folder</T></h3>

			<div class="mb-4">
				<input
					type="text"
					bind:value={newFolderName}
					placeholder="Folder name"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
					onkeydown={async (e) => {
						if (e.key === 'Enter') {
							await createFolder();
						} else if (e.key === 'Escape') {
							showNewFolderModal = false;
							newFolderName = '';
						}
					}}
				/>
			</div>

			<div class="flex justify-end space-x-2">
				<button
					onclick={() => {
						showNewFolderModal = false;
						newFolderName = '';
					}}
					class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
				>
					<T>Cancel</T>
				</button>
				<button
					onclick={async () => await createFolder()}
					class="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
					disabled={!newFolderName.trim()}
				>
					<T>Create</T>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Metadata Modal -->
{#if showMetadataModal && selectedFileForMetadata}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="mx-4 w-full max-w-lg rounded-lg bg-white p-6">
			<h3 class="mb-4 text-lg font-medium"><T>File Metadata</T></h3>

			<div class="space-y-3">
				<div>
					<label class="text-sm font-medium text-gray-700"><T>Name:</T></label>
					<p class="text-gray-900">{selectedFileForMetadata.name}</p>
				</div>
				<div>
					<label class="text-sm font-medium text-gray-700"><T>Duration:</T></label>
					<p class="text-gray-900">{formatDuration(selectedFileForMetadata.metadata.duration)}</p>
				</div>
				<div>
					<label class="text-sm font-medium text-gray-700"><T>Size:</T></label>
					<p class="text-gray-900">{formatFileSize(selectedFileForMetadata.metadata.size)}</p>
				</div>
				<div>
					<label class="text-sm font-medium text-gray-700"><T>Type:</T></label>
					<p class="text-gray-900">{selectedFileForMetadata.metadata.type}</p>
				</div>
				<div>
					<label class="text-sm font-medium text-gray-700"><T>Last Modified:</T></label>
					<p class="text-gray-900">
						{new Date(selectedFileForMetadata.metadata.lastModified).toLocaleString()}
					</p>
				</div>
				<div>
					<label class="text-sm font-medium text-gray-700"><T>Tags:</T></label>
					<p class="text-gray-900">
						{selectedFileForMetadata.tags.length > 0
							? selectedFileForMetadata.tags.join(', ')
							: 'No tags'}
					</p>
				</div>
			</div>

			<div class="mt-6 flex justify-end">
				<button
					onclick={() => {
						showMetadataModal = false;
						selectedFileForMetadata = null;
					}}
					class="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
				>
					<T>Close</T>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Rename Folder Modal -->
{#if showRenameFolderModal && selectedFolderForRename}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="mx-4 w-full max-w-md rounded-lg bg-white p-6">
			<h3 class="mb-4 text-lg font-medium"><T>Rename Folder</T></h3>

			<div class="mb-4">
				<input
					type="text"
					bind:value={renameFolderName}
					placeholder="Folder name"
					class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
					onkeydown={async (e) => {
						if (e.key === 'Enter') {
							await renameFolder();
						} else if (e.key === 'Escape') {
							showRenameFolderModal = false;
							selectedFolderForRename = null;
							renameFolderName = '';
						}
					}}
				/>
			</div>

			<div class="flex justify-end space-x-2">
				<button
					onclick={() => {
						showRenameFolderModal = false;
						selectedFolderForRename = null;
						renameFolderName = '';
					}}
					class="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
				>
					<T>Cancel</T>
				</button>
				<button
					onclick={async () => await renameFolder()}
					class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
					disabled={!renameFolderName.trim()}
				>
					<T>Rename</T>
				</button>
			</div>
		</div>
	</div>
{/if}
