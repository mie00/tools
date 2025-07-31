// Unit conversion history storage API

import { BaseEntityStorage } from '../storage-client';
import { UnitConversionHistoryId } from '../entity-id';

export interface UnitConversionHistoryItem {
	input: string;
	output: string;
	conversion: string;
	timestamp: string;
	category: string;
	fromUnit: string;
	toUnit: string;
}

export class UnitConversionHistoryStorage extends BaseEntityStorage<UnitConversionHistoryItem> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'unit_conversion_history',
			generateId: UnitConversionHistoryId.generate
		});
	}

	async addConversion(
		input: string,
		output: string,
		category: string,
		fromUnit: string,
		toUnit: string
	): Promise<string> {
		const item: UnitConversionHistoryItem = {
			input,
			output,
			conversion: `${input} ${fromUnit} = ${output} ${toUnit}`,
			timestamp: new Date().toISOString(),
			category,
			fromUnit,
			toUnit
		};
		return this.create(item);
	}

	async getRecentConversions(
		limit: number = 10
	): Promise<(UnitConversionHistoryItem & { id: string })[]> {
		const items = await this.list();
		return items
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
			.slice(0, limit);
	}

	async getByCategory(category: string): Promise<(UnitConversionHistoryItem & { id: string })[]> {
		return this.list((item) => item.category === category);
	}

	async searchConversions(query: string): Promise<(UnitConversionHistoryItem & { id: string })[]> {
		return this.list(
			(item) =>
				item.conversion.toLowerCase().includes(query.toLowerCase()) ||
				item.fromUnit.toLowerCase().includes(query.toLowerCase()) ||
				item.toUnit.toLowerCase().includes(query.toLowerCase())
		);
	}
}
