<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { calculationMethods, countryMethodMapping } from './constants';
	import { enrichLocationData, getSuggestedCalculationMethod, parseMawaqitConfig } from './utils';
	import type { City, MawaqitConfig } from './types';
	import CitySearch from './CitySearch.svelte';

	export let cities: City[] = [];
	export let loadingCities: boolean = false;
	export let hasExistingProfiles: boolean = false;

	const dispatch = createEventDispatcher<{
		create: any;
		cancel: void;
	}>();

	let showLocationPermission = false;
	let locationError = '';
	let citySearchQuery = '';
	let createMode: 'manual' | 'mawaqit' = 'manual';
	let mawaqitJson = '';
	let mawaqitError = '';

	let newProfile = {
		name: '',
		latitude: null as number | null,
		longitude: null as number | null,
		timezone: '',
		calculationMethod: 'MWL',
		madhab: 'shafi',
		highLatitudeRule: 'middle_of_night',
		adjustments: {
			fajr: 0,
			sunrise: 0,
			dhuhr: 0,
			asr: 0,
			maghrib: 0,
			isha: 0
		}
	};

	function resetForm() {
		newProfile = {
			name: '',
			latitude: null,
			longitude: null,
			timezone: '',
			calculationMethod: 'MWL',
			madhab: 'shafi',
			highLatitudeRule: 'middle_of_night',
			adjustments: {
				fajr: 0,
				sunrise: 0,
				dhuhr: 0,
				asr: 0,
				maghrib: 0,
				isha: 0
			}
		};
		locationError = '';
		citySearchQuery = '';
	}

	function tryGetCurrentLocation() {
		if (navigator.geolocation) {
			showLocationPermission = true;
			navigator.geolocation.getCurrentPosition(
				async (position) => {
					newProfile.latitude = position.coords.latitude;
					newProfile.longitude = position.coords.longitude;
					showLocationPermission = false;

					// Get timezone and location details
					await enrichCurrentLocation();
				},
				(error) => {
					showLocationPermission = false;
					locationError = 'Unable to get location: ' + error.message;
				}
			);
		}
	}

	async function enrichCurrentLocation() {
		if (!newProfile.latitude || !newProfile.longitude) return;

		try {
			const locationData = await enrichLocationData(newProfile.latitude, newProfile.longitude);

			if (locationData.timezone) {
				newProfile.timezone = locationData.timezone;
			}

			if (locationData.country) {
				// Set default profile name
				if (!newProfile.name) {
					newProfile.name = locationData.country;
				}

				// Suggest calculation method based on country
				const suggestedMethod = getSuggestedCalculationMethod(locationData.country);
				newProfile.calculationMethod = suggestedMethod;
			}
		} catch (error) {
			console.error('Error enriching location data:', error);
			newProfile.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		}
	}

	function handleCitySelect(event: CustomEvent<City>) {
		const city = event.detail;
		newProfile.latitude = city.lat;
		newProfile.longitude = city.lng;
		newProfile.name = `${city.name}, ${city.country}`;

		// Try to get more detailed location info and set calculation method
		enrichCityLocation(city);
	}

	async function enrichCityLocation(city: City) {
		try {
			// Get timezone
			const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			newProfile.timezone = timezone;

			// Suggest calculation method based on country code
			const suggestedMethod = getSuggestedCalculationMethod(city.country);
			newProfile.calculationMethod = suggestedMethod;
		} catch (error) {
			console.error('Error enriching location data:', error);
			newProfile.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		}
	}

	function handleCreate() {
		if (!newProfile.name || !newProfile.latitude || !newProfile.longitude) {
			return;
		}

		const profile = {
			id: Date.now().toString(),
			name: newProfile.name,
			latitude: newProfile.latitude,
			longitude: newProfile.longitude,
			timezone: newProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
			calculationMethod: newProfile.calculationMethod,
			madhab: newProfile.madhab,
			highLatitudeRule: newProfile.highLatitudeRule,
			adjustments: { ...newProfile.adjustments },
			isActive: !hasExistingProfiles // First profile is active by default
		};

		dispatch('create', profile);
		resetForm();
	}

	function handleCancel() {
		resetForm();
		dispatch('cancel');
	}

	function handleMawaqitImport() {
		mawaqitError = '';
		if (!mawaqitJson.trim()) {
			mawaqitError = 'Please paste the mawaqit config data.';
			return;
		}

		try {
			const parsedData = JSON.parse(mawaqitJson);
			const mawaqitConfig = parseMawaqitConfig(parsedData);

			if (!mawaqitConfig) {
				mawaqitError = 'Invalid or incomplete mawaqit config data. Please check the format.';
				return;
			}

			const profile = {
				id: Date.now().toString(),
				name: mawaqitConfig.name,
				latitude: mawaqitConfig.latitude,
				longitude: mawaqitConfig.longitude,
				timezone: mawaqitConfig.timezone,
				calculationMethod: '', // Not applicable for mawaqit
				madhab: '', // Not applicable for mawaqit
				highLatitudeRule: '', // Not applicable for mawaqit
				adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
				isActive: !hasExistingProfiles,
				profileType: 'mawaqit',
				mawaqitConfig: mawaqitConfig
			};

			dispatch('create', profile);
			resetForm();
		} catch (error) {
			mawaqitError = 'Invalid JSON data. Please check the copied text.';
			console.error(error);
		}
	}

	// Auto-get location for new users
	$: if (
		createMode === 'manual' &&
		!hasExistingProfiles &&
		!newProfile.latitude &&
		!newProfile.longitude
	) {
		tryGetCurrentLocation();
	}
</script>

<div class="rounded-xl bg-white p-8 shadow-lg">
	<h3 class="mb-6 text-2xl font-bold text-gray-800">
		{hasExistingProfiles ? 'Create New Profile' : 'Welcome! Create Your First Prayer Profile'}
	</h3>

	<div class="mb-6 border-b border-gray-200">
		<nav class="-mb-px flex space-x-6" aria-label="Tabs">
			<button
				class="border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap"
				class:border-blue-500={createMode === 'manual'}
				class:text-blue-600={createMode === 'manual'}
				class:border-transparent={createMode !== 'manual'}
				class:text-gray-500={createMode !== 'manual'}
				class:hover:border-gray-300={createMode !== 'manual'}
				class:hover:text-gray-700={createMode !== 'manual'}
				on:click={() => (createMode = 'manual')}
			>
				Create Manually
			</button>
			<button
				class="border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap"
				class:border-blue-500={createMode === 'mawaqit'}
				class:text-blue-600={createMode === 'mawaqit'}
				class:border-transparent={createMode !== 'mawaqit'}
				class:text-gray-500={createMode !== 'mawaqit'}
				class:hover:border-gray-300={createMode !== 'mawaqit'}
				class:hover:text-gray-700={createMode !== 'mawaqit'}
				on:click={() => (createMode = 'mawaqit')}
			>
				Import from Mawaqit
			</button>
		</nav>
	</div>

	{#if createMode === 'manual'}
		{#if showLocationPermission}
			<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
				<div class="flex items-center space-x-2">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
					></div>
					<span class="text-blue-700">Getting your current location...</span>
				</div>
			</div>
		{/if}

		{#if locationError}
			<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
				<p class="text-red-700">{locationError}</p>
			</div>
		{/if}

		<div class="grid gap-6 md:grid-cols-2">
			<div>
				<label class="mb-2 block text-sm font-medium text-gray-700">Profile Name</label>
				<input
					type="text"
					bind:value={newProfile.name}
					placeholder="e.g., Home, Work, Cairo"
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>

			<div>
				<label class="mb-2 block text-sm font-medium text-gray-700">Calculation Method</label>
				<select
					bind:value={newProfile.calculationMethod}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				>
					{#each Object.entries(calculationMethods) as [key, method]}
						<option value={key}>{method.name}</option>
					{/each}
				</select>
				{#if calculationMethods[newProfile.calculationMethod]}
					<p class="mt-1 text-sm text-gray-600">
						Used in: {calculationMethods[newProfile.calculationMethod].region.join(', ')}
					</p>
				{/if}
			</div>

			<div class="md:col-span-2">
				<CitySearch
					{cities}
					loading={loadingCities}
					bind:searchQuery={citySearchQuery}
					placeholder="Search for a city or manually enter coordinates below..."
					on:select={handleCitySelect}
				/>
			</div>

			<div>
				<label class="mb-2 block text-sm font-medium text-gray-700">Latitude</label>
				<input
					type="number"
					step="0.000001"
					bind:value={newProfile.latitude}
					placeholder="e.g., 40.7128"
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>

			<div>
				<label class="mb-2 block text-sm font-medium text-gray-700">Longitude</label>
				<input
					type="number"
					step="0.000001"
					bind:value={newProfile.longitude}
					placeholder="e.g., -74.0060"
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>

			<div>
				<label class="mb-2 block text-sm font-medium text-gray-700">Madhab</label>
				<select
					bind:value={newProfile.madhab}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				>
					<option value="shafi">Shafi/Maliki/Hanbali</option>
					<option value="hanafi">Hanafi</option>
				</select>
			</div>

			<div>
				<label class="mb-2 block text-sm font-medium text-gray-700">High Latitude Rule</label>
				<select
					bind:value={newProfile.highLatitudeRule}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				>
					<option value="middle_of_night">Middle of Night</option>
					<option value="seventh_of_night">Seventh of Night</option>
					<option value="twilight_angle">Twilight Angle</option>
				</select>
			</div>
		</div>

		<div class="mt-6 flex space-x-4">
			<button
				on:click={handleCreate}
				disabled={!newProfile.name || !newProfile.latitude || !newProfile.longitude}
				class="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
			>
				Create Profile
			</button>

			{#if !showLocationPermission}
				<button
					on:click={tryGetCurrentLocation}
					class="rounded-lg border border-blue-600 px-6 py-2 text-blue-600 hover:bg-blue-50"
				>
					📍 Use Current Location
				</button>
			{/if}

			{#if hasExistingProfiles}
				<button
					on:click={handleCancel}
					class="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
			{/if}
		</div>
	{:else}
		<!-- Mawaqit Import UI -->
		<div class="space-y-4">
			<div>
				<label for="mawaqit-json" class="mb-2 block text-sm font-medium text-gray-700">
					Mawaqit Config Data
				</label>
				<textarea
					id="mawaqit-json"
					bind:value={mawaqitJson}
					rows="8"
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
					placeholder="Paste the confData from mawaqit.net mosque page source here..."
				></textarea>
				<p class="mt-1 text-sm text-gray-500">
					Find the `confData` variable in the page source of a mosque on mawaqit.net and paste its
					JSON content here.
				</p>
			</div>

			{#if mawaqitError}
				<div class="rounded-lg border border-red-200 bg-red-50 p-4">
					<p class="text-red-700">{mawaqitError}</p>
				</div>
			{/if}

			<div class="flex space-x-4">
				<button
					on:click={handleMawaqitImport}
					class="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
				>
					Import Profile
				</button>
				{#if hasExistingProfiles}
					<button
						on:click={handleCancel}
						class="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
