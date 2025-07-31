// Saved functions storage API

import { BaseEntityStorage } from '../storage-client';
import { SavedFunctionId } from '../entity-id';

export interface SavedFunction {
	name: string;
	expression: string;
	parameters: string[];
	description?: string;
	category: string;
	plotData?: {
		xValues: number[];
		yValues: number[];
		plotType: 'line' | 'scatter' | 'bar';
	};
	createdAt: string;
	updatedAt: string;
	lastUsed: string;
	useCount: number;
	favorite: boolean;
}

export class SavedFunctionStorage extends BaseEntityStorage<SavedFunction> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'saved_functions',
			generateId: () => SavedFunctionId.generate({})
		});
	}

	async saveFunction(
		name: string,
		expression: string,
		parameters: string[],
		category: string = 'user',
		description?: string
	): Promise<string> {
		const func: SavedFunction = {
			name,
			expression,
			parameters,
			description,
			category,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			lastUsed: new Date().toISOString(),
			useCount: 0,
			favorite: false
		};

		return this.create(func);
	}

	async getByCategory(category: string): Promise<(SavedFunction & { id: string })[]> {
		return this.list((func) => func.category === category);
	}

	async getFavorites(): Promise<(SavedFunction & { id: string })[]> {
		return this.list((func) => func.favorite);
	}

	async getMostUsed(limit: number = 10): Promise<(SavedFunction & { id: string })[]> {
		const functions = await this.list();
		return functions.sort((a, b) => b.useCount - a.useCount).slice(0, limit);
	}

	async getRecentlyUsed(limit: number = 10): Promise<(SavedFunction & { id: string })[]> {
		const functions = await this.list();
		return functions
			.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
			.slice(0, limit);
	}

	async searchFunctions(query: string): Promise<(SavedFunction & { id: string })[]> {
		const lowerQuery = query.toLowerCase();
		return this.list(
			(func) =>
				func.name.toLowerCase().includes(lowerQuery) ||
				func.expression.toLowerCase().includes(lowerQuery) ||
				(func.description && func.description.toLowerCase().includes(lowerQuery)) ||
				func.parameters.some((param) => param.toLowerCase().includes(lowerQuery))
		);
	}

	async recordUsage(id: string): Promise<void> {
		const func = await this.get(id);
		if (!func) throw new Error('Function not found');

		await this.update(id, {
			lastUsed: new Date().toISOString(),
			useCount: func.useCount + 1
		});
	}

	async toggleFavorite(id: string): Promise<void> {
		const func = await this.get(id);
		if (!func) throw new Error('Function not found');

		await this.update(id, { favorite: !func.favorite });
	}

	async updatePlotData(id: string, plotData: SavedFunction['plotData']): Promise<void> {
		await this.update(id, {
			plotData,
			updatedAt: new Date().toISOString()
		});
	}

	async getCategories(): Promise<string[]> {
		const functions = await this.list();
		const categories = new Set(functions.map((func) => func.category));
		return Array.from(categories).sort();
	}
}
