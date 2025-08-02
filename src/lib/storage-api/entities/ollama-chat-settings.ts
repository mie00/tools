// Ollama Chat Settings Storage Entity
// Handles ollama chat specific settings like topics, config, and LLM state

import type { StorageAdapter } from '../types';

export interface OllamaChatSettings {
	// Chat topics
	topics?: any[];

	// Chat configuration
	config?: any;

	// LLM state
	llmState?: any;

	// Timestamps
	createdAt?: string;
	updatedAt?: string;
}

export class OllamaChatSettingsStorage {
	private adapter: StorageAdapter;
	private readonly key = 'ollama-chat-settings';

	constructor(adapter: StorageAdapter) {
		this.adapter = adapter;
	}

	// Get the ollama chat settings object
	async getSettings(): Promise<OllamaChatSettings> {
		try {
			const data = await this.adapter.get(this.key);
			return data ? JSON.parse(data as string) : {};
		} catch (error) {
			console.warn('Failed to load ollama chat settings:', error);
			return {};
		}
	}

	// Update specific setting
	async updateSetting<K extends keyof OllamaChatSettings>(
		key: K,
		value: OllamaChatSettings[K]
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
			console.warn(`Failed to update ollama chat setting ${String(key)}:`, error);
			throw error;
		}
	}

	// Get specific setting
	async getSetting<K extends keyof OllamaChatSettings>(
		key: K
	): Promise<OllamaChatSettings[K] | undefined> {
		const settings = await this.getSettings();
		return settings[key];
	}

	// Topics management
	async setTopics(topics: any[]): Promise<void> {
		await this.updateSetting('topics', topics);
	}

	async getTopics(): Promise<any[] | undefined> {
		return this.getSetting('topics');
	}

	// Config management
	async setConfig(config: any): Promise<void> {
		await this.updateSetting('config', config);
	}

	async getConfig(): Promise<any | undefined> {
		return this.getSetting('config');
	}

	// LLM state management
	async setLlmState(state: any): Promise<void> {
		await this.updateSetting('llmState', state);
	}

	async getLlmState(): Promise<any | undefined> {
		return this.getSetting('llmState');
	}
}
