import type { StockQuote, StockSearchResult } from './StockApiManager';
import { StorageFactory, type StockPortfolio, type StockPosition } from '../storage-api';

export interface PortfolioStock extends StockQuote {
	addedDate: string;
	notes?: string;
	purchasePrice?: number;
	shares?: number;
	currentPrice?: number;
}

export class PortfolioManager {
	private static instance: PortfolioManager;
	private portfolioStorage = StorageFactory.createStockPortfolioStorage();
	private defaultPortfolioId: string | null = null;
	private portfolio: PortfolioStock[] = [];

	static getInstance(): PortfolioManager {
		if (!PortfolioManager.instance) {
			PortfolioManager.instance = new PortfolioManager();
		}
		return PortfolioManager.instance;
	}

	constructor() {
		this.initializePortfolio();
	}

	private async initializePortfolio(): Promise<void> {
		try {
			// Get or create default portfolio
			let defaultPortfolio = await this.portfolioStorage.getDefaultPortfolio();

			if (!defaultPortfolio) {
				// Create default portfolio
				this.defaultPortfolioId = await this.portfolioStorage.createPortfolio(
					'My Portfolio',
					'Default stock portfolio',
					true
				);
				defaultPortfolio = (await this.portfolioStorage.get(this.defaultPortfolioId)) as any;
			} else {
				this.defaultPortfolioId = defaultPortfolio?.id || '';
			}

			// Load portfolio positions
			if (defaultPortfolio) {
				this.portfolio = defaultPortfolio.positions.map((pos: any) => ({
					symbol: pos.symbol,
					name: pos.name,
					price: pos.price,
					change: pos.change,
					changePercent: pos.changePercent,
					lastUpdate: pos.lastUpdate,
					addedDate: pos.addedDate,
					notes: pos.notes,
					purchasePrice: pos.purchasePrice,
					shares: pos.shares
				}));
			}
		} catch (error) {
			console.warn('Failed to initialize portfolio:', error);
			this.portfolio = [];
		}
	}

	private async savePortfolio(): Promise<void> {
		if (!this.defaultPortfolioId) return;

		try {
			const positions: StockPosition[] = this.portfolio.map((stock) => ({
				symbol: stock.symbol,
				name: stock.name,
				price: stock.price,
				change: stock.change,
				changePercent: stock.changePercent,
				lastUpdate: stock.lastUpdate,
				addedDate: stock.addedDate,
				notes: stock.notes,
				purchasePrice: stock.purchasePrice,
				shares: stock.shares
			}));

			const portfolio = await this.portfolioStorage.get(this.defaultPortfolioId);
			if (portfolio) {
				await this.portfolioStorage.update(this.defaultPortfolioId, {
					positions,
					updatedAt: new Date().toISOString()
				});
			}
		} catch (error) {
			console.warn('Failed to save portfolio:', error);
		}
	}

	getPortfolio(): PortfolioStock[] {
		return [...this.portfolio];
	}

	async addStock(searchResult: StockSearchResult): Promise<PortfolioStock> {
		// Check if stock already exists
		const existingIndex = this.portfolio.findIndex((stock) => stock.symbol === searchResult.symbol);
		if (existingIndex >= 0) {
			return this.portfolio[existingIndex];
		}

		// Create new portfolio stock
		const newStock: PortfolioStock = {
			symbol: searchResult.symbol,
			name: searchResult.name,
			price: 0, // Will be updated when quote is fetched
			change: 0,
			changePercent: 0,
			lastUpdate: '',
			addedDate: new Date().toISOString()
		};

		this.portfolio.push(newStock);
		await this.savePortfolio();
		return newStock;
	}

	async removeStock(symbol: string): Promise<boolean> {
		const initialLength = this.portfolio.length;
		this.portfolio = this.portfolio.filter((stock) => stock.symbol !== symbol);

		if (this.portfolio.length !== initialLength) {
			await this.savePortfolio();
			return true;
		}
		return false;
	}

	async updateStock(updatedStock: StockQuote): Promise<boolean> {
		const index = this.portfolio.findIndex((stock) => stock.symbol === updatedStock.symbol);
		if (index >= 0) {
			this.portfolio[index] = {
				...this.portfolio[index],
				...updatedStock
			};
			await this.savePortfolio();
			return true;
		}
		return false;
	}

	async updateStockNotes(symbol: string, notes: string): Promise<boolean> {
		const index = this.portfolio.findIndex((stock) => stock.symbol === symbol);
		if (index >= 0) {
			this.portfolio[index].notes = notes;
			await this.savePortfolio();
			return true;
		}
		return false;
	}

	hasStock(symbol: string): boolean {
		return this.portfolio.some((stock) => stock.symbol === symbol);
	}

	getStock(symbol: string): PortfolioStock | undefined {
		return this.portfolio.find((stock) => stock.symbol === symbol);
	}

	getPortfolioStats(): {
		totalStocks: number;
		positiveStocks: number;
		negativeStocks: number;
		totalValue: number;
		totalChange: number;
		totalChangePercent: number;
	} {
		const totalStocks = this.portfolio.length;
		const positiveStocks = this.portfolio.filter((stock) => stock.change >= 0).length;
		const negativeStocks = this.portfolio.filter((stock) => stock.change < 0).length;

		// Note: These calculations assume equal weight since we don't track shares
		const totalValue = this.portfolio.reduce((sum, stock) => sum + stock.price, 0);
		const totalChange = this.portfolio.reduce((sum, stock) => sum + stock.change, 0);
		const totalChangePercent =
			this.portfolio.length > 0
				? this.portfolio.reduce((sum, stock) => sum + stock.changePercent, 0) /
					this.portfolio.length
				: 0;

		return {
			totalStocks,
			positiveStocks,
			negativeStocks,
			totalValue,
			totalChange,
			totalChangePercent
		};
	}

	sortPortfolio(
		sortBy: 'symbol' | 'name' | 'price' | 'change' | 'changePercent' | 'addedDate',
		ascending: boolean = true
	): PortfolioStock[] {
		const sorted = [...this.portfolio].sort((a, b) => {
			let aValue: string | number;
			let bValue: string | number;

			switch (sortBy) {
				case 'symbol':
					aValue = a.symbol;
					bValue = b.symbol;
					break;
				case 'name':
					aValue = a.name;
					bValue = b.name;
					break;
				case 'price':
					aValue = a.price;
					bValue = b.price;
					break;
				case 'change':
					aValue = a.change;
					bValue = b.change;
					break;
				case 'changePercent':
					aValue = a.changePercent;
					bValue = b.changePercent;
					break;
				case 'addedDate':
					aValue = a.addedDate;
					bValue = b.addedDate;
					break;
				default:
					return 0;
			}

			if (typeof aValue === 'string' && typeof bValue === 'string') {
				return ascending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
			} else if (typeof aValue === 'number' && typeof bValue === 'number') {
				return ascending ? aValue - bValue : bValue - aValue;
			}
			return 0;
		});

		return sorted;
	}

	searchPortfolio(query: string): PortfolioStock[] {
		if (!query.trim()) {
			return this.getPortfolio();
		}

		const lowercaseQuery = query.toLowerCase();
		return this.portfolio.filter(
			(stock) =>
				stock.symbol.toLowerCase().includes(lowercaseQuery) ||
				stock.name.toLowerCase().includes(lowercaseQuery) ||
				(stock.notes && stock.notes.toLowerCase().includes(lowercaseQuery))
		);
	}

	async clearPortfolio(): Promise<void> {
		this.portfolio = [];
		await this.savePortfolio();
	}

	exportPortfolio(): string {
		return JSON.stringify(this.portfolio, null, 2);
	}

	async importPortfolio(jsonData: string): Promise<boolean> {
		try {
			const imported = JSON.parse(jsonData);
			if (Array.isArray(imported)) {
				this.portfolio = imported;
				await this.savePortfolio();
				return true;
			}
			return false;
		} catch (error) {
			console.warn('Failed to import portfolio:', error);
			return false;
		}
	}
}
