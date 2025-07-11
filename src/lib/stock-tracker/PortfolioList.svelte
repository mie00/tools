<script lang="ts">
	import type { PortfolioStock } from './PortfolioManager';

	let {
		portfolio = $bindable(),
		isRefreshing = $bindable(),
		onselectStock,
		onremoveStock,
		onrefreshPortfolio,
		onrefreshStock
	} = $props<{
		portfolio?: PortfolioStock[];
		isRefreshing?: boolean;
		onselectStock: (_stock: PortfolioStock) => void;
		onremoveStock: (_symbol: string) => void;
		onrefreshPortfolio: () => void;
		onrefreshStock: (_symbol: string) => void;
	}>();

	function handleSelectStock(stock: PortfolioStock) {
		onselectStock(stock);
	}

	function handleRemoveStock(symbol: string) {
		onremoveStock(symbol);
	}

	function handleRefreshPortfolio() {
		onrefreshPortfolio();
	}

	function handleRefreshStock(symbol: string) {
		onrefreshStock(symbol);
	}

	const portfolioStats = $derived.by(() => {
		if (!portfolio || portfolio.length === 0) {
			return { totalValue: 0, totalChange: 0, totalChangePercent: 0, totalShares: 0 };
		}

		let totalInvestment = 0;
		portfolio.forEach((stock: PortfolioStock) => {
			totalInvestment += (stock.purchasePrice || stock.price) * (stock.shares || 1);
		});

		const totalChangePercent = totalInvestment > 0 ? (totalChange / totalInvestment) * 100 : 0;
		const totalShares = portfolio.reduce(
			(sum: number, stock: PortfolioStock) => sum + (stock.shares || 1),
			0
		);

		return {
			totalValue,
			totalChange,
			totalChangePercent,
			totalShares
		};
	});

	const totalValue = $derived(
		portfolio?.reduce(
			(sum: number, stock: PortfolioStock) =>
				sum + (stock.currentPrice || stock.price) * (stock.shares || 1),
			0
		) || 0
	);

	const totalChange = $derived(
		portfolio?.reduce((sum: number, stock: PortfolioStock) => {
			const change =
				((stock.currentPrice || stock.price) - (stock.purchasePrice || stock.price)) *
				(stock.shares || 1);
			return sum + change;
		}, 0) || 0
	);

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	}

	function formatPercent(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'percent',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value / 100);
	}
</script>

<div class="space-y-6">
	<!-- Portfolio Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-bold text-gray-800">Your Portfolio</h2>
			<p class="text-sm text-gray-600">
				{portfolio.length} stock{portfolio.length !== 1 ? 's' : ''} tracked
			</p>
		</div>
		<button
			onclick={handleRefreshPortfolio}
			disabled={isRefreshing}
			class="flex items-center space-x-2 rounded-lg border border-blue-200 px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
			title="Refresh all prices"
		>
			<svg
				class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				></path>
			</svg>
			<span>{isRefreshing ? 'Refreshing...' : 'Refresh All'}</span>
		</button>
	</div>

	<!-- Portfolio Summary -->
	{#if portfolio.length > 0}
		<div
			class="grid grid-cols-2 gap-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 sm:grid-cols-4"
		>
			<div class="text-center">
				<div class="text-xs tracking-wide text-gray-500 uppercase">Total Value</div>
				<div class="text-lg font-semibold text-gray-900">
					{formatCurrency(portfolioStats.totalValue)}
				</div>
			</div>
			<div class="text-center">
				<div class="text-xs tracking-wide text-gray-500 uppercase">Total Change</div>
				<div
					class="text-lg font-semibold {portfolioStats.totalChange >= 0
						? 'text-green-600'
						: 'text-red-600'}"
				>
					{portfolioStats.totalChange >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalChange)}
				</div>
			</div>
			<div class="text-center">
				<div class="text-xs tracking-wide text-gray-500 uppercase">Avg Change</div>
				<div
					class="text-lg font-semibold {portfolioStats.totalChangePercent >= 0
						? 'text-green-600'
						: 'text-red-600'}"
				>
					{formatPercent(portfolioStats.totalChangePercent)}
				</div>
			</div>
			<div class="text-center">
				<div class="text-xs tracking-wide text-gray-500 uppercase">Gainers/Losers</div>
				<div class="text-lg font-semibold text-gray-900">
					<span class="text-green-600">{portfolioStats.totalShares}</span>
					/
					<span class="text-red-600">{portfolioStats.totalShares}</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- Portfolio Stocks -->
	{#if portfolio.length > 0}
		<div class="space-y-3">
			{#each portfolio as stock (stock.symbol)}
				<div
					class="group cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-blue-300 hover:shadow-md"
					onclick={() => handleSelectStock(stock)}
					onkeydown={(e) => e.key === 'Enter' && handleSelectStock(stock)}
					role="button"
					tabindex="0"
				>
					<div class="flex items-center justify-between">
						<!-- Stock Info -->
						<div class="flex items-center space-x-4">
							<div class="rounded-lg bg-blue-100 px-3 py-2">
								<span class="text-sm font-bold text-blue-800">{stock.symbol}</span>
							</div>
							<div class="min-w-0 flex-1">
								<h3 class="truncate font-semibold text-gray-900">{stock.name}</h3>
								<p class="text-sm text-gray-500">
									Added {new Date(stock.addedDate).toLocaleDateString()}
								</p>
							</div>
						</div>

						<!-- Price Info -->
						<div class="text-right">
							<div class="text-lg font-bold text-gray-900">
								{stock.currentPrice > 0 ? formatCurrency(stock.currentPrice) : '--'}
							</div>
							<div class="flex items-center space-x-2">
								<span class="text-sm {stock.change >= 0 ? 'text-green-600' : 'text-red-600'}">
									{stock.currentPrice > 0
										? `${stock.change >= 0 ? '+' : ''}${formatCurrency(stock.change)} (${formatPercent(stock.changePercent)})`
										: 'Loading...'}
								</span>
							</div>
							{#if stock.lastUpdate}
								<p class="text-xs text-gray-400">
									{stock.lastUpdate}
								</p>
							{/if}
						</div>

						<!-- Actions -->
						<div
							class="ml-4 flex items-center space-x-2 opacity-0 transition-opacity group-hover:opacity-100"
						>
							<button
								onclick={() => handleRefreshStock(stock.symbol)}
								class="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
								title="Refresh {stock.symbol} price"
								aria-label="Refresh {stock.symbol} price"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									></path>
								</svg>
							</button>
							<button
								onclick={() => handleRemoveStock(stock.symbol)}
								class="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
								title="Remove {stock.symbol} from portfolio"
								aria-label="Remove {stock.symbol} from portfolio"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									></path>
								</svg>
							</button>
						</div>
					</div>

					<!-- Notes (if any) -->
					{#if stock.notes}
						<div class="mt-3 rounded-lg bg-gray-50 p-3">
							<p class="text-sm text-gray-700">{stock.notes}</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<!-- Empty Portfolio -->
		<div class="py-12 text-center">
			<svg
				class="mx-auto mb-4 h-16 w-16 text-gray-300"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
				></path>
			</svg>
			<h3 class="mb-2 text-lg font-medium text-gray-900">No stocks in portfolio</h3>
			<p class="mb-4 text-gray-500">Search for stocks above to start building your portfolio</p>
			<div class="mx-auto max-w-md rounded-lg bg-blue-50 p-4 text-left">
				<h4 class="mb-2 text-sm font-medium text-blue-800">Getting Started</h4>
				<ul class="space-y-1 text-sm text-blue-700">
					<li>• Search for stocks using the search box above</li>
					<li>• Click on search results to add them to your portfolio</li>
					<li>• Track real-time prices and performance</li>
					<li>• Click on portfolio stocks to view detailed charts</li>
				</ul>
			</div>
		</div>
	{/if}
</div>
