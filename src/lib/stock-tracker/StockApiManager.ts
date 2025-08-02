export interface StockQuote {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	lastUpdate: string;
}

export interface StockSearchResult {
	symbol: string;
	name: string;
	type: string;
	region: string;
	currency: string;
}

export interface ChartPoint {
	date: string;
	fullDate: string;
	price: number;
	high: number;
	low: number;
	volume: number;
}

export interface TimeWindow {
	id: string;
	label: string;
	function: string;
	interval?: string;
	days: number;
}

import { StorageFactory } from '../storage-api';

export class StockApiManager {
	private static instance: StockApiManager;
	private apiKey: string = '';
	private readonly baseUrl = 'https://www.alphavantage.co/query';
	private readonly uiSettingsStorage = StorageFactory.createUISettingsStorage();

	static getInstance(): StockApiManager {
		if (!StockApiManager.instance) {
			StockApiManager.instance = new StockApiManager();
		}
		return StockApiManager.instance;
	}

	constructor() {
		// API key will be loaded explicitly by calling loadApiKey()
	}

	async loadApiKey(): Promise<void> {
		try {
			const saved = await this.uiSettingsStorage.getStockApiKey();
			if (saved) {
				this.apiKey = saved;
			}
		} catch (error) {
			console.warn('Failed to load API key from storage:', error);
		}
	}

	async setApiKey(key: string): Promise<void> {
		this.apiKey = key.trim();
		try {
			await this.uiSettingsStorage.setStockApiKey(this.apiKey);
		} catch (error) {
			console.warn('Failed to save API key to storage:', error);
		}
	}

	getApiKey(): string {
		return this.apiKey;
	}

	hasApiKey(): boolean {
		return this.apiKey.length > 0;
	}

	async clearApiKey(): Promise<void> {
		this.apiKey = '';
		try {
			await this.uiSettingsStorage.removeStockApiKey();
		} catch (error) {
			console.warn('Failed to remove API key from storage:', error);
		}
	}

	async searchStocks(query: string): Promise<StockSearchResult[]> {
		if (!this.hasApiKey()) {
			throw new Error('API key not configured');
		}

		if (!query.trim()) {
			return [];
		}

		const url = `${this.baseUrl}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${this.apiKey}`;

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`API Error: ${response.status}`);
		}

		const data = await response.json();

		if (data['Error Message']) {
			throw new Error(data['Error Message']);
		}

		if (data['Note']) {
			throw new Error('API rate limit exceeded. Please try again later.');
		}

		const matches = data['bestMatches'] || [];
		return matches.map((match: any) => ({
			symbol: match['1. symbol'],
			name: match['2. name'],
			type: match['3. type'],
			region: match['4. region'],
			currency: match['8. currency']
		}));
	}

	async getStockQuote(symbol: string): Promise<StockQuote> {
		if (!this.hasApiKey()) {
			throw new Error('API key not configured');
		}

		const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`API Error: ${response.status}`);
		}

		const data = await response.json();

		if (data['Error Message']) {
			throw new Error(data['Error Message']);
		}

		if (data['Note']) {
			throw new Error('API rate limit exceeded. Please try again later.');
		}

		const quote = data['Global Quote'];
		if (!quote) {
			throw new Error('No quote data available');
		}

		const price = parseFloat(quote['05. price']);
		const change = parseFloat(quote['09. change']);
		const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

		return {
			symbol: quote['01. symbol'],
			name: symbol, // API doesn't provide name in quote, use symbol
			price,
			change,
			changePercent,
			lastUpdate: new Date(quote['07. latest trading day']).toLocaleString()
		};
	}

	async getChartData(symbol: string, timeWindow: TimeWindow): Promise<ChartPoint[]> {
		if (!this.hasApiKey()) {
			throw new Error('API key not configured');
		}

		let url = `${this.baseUrl}?function=${timeWindow.function}&symbol=${symbol}&apikey=${this.apiKey}`;

		if (timeWindow.interval) {
			url += `&interval=${timeWindow.interval}`;
		}

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`API Error: ${response.status}`);
		}

		const data = await response.json();

		if (data['Error Message']) {
			throw new Error(data['Error Message']);
		}

		if (data['Note']) {
			throw new Error('API rate limit exceeded. Please try again later.');
		}

		// Extract time series data based on function type
		let timeSeries: Record<string, Record<string, string>> | undefined;
		if (timeWindow.function === 'TIME_SERIES_INTRADAY') {
			const intervalKey = `Time Series (${timeWindow.interval})`;
			timeSeries = data[intervalKey];
		} else {
			timeSeries = data['Time Series (Daily)'];
		}

		if (!timeSeries) {
			throw new Error('No chart data available');
		}

		// Convert to chart format and limit by days
		const chartData: ChartPoint[] = Object.entries(timeSeries)
			.slice(0, timeWindow.days * (timeWindow.interval ? 8 : 1)) // Rough estimate for intraday points
			.reverse()
			.map(([date, values]) => ({
				date: timeWindow.interval ? date.split(' ')[1] || date.split(' ')[0] : date,
				fullDate: date,
				price: parseFloat(values['4. close']),
				high: parseFloat(values['2. high']),
				low: parseFloat(values['3. low']),
				volume: parseInt(values['5. volume'])
			}));

		return chartData;
	}

	async validateApiKey(key: string): Promise<boolean> {
		try {
			const testUrl = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${key}`;
			const response = await fetch(testUrl);

			if (!response.ok) {
				return false;
			}

			const data = await response.json();

			// Check if the key is valid (no error message and has data)
			return !data['Error Message'] && !data['Note'] && data['Global Quote'];
		} catch (error) {
			console.warn('API key validation failed:', error);
			return false;
		}
	}

	getTimeWindows(): TimeWindow[] {
		return [
			{ id: '1d', label: '1D', function: 'TIME_SERIES_INTRADAY', interval: '5min', days: 1 },
			{ id: '5d', label: '5D', function: 'TIME_SERIES_DAILY', days: 5 },
			{ id: '1m', label: '1M', function: 'TIME_SERIES_DAILY', days: 30 },
			{ id: '3m', label: '3M', function: 'TIME_SERIES_DAILY', days: 90 },
			{ id: '6m', label: '6M', function: 'TIME_SERIES_DAILY', days: 180 },
			{ id: '1y', label: '1Y', function: 'TIME_SERIES_DAILY', days: 365 }
		];
	}
}
