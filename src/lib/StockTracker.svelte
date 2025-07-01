<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	
	let searchQuery = '';
	let searchResults = [];
	let pinnedStocks = [];
	let selectedStock = null;
	let stockChart = null;
	let loading = false;
	let error = '';
	let priceRefreshInterval;
	let searchTimeout;
	let apiKey = '';
	let showApiKeyPrompt = false;
	let apiKeyInput = '';
	let apiKeyError = '';
	let selectedTimeWindow = '1M';
	
	// Using Alpha Vantage API (free tier allows 5 API requests per minute)
	const BASE_URL = 'https://www.alphavantage.co/query';
	
	// Time window options
	const timeWindows = [
		{ id: '1D', label: '1 Day', function: 'TIME_SERIES_INTRADAY', interval: '60min', days: 1 },
		{ id: '5D', label: '5 Days', function: 'TIME_SERIES_INTRADAY', interval: '60min', days: 5 },
		{ id: '1M', label: '1 Month', function: 'TIME_SERIES_DAILY', days: 30 },
		{ id: '3M', label: '3 Months', function: 'TIME_SERIES_DAILY', days: 90 },
		{ id: '6M', label: '6 Months', function: 'TIME_SERIES_DAILY', days: 180 },
		{ id: '1Y', label: '1 Year', function: 'TIME_SERIES_DAILY', days: 365 }
	];
	
	onMount(() => {
		loadApiKey();
		loadPinnedStocks();
		if (apiKey) {
			refreshPinnedPrices();
			// Refresh prices every 60 seconds
			priceRefreshInterval = setInterval(refreshPinnedPrices, 60000);
		}
	});
	
	onDestroy(() => {
		if (priceRefreshInterval) {
			clearInterval(priceRefreshInterval);
		}
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
	});
	
	function loadApiKey() {
		try {
			const stored = localStorage.getItem('stockTracker_apiKey');
			if (stored) {
				apiKey = stored;
			} else {
				showApiKeyPrompt = true;
			}
		} catch (err) {
			console.warn('Failed to load API key:', err);
			showApiKeyPrompt = true;
		}
	}
	
	function saveApiKey() {
		try {
			localStorage.setItem('stockTracker_apiKey', apiKey);
		} catch (err) {
			console.warn('Failed to save API key:', err);
		}
	}
	
	function handleApiKeySubmit() {
		apiKeyError = '';
		
		if (!apiKeyInput.trim()) {
			apiKeyError = 'Please enter a valid API key';
			return;
		}
		
		apiKey = apiKeyInput.trim();
		saveApiKey();
		showApiKeyPrompt = false;
		apiKeyInput = '';
		
		// Start refreshing prices now that we have an API key
		refreshPinnedPrices();
		if (priceRefreshInterval) {
			clearInterval(priceRefreshInterval);
		}
		priceRefreshInterval = setInterval(refreshPinnedPrices, 60000);
	}
	
	function handleApiKeyCancel() {
		showApiKeyPrompt = false;
		apiKeyInput = '';
		apiKeyError = 'API key is required to use the Stock Tracker. Click "Setup API Key" to try again.';
	}
	
	function showApiKeySetup() {
		showApiKeyPrompt = true;
		apiKeyError = '';
		apiKeyInput = '';
	}
	
	function loadPinnedStocks() {
		try {
			const stored = localStorage.getItem('pinnedStocks');
			if (stored) {
				pinnedStocks = JSON.parse(stored);
			}
		} catch (err) {
			console.warn('Failed to load pinned stocks:', err);
		}
	}
	
	function savePinnedStocks() {
		try {
			localStorage.setItem('pinnedStocks', JSON.stringify(pinnedStocks));
		} catch (err) {
			console.warn('Failed to save pinned stocks:', err);
		}
	}
	
	async function searchStocks() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}
		
		if (!apiKey) {
			error = 'API key required. Please setup your API key first.';
			return;
		}
		
		loading = true;
		error = '';
		
		try {
			// Using Alpha Vantage Symbol Search
			const response = await fetch(`${BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(searchQuery)}&apikey=${apiKey}`);
			
			if (!response.ok) {
				throw new Error(`API Error: ${response.status}`);
			}
			
			const data = await response.json();
			
			if (data['Error Message']) {
				throw new Error(data['Error Message']);
			}
			
			if (data['Note']) {
				throw new Error('API rate limit exceeded. Please wait a moment.');
			}
			
			searchResults = data.bestMatches?.slice(0, 10) || [];
		} catch (err) {
			error = err.message || 'Failed to search stocks';
			searchResults = [];
		} finally {
			loading = false;
		}
	}
	
	async function getStockQuote(symbol) {
		if (!apiKey) {
			return null;
		}
		
		try {
			const response = await fetch(`${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
			
			if (!response.ok) {
				throw new Error(`API Error: ${response.status}`);
			}
			
			const data = await response.json();
			
			if (data['Error Message']) {
				throw new Error(data['Error Message']);
			}
			
			if (data['Note']) {
				throw new Error('API rate limit exceeded');
			}
			
			const quote = data['Global Quote'];
			if (!quote) {
				throw new Error('No quote data available');
			}
			
			return {
				symbol: quote['01. symbol'],
				price: parseFloat(quote['05. price']),
				change: parseFloat(quote['09. change']),
				changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
				lastUpdate: quote['07. latest trading day']
			};
		} catch (err) {
			console.error(`Failed to get quote for ${symbol}:`, err);
			return null;
		}
	}
	
	async function refreshPinnedPrices() {
		for (let i = 0; i < pinnedStocks.length; i++) {
			const stock = pinnedStocks[i];
			const quote = await getStockQuote(stock.symbol);
			if (quote) {
				pinnedStocks[i] = { ...stock, ...quote };
			}
			// Small delay to avoid hitting rate limits
			await new Promise(resolve => setTimeout(resolve, 500));
		}
		pinnedStocks = [...pinnedStocks]; // Trigger reactivity
		savePinnedStocks();
	}
	
	function pinStock(stockInfo) {
		const symbol = stockInfo['1. symbol'];
		const name = stockInfo['2. name'];
		
		// Check if already pinned
		if (pinnedStocks.some(stock => stock.symbol === symbol)) {
			return;
		}
		
		const newStock = {
			symbol: symbol,
			name: name,
			price: 0,
			change: 0,
			changePercent: 0,
			lastUpdate: ''
		};
		
		pinnedStocks = [...pinnedStocks, newStock];
		savePinnedStocks();
		
		// Get initial quote
		getStockQuote(symbol).then(quote => {
			if (quote) {
				const index = pinnedStocks.findIndex(s => s.symbol === symbol);
				if (index !== -1) {
					pinnedStocks[index] = { ...pinnedStocks[index], ...quote };
					pinnedStocks = [...pinnedStocks];
					savePinnedStocks();
				}
			}
		});
		
		// Clear search
		searchQuery = '';
		searchResults = [];
	}
	
	function unpinStock(symbol) {
		pinnedStocks = pinnedStocks.filter(stock => stock.symbol !== symbol);
		savePinnedStocks();
		if (selectedStock?.symbol === symbol) {
			selectedStock = null;
		}
	}
	
	async function selectStock(stock) {
		selectedStock = stock;
		await loadChartData();
	}
	
	async function loadChartData() {
		if (!selectedStock) return;
		
		loading = true;
		error = '';
		
		if (!apiKey) {
			error = 'API key required. Please setup your API key first.';
			loading = false;
			return;
		}
		
		try {
			const timeWindow = timeWindows.find(tw => tw.id === selectedTimeWindow);
			if (!timeWindow) {
				throw new Error('Invalid time window selected');
			}
			
			let url = `${BASE_URL}?function=${timeWindow.function}&symbol=${selectedStock.symbol}&apikey=${apiKey}`;
			
			// Add interval for intraday data
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
				throw new Error('API rate limit exceeded');
			}
			
			// Extract time series data based on function type
			let timeSeries;
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
			const chartData = Object.entries(timeSeries)
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
			
			stockChart = chartData;
		} catch (err) {
			error = err.message || 'Failed to load chart data';
			stockChart = null;
		} finally {
			loading = false;
		}
	}
	
	function changeTimeWindow(windowId) {
		selectedTimeWindow = windowId;
		if (selectedStock) {
			loadChartData();
		}
	}
	
	function formatCurrency(value) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	}
	
	function formatPercent(value) {
		const sign = value >= 0 ? '+' : '';
		return `${sign}${value.toFixed(2)}%`;
	}
	
	// Debounced search
	$: if (searchQuery) {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		searchTimeout = setTimeout(searchStocks, 500);
	} else {
		searchResults = [];
	}
</script>

<div class="space-y-6">
	<!-- API Key Prompt Modal -->
	{#if showApiKeyPrompt}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
				<h3 class="text-xl font-bold text-gray-800 mb-4">Setup Alpha Vantage API Key</h3>
				<p class="text-gray-600 mb-4">
					To use the Stock Tracker, you need a free API key from Alpha Vantage.
				</p>
				
				<div class="space-y-4">
					<div>
						<a
							href="https://www.alphavantage.co/support/#api-key"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm"
						>
							<span>Get your free API key here</span>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
							</svg>
						</a>
					</div>
					
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Enter your API key:
						</label>
						<input
							type="text"
							bind:value={apiKeyInput}
							placeholder="Your Alpha Vantage API key"
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
					
					{#if apiKeyError}
						<div class="text-red-600 text-sm">{apiKeyError}</div>
					{/if}
					
					<div class="flex space-x-3">
						<button
							on:click={handleApiKeySubmit}
							class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
						>
							Save API Key
						</button>
						<button
							on:click={handleApiKeyCancel}
							class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- API Indicator -->
	<div class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
		<div class="flex items-center space-x-2">
			<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM12 9v2"></path>
			</svg>
			<span class="text-sm text-blue-800 font-medium">Uses External API</span>
		</div>
		<div class="text-xs text-blue-600">
			Real-time stock data from Alpha Vantage
			{#if !apiKey}
				<button
					on:click={showApiKeySetup}
					class="ml-2 text-blue-600 hover:text-blue-800 underline"
				>
					Setup API Key
				</button>
			{/if}
		</div>
	</div>

	<!-- API Key Error Message -->
	{#if apiKeyError && !showApiKeyPrompt}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-2">
					<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<span class="text-red-800">{apiKeyError}</span>
				</div>
				<button
					on:click={showApiKeySetup}
					class="text-red-600 hover:text-red-800 text-sm underline"
				>
					Setup API Key
				</button>
			</div>
		</div>
	{/if}

	{#if !selectedStock}
		<!-- Stock Search -->
		<div class="bg-white rounded-xl border border-gray-200 p-6">
			<h3 class="text-lg font-semibold text-gray-800 mb-4">Search & Pin Stocks</h3>
			
			<div class="space-y-4">
				<div class="relative">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search for stocks (e.g., AAPL, Tesla, Microsoft)..."
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
					{#if loading}
						<div class="absolute right-3 top-3">
							<svg class="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
					{/if}
				</div>
				
				{#if error}
					<div class="bg-red-50 border border-red-200 rounded-lg p-3">
						<div class="flex items-center space-x-2">
							<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							<span class="text-sm text-red-800">{error}</span>
						</div>
					</div>
				{/if}
				
				{#if searchResults.length > 0}
					<div class="space-y-2 max-h-60 overflow-y-auto">
						{#each searchResults as stock}
							<button
								on:click={() => pinStock(stock)}
								class="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
								disabled={pinnedStocks.some(s => s.symbol === stock['1. symbol'])}
							>
								<div class="flex justify-between items-center">
									<div>
										<div class="font-semibold text-gray-800">{stock['1. symbol']}</div>
										<div class="text-sm text-gray-600">{stock['2. name']}</div>
									</div>
									{#if pinnedStocks.some(s => s.symbol === stock['1. symbol'])}
										<span class="text-green-600 text-sm">✓ Pinned</span>
									{:else}
										<span class="text-blue-600 text-sm">+ Pin</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Pinned Stocks -->
		<div class="bg-white rounded-xl border border-gray-200 p-6">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-lg font-semibold text-gray-800">Pinned Stocks</h3>
				{#if pinnedStocks.length > 0}
					<button
						on:click={refreshPinnedPrices}
						class="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
						</svg>
						<span>Refresh</span>
					</button>
				{/if}
			</div>
			
			{#if pinnedStocks.length === 0}
				<div class="text-center py-8">
					<svg class="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
					</svg>
					<p class="text-gray-500">No stocks pinned yet</p>
					<p class="text-sm text-gray-400">Search and pin stocks to track their prices</p>
				</div>
			{:else}
				<div class="grid gap-4">
					{#each pinnedStocks as stock}
						<div
							class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
							on:click={() => selectStock(stock)}
						>
							<div class="flex justify-between items-center">
								<div class="flex-1">
									<div class="flex items-center space-x-3">
										<div>
											<div class="font-semibold text-gray-800">{stock.symbol}</div>
											<div class="text-sm text-gray-600">{stock.name}</div>
										</div>
									</div>
									{#if stock.lastUpdate}
										<div class="text-xs text-gray-400 mt-1">
											Updated: {stock.lastUpdate}
										</div>
									{/if}
								</div>
								
								<div class="text-right">
									{#if stock.price > 0}
										<div class="text-lg font-semibold text-gray-800">
											{formatCurrency(stock.price)}
										</div>
										<div class="text-sm {stock.change >= 0 ? 'text-green-600' : 'text-red-600'}">
											{stock.change >= 0 ? '+' : ''}{formatCurrency(stock.change)}
											({formatPercent(stock.changePercent)})
										</div>
									{:else}
										<div class="text-gray-400">Loading...</div>
									{/if}
								</div>
								
								<button
									on:click|stopPropagation={() => unpinStock(stock.symbol)}
									class="ml-4 p-1 text-gray-400 hover:text-red-600 transition-colors"
									title="Unpin stock"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Stock Details & Chart -->
		<div class="space-y-6">
			<!-- Header -->
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<button
					on:click={() => { selectedStock = null; stockChart = null; }}
					class="flex items-center space-x-2 text-blue-600 hover:text-blue-800 self-start"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
					</svg>
					<span>Back to Portfolio</span>
				</button>
				
				<button
					on:click={loadChartData}
					class="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors self-start sm:self-auto"
				>
					Refresh Chart
				</button>
			</div>
			
			<!-- Stock Info -->
			<div class="bg-white rounded-xl border border-gray-200 p-6">
				<div class="flex justify-between items-start mb-4">
					<div>
						<h3 class="text-2xl font-bold text-gray-800">{selectedStock.symbol}</h3>
						<p class="text-gray-600">{selectedStock.name}</p>
					</div>
					<div class="text-right">
						{#if selectedStock.price > 0}
							<div class="text-3xl font-bold text-gray-800">
								{formatCurrency(selectedStock.price)}
							</div>
							<div class="text-lg {selectedStock.change >= 0 ? 'text-green-600' : 'text-red-600'}">
								{selectedStock.change >= 0 ? '+' : ''}{formatCurrency(selectedStock.change)}
								({formatPercent(selectedStock.changePercent)})
							</div>
							<div class="text-sm text-gray-500 mt-1">
								Last updated: {selectedStock.lastUpdate}
							</div>
						{:else}
							<div class="text-gray-400">Loading price...</div>
						{/if}
					</div>
				</div>
			</div>
			
			<!-- Chart -->
			<div class="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
					<h4 class="text-lg font-semibold text-gray-800 mb-4 sm:mb-0">Price Chart</h4>
					
					<!-- Time Window Selector -->
					<div class="flex flex-wrap gap-2">
						{#each timeWindows as timeWindow}
							<button
								on:click={() => changeTimeWindow(timeWindow.id)}
								class="px-3 py-1 text-sm rounded-lg transition-colors {
									selectedTimeWindow === timeWindow.id 
										? 'bg-blue-600 text-white' 
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
								}"
							>
								{timeWindow.label}
							</button>
						{/each}
					</div>
				</div>
				
				{#if loading}
					<div class="flex items-center justify-center py-12">
						<svg class="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
				{:else if error}
					<div class="text-center py-12">
						<svg class="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
						<p class="text-red-600 font-medium">Failed to load chart</p>
						<p class="text-sm text-red-500">{error}</p>
						<button
							on:click={loadChartData}
							class="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Retry
						</button>
					</div>
				{:else if stockChart && stockChart.length > 0}
					<!-- Responsive chart visualization -->
					<div class="space-y-6">
						<!-- Chart Container -->
						<div class="w-full overflow-x-auto">
							<div class="min-w-full h-64 sm:h-80 lg:h-96 border border-gray-200 rounded-lg p-2 sm:p-4 bg-gradient-to-b from-blue-50 to-gray-50">
								<div class="flex items-end justify-between h-full gap-1">
									{#each stockChart as point, i}
										{@const minPrice = Math.min(...stockChart.map(p => p.price))}
										{@const maxPrice = Math.max(...stockChart.map(p => p.price))}
										{@const height = stockChart.length > 1 ? ((point.price - minPrice) / (maxPrice - minPrice)) * 85 + 10 : 50}
										{@const isPositive = i === 0 || point.price >= stockChart[i-1]?.price}
										<div
											class="transition-all duration-300 hover:opacity-80 cursor-pointer relative group rounded-t-sm {
												isPositive ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
											}"
											style="height: {height}%; flex: 1; min-width: {stockChart.length > 50 ? '3px' : '8px'}; max-width: 20px;"
										>
											<!-- Tooltip -->
											<div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
												<div class="font-semibold">{point.fullDate || point.date}</div>
												<div class="text-green-300">Close: {formatCurrency(point.price)}</div>
												<div class="text-blue-300">High: {formatCurrency(point.high)}</div>
												<div class="text-red-300">Low: {formatCurrency(point.low)}</div>
												<div class="text-gray-300">Volume: {point.volume.toLocaleString()}</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
						
						<!-- Chart Summary Stats -->
						{#if stockChart.length > 0}
							{@const currentPrice = stockChart[stockChart.length - 1].price}
							{@const firstPrice = stockChart[0].price}
							{@const change = currentPrice - firstPrice}
							{@const changePercent = (change / firstPrice) * 100}
							{@const highPrice = Math.max(...stockChart.map(p => p.high))}
							{@const lowPrice = Math.min(...stockChart.map(p => p.low))}
							
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
								<div class="text-center">
									<div class="text-xs text-gray-500 uppercase tracking-wide">Period Change</div>
									<div class="text-lg font-semibold {change >= 0 ? 'text-green-600' : 'text-red-600'}">
										{change >= 0 ? '+' : ''}{formatCurrency(change)}
									</div>
									<div class="text-sm {change >= 0 ? 'text-green-600' : 'text-red-600'}">
										({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
									</div>
								</div>
								<div class="text-center">
									<div class="text-xs text-gray-500 uppercase tracking-wide">Period High</div>
									<div class="text-lg font-semibold text-green-600">{formatCurrency(highPrice)}</div>
								</div>
								<div class="text-center">
									<div class="text-xs text-gray-500 uppercase tracking-wide">Period Low</div>
									<div class="text-lg font-semibold text-red-600">{formatCurrency(lowPrice)}</div>
								</div>
								<div class="text-center">
									<div class="text-xs text-gray-500 uppercase tracking-wide">Data Points</div>
									<div class="text-lg font-semibold text-gray-700">{stockChart.length}</div>
								</div>
							</div>
						{/if}
						
						<!-- Chart data table (collapsible on mobile) -->
						<details class="group">
							<summary class="cursor-pointer list-none">
								<div class="flex items-center justify-between p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
									<span class="font-medium text-gray-800">View Raw Data</span>
									<svg class="w-5 h-5 text-gray-600 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
									</svg>
								</div>
							</summary>
							<div class="mt-4 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
								<table class="w-full text-sm">
									<thead class="bg-gray-50 sticky top-0">
										<tr>
											<th class="text-left p-3 font-medium text-gray-700">Date/Time</th>
											<th class="text-right p-3 font-medium text-gray-700">Close</th>
											<th class="text-right p-3 font-medium text-gray-700">High</th>
											<th class="text-right p-3 font-medium text-gray-700">Low</th>
											<th class="text-right p-3 font-medium text-gray-700 hidden sm:table-cell">Volume</th>
										</tr>
									</thead>
									<tbody>
										{#each stockChart.slice().reverse() as point}
											<tr class="border-b border-gray-100 hover:bg-gray-50">
												<td class="p-3 text-gray-800">{point.fullDate || point.date}</td>
												<td class="p-3 text-right font-medium">{formatCurrency(point.price)}</td>
												<td class="p-3 text-right text-green-600">{formatCurrency(point.high)}</td>
												<td class="p-3 text-right text-red-600">{formatCurrency(point.low)}</td>
												<td class="p-3 text-right text-gray-600 hidden sm:table-cell">{point.volume.toLocaleString()}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</details>
					</div>
				{:else}
					<div class="text-center py-12">
						<svg class="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
						</svg>
						<p class="text-gray-500">No chart data available</p>
						<button
							on:click={loadChartData}
							class="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Load Chart Data
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Disclaimer -->
	<div class="text-xs text-gray-500 text-center border-t pt-4">
		<p>Stock data is provided by Alpha Vantage and may be delayed. This tool is for informational purposes only.</p>
		<p>Always consult professional financial advisors before making investment decisions.</p>
	</div>
</div> 