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

	function handleSearch(query: string) {
		searchQuery = query;

		if (!query.trim()) {
			filteredResults = [];
			showDropdown = false;
			return;
		}

		filteredResults = cities.filter(
			(city: SearchResult) =>
				city.name.toLowerCase().includes(query.toLowerCase()) ||
				city.country.toLowerCase().includes(query.toLowerCase())
		);
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

	$effect(() => {
		handleSearch(searchQuery);
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
				{console.log(result)}
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
