<script lang="ts">
	import type { CitySearchResult } from './types';

	type SearchResult = CitySearchResult;

	let {
		cities,
		loading,
		searchQuery = $bindable(),
		placeholder = 'Search for a city...',
		onselect
	} = $props<{
		cities: SearchResult[];
		loading: boolean;
		searchQuery?: string;
		placeholder?: string;
		onselect: (_city: SearchResult) => void;
	}>();

	let filteredResults: SearchResult[] = $state([]);
	let showDropdown = $state(false);

	function performSearch(query: string) {
		if (!query.trim()) {
			filteredResults = [];
			showDropdown = false;
			return;
		}

		const searchTerm = query.toLowerCase();
		// Build a list of { city, score, matchedName } objects, then sort by score and extract cities
		const scoredResults: { city: SearchResult; score: number; matchedName: string }[] = [];

		for (const city of cities) {
			const names: string[] = [city.name];
			if (city.altnames) {
				for (const langCode in city.altnames) {
					const altNamesArray = city.altnames[langCode];
					if (Array.isArray(altNamesArray)) {
						names.push(...altNamesArray);
					}
				}
			}

			let bestScore: number | null = null;
			let bestMatchedName: string = city.name;

			for (const name of names) {
				const lowerName = name.toLowerCase();

				// 1. Match from beginning
				const idx = lowerName.indexOf(searchTerm);
				if (idx === 0) {
					// Higher score for shorter leftover
					const score = 1000 - (lowerName.length - searchTerm.length);
					if (bestScore === null || score > bestScore) {
						bestScore = score;
						bestMatchedName = name;
					}
				} else if (idx > 0) {
					// Match from anywhere else, lower base score
					const score = 500 - (lowerName.length - searchTerm.length) - idx * 2;
					if (bestScore === null || score > bestScore) {
						bestScore = score;
						bestMatchedName = name;
					}
				}
			}

			// Also check country
			if (city.country && city.country.toLowerCase().includes(searchTerm)) {
				const idx = city.country.toLowerCase().indexOf(searchTerm);
				const score =
					idx === 0
						? 400 - (city.country.length - searchTerm.length)
						: 200 - (city.country.length - searchTerm.length) - idx * 2;
				if (bestScore === null || score > bestScore) {
					bestScore = score;
					bestMatchedName = city.name; // Keep original name when matching by country
				}
			}

			if (bestScore !== null) {
				scoredResults.push({ city, score: bestScore, matchedName: bestMatchedName });
			}
		}

		// Sort by descending score, then alphabetically by city name for tie-breaker
		scoredResults.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.city.name.localeCompare(b.city.name);
		});
		filteredResults = scoredResults.slice(0, 10).map((item) => ({
			...item.city,
			matchedName: item.matchedName
		}));

		showDropdown = filteredResults.length > 0;
	}

	function handleSelect(city: SearchResult) {
		onselect(city);
		showDropdown = false;
		filteredResults = [];
	}

	function handleFocus() {
		if (searchQuery && filteredResults.length > 0) {
			showDropdown = true;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Element;
		const dropdown = target.closest('.city-search-container');
		if (!dropdown) {
			showDropdown = false;
		}
	}

	// Debounced search effect to prevent excessive filtering
	let searchTimeout: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (searchQuery !== undefined) {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				performSearch(searchQuery);
			}, 150);
		}
	});
</script>

<svelte:window onclick={handleClickOutside} />

<div class="city-search-container relative">
	<label for="city-search-input" class="mb-2 block text-sm font-medium text-gray-700"
		>Search City</label
	>
	<input
		id="city-search-input"
		type="text"
		bind:value={searchQuery}
		{placeholder}
		class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
		onfocus={handleFocus}
	/>

	{#if showDropdown && filteredResults.length > 0}
		<div
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
		>
			{#each filteredResults as result (`${result.lat}-${result.lng}-${result.name}`)}
				<button
					type="button"
					class="w-full border-b border-gray-100 px-4 py-2 text-left last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
					onclick={() => handleSelect(result)}
				>
					<div class="font-medium">{result.matchedName || result.name}</div>
					<div class="text-sm text-gray-500">
						{result.country} • {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
					</div>
				</button>
			{/each}
		</div>
	{/if}

	{#if loading}
		<p class="mt-1 text-sm text-gray-500">Loading cities...</p>
	{/if}
</div>
