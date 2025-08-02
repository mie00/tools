// UI Settings Storage Entity
// Handles user interface preferences like tool ordering, layout settings, etc.

import type { StorageAdapter } from '../types';

export interface UISettings {
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

	// Currency converter recent conversions
	recentCurrencyConversions?: any[];

	// AI Assistant configuration
	aiAssistantConfig?: any;

	// API keys and sensitive data
	stockApiKey?: string;

	// Timestamps
	createdAt?: string;
	updatedAt?: string;
}

export class UISettingsStorage {
	private adapter: StorageAdapter;
	private readonly key = 'ui-settings';

	constructor(adapter: StorageAdapter) {
		this.adapter = adapter;
	}

	// Get the UI settings object
	async getSettings(): Promise<UISettings> {
		try {
			const data = await this.adapter.get(this.key);
			return data ? JSON.parse(data as string) : {};
		} catch (error) {
			console.warn('Failed to load UI settings:', error);
			return {};
		}
	}

	// Update specific setting
	async updateSetting<K extends keyof UISettings>(key: K, value: UISettings[K]): Promise<void> {
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
			console.warn(`Failed to update UI setting ${String(key)}:`, error);
			throw error;
		}
	}

	// Get specific setting
	async getSetting<K extends keyof UISettings>(key: K): Promise<UISettings[K] | undefined> {
		const settings = await this.getSettings();
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
		const settings = await this.getSettings();
		const updatedSettings = {
			...settings,
			translatorSourceLanguage: sourceLanguage,
			translatorTargetLanguage: targetLanguage,
			updatedAt: new Date().toISOString()
		};

		if (!settings.createdAt) {
			updatedSettings.createdAt = new Date().toISOString();
		}

		await this.adapter.set(this.key, JSON.stringify(updatedSettings));
	}

	async getTranslatorSettings(): Promise<{ sourceLanguage?: string; targetLanguage?: string }> {
		const settings = await this.getSettings();
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

	// AI Assistant configuration
	async setAiAssistantConfig(config: any): Promise<void> {
		await this.updateSetting('aiAssistantConfig', config);
	}

	async getAiAssistantConfig(): Promise<any | undefined> {
		return this.getSetting('aiAssistantConfig');
	}
}
