import { StorageFactory } from '../storage-api';

export interface StorageInfo {
	used: number;
	quota: number;
	available: number;
}

export class StorageManager {
	private static instance: StorageManager;
	private noteTakingStorage: ReturnType<typeof StorageFactory.createNoteTakingSettingsStorage>;

	static getInstance(): StorageManager {
		if (!StorageManager.instance) {
			StorageManager.instance = new StorageManager();
		}
		return StorageManager.instance;
	}

	constructor() {
		this.noteTakingStorage = StorageFactory.createNoteTakingSettingsStorage();
	}

	async initializeStorage(): Promise<void> {
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

	async getStorageInfo(): Promise<StorageInfo> {
		try {
			if ('storage' in navigator && 'estimate' in navigator.storage) {
				const estimate = await navigator.storage.estimate();
				return {
					used: estimate.usage || 0,
					quota: estimate.quota || 0,
					available: (estimate.quota || 0) - (estimate.usage || 0)
				};
			}
		} catch (error) {
			console.warn('Storage estimate API not supported:', error);
		}

		return { used: 0, quota: 0, available: 0 };
	}

	formatBytes(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	async checkStorageQuota(additionalSize = 0): Promise<boolean> {
		const storageInfo = await this.getStorageInfo();
		const wouldExceed = storageInfo.used + additionalSize > storageInfo.quota * 0.9; // 90% threshold
		return !wouldExceed;
	}

	isStorageWarningNeeded(storageInfo: StorageInfo): boolean {
		if (storageInfo.quota === 0) return false;
		const usagePercentage = (storageInfo.used / storageInfo.quota) * 100;
		return usagePercentage > 80;
	}

	async saveToStorage<T>(key: string, data: T): Promise<void> {
		try {
			// Use the note taking storage based on key
			if (key === 'noteTakingNotes') {
				await this.noteTakingStorage.setNotes(data as any);
			} else if (key === 'noteTakingTopics') {
				await this.noteTakingStorage.setTopics(data as any);
			} else {
				// Fallback for unknown keys - use generic setting update
				await this.noteTakingStorage.updateSetting(key as any, data);
			}
		} catch (error: unknown) {
			const err = error as Error;
			console.error(`Error saving ${key}:`, error);

			// Fallback to localStorage for backward compatibility
			try {
				localStorage.setItem(key, JSON.stringify(data));
			} catch (localStorageError: unknown) {
				const lsErr = localStorageError as Error;
				if (lsErr.name === 'QuotaExceededError' || lsErr.message?.includes('quota')) {
					throw new Error('Storage quota exceeded');
				} else {
					throw new Error(`Error saving ${key}: ${lsErr.message || 'Unknown error'}`);
				}
			}
		}
	}

	async loadFromStorage<T>(key: string, defaultValue: T): Promise<T> {
		try {
			// Use the note taking storage based on key
			let saved: T | undefined;
			if (key === 'noteTakingNotes') {
				saved = (await this.noteTakingStorage.getNotes()) as T;
			} else if (key === 'noteTakingTopics') {
				saved = (await this.noteTakingStorage.getTopics()) as T;
			} else {
				// Fallback for unknown keys
				saved = (await this.noteTakingStorage.getSetting(key as any)) as T;
			}

			if (saved !== undefined) {
				return saved;
			}

			// Fallback to localStorage for migration
			const localSaved = localStorage.getItem(key);
			if (localSaved) {
				const parsed = JSON.parse(localSaved);
				// Migrate to storage API and remove from localStorage
				try {
					if (key === 'noteTakingNotes') {
						await this.noteTakingStorage.setNotes(parsed);
					} else if (key === 'noteTakingTopics') {
						await this.noteTakingStorage.setTopics(parsed);
					} else {
						await this.noteTakingStorage.updateSetting(key as any, parsed);
					}
					localStorage.removeItem(key);
					console.log(`Migrated ${key} from localStorage to storage-api`);
				} catch (e) {
					console.warn(`Failed to migrate ${key}:`, e);
				}
				return parsed;
			}
		} catch (error: unknown) {
			console.error(`Error loading ${key}:`, error);
		}
		return defaultValue;
	}

	async removeFromStorage(key: string): Promise<void> {
		try {
			// Remove from both storage API and localStorage
			if (key === 'noteTakingNotes') {
				await this.noteTakingStorage.setNotes([]);
			} else if (key === 'noteTakingTopics') {
				await this.noteTakingStorage.setTopics([]);
			} else {
				await this.noteTakingStorage.updateSetting(key as any, undefined);
			}
			localStorage.removeItem(key);
		} catch (error) {
			console.warn(`Failed to remove ${key} from storage:`, error);
		}
	}

	async validateAndSave<T>(key: string, data: T, estimatedSize?: number): Promise<void> {
		// Estimate size if not provided
		if (!estimatedSize) {
			estimatedSize = JSON.stringify(data).length * 2; // rough estimate for UTF-16
		}

		// Check if we have enough storage space
		const hasSpace = await this.checkStorageQuota(estimatedSize);
		if (!hasSpace) {
			throw new Error('Storage quota would be exceeded');
		}

		await this.saveToStorage(key, data);
	}
}
