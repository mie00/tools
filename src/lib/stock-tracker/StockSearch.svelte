<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StockSearchResult } from './StockApiManager';

	export let searchQuery: string = '';
	export let searchResults: StockSearchResult[] = [];
	export let isSearching: boolean = false;
	export let searchError: string = '';

	const dispatch = createEventDispatcher<{
		search: string;
		select: StockSearchResult;
		clear: void;
	}>();

	let searchInput: HTMLInputElement;

	function handleSearch() {
		if (searchQuery.trim()) {
			dispatch('search', searchQuery.trim());
		}
	}

	function selectStock(stock: StockSearchResult) {
		dispatch('select', stock);
		searchQuery = '';
		searchResults = [];
	}

	function clearSearch() {
		searchQuery = '';
		searchResults = [];
		dispatch('clear');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSearch();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			clearSearch();
		}
	}

	// Auto-focus search input when component mounts
	function focusSearch() {
		if (searchInput) {
			searchInput.focus();
		}
	}

	// Reactive search - trigger search after debounce
	$: if (searchQuery.trim().length >= 2) {
		// Dispatch will be handled by parent with debouncing
		dispatch('search', searchQuery.trim());
	} else if (!searchQuery.trim()) {
		searchResults = [];
		dispatch('clear');
	}
</script>

<div class="space-y-4">
	<!-- Search Header -->
	<div class="text-center">
		<h2 class="mb-2 text-xl font-bold text-gray-800">Stock Search</h2>
		<p class="text-sm text-gray-600">Search for stocks to add to your portfolio</p>
	</div>

	<!-- Search Input -->
	<div class="relative">
		<div class="relative">
			<input
				bind:this={searchInput}
				bind:value={searchQuery}
				on:keydown={handleKeydown}
				type="text"
				placeholder="Search stocks (e.g., AAPL, Tesla, Microsoft)..."
				class="w-full rounded-lg border border-gray-300 py-3 pr-10 pl-10 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			/>

			<!-- Search Icon -->
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					></path>
				</svg>
			</div>

			<!-- Clear Button -->
			{#if searchQuery}
				<button
					on:click={clearSearch}
					class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
					title="Clear search"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			{/if}
		</div>

		<!-- Search Status -->
		{#if isSearching}
			<div class="absolute top-1/2 right-3 -translate-y-1/2">
				<svg class="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
		{/if}
	</div>

	<!-- Search Error -->
	{#if searchError}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center space-x-2">
				<svg
					class="h-5 w-5 flex-shrink-0 text-red-500"
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
				<div class="text-sm text-red-700">
					<p class="font-medium">Search failed</p>
					<p>{searchError}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Search Results -->
	{#if searchResults.length > 0}
		<div class="space-y-2">
			<h3 class="text-sm font-medium text-gray-700">
				Search Results ({searchResults.length})
			</h3>
			<div class="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white">
				{#each searchResults as stock (stock.symbol)}
					<button
						on:click={() => selectStock(stock)}
						class="w-full border-b border-gray-100 p-4 text-left transition-colors last:border-b-0 hover:bg-blue-50"
					>
						<div class="flex items-center justify-between">
							<div class="flex-1">
								<div class="flex items-center space-x-3">
									<div class="rounded-lg bg-blue-100 px-2 py-1">
										<span class="text-sm font-bold text-blue-800">{stock.symbol}</span>
									</div>
									<div class="min-w-0 flex-1">
										<p class="truncate font-medium text-gray-900">{stock.name}</p>
										<div class="flex items-center space-x-2 text-xs text-gray-500">
											<span>{stock.type}</span>
											<span>•</span>
											<span>{stock.region}</span>
											{#if stock.currency}
												<span>•</span>
												<span>{stock.currency}</span>
											{/if}
										</div>
									</div>
								</div>
							</div>
							<div class="ml-4 flex-shrink-0">
								<svg
									class="h-5 w-5 text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 6v6m0 0v6m0-6h6m-6 0H6"
									></path>
								</svg>
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else if searchQuery.trim() && !isSearching && !searchError}
		<div class="py-8 text-center">
			<svg
				class="mx-auto mb-3 h-12 w-12 text-gray-300"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				></path>
			</svg>
			<p class="text-gray-500">No stocks found for "{searchQuery}"</p>
			<p class="mt-1 text-sm text-gray-400">
				Try searching with a different keyword or stock symbol
			</p>
		</div>
	{/if}

	<!-- Search Tips -->
	{#if !searchQuery.trim()}
		<div class="rounded-lg bg-gray-50 p-4">
			<h4 class="mb-2 text-sm font-medium text-gray-800">Search Tips</h4>
			<ul class="space-y-1 text-sm text-gray-600">
				<li>• Enter stock symbols (e.g., AAPL, GOOGL, TSLA)</li>
				<li>• Search by company name (e.g., Apple, Google, Tesla)</li>
				<li>• Use partial matches (e.g., "Micro" for Microsoft)</li>
				<li>• Results show stocks from major exchanges</li>
			</ul>
		</div>
	{/if}
</div>

<!-- Auto-focus on mount -->
<svelte:window on:load={focusSearch} />
