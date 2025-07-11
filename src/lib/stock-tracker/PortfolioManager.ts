import type { StockQuote, StockSearchResult } from './StockApiManager';

export interface PortfolioStock extends StockQuote {
	addedDate: string;
	notes?: string;
}

export class PortfolioManager {
	private static instance: PortfolioManager;
	private readonly storageKey = 'stockTrackerPortfolio';
	private portfolio: PortfolioStock[] = [];

	static getInstance(): PortfolioManager {
		if (!PortfolioManager.instance) {
			PortfolioManager.instance = new PortfolioManager();
		}
		return PortfolioManager.instance;
	}

	constructor() {
		this.loadPortfolio();
	}

	private loadPortfolio(): void {
		try {
			const saved = localStorage.getItem(this.storageKey);
			if (saved) {
				this.portfolio = JSON.parse(saved);
			}
		} catch (error) {
			console.warn('Failed to load portfolio from localStorage:', error);
			this.portfolio = [];
		}
	}

	private savePortfolio(): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(this.portfolio));
		} catch (error) {
			console.warn('Failed to save portfolio to localStorage:', error);
		}
	}

	getPortfolio(): PortfolioStock[] {
		return [...this.portfolio];
	}

	addStock(searchResult: StockSearchResult): PortfolioStock {
		// Check if stock already exists
		const existingIndex = this.portfolio.findIndex(stock => stock.symbol === searchResult.symbol);
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
		this.savePortfolio();
		return newStock;
	}

	removeStock(symbol: string): boolean {
		const initialLength = this.portfolio.length;
		this.portfolio = this.portfolio.filter(stock => stock.symbol !== symbol);
		
		if (this.portfolio.length !== initialLength) {
			this.savePortfolio();
			return true;
		}
		return false;
	}

	updateStock(updatedStock: StockQuote): boolean {
		const index = this.portfolio.findIndex(stock => stock.symbol === updatedStock.symbol);
		if (index >= 0) {
			this.portfolio[index] = {
				...this.portfolio[index],
				...updatedStock
			};
			this.savePortfolio();
			return true;
		}
		return false;
	}

	updateStockNotes(symbol: string, notes: string): boolean {
		const index = this.portfolio.findIndex(stock => stock.symbol === symbol);
		if (index >= 0) {
			this.portfolio[index].notes = notes;
			this.savePortfolio();
			return true;
		}
		return false;
	}

	hasStock(symbol: string): boolean {
		return this.portfolio.some(stock => stock.symbol === symbol);
	}

	getStock(symbol: string): PortfolioStock | undefined {
		return this.portfolio.find(stock => stock.symbol === symbol);
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
		const positiveStocks = this.portfolio.filter(stock => stock.change >= 0).length;
		const negativeStocks = this.portfolio.filter(stock => stock.change < 0).length;
		
		// Note: These calculations assume equal weight since we don't track shares
		const totalValue = this.portfolio.reduce((sum, stock) => sum + stock.price, 0);
		const totalChange = this.portfolio.reduce((sum, stock) => sum + stock.change, 0);
		const totalChangePercent = this.portfolio.length > 0 
			? this.portfolio.reduce((sum, stock) => sum + stock.changePercent, 0) / this.portfolio.length
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

	sortPortfolio(sortBy: 'symbol' | 'name' | 'price' | 'change' | 'changePercent' | 'addedDate', ascending: boolean = true): PortfolioStock[] {
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
		return this.portfolio.filter(stock => 
			stock.symbol.toLowerCase().includes(lowercaseQuery) ||
			stock.name.toLowerCase().includes(lowercaseQuery) ||
			(stock.notes && stock.notes.toLowerCase().includes(lowercaseQuery))
		);
	}

	clearPortfolio(): void {
		this.portfolio = [];
		this.savePortfolio();
	}

	exportPortfolio(): string {
		return JSON.stringify(this.portfolio, null, 2);
	}

	importPortfolio(jsonData: string): boolean {
		try {
			const imported = JSON.parse(jsonData);
			if (Array.isArray(imported)) {
				this.portfolio = imported;
				this.savePortfolio();
				return true;
			}
			return false;
		} catch (error) {
			console.warn('Failed to import portfolio:', error);
			return false;
		}
	}
} 