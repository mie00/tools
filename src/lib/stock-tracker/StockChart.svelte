<script lang="ts">
	import type { ChartPoint, TimeWindow } from './StockApiManager';

	let {
		data,
		timeWindows,
		selectedTimeWindow = $bindable(),
		loading = $bindable(),
		error = $bindable(),
		symbol,
		ontimeWindowChanged,
		onrefresh
	} = $props<{
		data: ChartPoint[];
		timeWindows: TimeWindow[];
		selectedTimeWindow?: string;
		loading?: boolean;
		error?: string;
		symbol: string;
		ontimeWindowChanged: (_timeWindow: string) => void;
		onrefresh: () => void;
	}>();

	function handleTimeWindowChange(timeWindow: string) {
		ontimeWindowChanged(timeWindow);
	}

	function handleRefresh() {
		onrefresh();
	}

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	}

	let minPrice = $derived(data.length > 0 ? Math.min(...data.map((p: ChartPoint) => p.price)) : 0);
	let maxPrice = $derived(data.length > 0 ? Math.max(...data.map((p: ChartPoint) => p.price)) : 0);
	let currentPrice = $derived(data.length > 0 ? data[data.length - 1].price : 0);
	let firstPrice = $derived(data.length > 0 ? data[0].price : 0);
	let periodChange = $derived(currentPrice - firstPrice);
	let periodChangePercent = $derived(firstPrice > 0 ? (periodChange / firstPrice) * 100 : 0);
	let highPrice = $derived(data.length > 0 ? Math.max(...data.map((p: ChartPoint) => p.high)) : 0);
	let lowPrice = $derived(data.length > 0 ? Math.min(...data.map((p: ChartPoint) => p.low)) : 0);
</script>

<div class="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
	<div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
		<h4 class="mb-4 text-lg font-semibold text-gray-800 sm:mb-0">
			{symbol} Price Chart
		</h4>

		<div class="flex items-center gap-3">
			<!-- Time Window Selector -->
			<div class="flex flex-wrap gap-2">
				{#each timeWindows as timeWindow (timeWindow.id)}
					<button
						onclick={() => handleTimeWindowChange(timeWindow.id)}
						class="rounded-lg px-3 py-1 text-sm transition-colors {selectedTimeWindow ===
						timeWindow.id
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						{timeWindow.label}
					</button>
				{/each}
			</div>

			<!-- Refresh Button -->
			<button
				onclick={handleRefresh}
				class="rounded border border-blue-200 px-3 py-1 text-sm text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
				title="Refresh chart data"
				aria-label="Refresh chart data"
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
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<svg class="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		</div>
	{:else if error}
		<div class="py-12 text-center">
			<svg
				class="mx-auto mb-3 h-12 w-12 text-red-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<p class="font-medium text-red-600">Failed to load chart</p>
			<p class="text-sm text-red-500">{error}</p>
			<button
				onclick={handleRefresh}
				class="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
			>
				Retry
			</button>
		</div>
	{:else if data.length > 0}
		<div class="space-y-6">
			<!-- Chart Container -->
			<div class="w-full overflow-x-auto">
				<div
					class="h-64 min-w-full rounded-lg border border-gray-200 bg-gradient-to-b from-blue-50 to-gray-50 p-2 sm:h-80 sm:p-4 lg:h-96"
				>
					<div class="flex h-full items-end justify-between gap-1">
						{#each data as point, i (i)}
							{@const height =
								data.length > 1 ? ((point.price - minPrice) / (maxPrice - minPrice)) * 85 + 10 : 50}
							{@const isPositive = i === 0 || point.price >= data[i - 1]?.price}
							<div
								class="group relative cursor-pointer rounded-t-sm transition-all duration-300 hover:opacity-80 {isPositive
									? 'bg-green-500 hover:bg-green-600'
									: 'bg-red-500 hover:bg-red-600'}"
								style="height: {height}%; flex: 1; min-width: {data.length > 50
									? '3px'
									: '8px'}; max-width: 20px;"
							>
								<!-- Tooltip -->
								<div
									class="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-lg bg-gray-900 px-3 py-2 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
								>
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
			<div class="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-4">
				<div class="text-center">
					<div class="text-xs tracking-wide text-gray-500 uppercase">Period Change</div>
					<div
						class="text-lg font-semibold {periodChange >= 0 ? 'text-green-600' : 'text-red-600'}"
					>
						{periodChange >= 0 ? '+' : ''}{formatCurrency(periodChange)}
					</div>
					<div class="text-sm {periodChange >= 0 ? 'text-green-600' : 'text-red-600'}">
						({periodChangePercent >= 0 ? '+' : ''}{periodChangePercent.toFixed(2)}%)
					</div>
				</div>
				<div class="text-center">
					<div class="text-xs tracking-wide text-gray-500 uppercase">Period High</div>
					<div class="text-lg font-semibold text-green-600">
						{formatCurrency(highPrice)}
					</div>
				</div>
				<div class="text-center">
					<div class="text-xs tracking-wide text-gray-500 uppercase">Period Low</div>
					<div class="text-lg font-semibold text-red-600">
						{formatCurrency(lowPrice)}
					</div>
				</div>
				<div class="text-center">
					<div class="text-xs tracking-wide text-gray-500 uppercase">Data Points</div>
					<div class="text-lg font-semibold text-gray-700">
						{data.length}
					</div>
				</div>
			</div>

			<!-- Raw Data Table (collapsible) -->
			<details class="group">
				<summary class="cursor-pointer list-none">
					<div
						class="flex items-center justify-between rounded-lg bg-gray-100 p-3 transition-colors hover:bg-gray-200"
					>
						<span class="font-medium text-gray-800">View Raw Data</span>
						<svg
							class="h-5 w-5 text-gray-600 transition-transform group-open:rotate-180"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path>
						</svg>
					</div>
				</summary>
				<div class="mt-4 overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50">
								<th class="px-4 py-2 text-left">Date</th>
								<th class="px-4 py-2 text-right">Close</th>
								<th class="px-4 py-2 text-right">High</th>
								<th class="px-4 py-2 text-right">Low</th>
								<th class="px-4 py-2 text-right">Volume</th>
							</tr>
						</thead>
						<tbody>
							{#each data.slice().reverse() as point (point.fullDate || point.date)}
								<tr class="border-b border-gray-100 hover:bg-gray-50">
									<td class="px-4 py-2 text-gray-700">{point.fullDate || point.date}</td>
									<td class="px-4 py-2 text-right font-medium text-gray-900"
										>{formatCurrency(point.price)}</td
									>
									<td class="px-4 py-2 text-right text-green-600">{formatCurrency(point.high)}</td>
									<td class="px-4 py-2 text-right text-red-600">{formatCurrency(point.low)}</td>
									<td class="px-4 py-2 text-right text-gray-600">{point.volume.toLocaleString()}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		</div>
	{:else}
		<div class="py-12 text-center text-gray-500">
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
			<p class="text-lg">No chart data available</p>
			<p class="text-sm">Select a stock to view its price chart</p>
		</div>
	{/if}
</div>
