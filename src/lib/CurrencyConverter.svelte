<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import T from './T.svelte';
	import { StorageFactory } from './storage-api';

	// Initialize UI settings storage
	const uiSettingsStorage = StorageFactory.createUISettingsStorage();

	// Type definitions
	interface CurrencyInfo {
		code: string;
		name: string;
		flag: string;
	}

	interface CacheEntry {
		rates: Record<string, number>;
		fetchTime: number;
		updateTime: number;
	}

	// Cache for exchange rates to reduce API calls and improve performance
	const rateCache = new Map<string, CacheEntry>();
	const CACHE_DURATION_MS = 60 * 60 * 1000; // Cache rates for 1 hour

	let fromCurrency: string = $state('USD');
	let toCurrency: string = $state('EUR');
	let amount: string = $state('1');
	let result: string = $state('');
	let loading: boolean = $state(false);
	let error: string = $state('');
	let exchangeRate: number | null = $state(null);
	let lastUpdated: string = $state('');
	let recentConversions: string[] = $state([]);

	// Popular currencies list
	const popularCurrencies: CurrencyInfo[] = [
		{ code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
		{ code: 'EUR', name: 'Euro', flag: '🇪🇺' },
		{ code: 'EGP', name: 'Egyptian Pound', flag: '🇪🇬' },
		{ code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
		{ code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
		{ code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
		{ code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
		{ code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
		{ code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
		{ code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
		{ code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
		{ code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
		{ code: 'BRL', name: 'Brazilian Real', flag: '🇧🇷' },
		{ code: 'MXN', name: 'Mexican Peso', flag: '🇲🇽' },
		{ code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' },
		{ code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
		{ code: 'NZD', name: 'New Zealand Dollar', flag: '🇳🇿' },
		{ code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' }
	];

	// Syncs state to the URL without stealing input focus
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			if (amount && parseFloat(amount) !== 1) {
				params.set('amount', amount);
			} else {
				params.delete('amount');
			}

			if (fromCurrency !== 'USD') {
				params.set('from', fromCurrency);
			} else {
				params.delete('from');
			}

			if (toCurrency !== 'EUR') {
				params.set('to', toCurrency);
			} else {
				params.delete('to');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	function loadFromUrl() {
		const urlAmount = $page.url.searchParams.get('amount');
		const urlFromCurrency = $page.url.searchParams.get('from');
		const urlToCurrency = $page.url.searchParams.get('to');

		if (urlAmount) {
			amount = urlAmount;
		}

		if (urlFromCurrency && popularCurrencies.some((c) => c.code === urlFromCurrency)) {
			fromCurrency = urlFromCurrency;
		}

		if (urlToCurrency && popularCurrencies.some((c) => c.code === urlToCurrency)) {
			toCurrency = urlToCurrency;
		}
	}

	onMount(async () => {
		loadFromUrl();
		await loadRecentConversions();
		// Auto-convert on mount if we have valid currencies
		if (fromCurrency && toCurrency && fromCurrency !== toCurrency) {
			convertAndSync();
		}
	});

	async function loadRecentConversions() {
		try {
			const stored = await uiSettingsStorage.getRecentCurrencyConversions();
			if (stored && Array.isArray(stored)) {
				recentConversions = stored;
			}
		} catch (err) {
			console.warn('Failed to load recent conversions:', err);
		}
	}

	async function saveRecentConversion(from: string, to: string) {
		const conversionPair = `${from}-${to}`;
		recentConversions = recentConversions.filter((item) => item !== conversionPair);
		recentConversions.unshift(conversionPair);
		recentConversions = recentConversions.slice(0, 5); // Keep only 5 recent

		try {
			await uiSettingsStorage.setRecentCurrencyConversions(recentConversions);
		} catch (err: unknown) {
			console.warn('Failed to save recent conversions:', err);
		}
	}

	// Rewritten with caching for performance
	async function convertCurrency() {
		const numAmount = parseFloat(amount);
		if (!amount || numAmount <= 0 || fromCurrency === toCurrency) {
			result = '';
			exchangeRate = null;
			return;
		}

		loading = true;
		error = '';

		try {
			const now = Date.now();
			const cacheKey =
				typeof fromCurrency === 'string' ? fromCurrency : JSON.stringify(fromCurrency);
			const cachedEntry = rateCache.get(cacheKey);
			let ratesData: Record<string, number>;

			if (cachedEntry && now - cachedEntry.fetchTime < CACHE_DURATION_MS) {
				// Use cached data
				ratesData = cachedEntry.rates;
				lastUpdated = new Date(cachedEntry.updateTime).toLocaleString();
			} else {
				// Fetch new data
				const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
				if (!response.ok) {
					throw new Error(`API Error: ${response.status}`);
				}
				const data = await response.json();
				if (!data.rates) {
					throw new Error('Invalid API response');
				}
				ratesData = data.rates;
				// The API returns time_last_updated as a UNIX timestamp in seconds
				const apiUpdateTime = new Date((data.time_last_updated || now / 1000) * 1000);
				lastUpdated = apiUpdateTime.toLocaleString();
				rateCache.set(cacheKey, {
					rates: ratesData,
					fetchTime: now,
					updateTime: apiUpdateTime.getTime()
				});
			}

			const rate = ratesData[toCurrency];
			if (rate === undefined) {
				throw new Error(`Exchange rate not found for ${toCurrency}`);
			}

			exchangeRate = rate;
			result = (numAmount * exchangeRate).toFixed(2);
			saveRecentConversion(fromCurrency, toCurrency).catch((e) =>
				console.warn('Failed to save recent conversion:', e)
			);
		} catch (err: unknown) {
			error = (err as Error).message || 'Failed to fetch exchange rates';
			result = '';
			exchangeRate = null;
		} finally {
			loading = false;
		}
	}

	function swapCurrencies() {
		[fromCurrency, toCurrency] = [toCurrency, fromCurrency];
		convertAndSync();
	}

	function useRecentConversion(conversionPair: string) {
		const [from, to] = conversionPair.split('-');
		fromCurrency = from;
		toCurrency = to;
		convertAndSync();
	}

	function getCurrencyDisplay(code: string): string {
		const currency = popularCurrencies.find((c) => c.code === code);
		return currency ? `${currency.flag} ${currency.code}` : code;
	}

	// This function now handles both conversion and URL updates
	async function convertAndSync() {
		await convertCurrency();
		updateUrl();
	}

	function handleInput() {
		convertAndSync();
	}
</script>

<div class="space-y-6">
	<!-- API Indicator -->
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
			<span class="text-sm font-medium text-blue-800"><T>Uses External API</T></span>
		</div>
		<div class="text-xs text-blue-600">
			<T>Real-time exchange rates from exchangerate-api.com</T>
		</div>
	</div>

	<!-- Recent Conversions -->
	{#if recentConversions.length > 0}
		<div class="rounded-lg bg-gray-50 p-4">
			<h3 class="mb-2 text-sm font-medium text-gray-700"><T>Recent Conversions</T></h3>
			<div class="flex flex-wrap gap-2">
				{#each recentConversions as conversion (conversion)}
					<button
						onclick={() => useRecentConversion(conversion)}
						class="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm transition-colors hover:bg-gray-100"
					>
						{conversion.replace('-', ' → ')}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Converter Interface -->
	<div class="grid gap-6">
		<!-- Currency Selectors -->
		<div class="grid grid-cols-1 items-end gap-4 md:grid-cols-5">
			<!-- From Currency -->
			<div class="space-y-2 md:col-span-2">
				<label for="from-currency" class="block text-sm font-medium text-gray-700"
					><T>From</T></label
				>
				<select
					id="from-currency"
					bind:value={fromCurrency}
					onchange={handleInput}
					class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				>
					{#each popularCurrencies as currency (currency.code)}
						<option value={currency.code}>{currency.flag} {currency.code} - {currency.name}</option>
					{/each}
				</select>
			</div>

			<!-- Swap Button -->
			<div class="flex justify-center md:justify-center">
				<button
					onclick={swapCurrencies}
					aria-label="Swap currencies"
					class="rounded-lg bg-gray-100 p-3 transition-colors hover:bg-gray-200"
					title="Swap currencies"
				>
					<svg class="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
						></path>
					</svg>
				</button>
			</div>

			<!-- To Currency -->
			<div class="space-y-2 md:col-span-2">
				<label for="to-currency" class="block text-sm font-medium text-gray-700"><T>To</T></label>
				<select
					id="to-currency"
					bind:value={toCurrency}
					onchange={handleInput}
					class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				>
					{#each popularCurrencies as currency (currency.code)}
						<option value={currency.code}>{currency.flag} {currency.code} - {currency.name}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Amount Input -->
		<div class="space-y-2">
			<label for="amount-input" class="block text-sm font-medium text-gray-700"><T>Amount</T></label
			>
			<input
				id="amount-input"
				type="number"
				bind:value={amount}
				oninput={handleInput}
				min="0"
				step="0.01"
				class="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				placeholder="Enter amount"
			/>
		</div>

		<!-- Result Display -->
		<div class="rounded-xl border border-gray-200 bg-gradient-to-r from-green-50 to-blue-50 p-6">
			{#if loading}
				<div class="flex items-center justify-center space-x-2">
					<svg class="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span class="text-gray-600"><T>Converting...</T></span>
				</div>
			{:else if error}
				<div class="text-center text-red-600">
					<svg class="mx-auto mb-2 h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<p class="font-medium"><T>Conversion Error</T></p>
					<p class="text-sm">{error}</p>
				</div>
			{:else if result && exchangeRate}
				<div class="text-center">
					<div class="mb-2 text-3xl font-bold text-gray-800">
						{getCurrencyDisplay(toCurrency)}
						{result}
					</div>
					<div class="space-y-1 text-sm text-gray-600">
						<p>
							{getCurrencyDisplay(fromCurrency)}
							{amount} = {getCurrencyDisplay(toCurrency)}
							{result}
						</p>
						<p>1 {fromCurrency} = {exchangeRate.toFixed(4)} {toCurrency}</p>
						{#if lastUpdated}
							<p class="text-xs">Rates as of: {lastUpdated}</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="text-center text-gray-500">
					<svg
						class="mx-auto mb-3 h-12 w-12 opacity-50"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
						></path>
					</svg>
					<p><T>Enter an amount to convert</T></p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Disclaimer -->
	<div class="border-t pt-4 text-center text-xs text-gray-500">
		<p>
			Exchange rates are provided by exchangerate-api.com and may not reflect real-time market
			rates.
		</p>
		<p>For financial decisions, please consult official sources.</p>
	</div>
</div>
