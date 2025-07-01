<script>
	import { onMount } from 'svelte';
	
	let amount = 1;
	let fromCurrency = 'USD';
	let toCurrency = 'EUR';
	let result = '';
	let loading = false;
	let error = '';
	let exchangeRate = null;
	let lastUpdated = '';
	let recentConversions = [];
	
	// Popular currencies list
	const popularCurrencies = [
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
	
	onMount(() => {
		loadRecentConversions();
		// Auto-convert on mount if we have valid currencies
		if (fromCurrency && toCurrency && fromCurrency !== toCurrency) {
			convertCurrency();
		}
	});
	
	function loadRecentConversions() {
		try {
			const stored = localStorage.getItem('recentCurrencyConversions');
			if (stored) {
				recentConversions = JSON.parse(stored);
			}
		} catch (err) {
			console.warn('Failed to load recent conversions:', err);
		}
	}
	
	function saveRecentConversion(from, to) {
		const conversionPair = `${from}-${to}`;
		recentConversions = recentConversions.filter(item => item !== conversionPair);
		recentConversions.unshift(conversionPair);
		recentConversions = recentConversions.slice(0, 5); // Keep only 5 recent
		
		try {
			localStorage.setItem('recentCurrencyConversions', JSON.stringify(recentConversions));
		} catch (err) {
			console.warn('Failed to save recent conversions:', err);
		}
	}
	
	async function convertCurrency() {
		if (!amount || amount <= 0 || fromCurrency === toCurrency) {
			result = '';
			return;
		}
		
		loading = true;
		error = '';
		
		try {
			// Using exchangerate-api.com (free tier allows 1500 requests/month)
			const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
			
			if (!response.ok) {
				throw new Error(`API Error: ${response.status}`);
			}
			
			const data = await response.json();
			
			if (!data.rates || !data.rates[toCurrency]) {
				throw new Error(`Exchange rate not found for ${toCurrency}`);
			}
			
			exchangeRate = data.rates[toCurrency];
			const convertedAmount = (amount * exchangeRate).toFixed(2);
			result = convertedAmount;
			lastUpdated = new Date(data.time_last_updated || Date.now()).toLocaleString();
			
			// Save this conversion pair to recent
			saveRecentConversion(fromCurrency, toCurrency);
			
		} catch (err) {
			error = err.message || 'Failed to fetch exchange rates';
			result = '';
			exchangeRate = null;
		} finally {
			loading = false;
		}
	}
	
	function swapCurrencies() {
		[fromCurrency, toCurrency] = [toCurrency, fromCurrency];
		convertCurrency();
	}
	
	function useRecentConversion(conversionPair) {
		const [from, to] = conversionPair.split('-');
		fromCurrency = from;
		toCurrency = to;
		convertCurrency();
	}
	
	function getCurrencyDisplay(code) {
		const currency = popularCurrencies.find(c => c.code === code);
		return currency ? `${currency.flag} ${currency.code}` : code;
	}
	
	// Auto-convert when amount or currencies change
	$: if (amount && fromCurrency && toCurrency && fromCurrency !== toCurrency) {
		convertCurrency();
	}
</script>

<div class="space-y-6">
	<!-- API Indicator -->
	<div class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
		<div class="flex items-center space-x-2">
			<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM12 9v2"></path>
			</svg>
			<span class="text-sm text-blue-800 font-medium">Uses External API</span>
		</div>
		<div class="text-xs text-blue-600">
			Real-time exchange rates from exchangerate-api.com
		</div>
	</div>

	<!-- Recent Conversions -->
	{#if recentConversions.length > 0}
		<div class="bg-gray-50 rounded-lg p-4">
			<h3 class="text-sm font-medium text-gray-700 mb-2">Recent Conversions</h3>
			<div class="flex flex-wrap gap-2">
				{#each recentConversions as conversion}
					<button
						on:click={() => useRecentConversion(conversion)}
						class="px-3 py-1 bg-white border border-gray-200 rounded-md text-sm hover:bg-gray-100 transition-colors"
					>
						{conversion.replace('-', ' → ')}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Converter Interface -->
	<div class="grid gap-6">
		<!-- Amount Input -->
		<div class="space-y-2">
			<label class="block text-sm font-medium text-gray-700">Amount</label>
			<input
				type="number"
				bind:value={amount}
				min="0"
				step="0.01"
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
				placeholder="Enter amount"
			>
		</div>

		<!-- Currency Selectors -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
			<!-- From Currency -->
			<div class="space-y-2">
				<label class="block text-sm font-medium text-gray-700">From</label>
				<select
					bind:value={fromCurrency}
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					{#each popularCurrencies as currency}
						<option value={currency.code}>{currency.flag} {currency.code} - {currency.name}</option>
					{/each}
				</select>
			</div>

			<!-- Swap Button -->
			<div class="flex justify-center md:justify-start">
				<button
					on:click={swapCurrencies}
					class="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
					title="Swap currencies"
				>
					<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
					</svg>
				</button>
			</div>

			<!-- To Currency -->
			<div class="space-y-2">
				<label class="block text-sm font-medium text-gray-700">To</label>
				<select
					bind:value={toCurrency}
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					{#each popularCurrencies as currency}
						<option value={currency.code}>{currency.flag} {currency.code} - {currency.name}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Result Display -->
		<div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-gray-200">
			{#if loading}
				<div class="flex items-center justify-center space-x-2">
					<svg class="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span class="text-gray-600">Converting...</span>
				</div>
			{:else if error}
				<div class="text-center text-red-600">
					<svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<p class="font-medium">Conversion Error</p>
					<p class="text-sm">{error}</p>
				</div>
			{:else if result && exchangeRate}
				<div class="text-center">
					<div class="text-3xl font-bold text-gray-800 mb-2">
						{getCurrencyDisplay(toCurrency)} {result}
					</div>
					<div class="text-sm text-gray-600 space-y-1">
						<p>{getCurrencyDisplay(fromCurrency)} {amount} = {getCurrencyDisplay(toCurrency)} {result}</p>
						<p>1 {fromCurrency} = {exchangeRate.toFixed(4)} {toCurrency}</p>
						{#if lastUpdated}
							<p class="text-xs">Last updated: {lastUpdated}</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="text-center text-gray-500">
					<svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
					</svg>
					<p>Enter an amount to convert</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Disclaimer -->
	<div class="text-xs text-gray-500 text-center border-t pt-4">
		<p>Exchange rates are provided by exchangerate-api.com and may not reflect real-time market rates.</p>
		<p>For financial decisions, please consult official sources.</p>
	</div>
</div> 