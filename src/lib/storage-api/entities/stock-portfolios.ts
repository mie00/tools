// Stock portfolios storage API

import { BaseEntityStorage } from '../storage-client';
import { EntityIdGenerator } from '../entity-id';

export interface StockPosition {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	lastUpdate: string;
	addedDate: string;
	notes?: string;
	purchasePrice?: number;
	shares?: number;
}

export interface StockPortfolio {
	name: string;
	description?: string;
	positions: StockPosition[];
	createdAt: string;
	updatedAt: string;
	isDefault: boolean;
}

export class StockPortfolioStorage extends BaseEntityStorage<StockPortfolio> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'stock_portfolios',
			generateId: () => EntityIdGenerator.generateUuid()
		});
	}

	async createPortfolio(
		name: string,
		description?: string,
		isDefault: boolean = false
	): Promise<string> {
		// If this is set as default, unset other defaults
		if (isDefault) {
			await this.unsetAllDefaults();
		}

		const portfolio: StockPortfolio = {
			name,
			description,
			positions: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			isDefault
		};

		return this.create(portfolio);
	}

	private async unsetAllDefaults(): Promise<void> {
		const portfolios = await this.list((p) => p.isDefault);
		for (const portfolio of portfolios) {
			await this.update(portfolio.id, { isDefault: false });
		}
	}

	async getDefaultPortfolio(): Promise<(StockPortfolio & { id: string }) | null> {
		const portfolios = await this.list((p) => p.isDefault);
		return portfolios[0] || null;
	}

	async setDefaultPortfolio(portfolioId: string): Promise<void> {
		await this.unsetAllDefaults();
		await this.update(portfolioId, { isDefault: true });
	}

	async addStock(portfolioId: string, position: Omit<StockPosition, 'addedDate'>): Promise<void> {
		const portfolio = await this.get(portfolioId);
		if (!portfolio) throw new Error('Portfolio not found');

		const existingIndex = portfolio.positions.findIndex((p) => p.symbol === position.symbol);

		if (existingIndex >= 0) {
			// Update existing position
			portfolio.positions[existingIndex] = {
				...portfolio.positions[existingIndex],
				...position
			};
		} else {
			// Add new position
			portfolio.positions.push({
				...position,
				addedDate: new Date().toISOString()
			});
		}

		await this.update(portfolioId, {
			positions: portfolio.positions,
			updatedAt: new Date().toISOString()
		});
	}

	async removeStock(portfolioId: string, symbol: string): Promise<void> {
		const portfolio = await this.get(portfolioId);
		if (!portfolio) throw new Error('Portfolio not found');

		const updatedPositions = portfolio.positions.filter((p) => p.symbol !== symbol);
		await this.update(portfolioId, {
			positions: updatedPositions,
			updatedAt: new Date().toISOString()
		});
	}

	async updateStockPrice(
		portfolioId: string,
		symbol: string,
		priceData: Partial<StockPosition>
	): Promise<void> {
		const portfolio = await this.get(portfolioId);
		if (!portfolio) throw new Error('Portfolio not found');

		const positionIndex = portfolio.positions.findIndex((p) => p.symbol === symbol);
		if (positionIndex >= 0) {
			portfolio.positions[positionIndex] = {
				...portfolio.positions[positionIndex],
				...priceData
			};

			await this.update(portfolioId, {
				positions: portfolio.positions,
				updatedAt: new Date().toISOString()
			});
		}
	}

	async searchStocks(portfolioId: string, query: string): Promise<StockPosition[]> {
		const portfolio = await this.get(portfolioId);
		if (!portfolio) return [];

		const lowerQuery = query.toLowerCase();
		return portfolio.positions.filter(
			(position) =>
				position.symbol.toLowerCase().includes(lowerQuery) ||
				position.name.toLowerCase().includes(lowerQuery) ||
				(position.notes && position.notes.toLowerCase().includes(lowerQuery))
		);
	}
}
