<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Profile, PrayerTimes, City } from './types';
	import { calculateTimesForProfile, parseCsv } from './utils';
	import ProfileList from './ProfileList.svelte';
	import CreateProfileForm from './CreateProfileForm.svelte';
	import EditProfileForm from './EditProfileForm.svelte';
	import PrayerTimesDisplay from './PrayerTimesDisplay.svelte';

	let profiles: Profile[] = $state([]);
	let showCreateForm = $state(false);
	let editingProfile: Profile | null = $state(null);
	let cities: City[] = $state([]);
	let loadingCities = $state(true);
	let profilePrayerTimes = $state(new Map<string, PrayerTimes>());
	let sharedConfig: Profile | null = $state(null);
	let showSaveButton = $state(false);
	let suggestedName = $state('');
	let sharingInProgress = $state(false);
	let duplicateFoundMessage = $state('');
	let showDuplicateMessage = $state(false);

	let activeProfile = $derived(profiles.find((p) => p.isActive) || null);
	let activePrayerTimes = $derived(activeProfile ? profilePrayerTimes.get(activeProfile.id) : null);

	// URL parameter sync functions
	function _updateUrl() {
		// Prayer times don't automatically update URL - only when explicitly sharing
	}

	// Check if a profile with similar configuration already exists
	function findDuplicateProfile(configToCheck: Profile): Profile | null {
		return (
			profiles.find((profile) => {
				console.log('findDuplicateProfile', profile, configToCheck);
				// Check basic location and method match
				const locationMatch =
					Math.abs(profile.latitude - configToCheck.latitude) < 0.001 &&
					Math.abs(profile.longitude - configToCheck.longitude) < 0.001;
				const methodMatch = profile.calculationMethod === configToCheck.calculationMethod;
				const timezoneMatch = profile.timezone === configToCheck.timezone;

				// For Mawaqit profiles, also check if it's the same mosque
				if (configToCheck.profileType === 'mawaqit' && profile.profileType === 'mawaqit') {
					const mawaqitNameMatch =
						profile.mawaqitConfig?.name === configToCheck.mawaqitConfig?.name;
					return locationMatch && timezoneMatch && mawaqitNameMatch;
				}

				// For calculated profiles, check calculation parameters
				if (configToCheck.profileType === 'calculated' && profile.profileType === 'calculated') {
					const madhabMatch = profile.madhab === configToCheck.madhab;
					const highLatMatch = profile.highLatitudeRule === configToCheck.highLatitudeRule;
					return locationMatch && methodMatch && timezoneMatch && madhabMatch && highLatMatch;
				}

				return false;
			}) || null
		);
	}

	// Compression utilities for calendar data
	// Uses browser's native gzip compression with base64 encoding for URL safety
	// This can reduce large Mawaqit calendar JSON data by 70-90%
	async function compressData(data: string): Promise<string> {
		try {
			const stream = new CompressionStream('gzip');
			const writer = stream.writable.getWriter();
			const reader = stream.readable.getReader();

			// Convert string to Uint8Array
			const encoder = new TextEncoder();
			const input = encoder.encode(data);

			// Start compression
			writer.write(input);
			writer.close();

			// Read compressed data
			const chunks: Uint8Array[] = [];
			let done = false;

			while (!done) {
				const { value, done: readerDone } = await reader.read();
				done = readerDone;
				if (value) {
					chunks.push(value);
				}
			}

			// Combine chunks and convert to base64
			const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
			let offset = 0;
			for (const chunk of chunks) {
				compressed.set(chunk, offset);
				offset += chunk.length;
			}

			// Convert to base64 for URL safety
			return btoa(String.fromCharCode(...compressed));
		} catch (error) {
			console.warn('Compression failed, using raw data:', error);
			return btoa(data); // Fallback to base64 only
		}
	}

	async function decompressData(compressedData: string): Promise<string> {
		try {
			// Convert from base64
			const binaryString = atob(compressedData);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			const stream = new DecompressionStream('gzip');
			const writer = stream.writable.getWriter();
			const reader = stream.readable.getReader();

			// Start decompression
			writer.write(bytes);
			writer.close();

			// Read decompressed data
			const chunks: Uint8Array[] = [];
			let done = false;

			while (!done) {
				const { value, done: readerDone } = await reader.read();
				done = readerDone;
				if (value) {
					chunks.push(value);
				}
			}

			// Combine chunks and convert to string
			const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
			let offset = 0;
			for (const chunk of chunks) {
				decompressed.set(chunk, offset);
				offset += chunk.length;
			}

			const decoder = new TextDecoder();
			return decoder.decode(decompressed);
		} catch (error) {
			console.warn('Decompression failed, trying base64 decode:', error);
			try {
				return atob(compressedData); // Fallback for uncompressed base64
			} catch (base64Error) {
				console.error('Both decompression and base64 decode failed:', base64Error);
				throw new Error('Failed to decompress calendar data');
			}
		}
	}

	async function shareConfiguration(profile: Profile) {
		if (typeof window !== 'undefined') {
			sharingInProgress = true;
			const params = new URLSearchParams();

			params.set('name', profile.name);
			params.set('lat', profile.latitude.toString());
			params.set('lng', profile.longitude.toString());
			params.set('method', profile.calculationMethod);
			params.set('timezone', profile.timezone);
			params.set('madhab', profile.madhab);
			params.set('highLatRule', profile.highLatitudeRule);

			// Handle Mawaqit configurations
			if (profile.profileType === 'mawaqit' && profile.mawaqitConfig) {
				params.set('type', 'mawaqit');
				params.set('mawaqitName', profile.mawaqitConfig.name);

				// Compress and serialize the calendar data
				const calendarData = JSON.stringify(profile.mawaqitConfig.calendar);
				try {
					const compressedCalendar = await compressData(calendarData);
					params.set('calendar', compressedCalendar);
					params.set('compressed', 'true'); // Flag to indicate compression
				} catch (error) {
					console.error('Failed to compress calendar data:', error);
					// Fallback to uncompressed (though this might be too large)
					params.set('calendar', calendarData);
				}

				// Include other Mawaqit-specific data
				if (profile.mawaqitConfig.times) {
					params.set('times', JSON.stringify(profile.mawaqitConfig.times));
				}
				if (profile.mawaqitConfig.shuruq) {
					params.set('shuruq', profile.mawaqitConfig.shuruq);
				}
				if (profile.mawaqitConfig.jumua) {
					params.set('jumua', profile.mawaqitConfig.jumua);
				}
				if (profile.mawaqitConfig.hijriDateEnabled !== undefined) {
					params.set('hijriDate', profile.mawaqitConfig.hijriDateEnabled.toString());
				}
				if (profile.mawaqitConfig.iqamaEnabled !== undefined) {
					params.set('iqama', profile.mawaqitConfig.iqamaEnabled.toString());
				}
				if (profile.mawaqitConfig.countryCode) {
					params.set('countryCode', profile.mawaqitConfig.countryCode);
				}
				if (profile.mawaqitConfig.association) {
					params.set('association', profile.mawaqitConfig.association);
				}
				if (profile.mawaqitConfig.site) {
					params.set('site', profile.mawaqitConfig.site);
				}
			} else {
				params.set('type', 'calculated');
			}

			const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

			// Copy to clipboard
			try {
				await navigator.clipboard.writeText(shareUrl);
				const message =
					profile.profileType === 'mawaqit'
						? 'Mawaqit prayer times configuration URL copied to clipboard! (Calendar data compressed for sharing)'
						: 'Prayer times configuration URL copied to clipboard!';
				alert(message);
			} catch (error) {
				// Fallback - show the URL in a prompt
				console.warn('Failed to copy to clipboard:', error);
				prompt('Share this URL:', shareUrl);
			} finally {
				sharingInProgress = false;
			}
		} else {
			sharingInProgress = false;
		}
	}

	async function loadFromUrl() {
		const urlParams = $page.url.searchParams;
		const name = urlParams.get('name');
		const lat = urlParams.get('lat');
		const lng = urlParams.get('lng');
		const method = urlParams.get('method');
		const timezone = urlParams.get('timezone');
		const madhab = urlParams.get('madhab') || 'standard';
		const highLatRule = urlParams.get('highLatRule') || 'NightMiddle';
		const type = urlParams.get('type') || 'calculated';

		console.log('loadFromUrl called with params:', { name, lat, lng, method, timezone, type });

		if (name && lat && lng && timezone) {
			const latitude = parseFloat(lat);
			const longitude = parseFloat(lng);

			if (!isNaN(latitude) && !isNaN(longitude)) {
				const baseConfig = {
					id: 'shared-config',
					name: name,
					latitude: latitude,
					longitude: longitude,
					calculationMethod: method || 'MWL',
					timezone: timezone,
					madhab: madhab,
					highLatitudeRule: highLatRule,
					adjustments: {
						fajr: 0,
						sunrise: 0,
						dhuhr: 0,
						asr: 0,
						maghrib: 0,
						isha: 0
					},
					isActive: false
				};

				// Handle Mawaqit configurations
				if (type === 'mawaqit') {
					console.log('Processing Mawaqit configuration...');
					const mawaqitName = urlParams.get('mawaqitName') || name;
					const calendarParam = urlParams.get('calendar');
					const isCompressed = urlParams.get('compressed') === 'true';
					const timesParam = urlParams.get('times');
					const shuruq = urlParams.get('shuruq');
					const jumua = urlParams.get('jumua');
					const hijriDate = urlParams.get('hijriDate');
					const iqama = urlParams.get('iqama');
					const countryCode = urlParams.get('countryCode');
					const association = urlParams.get('association');
					const site = urlParams.get('site');

					console.log('Mawaqit params:', {
						mawaqitName,
						hasCalendar: !!calendarParam,
						isCompressed,
						hasTimes: !!timesParam
					});

					try {
						// Parse calendar data (with decompression if needed)
						let calendar = [];
						if (calendarParam) {
							console.log('Parsing calendar data, compressed:', isCompressed);
							if (isCompressed) {
								console.log('Decompressing calendar data...');
								const decompressedCalendar = await decompressData(calendarParam);
								console.log('Decompressed calendar length:', decompressedCalendar.length);
								calendar = JSON.parse(decompressedCalendar);
							} else {
								calendar = JSON.parse(calendarParam);
							}
							console.log('Parsed calendar entries:', calendar.length);
						}

						// Parse times data
						let times = [];
						if (timesParam) {
							times = JSON.parse(timesParam);
							console.log('Parsed times:', times);
						}

						const mawaqitConfig = {
							name: mawaqitName,
							timezone: timezone,
							latitude: latitude,
							longitude: longitude,
							times: times,
							calendar: calendar,
							...(shuruq && { shuruq }),
							...(jumua && { jumua }),
							...(hijriDate && { hijriDateEnabled: hijriDate === 'true' }),
							...(iqama && { iqamaEnabled: iqama === 'true' }),
							...(countryCode && { countryCode }),
							...(association && { association }),
							...(site && { site })
						};

						const tempConfig = {
							...baseConfig,
							profileType: 'mawaqit' as const,
							mawaqitConfig: mawaqitConfig
						};

						console.log('Created Mawaqit config:', tempConfig);

						// Check for duplicates
						const existingProfile = findDuplicateProfile(tempConfig);
						if (existingProfile) {
							console.log('Found duplicate profile:', existingProfile.name);
							// Switch to existing profile instead of showing save dialog
							profiles = profiles.map((p) => ({ ...p, isActive: p.id === existingProfile.id }));
							saveProfiles();

							// Show message about switching to existing profile
							duplicateFoundMessage = `Switched to existing profile: "${existingProfile.name}"`;
							showDuplicateMessage = true;
							setTimeout(() => {
								showDuplicateMessage = false;
							}, 5000);

							// Clear URL parameters
							goto(window.location.pathname, { replaceState: true });
							return; // Exit early
						}

						sharedConfig = tempConfig;
					} catch (error) {
						console.error('Error parsing Mawaqit configuration:', error);
						// Fallback to calculated configuration
						const tempConfig = {
							...baseConfig,
							profileType: 'calculated' as const
						};

						// Check for duplicates even for fallback
						const existingProfile = findDuplicateProfile(tempConfig);
						if (existingProfile) {
							profiles = profiles.map((p) => ({ ...p, isActive: p.id === existingProfile.id }));
							saveProfiles();

							duplicateFoundMessage = `Switched to existing profile: "${existingProfile.name}" (Mawaqit data couldn't be loaded)`;
							showDuplicateMessage = true;
							setTimeout(() => {
								showDuplicateMessage = false;
							}, 5000);

							goto(window.location.pathname, { replaceState: true });
							return;
						}

						sharedConfig = tempConfig;
					}
				} else {
					// Standard calculated configuration
					const tempConfig = {
						...baseConfig,
						profileType: 'calculated' as const
					};

					// Check for duplicates
					const existingProfile = findDuplicateProfile(tempConfig);
					if (existingProfile) {
						console.log('Found duplicate calculated profile:', existingProfile.name);
						// Switch to existing profile instead of showing save dialog
						profiles = profiles.map((p) => ({ ...p, isActive: p.id === existingProfile.id }));
						saveProfiles();

						duplicateFoundMessage = `Switched to existing profile: "${existingProfile.name}"`;
						showDuplicateMessage = true;
						setTimeout(() => {
							showDuplicateMessage = false;
						}, 5000);

						// Clear URL parameters
						goto(window.location.pathname, { replaceState: true });
						return; // Exit early
					}

					sharedConfig = tempConfig;
				}

				// Calculate prayer times for shared config
				if (sharedConfig) {
					console.log('Calculating prayer times for shared config...');
					try {
						const times = calculateTimesForProfile(sharedConfig);
						profilePrayerTimes.set(sharedConfig.id, times);
						profilePrayerTimes = new Map(profilePrayerTimes); // Trigger reactivity with a new reference
						console.log('Prayer times calculated successfully');
					} catch (error) {
						console.error('Error calculating shared prayer times:', error);
					}

					showSaveButton = true;
					const configType = type === 'mawaqit' ? 'Mawaqit' : 'Calculated';
					suggestedName = `${name} (${configType} - Shared)`;
					console.log('Shared config ready for saving:', suggestedName);

					// Clear URL parameters after loading
					goto(window.location.pathname, { replaceState: true });
				} else {
					console.log('No shared config to process');
				}
			}
		}
	}

	function saveSharedConfig() {
		if (sharedConfig) {
			const newProfile: Profile = {
				...sharedConfig,
				id: Date.now().toString(),
				name: suggestedName,
				isActive: profiles.length === 0 // Make active if it's the first profile
			};

			// If there are existing profiles, deactivate them
			if (profiles.length > 0) {
				profiles = profiles.map((p) => ({ ...p, isActive: false }));
			}

			profiles = [...profiles, newProfile];
			saveProfiles();
			calculateAllPrayerTimes();

			// Clear shared config
			sharedConfig = null;
			showSaveButton = false;
			suggestedName = '';
		}
	}

	function dismissSharedConfig() {
		sharedConfig = null;
		showSaveButton = false;
		suggestedName = '';
		profilePrayerTimes.delete('shared-config');
		profilePrayerTimes = profilePrayerTimes;
	}

	onMount(async () => {
		loadProfiles();
		await loadCities();
		await loadFromUrl(); // Load shared config after cities are loaded
		calculateAllPrayerTimes();
	});

	async function loadCities() {
		try {
			const response = await fetch('/world_cities_tz_5000.csv');
			const csvText = await response.text();
			cities = parseCsv(csvText);
		} catch (error) {
			console.error('Error loading cities:', error);
		} finally {
			loadingCities = false;
		}
	}

	function loadProfiles() {
		try {
			const stored = localStorage.getItem('prayerProfiles');
			if (stored) {
				const loadedProfiles: Profile[] = JSON.parse(stored);
				if (loadedProfiles.length > 0) {
					const hasActiveProfile = loadedProfiles.some((p) => p.isActive);
					if (!hasActiveProfile) {
						// Ensure there's always an active profile if profiles exist
						loadedProfiles[0].isActive = true;
					}
				}
				profiles = loadedProfiles;
			}
		} catch (error) {
			console.error('Error loading profiles:', error);
		}
	}

	function saveProfiles() {
		try {
			localStorage.setItem('prayerProfiles', JSON.stringify(profiles));
		} catch (error) {
			console.error('Error saving profiles:', error);
		}
	}

	function calculateAllPrayerTimes() {
		// Rebuild the map each time to ensure reactivity
		const newMap = new Map<string, PrayerTimes>();
		for (const profile of profiles) {
			try {
				const times = calculateTimesForProfile(profile);
				newMap.set(profile.id, times);
			} catch (error) {
				console.error(`Error calculating times for profile ${profile.name}:`, error);
			}
		}
		profilePrayerTimes = newMap; // Trigger reactivity with a new reference
	}

	function handleCreateProfile(event: CustomEvent) {
		const newProfile = event.detail;
		profiles = [...profiles, newProfile];
		saveProfiles();
		calculateAllPrayerTimes();
		showCreateForm = false;
	}

	function handleActivateProfile(event: CustomEvent<Profile>) {
		const profile = event.detail;
		profiles = profiles.map((p) => ({ ...p, isActive: p.id === profile.id }));
		saveProfiles();
	}

	function handleEditProfile(event: CustomEvent<Profile>) {
		editingProfile = event.detail;
	}

	function handleSaveEditedProfile(event: CustomEvent<Profile>) {
		const updatedProfile = event.detail;
		profiles = profiles.map((p) => (p.id === updatedProfile.id ? updatedProfile : p));
		saveProfiles();
		calculateAllPrayerTimes();
		editingProfile = null;
	}

	function handleDeleteProfile(event: CustomEvent<string>) {
		const profileId = event.detail;
		const wasActive = profiles.find((p) => p.id === profileId)?.isActive;

		profiles = profiles.filter((p) => p.id !== profileId);

		// If we deleted the active profile, make the first remaining profile active
		if (wasActive && profiles.length > 0) {
			profiles[0].isActive = true;
		}

		saveProfiles();
		calculateAllPrayerTimes();
	}

	async function handleShareProfile(event: CustomEvent<Profile>) {
		const profile = event.detail;
		await shareConfiguration(profile);
	}

	function handleShowCreateForm() {
		showCreateForm = true;
	}

	function handleCancelCreate() {
		showCreateForm = false;
	}

	function handleCancelEdit() {
		editingProfile = null;
	}

	let hasProfiles = $derived(profiles.length > 0);
	let shouldShowMainView = $derived(hasProfiles && !showCreateForm && !editingProfile);
</script>

<div class="space-y-6">
	<!-- Duplicate Profile Found Banner -->
	{#if showDuplicateMessage}
		<div class="rounded-lg border-2 border-green-200 bg-green-50 p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center">
					<span class="mr-2 text-green-600">✓</span>
					<p class="font-medium text-green-800">{duplicateFoundMessage}</p>
				</div>
				<button
					onclick={() => (showDuplicateMessage = false)}
					class="text-green-400 hover:text-green-600"
					title="Dismiss"
				>
					✕
				</button>
			</div>
		</div>
	{/if}

	<!-- Shared Configuration Banner -->
	{#if sharedConfig && showSaveButton}
		<div class="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<h3 class="text-lg font-semibold text-blue-800">Shared Prayer Times Configuration</h3>
					<p class="mt-1 text-blue-700">Someone shared this prayer times configuration with you:</p>
					<div class="mt-2 text-sm text-blue-600">
						<strong>{sharedConfig.name}</strong> • {sharedConfig.latitude.toFixed(4)}, {sharedConfig.longitude.toFixed(
							4
						)}
						{#if sharedConfig.profileType === 'mawaqit'}
							• Mawaqit Mosque Calendar
						{:else}
							• {sharedConfig.calculationMethod}
						{/if}
					</div>
				</div>
				<button
					onclick={dismissSharedConfig}
					class="ml-4 text-blue-400 hover:text-blue-600"
					title="Dismiss"
				>
					✕
				</button>
			</div>
			<div class="mt-4 flex gap-2">
				<input
					type="text"
					bind:value={suggestedName}
					placeholder="Profile name"
					class="flex-1 rounded-md border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
				<button
					onclick={saveSharedConfig}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				>
					Save as Profile
				</button>
			</div>
		</div>
	{/if}

	{#if editingProfile}
		<EditProfileForm
			profile={editingProfile}
			on:save={handleSaveEditedProfile}
			on:cancel={handleCancelEdit}
		/>
	{:else if showCreateForm || !hasProfiles}
		<CreateProfileForm
			{cities}
			{loadingCities}
			hasExistingProfiles={hasProfiles}
			hasSharedConfig={sharedConfig !== null}
			on:create={handleCreateProfile}
			on:cancel={handleCancelCreate}
		/>
	{:else if shouldShowMainView}
		<!-- Profile List -->
		<ProfileList
			{profiles}
			{profilePrayerTimes}
			{sharingInProgress}
			on:activate={handleActivateProfile}
			on:edit={handleEditProfile}
			on:delete={handleDeleteProfile}
			on:share={handleShareProfile}
			on:create-new={handleShowCreateForm}
		/>

		<!-- Prayer Times Display for Active Profile -->
		{#if activeProfile && activePrayerTimes}
			<PrayerTimesDisplay {activeProfile} prayerTimes={activePrayerTimes} />
		{/if}

		<!-- Prayer Times Display for Shared Configuration -->
		{#if sharedConfig}
			{@const sharedTimes = profilePrayerTimes.get(sharedConfig.id)}
			{#if sharedTimes}
				<PrayerTimesDisplay activeProfile={sharedConfig} prayerTimes={sharedTimes} />
			{/if}
		{/if}
	{/if}
</div>
