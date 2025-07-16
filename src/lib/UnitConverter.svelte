<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import T from './T.svelte';

	// Type definitions
	interface UnitInfo {
		name: string;
		symbol: string;
		factor?: number; // Optional for temperature units
	}

	interface CategoryInfo {
		name: string;
		icon: string;
		baseUnit: string;
		units: Record<string, UnitInfo>;
	}

	interface HistoryItem {
		input: string;
		output: string;
		conversion: string;
		timestamp: string;
	}

	let inputValue: string = $state('1');
	let fromUnit: string = $state('meter');
	let toUnit: string = $state('kilometer');
	let selectedCategory: string = $state('length');
	let result: string = $state('');
	let history: HistoryItem[] = $state([]);
	let isLoaded: boolean = $state(false);

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			if (selectedCategory !== 'length') {
				params.set('category', selectedCategory);
			} else {
				params.delete('category');
			}

			if (inputValue !== '1') {
				params.set('value', inputValue);
			} else {
				params.delete('value');
			}

			if (fromUnit !== 'meter') {
				params.set('from', fromUnit);
			} else {
				params.delete('from');
			}

			if (toUnit !== 'kilometer') {
				params.set('to', toUnit);
			} else {
				params.delete('to');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	function loadFromUrl() {
		const category = $page.url.searchParams.get('category');
		const value = $page.url.searchParams.get('value');
		const from = $page.url.searchParams.get('from');
		const to = $page.url.searchParams.get('to');

		if (category && categories[category]) {
			selectedCategory = category;
		}

		if (value) {
			inputValue = value;
		}

		if (from && selectedCategory && categories[selectedCategory].units[from]) {
			fromUnit = from;
		}

		if (to && selectedCategory && categories[selectedCategory].units[to]) {
			toUnit = to;
		}

		// Convert if we have all parameters
		if (value) {
			convert();
		}
	}

	// Unit definitions with conversion factors to base units
	const categories: Record<string, CategoryInfo> = {
		length: {
			name: 'Length',
			icon: '📏',
			baseUnit: 'meter',
			units: {
				meter: { name: 'Meter', symbol: 'm', factor: 1 },
				kilometer: { name: 'Kilometer', symbol: 'km', factor: 1000 },
				centimeter: { name: 'Centimeter', symbol: 'cm', factor: 0.01 },
				millimeter: { name: 'Millimeter', symbol: 'mm', factor: 0.001 },
				inch: { name: 'Inch', symbol: 'in', factor: 0.0254 },
				feet: { name: 'Feet', symbol: 'ft', factor: 0.3048 },
				yard: { name: 'Yard', symbol: 'yd', factor: 0.9144 },
				mile: { name: 'Mile', symbol: 'mi', factor: 1609.344 }
			}
		},
		weight: {
			name: 'Weight',
			icon: '⚖️',
			baseUnit: 'kilogram',
			units: {
				kilogram: { name: 'Kilogram', symbol: 'kg', factor: 1 },
				gram: { name: 'Gram', symbol: 'g', factor: 0.001 },
				pound: { name: 'Pound', symbol: 'lb', factor: 0.453592 },
				ounce: { name: 'Ounce', symbol: 'oz', factor: 0.0283495 },
				ton: { name: 'Ton', symbol: 't', factor: 1000 },
				stone: { name: 'Stone', symbol: 'st', factor: 6.35029 }
			}
		},
		temperature: {
			name: 'Temperature',
			icon: '🌡️',
			baseUnit: 'celsius',
			units: {
				celsius: { name: 'Celsius', symbol: '°C' },
				fahrenheit: { name: 'Fahrenheit', symbol: '°F' },
				kelvin: { name: 'Kelvin', symbol: 'K' }
			}
		},
		volume: {
			name: 'Volume',
			icon: '🧪',
			baseUnit: 'liter',
			units: {
				liter: { name: 'Liter', symbol: 'L', factor: 1 },
				milliliter: { name: 'Milliliter', symbol: 'mL', factor: 0.001 },
				gallon: { name: 'Gallon (US)', symbol: 'gal', factor: 3.78541 },
				quart: { name: 'Quart', symbol: 'qt', factor: 0.946353 },
				pint: { name: 'Pint', symbol: 'pt', factor: 0.473176 },
				cup: { name: 'Cup', symbol: 'cup', factor: 0.236588 },
				fluid_ounce: { name: 'Fluid Ounce', symbol: 'fl oz', factor: 0.0295735 }
			}
		},
		area: {
			name: 'Area',
			icon: '⬜',
			baseUnit: 'square_meter',
			units: {
				square_meter: { name: 'Square Meter', symbol: 'm²', factor: 1 },
				square_kilometer: { name: 'Square Kilometer', symbol: 'km²', factor: 1000000 },
				square_centimeter: { name: 'Square Centimeter', symbol: 'cm²', factor: 0.0001 },
				square_foot: { name: 'Square Foot', symbol: 'ft²', factor: 0.092903 },
				square_inch: { name: 'Square Inch', symbol: 'in²', factor: 0.00064516 },
				acre: { name: 'Acre', symbol: 'ac', factor: 4046.86 },
				hectare: { name: 'Hectare', symbol: 'ha', factor: 10000 }
			}
		}
	};

	// Temperature conversion functions
	function convertTemperature(value: number, from: string, to: string): number {
		if (from === to) return value;

		// Convert to Celsius first
		let celsius = value;
		if (from === 'fahrenheit') {
			celsius = ((value - 32) * 5) / 9;
		} else if (from === 'kelvin') {
			celsius = value - 273.15;
		}

		// Convert from Celsius to target
		if (to === 'fahrenheit') {
			return (celsius * 9) / 5 + 32;
		} else if (to === 'kelvin') {
			return celsius + 273.15;
		}

		return celsius;
	}

	// General unit conversion
	function convertUnits(value: number, from: string, to: string, category: string): number {
		if (from === to) return value;

		if (category === 'temperature') {
			return convertTemperature(value, from, to);
		}

		const categoryData = categories[category];
		const fromFactor = categoryData.units[from].factor;
		const toFactor = categoryData.units[to].factor;

		if (fromFactor === undefined || toFactor === undefined) {
			return value; // Fallback for units without factor
		}

		// Convert to base unit, then to target unit
		const baseValue = value * fromFactor;
		return baseValue / toFactor;
	}

	function formatResult(value: number): string {
		if (isNaN(value)) return 'Invalid input';

		// Format numbers with appropriate precision
		if (Math.abs(value) >= 1000000) {
			return value.toExponential(4);
		} else if (Math.abs(value) < 0.0001 && value !== 0) {
			return value.toExponential(4);
		} else {
			return parseFloat(value.toFixed(6)).toString();
		}
	}

	function convert() {
		const value = parseFloat(inputValue);
		if (isNaN(value)) {
			result = 'Please enter a valid number';
			return;
		}

		const convertedValue = convertUnits(value, fromUnit, toUnit, selectedCategory);
		result = formatResult(convertedValue);

		// Add to history
		const fromUnitName = categories[selectedCategory].units[fromUnit].name;
		const toUnitName = categories[selectedCategory].units[toUnit].name;
		const fromSymbol = categories[selectedCategory].units[fromUnit].symbol;
		const toSymbol = categories[selectedCategory].units[toUnit].symbol;

		history = [
			{
				input: `${value} ${fromSymbol}`,
				output: `${result} ${toSymbol}`,
				conversion: `${fromUnitName} → ${toUnitName}`,
				timestamp: new Date().toLocaleTimeString()
			},
			...history.slice(0, 9) // Keep last 10 conversions
		];
	}

	function swapUnits() {
		const temp = fromUnit;
		fromUnit = toUnit;
		toUnit = temp;
		if (
			inputValue &&
			result &&
			result !== 'Please enter a valid number' &&
			result !== 'Invalid input'
		) {
			inputValue = result;
			convert();
		}
	}

	function clearHistory() {
		history = [];
		saveHistoryToStorage();
	}

	// Persistence functions
	function saveHistoryToStorage() {
		try {
			localStorage.setItem('unitConverter_history', JSON.stringify(history));
		} catch (error) {
			console.warn('Failed to save history to localStorage:', error);
		}
	}

	function loadHistoryFromStorage() {
		try {
			const saved = localStorage.getItem('unitConverter_history');
			if (saved) {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed)) {
					history = parsed;
				}
			}
		} catch (error) {
			console.warn('Failed to load history from localStorage:', error);
			history = [];
		}
	}

	function selectCategory(category: string) {
		selectedCategory = category;
		// Set default units for the category
		const units = Object.keys(categories[category].units);
		fromUnit = units[0];
		toUnit = units[1] || units[0];
		inputValue = '';
		result = '';
	}

	// Debounce conversion
	let convertTimeout: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (isLoaded) {
			clearTimeout(convertTimeout);
			convertTimeout = setTimeout(() => {
				convert();
			}, 200);
		}
	});

	// Debounce URL update
	let urlUpdateTimeout: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (isLoaded) {
			clearTimeout(urlUpdateTimeout);
			urlUpdateTimeout = setTimeout(() => {
				updateUrl();
			}, 300);
		}
	});

	// Save history to localStorage whenever it changes (but only after initial load)
	$effect(() => {
		if (isLoaded && history) {
			saveHistoryToStorage();
		}
	});

	// Load history on component mount
	onMount(() => {
		loadFromUrl();
		loadHistoryFromStorage();
		isLoaded = true;
	});
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6">
		<h2 class="mb-4 text-2xl font-bold text-gray-800"><T>Unit Converter</T></h2>

		<!-- Category Selection -->
		<div class="mb-6 flex flex-wrap gap-2">
			{#each Object.entries(categories) as [key, category] (key)}
				<button
					onclick={() => selectCategory(key)}
					class="flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-200 {selectedCategory ===
					key
						? 'bg-blue-500 text-white shadow-md'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					<span class="text-lg">{category.icon}</span>
					<span class="font-medium"><T key={category.name} /></span>
				</button>
			{/each}
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Converter -->
		<div class="lg:col-span-2">
			<div class="rounded-xl bg-gray-50 p-6">
				<div class="mb-4 grid gap-4 md:grid-cols-2">
					<!-- From Unit -->
					<div>
						<label for="from-unit" class="mb-2 block text-sm font-medium text-gray-700"
							><T>From</T></label
						>
						<select
							id="from-unit"
							bind:value={fromUnit}
							class="w-full rounded-lg border border-gray-300 p-3 focus:border-transparent focus:ring-2 focus:ring-blue-500"
						>
							{#each Object.entries(categories[selectedCategory].units) as [key, unit] (key)}
								<option value={key}>{unit.name} ({unit.symbol})</option>
							{/each}
						</select>
						<input
							type="number"
							bind:value={inputValue}
							placeholder="Enter value"
							class="mt-2 w-full rounded-lg border border-gray-300 p-3 focus:border-transparent focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<!-- Swap Button -->
					<div class="flex items-center justify-center md:flex-col">
						<button
							onclick={swapUnits}
							aria-label="Swap units"
							class="p-3 text-gray-500 transition-colors duration-200 hover:text-blue-500"
							title="Swap units"
						>
							<svg
								class="h-6 w-6 transform md:rotate-90"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
								></path>
							</svg>
						</button>
					</div>

					<!-- To Unit -->
					<div>
						<label for="to-unit" class="mb-2 block text-sm font-medium text-gray-700"
							><T>To</T></label
						>
						<select
							id="to-unit"
							bind:value={toUnit}
							class="w-full rounded-lg border border-gray-300 p-3 focus:border-transparent focus:ring-2 focus:ring-blue-500"
						>
							{#each Object.entries(categories[selectedCategory].units) as [key, unit] (key)}
								<option value={key}>{unit.name} ({unit.symbol})</option>
							{/each}
						</select>
						<div
							class="mt-2 flex min-h-[3rem] w-full items-center rounded-lg border border-gray-300 bg-white p-3"
						>
							<span
								class="text-lg font-medium {result && result !== 'Please enter a valid number'
									? 'text-green-600'
									: 'text-gray-400'}"
							>
								{result || 'Result will appear here'}
							</span>
						</div>
					</div>
				</div>

				{#if result && result !== 'Please enter a valid number' && result !== 'Invalid input'}
					<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
						<div class="text-sm font-medium text-blue-600">
							{inputValue}
							{categories[selectedCategory].units[fromUnit].symbol} =
							{result}
							{categories[selectedCategory].units[toUnit].symbol}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- History -->
		<div class="rounded-xl bg-gray-50 p-6">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="font-semibold text-gray-800"><T>History</T></h3>
				{#if history.length > 0}
					<button onclick={clearHistory} class="text-sm text-red-500 hover:text-red-700">
						Clear
					</button>
				{/if}
			</div>

			{#if history.length === 0}
				<p class="text-sm text-gray-500"><T>No conversions yet</T></p>
			{:else}
				<div class="max-h-96 space-y-3 overflow-y-auto">
					{#each history as item, i (i)}
						<div class="rounded-lg border border-gray-200 bg-white p-3">
							<div class="text-sm font-medium">{item.input} → {item.output}</div>
							<div class="mt-1 text-xs text-gray-500">{item.conversion}</div>
							<div class="mt-1 text-xs text-gray-400">{item.timestamp}</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
