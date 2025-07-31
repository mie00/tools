// Calculator history storage API

import type { EntityStorage } from '../types';
import { BaseEntityStorage } from '../storage-client';
import { CalculatorHistoryId } from '../entity-id';

export interface CalculatorHistoryItem {
	name: string;
	expression: string;
	result: number;
	timestamp: string;
}

export class CalculatorHistoryStorage extends BaseEntityStorage<CalculatorHistoryItem> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'calculator_history',
			generateId: CalculatorHistoryId.generate
		});
	}

	async addCalculation(name: string, expression: string, result: number): Promise<string> {
		const item: CalculatorHistoryItem = {
			name,
			expression,
			result,
			timestamp: new Date().toISOString()
		};
		return this.create(item);
	}

	async getRecentCalculations(
		limit: number = 10
	): Promise<(CalculatorHistoryItem & { id: string })[]> {
		const items = await this.list();
		return items
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
			.slice(0, limit);
	}

	async searchByExpression(query: string): Promise<(CalculatorHistoryItem & { id: string })[]> {
		return this.list(
			(item) =>
				item.expression.toLowerCase().includes(query.toLowerCase()) ||
				item.name.toLowerCase().includes(query.toLowerCase())
		);
	}
}
