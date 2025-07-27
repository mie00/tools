// SharedWorker for managing global playlist state across tabs
export interface AudioFile {
	id: string;
	name: string;
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
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	repeatMode: 'none' | 'one' | 'all';
	currentPlaylist: AudioFile[];
	currentIndex: number;
	showPlaylistPanel: boolean;
	playlistCollapsed: boolean;
}

interface TabInfo {
	id: string;
	port: MessagePort;
	canPlayAudio: boolean;
	registrationTime: number;
}

interface WorkerMessage {
	type: string;
	tabId: string;
	data?: any;
}

class PlaylistWorkerManager {
	private state: PlaybackState = {
		currentFileId: null,
		isPlaying: false,
		currentTime: 0,
		duration: 0,
		volume: 1,
		repeatMode: 'none',
		currentPlaylist: [],
		currentIndex: -1,
		showPlaylistPanel: true,
		playlistCollapsed: false
	};

	private tabs = new Map<string, TabInfo>();
	private activeAudioTabId: string | null = null;
	private saveStateTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		this.loadState();
	}

	private async loadState() {
		// Request state from the first tab that connects
		// The tab will send back the saved state via LOAD_STATE_RESPONSE
	}

	private async saveState() {
		// Create a serializable version of the state for localStorage
		const stateToSave = {
			...this.state,
			// Convert AudioFile objects to serializable format (without File objects)
			currentPlaylist: this.state.currentPlaylist.map((file) => ({
				id: file.id,
				name: file.name,
				tags: file.tags,
				folderId: file.folderId,
				metadata: file.metadata
				// Note: file and url properties are omitted as they can't be serialized
			})),
			// Don't save UI state across sessions
			showPlaylistPanel: true,
			playlistCollapsed: false,
			// Pause playback but preserve position for resume on refresh
			isPlaying: false
			// Keep currentTime so playback can resume from the same position
		};

		this.broadcastToTabs({
			type: 'SAVE_STATE_REQUEST',
			data: { state: stateToSave }
		});
	}

	private debouncedSaveState() {
		// Debounce state saving to avoid excessive localStorage writes during playback
		if (this.saveStateTimeout) {
			clearTimeout(this.saveStateTimeout);
		}
		this.saveStateTimeout = setTimeout(() => {
			this.saveState();
		}, 2000); // Save after 2 seconds of inactivity
	}

	private broadcastToTabs(message: any, excludeTabId?: string) {
		this.tabs.forEach((tab, tabId) => {
			if (tabId !== excludeTabId) {
				try {
					tab.port.postMessage(message);
				} catch (error) {
					console.warn(`Failed to send message to tab ${tabId}:`, error);
					this.tabs.delete(tabId);
				}
			}
		});
	}

	private selectActiveAudioTab(): string | null {
		// If there's already an active tab, keep it unless it's been closed
		if (this.activeAudioTabId && this.tabs.has(this.activeAudioTabId)) {
			return this.activeAudioTabId;
		}

		// Otherwise, select the most recently registered tab with audio capability
		const audioCapableTabs = Array.from(this.tabs.values()).filter((tab) => tab.canPlayAudio);

		if (audioCapableTabs.length > 0) {
			// Sort by registration time (newest first)
			audioCapableTabs.sort((a, b) => b.registrationTime - a.registrationTime);
			return audioCapableTabs[0].id;
		}

		// Fallback to any available tab
		const allTabs = Array.from(this.tabs.values());
		if (allTabs.length > 0) {
			allTabs.sort((a, b) => b.registrationTime - a.registrationTime);
			return allTabs[0].id;
		}

		return null;
	}

	private updateActiveAudioTab() {
		const newActiveTab = this.selectActiveAudioTab();

		if (this.activeAudioTabId !== newActiveTab) {
			// Notify old tab to stop audio
			if (this.activeAudioTabId && this.tabs.has(this.activeAudioTabId)) {
				this.tabs.get(this.activeAudioTabId)!.port.postMessage({
					type: 'STOP_AUDIO'
				});
			}

			this.activeAudioTabId = newActiveTab;

			// Notify new tab to take over audio
			if (this.activeAudioTabId && this.tabs.has(this.activeAudioTabId)) {
				this.tabs.get(this.activeAudioTabId)!.port.postMessage({
					type: 'START_AUDIO',
					data: { state: this.state }
				});
			}

			// Broadcast state update to all tabs
			this.broadcastToTabs({
				type: 'STATE_UPDATE',
				data: {
					state: this.state,
					activeAudioTabId: this.activeAudioTabId
				}
			});
		}
	}

	handleMessage(message: WorkerMessage, port: MessagePort) {
		const { type, tabId, data } = message;

		switch (type) {
			case 'REGISTER_TAB':
				this.tabs.set(tabId, {
					id: tabId,
					port,
					canPlayAudio: data.canPlayAudio || false,
					registrationTime: Date.now()
				});

				// Request saved state from this tab if we don't have any playlist data
				if (this.state.currentPlaylist.length === 0) {
					port.postMessage({
						type: 'LOAD_STATE_REQUEST'
					});
				} else {
					// Send current state to new tab
					port.postMessage({
						type: 'STATE_UPDATE',
						data: {
							state: this.state,
							activeAudioTabId: this.activeAudioTabId
						}
					});
				}

				this.updateActiveAudioTab();
				break;

			case 'TAB_CAN_PLAY_AUDIO':
				if (this.tabs.has(tabId)) {
					this.tabs.get(tabId)!.canPlayAudio = data.canPlayAudio;
					this.updateActiveAudioTab();
				}
				break;

			case 'SAVE_CURRENT_STATE':
				// Force save the current state immediately
				this.saveState();
				break;

			case 'UNREGISTER_TAB':
				this.tabs.delete(tabId);
				if (this.activeAudioTabId === tabId) {
					this.activeAudioTabId = null;
					this.updateActiveAudioTab();
				}
				break;

			case 'LOAD_STATE_RESPONSE':
				if (data.state && this.state.currentPlaylist.length === 0) {
					// Only load state if we don't have any current data
					this.state = { ...this.state, ...data.state };

					// Broadcast the loaded state to all tabs
					this.broadcastToTabs({
						type: 'STATE_UPDATE',
						data: {
							state: this.state,
							activeAudioTabId: this.activeAudioTabId
						}
					});
				}
				break;

			case 'FILES_AVAILABLE':
				// Restore playlist with serializable file objects when files become available
				if (this.state.currentPlaylist.length > 0 && data.files) {
					const fileMap = new Map(data.files.map((f: any) => [f.id, f]));
					const restoredPlaylist = this.state.currentPlaylist
						.map((playlistItem) => fileMap.get(playlistItem.id))
						.filter(Boolean);

					if (restoredPlaylist.length > 0) {
						this.state.currentPlaylist = restoredPlaylist as AudioFile[];
						// Update current index to match the restored playlist
						this.state.currentIndex = this.state.currentPlaylist.findIndex(
							(f) => f.id === this.state.currentFileId
						);

						// Broadcast updated state
						this.broadcastToTabs({
							type: 'STATE_UPDATE',
							data: {
								state: this.state,
								activeAudioTabId: this.activeAudioTabId
							}
						});
					}
				}
				break;

			// Playlist management
			case 'REPLACE_PLAYLIST':
				this.state.currentPlaylist = data.files;
				this.state.currentIndex = data.startIndex;
				if (data.files.length > 0 && data.startIndex < data.files.length) {
					this.state.currentFileId = data.files[data.startIndex].id;
					this.state.currentTime = 0; // Start new file from beginning
				}
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'ADD_TO_PLAYLIST':
				const existingIds = new Set(this.state.currentPlaylist.map((f) => f.id));
				const uniqueNewFiles = data.files.filter((f: AudioFile) => !existingIds.has(f.id));
				this.state.currentPlaylist = [...this.state.currentPlaylist, ...uniqueNewFiles];
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'REMOVE_FROM_PLAYLIST':
				const fileIndex = this.state.currentPlaylist.findIndex((f) => f.id === data.fileId);
				if (fileIndex !== -1) {
					this.state.currentPlaylist = this.state.currentPlaylist.filter(
						(f) => f.id !== data.fileId
					);

					// Handle current file removal
					if (this.state.currentFileId === data.fileId) {
						if (this.state.currentPlaylist.length > 0) {
							const newIndex = Math.min(fileIndex, this.state.currentPlaylist.length - 1);
							this.state.currentFileId = this.state.currentPlaylist[newIndex].id;
							this.state.currentIndex = newIndex;
						} else {
							this.state.currentFileId = null;
							this.state.currentIndex = -1;
							this.state.isPlaying = false;
						}
					}

					// Update current index
					this.state.currentIndex = this.state.currentPlaylist.findIndex(
						(f) => f.id === this.state.currentFileId
					);
				}
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'CLEAR_PLAYLIST':
				this.state.currentPlaylist = [];
				this.state.currentFileId = null;
				this.state.currentIndex = -1;
				this.state.isPlaying = false;
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			// Playback controls
			case 'PLAY_FILE':
				this.state.currentPlaylist = [data.file];
				this.state.currentFileId = data.file.id;
				this.state.currentIndex = 0;
				this.state.currentTime = 0; // Start new file from beginning
				this.state.isPlaying = true;
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'TOGGLE_PLAY_PAUSE':
				this.state.isPlaying = !this.state.isPlaying;
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'PLAY_NEXT':
				if (this.state.currentIndex < this.state.currentPlaylist.length - 1) {
					this.state.currentIndex++;
					this.state.currentFileId = this.state.currentPlaylist[this.state.currentIndex].id;
					this.state.currentTime = 0; // Start new file from beginning
				} else if (this.state.repeatMode === 'all' && this.state.currentPlaylist.length > 0) {
					this.state.currentIndex = 0;
					this.state.currentFileId = this.state.currentPlaylist[0].id;
					this.state.currentTime = 0; // Start new file from beginning
				}
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'PLAY_PREVIOUS':
				if (this.state.currentIndex > 0) {
					this.state.currentIndex--;
					this.state.currentFileId = this.state.currentPlaylist[this.state.currentIndex].id;
					this.state.currentTime = 0; // Start new file from beginning
				} else if (this.state.repeatMode === 'all' && this.state.currentPlaylist.length > 0) {
					this.state.currentIndex = this.state.currentPlaylist.length - 1;
					this.state.currentFileId = this.state.currentPlaylist[this.state.currentIndex].id;
					this.state.currentTime = 0; // Start new file from beginning
				}
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'SEEK_TO':
				this.state.currentTime = data.time;
				// Always broadcast to all tabs (including the sender) to ensure active audio tab gets the message
				this.broadcastToTabs({
					type: 'SEEK_TO',
					data: { time: data.time }
				});
				break;

			case 'CHANGE_VOLUME':
				this.state.volume = data.volume;
				this.saveState();
				// Send immediate volume update for responsive feedback
				this.broadcastToTabs({
					type: 'VOLUME_UPDATE',
					data: { volume: data.volume }
				});
				// Also send full state update
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'CYCLE_REPEAT_MODE':
				switch (this.state.repeatMode) {
					case 'none':
						this.state.repeatMode = 'one';
						break;
					case 'one':
						this.state.repeatMode = 'all';
						break;
					case 'all':
						this.state.repeatMode = 'none';
						break;
				}
				this.saveState();
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			// UI state
			case 'TOGGLE_PLAYLIST_PANEL':
				this.state.showPlaylistPanel = !this.state.showPlaylistPanel;
				this.broadcastToTabs({
					type: 'STATE_UPDATE',
					data: {
						state: this.state,
						activeAudioTabId: this.activeAudioTabId
					}
				});
				break;

			case 'SET_PLAYLIST_COLLAPSED':
				this.state.playlistCollapsed = data.collapsed;
				this.broadcastToTabs({
					type: 'SET_PLAYLIST_COLLAPSED',
					data: { collapsed: data.collapsed }
				});
				break;

			// State updates from active audio tab
			case 'UPDATE_TIME':
				this.state.currentTime = data.currentTime;
				// Debounced save to preserve position without excessive localStorage writes
				this.debouncedSaveState();
				// Broadcast time update to ALL tabs including the sender for UI consistency
				this.broadcastToTabs({
					type: 'TIME_UPDATE',
					data: { currentTime: data.currentTime }
				});
				break;

			case 'UPDATE_DURATION':
				this.state.duration = data.duration;
				// Broadcast duration update to ALL tabs including the sender for UI consistency
				this.broadcastToTabs({
					type: 'DURATION_UPDATE',
					data: { duration: data.duration }
				});
				break;

			case 'AUDIO_ENDED':
				if (this.state.repeatMode === 'one') {
					// Repeat current song
					this.broadcastToTabs({
						type: 'REPEAT_CURRENT'
					});
				} else if (
					this.state.repeatMode === 'all' ||
					this.state.currentIndex < this.state.currentPlaylist.length - 1
				) {
					// Play next song
					this.handleMessage({ type: 'PLAY_NEXT', tabId, data: {} }, port);
				} else {
					// Stop playing
					this.state.isPlaying = false;
					this.state.currentTime = 0;
					this.broadcastToTabs({
						type: 'STATE_UPDATE',
						data: {
							state: this.state,
							activeAudioTabId: this.activeAudioTabId
						}
					});
				}
				break;
		}
	}
}

// SharedWorker global scope types
interface SharedWorkerGlobalScope {
	addEventListener(type: 'connect', listener: (event: MessageEvent) => void): void;
}

declare const self: SharedWorkerGlobalScope;

const manager = new PlaylistWorkerManager();

self.addEventListener('connect', (event: MessageEvent) => {
	const port = event.ports[0];

	port.addEventListener('message', (messageEvent: MessageEvent) => {
		manager.handleMessage(messageEvent.data, port);
	});

	port.start();
});
