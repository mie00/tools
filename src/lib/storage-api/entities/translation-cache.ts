// Translation cache storage API

import { BaseEntityStorage } from '../storage-client';
import { EntityIdGenerator } from '../entity-id';

export interface TranslationEntry {
	sourceText: string;
	targetLanguage: string;
	translatedText: string;
	sourceLanguage?: string;
	confidence?: number;
	createdAt: string;
	lastUsed: string;
	useCount: number;
}

export interface LanguagePreference {
	currentLanguage: string;
	fallbackLanguage: string;
	autoDetect: boolean;
	updatedAt: string;
}

export class TranslationCacheStorage extends BaseEntityStorage<TranslationEntry> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'translation_cache',
			generateId: () => EntityIdGenerator.generateUuid()
		});
	}

	private getTranslationKey(sourceText: string, targetLanguage: string): string {
		return `${sourceText.toLowerCase().trim()}_${targetLanguage}`;
	}

	async cacheTranslation(
		sourceText: string,
		targetLanguage: string,
		translatedText: string,
		sourceLanguage?: string,
		confidence?: number
	): Promise<string> {
		// Check if translation already exists
		const existing = await this.findTranslation(sourceText, targetLanguage);

		if (existing) {
			// Update existing entry
			await this.update(existing.id, {
				translatedText,
				lastUsed: new Date().toISOString(),
				useCount: existing.useCount + 1,
				...(sourceLanguage && { sourceLanguage }),
				...(confidence && { confidence })
			});
			return existing.id;
		}

		// Create new entry
		const entry: TranslationEntry = {
			sourceText: sourceText.trim(),
			targetLanguage,
			translatedText,
			sourceLanguage,
			confidence,
			createdAt: new Date().toISOString(),
			lastUsed: new Date().toISOString(),
			useCount: 1
		};

		return this.create(entry);
	}

	async findTranslation(
		sourceText: string,
		targetLanguage: string
	): Promise<(TranslationEntry & { id: string }) | null> {
		const entries = await this.list(
			(entry) =>
				entry.sourceText.toLowerCase().trim() === sourceText.toLowerCase().trim() &&
				entry.targetLanguage === targetLanguage
		);

		if (entries.length > 0) {
			const entry = entries[0];
			// Update last used timestamp
			await this.update(entry.id, {
				lastUsed: new Date().toISOString(),
				useCount: entry.useCount + 1
			});
			return entry;
		}

		return null;
	}

	async getByTargetLanguage(
		targetLanguage: string
	): Promise<(TranslationEntry & { id: string })[]> {
		return this.list((entry) => entry.targetLanguage === targetLanguage);
	}

	async getMostUsed(limit: number = 50): Promise<(TranslationEntry & { id: string })[]> {
		const entries = await this.list();
		return entries.sort((a, b) => b.useCount - a.useCount).slice(0, limit);
	}

	async getRecentlyUsed(limit: number = 50): Promise<(TranslationEntry & { id: string })[]> {
		const entries = await this.list();
		return entries
			.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
			.slice(0, limit);
	}

	async cleanupOldEntries(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
		const cutoffDate = new Date(Date.now() - maxAge);
		const entries = await this.list();

		for (const entry of entries) {
			if (new Date(entry.lastUsed) < cutoffDate && entry.useCount < 2) {
				await this.delete(entry.id);
			}
		}
	}

	async searchTranslations(query: string): Promise<(TranslationEntry & { id: string })[]> {
		const lowerQuery = query.toLowerCase();
		return this.list(
			(entry) =>
				entry.sourceText.toLowerCase().includes(lowerQuery) ||
				entry.translatedText.toLowerCase().includes(lowerQuery)
		);
	}
}
