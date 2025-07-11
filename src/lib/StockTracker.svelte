<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	// Import our new components and utilities
	import ApiKeySetup from './stock-tracker/ApiKeySetup.svelte';
	import StockSearch from './stock-tracker/StockSearch.svelte';
	import PortfolioList from './stock-tracker/PortfolioList.svelte';
	import StockChart from './stock-tracker/StockChart.svelte';
	import { StockApiManager } from './stock-tracker/StockApiManager';
	import { PortfolioManager } from './stock-tracker/PortfolioManager';
	import type { StockSearchResult, ChartPoint } from './stock-tracker/StockApiManager';
	import type { PortfolioStock } from './stock-tracker/PortfolioManager';

	// Component state
	let view: 'portfolio' | 'search' | 'stock' = 'portfolio';
	let selectedStock: PortfolioStock | null = null;
	let stockChart: ChartPoint[] = [];
	let chartLoading: boolean = false;
	let chartError: string = '';
	let selectedTimeWindow: string = '1m';

	// Search state
	let searchQuery: string = '';
	let searchResults: StockSearchResult[] = [];
	let isSearching: boolean = false;
	let searchError: string = '';
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	// Portfolio state
	let portfolio: PortfolioStock[] = [];
	let isRefreshing: boolean = false;

	// API Key state
	let showApiKeyPrompt: boolean = false;
	let apiKeyInput: string = '';
	let apiKeyError: string = '';
	let isValidatingApiKey: boolean = false;

	// Manager instances
	const apiManager = StockApiManager.getInstance();
	const portfolioManager = PortfolioManager.getInstance();
	let priceRefreshInterval: ReturnType<typeof setInterval> | undefined;

	onMount(async () => {
		// Load initial data
		portfolio = portfolioManager.getPortfolio();

		// Check if API key is available
		if (!apiManager.hasApiKey()) {
			showApiKeyPrompt = true;
		} else {
			await refreshPortfolio();
			startPriceRefresh();
		}

		// Load from URL params
		loadFromUrl();
	});

	onDestroy(() => {
		if (priceRefreshInterval) {
			clearInterval(priceRefreshInterval);
		}
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
	});

	// URL management
	function updateUrl() {
		if (typeof window === 'undefined') return;

		const params = new URLSearchParams($page.url.searchParams);

		if (selectedStock) {
			params.set('stock', selectedStock.symbol);
		} else {
			params.delete('stock');
		}

		goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
	}

	function loadFromUrl() {
		const stockSymbol = $page.url.searchParams.get('stock');
		if (stockSymbol) {
			const stock = portfolioManager.getStock(stockSymbol);
			if (stock) {
				handleSelectStock(stock);
			}
		}
	}

	// API Key management
	async function handleApiKeySubmit(key: string) {
		isValidatingApiKey = true;
		apiKeyError = '';

		try {
			const isValid = await apiManager.validateApiKey(key);
			if (isValid) {
				apiManager.setApiKey(key);
				showApiKeyPrompt = false;
				apiKeyInput = '';
				await refreshPortfolio();
				startPriceRefresh();
			} else {
				apiKeyError = 'Invalid API key. Please check your key and try again.';
			}
		} catch (_error) {
			apiKeyError = 'Failed to validate API key. Please try again.';
		} finally {
			isValidatingApiKey = false;
		}
	}

	function handleApiKeyCancel() {
		showApiKeyPrompt = false;
		apiKeyInput = '';
		apiKeyError =
			'API key is required to use the Stock Tracker. Click "Setup API Key" to try again.';
	}

	function handleApiKeyClose() {
		showApiKeyPrompt = false;
	}

	function showApiKeySetup() {
		showApiKeyPrompt = true;
		apiKeyError = '';
		apiKeyInput = '';
	}

	// Stock search
	async function handleSearch(query: string) {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		searchTimeout = setTimeout(async () => {
			isSearching = true;
			searchError = '';

			try {
				searchResults = await apiManager.searchStocks(query);
			} catch (error) {
				searchError = (error as Error).message;
				searchResults = [];
			} finally {
				isSearching = false;
			}
		}, 500);
	}

	function handleSearchClear() {
		searchResults = [];
		searchError = '';
	}

	async function handleStockSelect(searchResult: StockSearchResult) {
		try {
			// Add to portfolio
			portfolioManager.addStock(searchResult);
			portfolio = portfolioManager.getPortfolio();

			// Get current quote
			const quote = await apiManager.getStockQuote(searchResult.symbol);
			portfolioManager.updateStock(quote);
			portfolio = portfolioManager.getPortfolio();

			// Switch to portfolio view
			view = 'portfolio';

			// Clear search
			searchQuery = '';
			searchResults = [];
		} catch (error) {
			console.error('Failed to add stock:', error);
		}
	}

	// Portfolio management
	async function refreshPortfolio() {
		if (!apiManager.hasApiKey()) return;

		isRefreshing = true;
		const currentPortfolio = portfolioManager.getPortfolio();

		for (const stock of currentPortfolio) {
			try {
				const quote = await apiManager.getStockQuote(stock.symbol);
				portfolioManager.updateStock(quote);
			} catch (error) {
				console.warn(`Failed to refresh ${stock.symbol}:`, error);
			}
		}

		portfolio = portfolioManager.getPortfolio();
		isRefreshing = false;
	}

	async function refreshSingleStock(symbol: string) {
		try {
			const quote = await apiManager.getStockQuote(symbol);
			portfolioManager.updateStock(quote);
			portfolio = portfolioManager.getPortfolio();

			// Update selected stock if it's the same
			if (selectedStock && selectedStock.symbol === symbol) {
				selectedStock = portfolioManager.getStock(symbol) || selectedStock;
			}
		} catch (error) {
			console.warn(`Failed to refresh ${symbol}:`, error);
		}
	}

	function handleRemoveStock(symbol: string) {
		portfolioManager.removeStock(symbol);
		portfolio = portfolioManager.getPortfolio();

		// If we're viewing the removed stock, go back to portfolio
		if (selectedStock && selectedStock.symbol === symbol) {
			selectedStock = null;
			view = 'portfolio';
			updateUrl();
		}
	}

	function handleSelectStock(stock: PortfolioStock) {
		selectedStock = stock;
		view = 'stock';
		updateUrl();
		loadChartData();
	}

	function startPriceRefresh() {
		if (priceRefreshInterval) {
			clearInterval(priceRefreshInterval);
		}
		// Refresh prices every 60 seconds
		priceRefreshInterval = setInterval(refreshPortfolio, 60000);
	}

	// Chart management
	async function loadChartData() {
		if (!selectedStock || !apiManager.hasApiKey()) return;

		chartLoading = true;
		chartError = '';

		try {
			const timeWindow = apiManager.getTimeWindows().find((tw) => tw.id === selectedTimeWindow);
			if (!timeWindow) return;

			stockChart = await apiManager.getChartData(selectedStock.symbol, timeWindow);
		} catch (error) {
			chartError = (error as Error).message;
			stockChart = [];
		} finally {
			chartLoading = false;
		}
	}

	function handleTimeWindowChanged(windowId: string) {
		selectedTimeWindow = windowId;
		loadChartData();
	}

	function handleChartRefresh() {
		loadChartData();
	}

	// Navigation
	function goBackToPortfolio() {
		selectedStock = null;
		view = 'portfolio';
		updateUrl();
	}

	function goToSearch() {
		view = 'search';
	}

	function goToPortfolio() {
		view = 'portfolio';
	}

	// Reactive updates
	$: if (typeof window !== 'undefined' && selectedStock) {
		updateUrl();
	}
</script>

<div class="mx-auto max-w-6xl space-y-6 p-4">
	<!-- API Key Setup Modal -->
	<ApiKeySetup
		bind:showModal={showApiKeyPrompt}
		bind:apiKeyInput
		bind:apiKeyError
		bind:isValidating={isValidatingApiKey}
		on:submit={(e) => handleApiKeySubmit(e.detail)}
		on:cancel={handleApiKeyCancel}
		on:close={handleApiKeyClose}
	/>

	<!-- API Status Indicator -->
	<div class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
		<div class="flex items-center space-x-2">
			<svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM12 9v2"
				></path>
			</svg>
			<span class="text-sm font-medium text-blue-800">Uses External API</span>
		</div>
		<div class="text-xs text-blue-600">
			Real-time stock data from Alpha Vantage
			{#if !apiManager.hasApiKey()}
				<button on:click={showApiKeySetup} class="ml-2 text-blue-600 underline hover:text-blue-800">
					Setup API Key
				</button>
			{/if}
		</div>
	</div>

	<!-- API Key Error Message -->
	{#if apiKeyError && !showApiKeyPrompt}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-2">
					<svg class="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<span class="text-red-800">{apiKeyError}</span>
				</div>
				<button
					on:click={showApiKeySetup}
					class="text-sm text-red-600 underline hover:text-red-800"
				>
					Setup API Key
				</button>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	{#if view === 'search'}
		<!-- Stock Search View -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-gray-800">Stock Search</h1>
			<button
				on:click={goToPortfolio}
				class="flex items-center space-x-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 19l-7-7m0 0l7-7m-7 7h18"
					></path>
				</svg>
				<span>Back to Portfolio</span>
			</button>
		</div>

		<StockSearch
			bind:searchQuery
			bind:searchResults
			bind:isSearching
			bind:searchError
			on:search={(e) => handleSearch(e.detail)}
			on:select={(e) => handleStockSelect(e.detail)}
			on:clear={handleSearchClear}
		/>
	{:else if view === 'stock' && selectedStock}
		<!-- Stock Detail View -->
		<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<button
				on:click={goBackToPortfolio}
				class="flex items-center space-x-2 self-start rounded border border-gray-200 px-3 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800 sm:self-auto"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 19l-7-7m0 0l7-7m-7 7h18"
					></path>
				</svg>
				<span>Back to Portfolio</span>
			</button>
		</div>

		<!-- Stock Info -->
		<div class="mb-6 rounded-xl border border-gray-200 bg-white p-6">
			<div class="mb-4 flex items-start justify-between">
				<div>
					<h3 class="text-2xl font-bold text-gray-800">{selectedStock.symbol}</h3>
					<p class="text-gray-600">{selectedStock.name}</p>
				</div>
				<div class="text-right">
					{#if selectedStock.price > 0}
						<div class="text-3xl font-bold text-gray-800">
							{new Intl.NumberFormat('en-US', {
								style: 'currency',
								currency: 'USD'
							}).format(selectedStock.price)}
						</div>
						<div class="text-lg {selectedStock.change >= 0 ? 'text-green-600' : 'text-red-600'}">
							{selectedStock.change >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', {
								style: 'currency',
								currency: 'USD'
							}).format(selectedStock.change)}
							({selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent.toFixed(
								2
							)}%)
						</div>
						<div class="mt-1 text-sm text-gray-500">
							Last updated: {selectedStock.lastUpdate}
						</div>
					{:else}
						<div class="text-gray-400">Loading price...</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Stock Chart -->
		<StockChart
			chartData={stockChart}
			timeWindows={apiManager.getTimeWindows()}
			bind:selectedTimeWindow
			bind:loading={chartLoading}
			bind:error={chartError}
			symbol={selectedStock.symbol}
			on:timeWindowChanged={(e) => handleTimeWindowChanged(e.detail)}
			on:refresh={handleChartRefresh}
		/>
	{:else}
		<!-- Portfolio View -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-gray-800">Stock Tracker</h1>
			<button
				on:click={goToSearch}
				class="flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					></path>
				</svg>
				<span>Search Stocks</span>
			</button>
		</div>

		<PortfolioList
			bind:portfolio
			bind:isRefreshing
			on:selectStock={(e) => handleSelectStock(e.detail)}
			on:removeStock={(e) => handleRemoveStock(e.detail)}
			on:refreshPortfolio={refreshPortfolio}
			on:refreshStock={(e) => refreshSingleStock(e.detail)}
		/>
	{/if}
</div>
