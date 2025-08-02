import { writable } from 'svelte/store';
import { SoundLibraryStorage } from '../utils/storage';
import { StorageFactory } from '../../storage-api';

export interface AudioFile {
	id: string;
	name: string;
	file: File | null;
	url: string;
	tags: string[];
	folderId: string;
	metadata: {
		duration: number;
		size: number;
		type: string;
		lastModified: number;
	};
}

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

const initialState: PlaybackState = {
	currentFileId: null,
	currentAudio: null,
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	volume: 1,
	repeatMode: 'none',
	currentPlaylist: [],
	currentIndex: -1,
	showPlaylistPanel: false,
	playlistCollapsed: false,
	playbackStateLoaded: false,
	isActiveAudioTab: false
};

function createGlobalPlaylistStore() {
	const { subscribe, update, set } = writable<PlaybackState>(initialState);

	// SharedWorker connection
	let worker: SharedWorker | null = null;
	let port: MessagePort | null = null;
	let tabId: string = crypto.randomUUID();
	let files: AudioFile[] = [];
	let fileReloadTimeout: ReturnType<typeof setTimeout> | null = null;

	// Initialize storage
	const soundLibraryStorage = StorageFactory.createSoundLibrarySettingsStorage();

	// Standalone file loader that works even if SoundLibrary component isn't mounted
	async function loadSpecificFilesFromStorage(fileIds: string[]): Promise<AudioFile[]> {
		return await SoundLibraryStorage.loadSpecificFiles(fileIds);
	}

	// Initialize SharedWorker connection
	function initWorker() {
		try {
			worker = new SharedWorker(new URL('./playlistWorker.ts', import.meta.url), {
				type: 'module'
			});
			port = worker.port;

			port.addEventListener('message', handleWorkerMessage);
			port.start();

			// Register this tab with the worker
			sendToWorker('REGISTER_TAB', {
				canPlayAudio: true // Assume we can play audio until proven otherwise
			});

			// Set up tab lifecycle event listeners
			window.addEventListener('beforeunload', handleTabUnload);

			// Try to enable audio after user interaction
			document.addEventListener('click', tryEnableAudio, { once: true });
			document.addEventListener('keydown', tryEnableAudio, { once: true });
		} catch (error) {
			console.error('Failed to initialize SharedWorker:', error);
		}
	}

	function sendToWorker(type: string, data?: any) {
		if (port) {
			port.postMessage({ type, tabId, data });
		}
	}

	function handleWorkerMessage(event: MessageEvent) {
		const { type, data } = event.data;

		update((state) => {
			switch (type) {
				case 'STATE_UPDATE':
					const newState = {
						...state,
						...data.state,
						isActiveAudioTab: data.activeAudioTabId === tabId,
						playbackStateLoaded: true
					};

					// Reconstruct full AudioFile objects with File references if needed
					if (data.state.currentPlaylist && files.length > 0) {
						const fileMap = new Map(files.map((f) => [f.id, f]));
						newState.currentPlaylist = data.state.currentPlaylist.map((playlistItem: any) => {
							const fullFile = fileMap.get(playlistItem.id);
							if (fullFile) {
								return fullFile;
							} else {
								// Keep the serialized version if we don't have the full file yet
								console.warn(
									`File ${playlistItem.id} not found in loaded files, using serialized version`
								);
								return playlistItem;
							}
						}) as AudioFile[];
					} else if (data.state.currentPlaylist) {
						// If files aren't loaded yet, keep the serialized playlist
						newState.currentPlaylist = data.state.currentPlaylist;
					}

					// Handle audio management
					if (newState.isActiveAudioTab) {
						handleAudioForActiveTab(newState);
					} else {
						// Clean up audio if we're no longer the active tab
						if (state.currentAudio) {
							state.currentAudio.pause();
							cleanupAudio(state.currentAudio);
							newState.currentAudio = null;
						}
					}

					return newState;

				case 'START_AUDIO':
					const startState = {
						...state,
						...data.state,
						isActiveAudioTab: true,
						playbackStateLoaded: true
					};

					// Reconstruct full AudioFile objects with File references if needed
					if (data.state.currentPlaylist && files.length > 0) {
						const fileMap = new Map(files.map((f) => [f.id, f]));
						startState.currentPlaylist = data.state.currentPlaylist.map((playlistItem: any) => {
							const fullFile = fileMap.get(playlistItem.id);
							if (fullFile) {
								return fullFile;
							} else {
								// Keep the serialized version if we don't have the full file yet
								console.warn(
									`File ${playlistItem.id} not found in loaded files, using serialized version`
								);
								return playlistItem;
							}
						}) as AudioFile[];
					} else if (data.state.currentPlaylist) {
						// If files aren't loaded yet, keep the serialized playlist
						startState.currentPlaylist = data.state.currentPlaylist;
					}

					handleAudioForActiveTab(startState);
					return startState;

				case 'STOP_AUDIO':
					if (state.currentAudio) {
						state.currentAudio.pause();
						cleanupAudio(state.currentAudio);
					}
					return {
						...state,
						currentAudio: null,
						isActiveAudioTab: false
					};

				case 'SEEK_TO':
					if (state.currentAudio && state.isActiveAudioTab) {
						state.currentAudio.currentTime = data.time;
					}
					return { ...state, currentTime: data.time };

				case 'SET_PLAYLIST_COLLAPSED':
					return { ...state, playlistCollapsed: data.collapsed };

				case 'TIME_UPDATE':
					// Read current time from storage-api instead of using broadcast data
					try {
						soundLibraryStorage
							.getCurrentTime()
							.then((savedTime) => {
								const currentTime = savedTime !== undefined ? savedTime : data.currentTime;
								update((state) => ({ ...state, currentTime }));
							})
							.catch(() => {
								update((state) => ({ ...state, currentTime: data.currentTime }));
							});
						return { ...state, currentTime: data.currentTime };
					} catch (error) {
						return { ...state, currentTime: data.currentTime };
					}

				case 'DURATION_UPDATE':
					return { ...state, duration: data.duration };

				case 'REPEAT_CURRENT':
					if (state.currentAudio && state.isActiveAudioTab) {
						state.currentAudio.currentTime = 0;
						state.currentAudio.play();
					}
					return state;

				case 'LOAD_STATE_REQUEST':
					// Load state from storage-api and send it back to the worker
					try {
						soundLibraryStorage
							.getPlaybackState()
							.then(async (savedState) => {
								if (savedState) {
									const parsedState = savedState;
									// Load current time from separate storage entry
									const savedTime = await soundLibraryStorage.getCurrentTime();
									if (savedTime !== undefined) {
										parsedState.currentTime = savedTime;
									}
									// Note: File objects and URLs can't be restored from storage
									// The playlist will need to be rebuilt from the sound library when needed
									sendToWorker('LOAD_STATE_RESPONSE', { state: parsedState });
								} else {
									// Try to migrate from old localStorage format
									const oldSavedState = localStorage.getItem('soundLibrary_playbackState');
									if (oldSavedState) {
										const parsedState = JSON.parse(oldSavedState);
										const savedTime = localStorage.getItem('soundLibrary_currentTime');
										if (savedTime) {
											parsedState.currentTime = parseFloat(savedTime);
										}
										// Migrate to storage-api and remove from localStorage
										try {
											await soundLibraryStorage.setPlaybackState(parsedState);
											if (savedTime) {
												await soundLibraryStorage.setCurrentTime(parseFloat(savedTime));
											}
											localStorage.removeItem('soundLibrary_playbackState');
											localStorage.removeItem('soundLibrary_currentTime');
											console.log(
												'Successfully migrated sound library playback state to storage-api'
											);
										} catch (e) {
											console.warn('Failed to migrate playback state:', e);
										}
										sendToWorker('LOAD_STATE_RESPONSE', { state: parsedState });
									}
								}
							})
							.catch((error) => {
								console.warn('Failed to load saved state:', error);
							});
					} catch (error) {
						console.warn('Failed to load saved state:', error);
					}
					return state;

				case 'SAVE_STATE_REQUEST':
					// Save the provided state to storage-api
					try {
						soundLibraryStorage.setPlaybackState(data.state).catch((error) => {
							console.warn('Failed to save state:', error);
						});
					} catch (error) {
						console.warn('Failed to save state:', error);
					}
					return state;

				case 'VOLUME_UPDATE':
					if (state.currentAudio && state.isActiveAudioTab) {
						state.currentAudio.volume = data.volume;
					}
					return { ...state, volume: data.volume };

				case 'REQUEST_ACTIVE_TAB_ACK':
					return state;

				case 'RETRY_AUDIO':
					// Retry audio playback after files have been loaded
					if (state.isActiveAudioTab && data?.fileId === state.currentFileId) {
						// Force a new attempt to handle audio
						handleAudioForActiveTab(state);
					}
					return state;

				case 'UNLOAD_FILES':
					// Unload specific files to free memory
					const fileIdsToUnload = data.fileIds || [];
					if (fileIdsToUnload.length > 0) {
						SoundLibraryStorage.unloadFiles(files, fileIdsToUnload);

						// Log current loaded file count
						const loadedCount = files.filter((f) => f.file && f.url).length;
						console.log(`💾  Current loaded files in memory: ${loadedCount}/${files.length}`);
					}
					return state;

				case 'REQUEST_SPECIFIC_FILES':
					// Debounce specific file requests to prevent spam
					if (fileReloadTimeout) {
						clearTimeout(fileReloadTimeout);
					}

					fileReloadTimeout = setTimeout(async () => {
						const requestedFileIds = data.fileIds || [];
						if (requestedFileIds.length === 0) return;

						// Check which files we already have loaded
						const loadedFileIds = new Set(files.filter((f) => f.file && f.url).map((f) => f.id));
						const filesToLoad = requestedFileIds.filter((id: string) => !loadedFileIds.has(id));

						console.log(
							`📊  File loading stats: ${loadedFileIds.size} already loaded, ${filesToLoad.length} need loading`
						);

						if (filesToLoad.length > 0) {
							try {
								// Load specific files from storage
								const newlyLoadedFiles = await loadSpecificFilesFromStorage(filesToLoad);

								// Update our local files array with newly loaded files
								for (const newFile of newlyLoadedFiles) {
									const existingIndex = files.findIndex((f) => f.id === newFile.id);
									if (existingIndex >= 0) {
										files[existingIndex] = newFile; // Replace with loaded version
									} else {
										files.push(newFile); // Add new file
									}
								}

								// Log updated count
								const newLoadedCount = files.filter((f) => f.file && f.url).length;
								console.log(`💾  Updated loaded files count: ${newLoadedCount}/${files.length}`);
							} catch (error) {
								console.error('Failed to load specific files from storage:', error);
							}
						}

						// Dispatch event to request file data from sound library component (if mounted)
						const event = new CustomEvent('file-data-request', {
							detail: { fileIds: requestedFileIds }
						});
						window.dispatchEvent(event);

						// Send requested files to worker (including any we loaded or already had)
						const requestedFiles = files.filter((f) => requestedFileIds.includes(f.id));
						if (requestedFiles.length > 0) {
							const serializableFiles = requestedFiles.map((file) => ({
								id: file.id,
								name: file.name,
								url: file.url,
								tags: [...file.tags],
								folderId: file.folderId,
								metadata: { ...file.metadata }
							}));
							sendToWorker('FILES_AVAILABLE', { files: serializableFiles });
						}
					}, 100); // 100ms debounce

					return state;

				default:
					return state;
			}
		});
	}

	function handleAudioForActiveTab(state: PlaybackState) {
		if (!state.currentFileId || !state.isActiveAudioTab) return;

		const currentFile = state.currentPlaylist.find((f) => f.id === state.currentFileId);
		if (!currentFile) {
			console.error('Cannot play file: File not found in playlist');
			return;
		}

		// If we don't have a URL but have the file object, create one
		if (!currentFile.url && currentFile.file) {
			try {
				currentFile.url = URL.createObjectURL(currentFile.file);
			} catch (error) {
				console.error(`Failed to create blob URL for ${currentFile.name}:`, error);
				return;
			}
		}

		// If we still don't have a URL, request files to be loaded
		if (!currentFile.url) {
			console.error(
				`Cannot play file ${currentFile.name}: No valid file or URL found. Files may not be loaded yet.`
			);
			// Request files to be loaded with debouncing to prevent spam
			sendToWorker('REQUEST_FILE_RELOAD', { fileId: currentFile.id });
			return;
		}

		// Clean up old audio
		if (state.currentAudio) {
			cleanupAudio(state.currentAudio);
		}

		// Create new audio element with error handling for blob URLs
		const audio = new Audio();
		audio.volume = state.volume;

		// Add error handling for blob URL issues with retry limit
		let retryCount = 0;
		const maxRetries = 1;

		audio.addEventListener('error', (e) => {
			if (retryCount < maxRetries && currentFile.file) {
				retryCount++;
				try {
					URL.revokeObjectURL(currentFile.url);
					currentFile.url = URL.createObjectURL(currentFile.file);
					audio.src = currentFile.url;
					audio.load();
				} catch (recreateError) {
					console.error(`Failed to recreate blob URL for ${currentFile.name}:`, recreateError);
				}
			}
		});

		// Set the source after error handlers are in place
		audio.src = currentFile.url;

		// Set up current time restoration for resuming playback
		if (state.currentTime > 0) {
			// Set currentTime immediately if metadata is already loaded
			if (audio.readyState >= 1) {
				audio.currentTime = state.currentTime;
			} else {
				// Otherwise wait for metadata to load
				audio.addEventListener(
					'loadedmetadata',
					() => {
						audio.currentTime = state.currentTime;
					},
					{ once: true }
				);
			}
		}

		// Set up event listeners with debounced time updates
		let timeUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
		audio.addEventListener('timeupdate', () => {
			const currentTime = audio.currentTime;
			// Save current time to storage-api with immediate update (fire-and-forget)
			soundLibraryStorage
				.setCurrentTime(currentTime)
				.catch((e) => console.warn('Failed to save current time:', e));

			// Debounce worker notification to 10ms
			if (timeUpdateTimeout) {
				clearTimeout(timeUpdateTimeout);
			}
			timeUpdateTimeout = setTimeout(() => {
				sendToWorker('UPDATE_TIME', { currentTime });
			}, 10);
		});

		audio.addEventListener('loadedmetadata', () => {
			sendToWorker('UPDATE_DURATION', { duration: audio.duration });
		});

		audio.addEventListener('ended', () => {
			sendToWorker('AUDIO_ENDED');
		});

		state.currentAudio = audio;

		// Start playing if needed
		if (state.isPlaying) {
			audio.play().catch((error) => {
				console.warn('Failed to play audio:', error);
			});
		}
	}

	function cleanupAudio(audio: HTMLAudioElement) {
		// Note: We can't remove the specific event listeners since they're anonymous functions
		// But they will be garbage collected when the audio element is destroyed
		audio.pause();
	}

	function handleTabUnload() {
		// Save current state before unloading to preserve position across refresh
		sendToWorker('SAVE_CURRENT_STATE');
		sendToWorker('UNREGISTER_TAB');
	}

	function tryEnableAudio() {
		// Test if we can play audio by creating a silent audio element
		const testAudio = new Audio();
		testAudio.muted = true;
		testAudio.volume = 0;

		// Create a minimal audio blob to test playback
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		const buffer = audioContext.createBuffer(1, 1, 22050);
		const source = audioContext.createBufferSource();
		source.buffer = buffer;
		source.connect(audioContext.destination);

		Promise.all([
			testAudio.play().catch(() => false),
			audioContext
				.resume()
				.then(() => true)
				.catch(() => false)
		])
			.then(([audioPlayable, contextResumed]) => {
				if (audioPlayable || contextResumed) {
					sendToWorker('TAB_CAN_PLAY_AUDIO', { canPlayAudio: true });
				} else {
					// Mark as unable to play audio for now
					sendToWorker('TAB_CAN_PLAY_AUDIO', { canPlayAudio: false });
				}
			})
			.catch(() => {
				// If everything fails, assume we can't play audio
				sendToWorker('TAB_CAN_PLAY_AUDIO', { canPlayAudio: false });
			})
			.finally(() => {
				audioContext.close();
			});
	}

	// Initialize worker connection
	initWorker();

	return {
		subscribe,

		// Playlist management
		replacePlaylist: (newFiles: AudioFile[], startIndex: number = 0) => {
			// Convert File objects to serializable format for worker
			const serializableFiles = newFiles.map((file) => ({
				id: file.id,
				name: file.name,
				url: file.url,
				tags: [...file.tags],
				folderId: file.folderId,
				metadata: { ...file.metadata }
			}));
			sendToWorker('REPLACE_PLAYLIST', { files: serializableFiles, startIndex });
		},

		addToPlaylist: (newFiles: AudioFile[]) => {
			const serializableFiles = newFiles.map((file) => ({
				id: file.id,
				name: file.name,
				url: file.url,
				tags: [...file.tags],
				folderId: file.folderId,
				metadata: { ...file.metadata }
			}));
			sendToWorker('ADD_TO_PLAYLIST', { files: serializableFiles });
		},

		removeFromPlaylist: (fileId: string) => {
			sendToWorker('REMOVE_FROM_PLAYLIST', { fileId });
		},

		clearPlaylist: () => {
			sendToWorker('CLEAR_PLAYLIST');
		},

		// Playback controls
		playFile: (file: AudioFile) => {
			const serializableFile = {
				id: file.id,
				name: file.name,
				url: file.url,
				tags: [...file.tags],
				folderId: file.folderId,
				metadata: { ...file.metadata }
			};
			sendToWorker('PLAY_FILE', { file: serializableFile });
		},

		togglePlayPause: () => {
			sendToWorker('TOGGLE_PLAY_PAUSE');
		},

		playNext: () => {
			sendToWorker('PLAY_NEXT');
		},

		playPrevious: () => {
			sendToWorker('PLAY_PREVIOUS');
		},

		seekTo: (seekTime: number) => {
			// Send seek request to worker, which will coordinate with the active audio tab
			sendToWorker('SEEK_TO', { time: seekTime });
		},

		changeVolume: (volume: number) => {
			sendToWorker('CHANGE_VOLUME', { volume });
		},

		cycleRepeatMode: () => {
			sendToWorker('CYCLE_REPEAT_MODE');
		},

		// UI state
		togglePlaylistPanel: () => {
			sendToWorker('TOGGLE_PLAYLIST_PANEL');
		},

		setPlaylistCollapsed: (collapsed: boolean) => {
			sendToWorker('SET_PLAYLIST_COLLAPSED', { collapsed });
		},

		// State management
		loadPlaybackState: async (loadedFiles: AudioFile[]) => {
			// Store metadata for all files, but only send loaded files with data to worker
			files = loadedFiles;

			// Only send files that have actual file data to the worker
			const filesWithData = loadedFiles.filter((f) => f.file && f.url);
			if (filesWithData.length > 0) {
				const serializableFiles = filesWithData.map((file) => ({
					id: file.id,
					name: file.name,
					url: file.url,
					tags: [...file.tags],
					folderId: file.folderId,
					metadata: { ...file.metadata }
				}));
				sendToWorker('FILES_AVAILABLE', { files: serializableFiles });
			}
			update((state) => ({ ...state, playbackStateLoaded: true }));
		},

		// Request to become the active audio tab (for user interactions)
		requestActiveTab: () => {
			sendToWorker('REQUEST_ACTIVE_TAB');
		},

		// These are now handled internally by the worker communication
		updateTime: (currentTime: number) => {
			// This is handled by the audio timeupdate event
		},

		updateDuration: (duration: number) => {
			// This is handled by the audio loadedmetadata event
		}
	};
}

export const globalPlaylistStore = createGlobalPlaylistStore();
