<script lang="ts">
	import type { City } from './types';

	type SearchResult = City;

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

		filteredResults = cities.filter((city: SearchResult) => {
			// Search in primary name and country
			if (
				city.name.toLowerCase().includes(searchTerm) ||
				city.country.toLowerCase().includes(searchTerm)
			) {
				return true;
			}

			// Search in alternative names if they exist
			if (city.altnames) {
				for (const langCode in city.altnames) {
					const altNamesArray = city.altnames[langCode];
					if (
						altNamesArray &&
						altNamesArray.some((altName) => altName.toLowerCase().includes(searchTerm))
					) {
						return true;
					}
				}
			}

			return false;
		});

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
	let searchTimeout: NodeJS.Timeout;
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
					<div class="font-medium">{result.name}</div>
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
