export interface StorageInfo {
	used: number;
	quota: number;
	available: number;
}

export class StorageManager {
	private static instance: StorageManager;

	static getInstance(): StorageManager {
		if (!StorageManager.instance) {
			StorageManager.instance = new StorageManager();
		}
		return StorageManager.instance;
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

	saveToLocalStorage<T>(key: string, data: T): void {
		try {
			localStorage.setItem(key, JSON.stringify(data));
		} catch (error: unknown) {
			const err = error as Error;
			console.error(`Error saving ${key}:`, error);

			if (err.name === 'QuotaExceededError' || err.message?.includes('quota')) {
				throw new Error('Storage quota exceeded');
			} else {
				throw new Error(`Error saving ${key}: ${err.message || 'Unknown error'}`);
			}
		}
	}

	loadFromLocalStorage<T>(key: string, defaultValue: T): T {
		try {
			const saved = localStorage.getItem(key);
			if (saved) {
				return JSON.parse(saved);
			}
		} catch (error: unknown) {
			console.error(`Error loading ${key}:`, error);
		}
		return defaultValue;
	}

	removeFromLocalStorage(key: string): void {
		try {
			localStorage.removeItem(key);
		} catch (error) {
			console.warn(`Failed to remove ${key} from localStorage:`, error);
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

		this.saveToLocalStorage(key, data);
	}
}
