<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { City } from './types';
	import { searchCities } from './utils';

	export let cities: City[] = [];
	export let searchQuery: string = '';
	export let placeholder: string = 'Search for a city... (e.g., "EG,cairo" for Egypt only)';
	export let loading: boolean = false;

	const dispatch = createEventDispatcher<{
		select: City;
		search: string;
	}>();

	let filteredCities: City[] = [];
	let showDropdown = false;

	function handleSearch(query: string) {
		searchQuery = query;
		dispatch('search', query);

		if (!query.trim()) {
			filteredCities = [];
			showDropdown = false;
			return;
		}

		filteredCities = searchCities(query, cities);
		showDropdown = filteredCities.length > 0;
	}

	function selectCity(city: City) {
		searchQuery = `${city.name}, ${city.country}`;
		showDropdown = false;
		dispatch('select', city);
	}

	function handleFocus() {
		if (searchQuery && filteredCities.length > 0) {
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
	<label class="mb-2 block text-sm font-medium text-gray-700">Search City</label>
	<input
		type="text"
		bind:value={searchQuery}
		{placeholder}
		class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
		on:focus={handleFocus}
	/>

	{#if showDropdown && filteredCities.length > 0}
		<div
			class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
		>
			{#each filteredCities as city}
				<button
					type="button"
					class="w-full border-b border-gray-100 px-4 py-2 text-left last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
					on:click={() => selectCity(city)}
				>
					<div class="font-medium">{city.name}</div>
					<div class="text-sm text-gray-500">
						{city.country} • {city.lat.toFixed(4)}, {city.lng.toFixed(4)}
					</div>
				</button>
			{/each}
		</div>
	{/if}

	{#if loading}
		<p class="mt-1 text-sm text-gray-500">Loading cities...</p>
	{/if}
</div>
