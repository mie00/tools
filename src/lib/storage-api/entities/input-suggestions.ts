// Smart input suggestions storage API

import { BaseEntityStorage } from '../storage-client';
import { EntityIdGenerator } from '../entity-id';

export interface InputSuggestion {
	originalInput: string;
	suggestedInput: string;
	confidence: number;
	category: 'intent' | 'correction' | 'completion' | 'enhancement';
	metadata: {
		inputLength: number;
		detectedLanguage?: string;
		inputType?: string;
		context?: string;
	};
	createdAt: string;
	lastUsed: string;
	useCount: number;
	accepted: boolean;
	userFeedback?: 'positive' | 'negative';
}

export interface SuggestionPattern {
	pattern: string;
	replacement: string;
	category: string;
	enabled: boolean;
	useCount: number;
	createdAt: string;
}

export class InputSuggestionStorage extends BaseEntityStorage<InputSuggestion> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'input_suggestions',
			generateId: () => EntityIdGenerator.generateUuid()
		});
	}

	async saveSuggestion(
		originalInput: string,
		suggestedInput: string,
		confidence: number,
		category: InputSuggestion['category'],
		metadata: InputSuggestion['metadata']
	): Promise<string> {
		const suggestion: InputSuggestion = {
			originalInput,
			suggestedInput,
			confidence,
			category,
			metadata,
			createdAt: new Date().toISOString(),
			lastUsed: new Date().toISOString(),
			useCount: 0,
			accepted: false
		};

		return this.create(suggestion);
	}

	async findSimilarSuggestions(
		input: string,
		threshold: number = 0.8
	): Promise<(InputSuggestion & { id: string })[]> {
		// TODO: Implement similarity matching logic
		return this.list(
			(suggestion) =>
				suggestion.originalInput.toLowerCase().includes(input.toLowerCase()) ||
				input.toLowerCase().includes(suggestion.originalInput.toLowerCase())
		);
	}

	async getByCategory(
		category: InputSuggestion['category']
	): Promise<(InputSuggestion & { id: string })[]> {
		return this.list((suggestion) => suggestion.category === category);
	}

	async getAcceptedSuggestions(): Promise<(InputSuggestion & { id: string })[]> {
		return this.list((suggestion) => suggestion.accepted);
	}

	async getHighConfidenceSuggestions(
		minConfidence: number = 0.9
	): Promise<(InputSuggestion & { id: string })[]> {
		return this.list((suggestion) => suggestion.confidence >= minConfidence);
	}

	async recordUsage(id: string, accepted: boolean): Promise<void> {
		const suggestion = await this.get(id);
		if (!suggestion) throw new Error('Suggestion not found');

		await this.update(id, {
			lastUsed: new Date().toISOString(),
			useCount: suggestion.useCount + 1,
			accepted: accepted || suggestion.accepted
		});
	}

	async provideFeedback(id: string, feedback: 'positive' | 'negative'): Promise<void> {
		await this.update(id, { userFeedback: feedback });
	}

	async getMostUsed(limit: number = 20): Promise<(InputSuggestion & { id: string })[]> {
		const suggestions = await this.list();
		return suggestions.sort((a, b) => b.useCount - a.useCount).slice(0, limit);
	}

	async getRecentSuggestions(limit: number = 20): Promise<(InputSuggestion & { id: string })[]> {
		const suggestions = await this.list();
		return suggestions
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, limit);
	}

	async searchSuggestions(query: string): Promise<(InputSuggestion & { id: string })[]> {
		const lowerQuery = query.toLowerCase();
		return this.list(
			(suggestion) =>
				suggestion.originalInput.toLowerCase().includes(lowerQuery) ||
				suggestion.suggestedInput.toLowerCase().includes(lowerQuery)
		);
	}

	async cleanupLowQualitySuggestions(
		minConfidence: number = 0.3,
		minUseCount: number = 1,
		maxAge: number = 30 * 24 * 60 * 60 * 1000
	): Promise<void> {
		const cutoffDate = new Date(Date.now() - maxAge);
		const suggestions = await this.list();

		for (const suggestion of suggestions) {
			const isLowQuality =
				suggestion.confidence < minConfidence &&
				suggestion.useCount < minUseCount &&
				new Date(suggestion.createdAt) < cutoffDate;

			if (isLowQuality || suggestion.userFeedback === 'negative') {
				await this.delete(suggestion.id);
			}
		}
	}

	async getSuccessRate(): Promise<number> {
		const suggestions = await this.list();
		if (suggestions.length === 0) return 0;

		const acceptedCount = suggestions.filter((s) => s.accepted).length;
		return acceptedCount / suggestions.length;
	}
}
