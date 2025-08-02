// Function Drawer Settings Storage Entity
// Handles function drawer specific settings like history and current ID

import type { StorageAdapter } from '../types';

export interface FunctionDrawerSettings {
	// Function drawer history and current ID
	history?: any[];
	currentHistoryId?: string;

	// Timestamps
	createdAt?: string;
	updatedAt?: string;
}

export class FunctionDrawerSettingsStorage {
	private adapter: StorageAdapter;
	private readonly key = 'function-drawer-settings';

	constructor(adapter: StorageAdapter) {
		this.adapter = adapter;
	}

	// Get the function drawer settings object
	async getSettings(): Promise<FunctionDrawerSettings> {
		try {
			const data = await this.adapter.get(this.key);
			return data ? JSON.parse(data as string) : {};
		} catch (error) {
			console.warn('Failed to load function drawer settings:', error);
			return {};
		}
	}

	// Update specific setting
	async updateSetting<K extends keyof FunctionDrawerSettings>(
		key: K,
		value: FunctionDrawerSettings[K]
	): Promise<void> {
		try {
			const settings = await this.getSettings();
			const updatedSettings = {
				...settings,
				[key]: value,
				updatedAt: new Date().toISOString()
			};

			// Set createdAt if this is the first time
			if (!settings.createdAt) {
				updatedSettings.createdAt = new Date().toISOString();
			}

			await this.adapter.set(this.key, JSON.stringify(updatedSettings));
		} catch (error) {
			console.warn(`Failed to update function drawer setting ${String(key)}:`, error);
			throw error;
		}
	}

	// Get specific setting
	async getSetting<K extends keyof FunctionDrawerSettings>(
		key: K
	): Promise<FunctionDrawerSettings[K] | undefined> {
		const settings = await this.getSettings();
		return settings[key];
	}

	// History management
	async setHistory(history: any[], currentId?: string): Promise<void> {
		const settings = await this.getSettings();
		const updatedSettings = {
			...settings,
			history: history,
			currentHistoryId: currentId,
			updatedAt: new Date().toISOString()
		};

		if (!settings.createdAt) {
			updatedSettings.createdAt = new Date().toISOString();
		}

		await this.adapter.set(this.key, JSON.stringify(updatedSettings));
	}

	async getHistory(): Promise<{ history?: any[]; currentId?: string }> {
		const settings = await this.getSettings();
		return {
			history: settings.history,
			currentId: settings.currentHistoryId
		};
	}
}
