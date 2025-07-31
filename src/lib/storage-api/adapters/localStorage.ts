// localStorage storage adapter

import type { StorageAdapter } from '../types';

export class LocalStorageAdapter implements StorageAdapter {
	async get<T>(key: string): Promise<T | null> {
		try {
			if (typeof window === 'undefined') return null;
			const item = localStorage.getItem(key);
			return item ? JSON.parse(item) : null;
		} catch (error) {
			console.warn('Failed to get from localStorage:', error);
			return null;
		}
	}

	async set<T>(key: string, value: T): Promise<void> {
		try {
			if (typeof window === 'undefined') return;
			localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {
			console.warn('Failed to set in localStorage:', error);
			throw error;
		}
	}

	async delete(key: string): Promise<void> {
		try {
			if (typeof window === 'undefined') return;
			localStorage.removeItem(key);
		} catch (error) {
			console.warn('Failed to delete from localStorage:', error);
		}
	}

	async list(prefix?: string): Promise<string[]> {
		try {
			if (typeof window === 'undefined') return [];
			const keys: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && (!prefix || key.startsWith(prefix))) {
					keys.push(key);
				}
			}
			return keys;
		} catch (error) {
			console.warn('Failed to list localStorage keys:', error);
			return [];
		}
	}

	async clear(prefix?: string): Promise<void> {
		try {
			if (typeof window === 'undefined') return;
			if (prefix) {
				const keys = await this.list(prefix);
				keys.forEach((key) => {
					try {
						localStorage.removeItem(key);
					} catch (e) {
						console.warn(`Failed to remove key ${key}:`, e);
					}
				});
			} else {
				localStorage.clear();
			}
		} catch (error) {
			console.warn('Failed to clear localStorage:', error);
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			if (typeof window === 'undefined') return false;
			return localStorage.getItem(key) !== null;
		} catch (error) {
			console.warn('Failed to check localStorage existence:', error);
			return false;
		}
	}

	async getSize(): Promise<number> {
		try {
			let size = 0;
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					const value = localStorage.getItem(key);
					size += key.length + (value?.length || 0);
				}
			}
			return size;
		} catch (error) {
			console.warn('Failed to calculate localStorage size:', error);
			return 0;
		}
	}

	async getAvailableSpace(): Promise<number> {
		// no need to implement this
		return 0;
	}

	async isSupported(): Promise<boolean> {
		try {
			if (typeof window === 'undefined' || !window.localStorage) {
				return false;
			}
			const testKey = '__localStorage_test__';
			localStorage.setItem(testKey, 'test');
			localStorage.removeItem(testKey);
			return true;
		} catch (error) {
			return false;
		}
	}
}
