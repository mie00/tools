// Sound Library Settings Storage Entity
// Handles sound library specific settings like playback state, file lists, etc.

import type { StorageAdapter } from '../types';

export interface SoundLibrarySettings {
	// Playback state
	playbackState?: any;
	currentTime?: number;

	// File and folder metadata
	files?: any[];
	folders?: any[];

	// Timestamps
	createdAt?: string;
	updatedAt?: string;
}

export class SoundLibrarySettingsStorage {
	private adapter: StorageAdapter;
	private readonly key = 'sound-library-settings';

	constructor(adapter: StorageAdapter) {
		this.adapter = adapter;
	}

	// Get the sound library settings object
	async getSettings(): Promise<SoundLibrarySettings> {
		try {
			const data = await this.adapter.get(this.key);
			return data ? JSON.parse(data as string) : {};
		} catch (error) {
			console.warn('Failed to load sound library settings:', error);
			return {};
		}
	}

	// Update specific setting
	async updateSetting<K extends keyof SoundLibrarySettings>(
		key: K,
		value: SoundLibrarySettings[K]
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
			console.warn(`Failed to update sound library setting ${String(key)}:`, error);
			throw error;
		}
	}

	// Get specific setting
	async getSetting<K extends keyof SoundLibrarySettings>(
		key: K
	): Promise<SoundLibrarySettings[K] | undefined> {
		const settings = await this.getSettings();
		return settings[key];
	}

	// Playback state management
	async setPlaybackState(state: any): Promise<void> {
		await this.updateSetting('playbackState', state);
	}

	async getPlaybackState(): Promise<any | undefined> {
		return this.getSetting('playbackState');
	}

	async setCurrentTime(time: number): Promise<void> {
		await this.updateSetting('currentTime', time);
	}

	async getCurrentTime(): Promise<number | undefined> {
		return this.getSetting('currentTime');
	}

	// File and folder management
	async setFiles(files: any[]): Promise<void> {
		await this.updateSetting('files', files);
	}

	async getFiles(): Promise<any[] | undefined> {
		return this.getSetting('files');
	}

	async setFolders(folders: any[]): Promise<void> {
		await this.updateSetting('folders', folders);
	}

	async getFolders(): Promise<any[] | undefined> {
		return this.getSetting('folders');
	}
}
