// Note Taking Settings Storage Entity
// Handles note taking specific settings like notes and topics

import type { StorageAdapter } from '../types';

export interface NoteTakingSettings {
	// Notes and topics data
	notes?: any[];
	topics?: string[];

	// Timestamps
	createdAt?: string;
	updatedAt?: string;
}

export class NoteTakingSettingsStorage {
	private adapter: StorageAdapter;
	private readonly key = 'note-taking-settings';

	constructor(adapter: StorageAdapter) {
		this.adapter = adapter;
	}

	// Get the note taking settings object
	async getSettings(): Promise<NoteTakingSettings> {
		try {
			const data = await this.adapter.get(this.key);
			return data ? JSON.parse(data as string) : {};
		} catch (error) {
			console.warn('Failed to load note taking settings:', error);
			return {};
		}
	}

	// Update specific setting
	async updateSetting<K extends keyof NoteTakingSettings>(
		key: K,
		value: NoteTakingSettings[K]
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
			console.warn(`Failed to update note taking setting ${String(key)}:`, error);
			throw error;
		}
	}

	// Get specific setting
	async getSetting<K extends keyof NoteTakingSettings>(
		key: K
	): Promise<NoteTakingSettings[K] | undefined> {
		const settings = await this.getSettings();
		return settings[key];
	}

	// Notes management
	async setNotes(notes: any[]): Promise<void> {
		await this.updateSetting('notes', notes);
	}

	async getNotes(): Promise<any[] | undefined> {
		return this.getSetting('notes');
	}

	// Topics management
	async setTopics(topics: string[]): Promise<void> {
		await this.updateSetting('topics', topics);
	}

	async getTopics(): Promise<string[] | undefined> {
		return this.getSetting('topics');
	}
}
