<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SearchResult } from './types';
	import { searchCities } from './utils';
	import type { City } from './types';

	export let cities: City[] = [];
	export let searchQuery: string = '';
	export let placeholder: string = 'Search for a city... (e.g., "EG,cairo" for Egypt only)';
	export let loading: boolean = false;

	const dispatch = createEventDispatcher<{
		select: SearchResult;
		search: string;
	}>();

	let filteredResults: SearchResult[] = [];
	let showDropdown = false;

	function handleSearch(query: string) {
		searchQuery = query;
		dispatch('search', query);

		if (!query.trim()) {
			filteredResults = [];
			showDropdown = false;
			return;
		}

		filteredResults = searchCities(query, cities);
		showDropdown = filteredResults.length > 0;
	}

	function selectCity(result: SearchResult) {
		searchQuery = `${result.matchedName}, ${result.city.country}`;
		showDropdown = false;
		dispatch('select', result);
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

	$: handleSearch(searchQuery);
</script>

<svelte:window on:click={handleClickOutside} />

<div class="city-search-container relative">
	<label for="city-search-input" class="mb-2 block text-sm font-medium text-gray-700">Search City</label>
	<input
		id="city-search-input"
		type="text"
		bind:value={searchQuery}
		{placeholder}
		class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
		on:focus={handleFocus}
	/>

	{#if showDropdown && filteredResults.length > 0}
		<div
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
		>
			{#each filteredResults as result}
				{console.log(result)}
				<button
					type="button"
					class="w-full border-b border-gray-100 px-4 py-2 text-left last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
					on:click={() => selectCity(result)}
				>
					<div class="font-medium">{result.matchedName}</div>
					<div class="text-sm text-gray-500">
						{result.city.country} • {result.city.lat.toFixed(4)}, {result.city.lng.toFixed(4)}
					</div>
				</button>
			{/each}
		</div>
	{/if}

	{#if loading}
		<p class="mt-1 text-sm text-gray-500">Loading cities...</p>
	{/if}
</div>
