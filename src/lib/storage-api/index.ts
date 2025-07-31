// Main storage API exports

// Core types and utilities
export type {
	StorageAdapter,
	EntityStorage,
	EntityStorageOptions,
	StorageFilter,
	StorageListOptions,
	EntityWithId,
	StorageMetadata,
	EntityIdStrategy,
	EntityConfig
} from './types';

export { EntityIdGenerator } from './entity-id';
export { BaseEntityStorage } from './storage-client';

// Storage adapters
export { LocalStorageAdapter } from './adapters/localStorage';
export { OPFSAdapter } from './adapters/opfs';
export { IndexedDBAdapter } from './adapters/indexedDB';

// Import types and classes for internal use
import type { StorageAdapter } from './types';
import { LocalStorageAdapter } from './adapters/localStorage';
import { OPFSAdapter } from './adapters/opfs';
import { IndexedDBAdapter } from './adapters/indexedDB';
import { CalculatorHistoryStorage } from './entities/calculator-history';
import { UnitConversionHistoryStorage } from './entities/unit-conversion-history';
import { PrayerProfileStorage } from './entities/prayer-profiles';
import { AudioFileStorage } from './entities/audio-files';
import { AudioPlaylistStorage } from './entities/audio-playlists';
import { NoteStorage } from './entities/notes';
import { StockPortfolioStorage } from './entities/stock-portfolios';
import { TranslationCacheStorage } from './entities/translation-cache';
import { ChatSessionStorage } from './entities/chat-sessions';
import { SavedFunctionStorage } from './entities/saved-functions';
import { InputSuggestionStorage } from './entities/input-suggestions';
import { UISettingsStorage } from './entities/ui-settings';

// Entity storage classes
export {
	CalculatorHistoryStorage,
	type CalculatorHistoryItem
} from './entities/calculator-history';

export {
	UnitConversionHistoryStorage,
	type UnitConversionHistoryItem
} from './entities/unit-conversion-history';

export { PrayerProfileStorage, type PrayerProfile } from './entities/prayer-profiles';

export {
	AudioFileStorage,
	type AudioFileMetadata,
	type AudioFileData
} from './entities/audio-files';

export { AudioPlaylistStorage, type AudioPlaylist } from './entities/audio-playlists';

export { NoteStorage, type Note } from './entities/notes';

export {
	StockPortfolioStorage,
	type StockPortfolio,
	type StockPosition
} from './entities/stock-portfolios';

export {
	TranslationCacheStorage,
	type TranslationEntry,
	type LanguagePreference
} from './entities/translation-cache';

export { ChatSessionStorage, type ChatSession, type ChatMessage } from './entities/chat-sessions';

export { SavedFunctionStorage, type SavedFunction } from './entities/saved-functions';

export {
	InputSuggestionStorage,
	type InputSuggestion,
	type SuggestionPattern
} from './entities/input-suggestions';

export { UISettingsStorage, type UISettings } from './entities/ui-settings';

// Storage factory and initialization
export class StorageFactory {
	private static adapters = new Map<string, StorageAdapter>();

	static registerAdapter(name: string, adapter: StorageAdapter): void {
		this.adapters.set(name, adapter);
	}

	static getAdapter(name: string): StorageAdapter {
		const adapter = this.adapters.get(name);
		if (!adapter) {
			console.warn(`Storage adapter '${name}' not registered, falling back to localStorage`);
			return this.adapters.get('localStorage') || new LocalStorageAdapter();
		}
		return adapter;
	}

	static createCalculatorHistoryStorage(
		adapterName: string = 'localStorage'
	): CalculatorHistoryStorage {
		return new CalculatorHistoryStorage(this.getAdapter(adapterName));
	}

	static createUnitConversionHistoryStorage(
		adapterName: string = 'localStorage'
	): UnitConversionHistoryStorage {
		return new UnitConversionHistoryStorage(this.getAdapter(adapterName));
	}

	static createPrayerProfileStorage(adapterName: string = 'localStorage'): PrayerProfileStorage {
		return new PrayerProfileStorage(this.getAdapter(adapterName));
	}

	static async createAudioFileStorage(adapterName?: string): Promise<AudioFileStorage> {
		// Auto-detect best adapter for audio files
		if (!adapterName) {
			const opfsAdapter = this.adapters.get('opfs');
			if (opfsAdapter && opfsAdapter.isSupported) {
				try {
					const isSupported = await opfsAdapter.isSupported();
					if (isSupported) {
						adapterName = 'opfs';
					} else {
						adapterName = 'localStorage';
					}
				} catch {
					adapterName = 'localStorage';
				}
			} else {
				adapterName = 'localStorage';
			}
		}
		return new AudioFileStorage(this.getAdapter(adapterName));
	}

	static createAudioPlaylistStorage(adapterName: string = 'localStorage'): AudioPlaylistStorage {
		return new AudioPlaylistStorage(this.getAdapter(adapterName));
	}

	static async createNoteStorage(adapterName?: string): Promise<NoteStorage> {
		// Auto-detect best adapter for notes (OPFS for large notes)
		if (!adapterName) {
			const opfsAdapter = this.adapters.get('opfs');
			if (opfsAdapter && opfsAdapter.isSupported) {
				try {
					const isSupported = await opfsAdapter.isSupported();
					if (isSupported) {
						adapterName = 'opfs';
					} else {
						adapterName = 'indexedDB'; // IndexedDB is better than localStorage for large notes
					}
				} catch {
					adapterName = 'indexedDB';
				}
			} else {
				adapterName = 'indexedDB';
			}
		}
		return new NoteStorage(this.getAdapter(adapterName));
	}

	static createStockPortfolioStorage(adapterName: string = 'localStorage'): StockPortfolioStorage {
		return new StockPortfolioStorage(this.getAdapter(adapterName));
	}

	static createTranslationCacheStorage(
		adapterName: string = 'localStorage'
	): TranslationCacheStorage {
		return new TranslationCacheStorage(this.getAdapter(adapterName));
	}

	static async createChatSessionStorage(adapterName?: string): Promise<ChatSessionStorage> {
		// Auto-detect best adapter for chat sessions (OPFS for large conversations)
		if (!adapterName) {
			const opfsAdapter = this.adapters.get('opfs');
			if (opfsAdapter && opfsAdapter.isSupported) {
				try {
					const isSupported = await opfsAdapter.isSupported();
					if (isSupported) {
						adapterName = 'opfs';
					} else {
						adapterName = 'indexedDB'; // IndexedDB is better than localStorage for large chat data
					}
				} catch {
					adapterName = 'indexedDB';
				}
			} else {
				adapterName = 'indexedDB';
			}
		}
		return new ChatSessionStorage(this.getAdapter(adapterName));
	}

	static createSavedFunctionStorage(adapterName: string = 'localStorage'): SavedFunctionStorage {
		return new SavedFunctionStorage(this.getAdapter(adapterName));
	}

	static createInputSuggestionStorage(
		adapterName: string = 'localStorage'
	): InputSuggestionStorage {
		return new InputSuggestionStorage(this.getAdapter(adapterName));
	}

	static createUISettingsStorage(adapterName: string = 'localStorage'): UISettingsStorage {
		return new UISettingsStorage(this.getAdapter(adapterName));
	}

	// Initialize default adapters
	static initializeDefaults(): void {
		this.registerAdapter('localStorage', new LocalStorageAdapter());
		this.registerAdapter('opfs', new OPFSAdapter());
		this.registerAdapter('indexedDB', new IndexedDBAdapter());
	}
}

// Auto-initialize on import
if (typeof window !== 'undefined') {
	StorageFactory.initializeDefaults();
}
