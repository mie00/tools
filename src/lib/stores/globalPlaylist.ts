import { writable } from 'svelte/store';

export interface AudioFile {
	id: string;
	name: string;
	file: File;
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
						newState.currentPlaylist = data.state.currentPlaylist
							.map((playlistItem: any) => fileMap.get(playlistItem.id))
							.filter(Boolean) as AudioFile[];
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
						startState.currentPlaylist = data.state.currentPlaylist
							.map((playlistItem: any) => fileMap.get(playlistItem.id))
							.filter(Boolean) as AudioFile[];
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
					return { ...state, currentTime: data.currentTime };

				case 'DURATION_UPDATE':
					return { ...state, duration: data.duration };

				case 'REPEAT_CURRENT':
					if (state.currentAudio && state.isActiveAudioTab) {
						state.currentAudio.currentTime = 0;
						state.currentAudio.play();
					}
					return state;

				case 'LOAD_STATE_REQUEST':
					// Load state from localStorage and send it back to the worker
					try {
						const savedState = localStorage.getItem('soundLibrary_playbackState');
						if (savedState) {
							const parsedState = JSON.parse(savedState);
							// Note: File objects and URLs can't be restored from localStorage
							// The playlist will need to be rebuilt from the sound library when needed
							sendToWorker('LOAD_STATE_RESPONSE', { state: parsedState });
						}
					} catch (error) {
						console.warn('Failed to load saved state:', error);
					}
					return state;

				case 'SAVE_STATE_REQUEST':
					// Save the provided state to localStorage
					try {
						localStorage.setItem('soundLibrary_playbackState', JSON.stringify(data.state));
					} catch (error) {
						console.warn('Failed to save state:', error);
					}
					return state;

				case 'VOLUME_UPDATE':
					if (state.currentAudio && state.isActiveAudioTab) {
						state.currentAudio.volume = data.volume;
					}
					return { ...state, volume: data.volume };

				default:
					return state;
			}
		});
	}

	function handleAudioForActiveTab(state: PlaybackState) {
		if (!state.currentFileId || !state.isActiveAudioTab) return;

		const currentFile = state.currentPlaylist.find((f) => f.id === state.currentFileId);
		if (!currentFile) return;

		// Clean up old audio
		if (state.currentAudio) {
			cleanupAudio(state.currentAudio);
		}

		// Create new audio element
		const audio = new Audio(currentFile.url);
		audio.volume = state.volume;

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

		// Set up event listeners
		audio.addEventListener('timeupdate', () => {
			sendToWorker('UPDATE_TIME', { currentTime: audio.currentTime });
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
		audio.removeEventListener('timeupdate', () => {});
		audio.removeEventListener('loadedmetadata', () => {});
		audio.removeEventListener('ended', () => {});
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
			files = loadedFiles;
			// Send serializable file data to worker so it can restore playlist
			const serializableFiles = loadedFiles.map((file) => ({
				id: file.id,
				name: file.name,
				url: file.url,
				tags: [...file.tags],
				folderId: file.folderId,
				metadata: { ...file.metadata }
			}));
			sendToWorker('FILES_AVAILABLE', { files: serializableFiles });
			update((state) => ({ ...state, playbackStateLoaded: true }));
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
