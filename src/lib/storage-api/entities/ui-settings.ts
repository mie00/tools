// UI Settings Storage Entity
// Handles user interface preferences like tool ordering, layout settings, etc.

import { BaseEntityStorage } from '../storage-client';
import type { StorageAdapter } from '../types';
import { EntityIdGenerator } from '../entity-id';

export interface UISettings {
	id?: string;

	// Tools page settings
	toolsOrder?: string[];

	// Selected cities for DateTime widget
	selectedCities?: string[];

	// Translator preferences
	translatorSourceLanguage?: string;
	translatorTargetLanguage?: string;

	// Language preference for the entire app
	appLanguage?: string;

	// Azkar progress
	azkarProgress?: Record<string, any>;

	// Function drawer history and current ID
	functionDrawerHistory?: any[];
	functionDrawerCurrentHistoryId?: string;

	// Currency converter recent conversions
	recentCurrencyConversions?: any[];

	// Chat configurations
	ollamaChatConfig?: any;
	ollamaChatLlmState?: any;
	aiAssistantConfig?: any;

	// API keys and sensitive data
	stockApiKey?: string;

	// Sound library playback state
	soundLibraryPlaybackState?: any;
	soundLibraryCurrentTime?: number;

	// Timestamps
	createdAt?: string;
	updatedAt?: string;
}

export class UISettingsStorage extends BaseEntityStorage<UISettings> {
	constructor(adapter: StorageAdapter) {
		super({
			adapter,
			keyPrefix: 'ui-settings',
			generateId: () => EntityIdGenerator.generateUuid()
		});
	}

	// Get or create the main UI settings object
	async getMainSettings(): Promise<UISettings> {
		const settings = await this.list();
		if (settings.length > 0) {
			return settings[0];
		}

		// Create default settings
		const defaultSettings: UISettings = {
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		const id = await this.create(defaultSettings);
		return { ...defaultSettings, id };
	}

	// Update specific setting
	async updateSetting<K extends keyof UISettings>(key: K, value: UISettings[K]): Promise<void> {
		const settings = await this.getMainSettings();
		await this.update(settings.id!, {
			[key]: value,
			updatedAt: new Date().toISOString()
		});
	}

	// Get specific setting
	async getSetting<K extends keyof UISettings>(key: K): Promise<UISettings[K] | undefined> {
		const settings = await this.getMainSettings();
		return settings[key];
	}

	// Tools order management
	async setToolsOrder(toolIds: string[]): Promise<void> {
		await this.updateSetting('toolsOrder', toolIds);
	}

	async getToolsOrder(): Promise<string[] | undefined> {
		return this.getSetting('toolsOrder');
	}

	// Selected cities management
	async setSelectedCities(cities: string[]): Promise<void> {
		await this.updateSetting('selectedCities', cities);
	}

	async getSelectedCities(): Promise<string[] | undefined> {
		return this.getSetting('selectedCities');
	}

	// Translator settings
	async setTranslatorSettings(sourceLanguage: string, targetLanguage: string): Promise<void> {
		const settings = await this.getMainSettings();
		await this.update(settings.id!, {
			translatorSourceLanguage: sourceLanguage,
			translatorTargetLanguage: targetLanguage,
			updatedAt: new Date().toISOString()
		});
	}

	async getTranslatorSettings(): Promise<{ sourceLanguage?: string; targetLanguage?: string }> {
		const settings = await this.getMainSettings();
		return {
			sourceLanguage: settings.translatorSourceLanguage,
			targetLanguage: settings.translatorTargetLanguage
		};
	}

	// App language preference
	async setAppLanguage(language: string): Promise<void> {
		await this.updateSetting('appLanguage', language);
	}

	async getAppLanguage(): Promise<string | undefined> {
		return this.getSetting('appLanguage');
	}

	// API key management
	async setStockApiKey(apiKey: string): Promise<void> {
		await this.updateSetting('stockApiKey', apiKey);
	}

	async getStockApiKey(): Promise<string | undefined> {
		return this.getSetting('stockApiKey');
	}

	async removeStockApiKey(): Promise<void> {
		await this.updateSetting('stockApiKey', undefined);
	}

	// Function drawer history
	async setFunctionDrawerHistory(history: any[], currentId?: string): Promise<void> {
		const settings = await this.getMainSettings();
		await this.update(settings.id!, {
			functionDrawerHistory: history,
			functionDrawerCurrentHistoryId: currentId,
			updatedAt: new Date().toISOString()
		});
	}

	async getFunctionDrawerHistory(): Promise<{ history?: any[]; currentId?: string }> {
		const settings = await this.getMainSettings();
		return {
			history: settings.functionDrawerHistory,
			currentId: settings.functionDrawerCurrentHistoryId
		};
	}

	// Currency converter recent conversions
	async setRecentCurrencyConversions(conversions: any[]): Promise<void> {
		await this.updateSetting('recentCurrencyConversions', conversions);
	}

	async getRecentCurrencyConversions(): Promise<any[] | undefined> {
		return this.getSetting('recentCurrencyConversions');
	}

	// Azkar progress
	async setAzkarProgress(progress: Record<string, any>): Promise<void> {
		await this.updateSetting('azkarProgress', progress);
	}

	async getAzkarProgress(): Promise<Record<string, any> | undefined> {
		return this.getSetting('azkarProgress');
	}

	// Chat configurations
	async setOllamaChatConfig(config: any): Promise<void> {
		await this.updateSetting('ollamaChatConfig', config);
	}

	async getOllamaChatConfig(): Promise<any | undefined> {
		return this.getSetting('ollamaChatConfig');
	}

	async setOllamaChatLlmState(state: any): Promise<void> {
		await this.updateSetting('ollamaChatLlmState', state);
	}

	async getOllamaChatLlmState(): Promise<any | undefined> {
		return this.getSetting('ollamaChatLlmState');
	}

	async setAiAssistantConfig(config: any): Promise<void> {
		await this.updateSetting('aiAssistantConfig', config);
	}

	async getAiAssistantConfig(): Promise<any | undefined> {
		return this.getSetting('aiAssistantConfig');
	}

	// Sound library settings
	async setSoundLibraryPlaybackState(state: any): Promise<void> {
		await this.updateSetting('soundLibraryPlaybackState', state);
	}

	async getSoundLibraryPlaybackState(): Promise<any | undefined> {
		return this.getSetting('soundLibraryPlaybackState');
	}

	async setSoundLibraryCurrentTime(time: number): Promise<void> {
		await this.updateSetting('soundLibraryCurrentTime', time);
	}

	async getSoundLibraryCurrentTime(): Promise<number | undefined> {
		return this.getSetting('soundLibraryCurrentTime');
	}
}
