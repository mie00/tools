<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	// Type definitions
	interface AvailableCity {
		name: string;
		timezone: string;
	}

	interface TimeInfo {
		time: string;
		date: string;
		offset: string;
	}

	let currentTime: Date = $state(new Date());
	let timeInterval: ReturnType<typeof setInterval> | undefined;
	let epochInput: string = $state('');
	let humanInput: string = $state('');
	let epochResult: string = $state('');
	let humanResult: string = $state('');
	let errorMessage: string = $state('');

	// Custom time input variables
	let customTimeInput: string = $state('');
	let customTimezone: string = $state('Local');
	let useCustomTime: boolean = $state(false);

	// Selected cities for display - with persistence
	let selectedCities: string[] = $state([]);
	let availableCities: AvailableCity[] = [
		// User's preferred cities at the top
		{ name: 'Cairo', timezone: 'Africa/Cairo' },
		{ name: 'Dubai', timezone: 'Asia/Dubai' },
		{ name: 'Riyadh', timezone: 'Asia/Riyadh' },
		{ name: 'Amsterdam', timezone: 'Europe/Amsterdam' },
		{ name: 'Dublin', timezone: 'Europe/Dublin' },
		{ name: 'New York', timezone: 'America/New_York' },
		{ name: 'Los Angeles', timezone: 'America/Los_Angeles' },
		// Other major cities
		{ name: 'London', timezone: 'Europe/London' },
		{ name: 'Paris', timezone: 'Europe/Paris' },
		{ name: 'Berlin', timezone: 'Europe/Berlin' },
		{ name: 'Chicago', timezone: 'America/Chicago' },
		{ name: 'Tokyo', timezone: 'Asia/Tokyo' },
		{ name: 'Shanghai', timezone: 'Asia/Shanghai' },
		{ name: 'Mumbai', timezone: 'Asia/Kolkata' },
		{ name: 'Sydney', timezone: 'Australia/Sydney' },
		{ name: 'Singapore', timezone: 'Asia/Singapore' },
		{ name: 'Hong Kong', timezone: 'Asia/Hong_Kong' },
		{ name: 'Seoul', timezone: 'Asia/Seoul' },
		{ name: 'Bangkok', timezone: 'Asia/Bangkok' },
		{ name: 'Moscow', timezone: 'Europe/Moscow' },
		{ name: 'São Paulo', timezone: 'America/Sao_Paulo' },
		{ name: 'Mexico City', timezone: 'America/Mexico_City' },
		{ name: 'Toronto', timezone: 'America/Toronto' },
		{ name: 'Vancouver', timezone: 'America/Vancouver' }
	];

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			// Custom time params
			if (customTimeInput) {
				params.set('time', customTimeInput);
			} else {
				params.delete('time');
			}

			if (customTimezone !== 'Local') {
				params.set('custom_tz', customTimezone);
			} else {
				params.delete('custom_tz');
			}

			// Epoch converter params
			if (epochInput) {
				params.set('epoch', epochInput);
			} else {
				params.delete('epoch');
			}

			if (humanInput) {
				params.set('human', humanInput);
			} else {
				params.delete('human');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	function loadFromUrl() {
		// Load custom time params
		const time = $page.url.searchParams.get('time');
		const customTz = $page.url.searchParams.get('custom_tz');

		if (time) {
			customTimeInput = time;
			useCustomTime = true;
		}
		if (customTz) {
			customTimezone = customTz;
		}

		// Load epoch converter params
		const epoch = $page.url.searchParams.get('epoch');
		const human = $page.url.searchParams.get('human');

		if (epoch) {
			epochInput = epoch;
			convertFromEpoch();
		}
		if (human) {
			humanInput = human;
			convertToEpoch();
		}
	}

	onMount(() => {
		// Load from URL parameters first
		loadFromUrl();

		// Load saved cities from localStorage
		const savedCities = localStorage.getItem('selectedCities');
		if (savedCities) {
			try {
				selectedCities = JSON.parse(savedCities);
			} catch (e) {
				// If parsing fails, use default cities
				console.warn('Failed to parse saved cities from localStorage:', e);
				selectedCities = [
					'Africa/Cairo',
					'Asia/Dubai',
					'Asia/Riyadh',
					'Europe/Amsterdam',
					'Europe/Dublin',
					'America/New_York',
					'America/Los_Angeles'
				];
			}
		} else {
			// Default cities for first time users
			selectedCities = [
				'Africa/Cairo',
				'Asia/Dubai',
				'Asia/Riyadh',
				'Europe/Amsterdam',
				'Europe/Dublin',
				'America/New_York',
				'America/Los_Angeles'
			];
		}

		// Update time every second
		timeInterval = setInterval(() => {
			currentTime = new Date();
		}, 1000);
	});

	onDestroy(() => {
		if (timeInterval) {
			clearInterval(timeInterval);
		}
	});

	function formatTime(date: Date) {
		return date.toLocaleTimeString('en-US', {
			hour12: true,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatDate(date: Date) {
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatISO(date: Date) {
		return date.toISOString();
	}

	function getCustomTimeInTimezone(timezone: string, referenceTime: Date): TimeInfo {
		if (!useCustomTime || !customTimeInput) {
			return getTimeInTimezone(timezone, referenceTime);
		}

		try {
			// Get today's date for the time conversion
			const today = new Date();
			const [hours, minutes] = customTimeInput.split(':');

			if (!hours || !minutes) {
				throw new Error('Invalid time format');
			}

			let sourceTimezoneName = customTimezone;
			// Handle Local timezone
			if (customTimezone === 'Local') {
				sourceTimezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			}

			// Create a date string that represents the input time in the source timezone
			const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T${hours}:${minutes}:00`;

			// Create a date assuming it's in the source timezone
			// We'll use a trick: create the date as if it were UTC, then adjust for source timezone
			const baseDate = new Date(dateString);

			// Get the timezone offset difference between source and target
			const sourceOffset = getTimezoneOffsetMinutes(sourceTimezoneName, baseDate);
			const targetOffset = getTimezoneOffsetMinutes(timezone, baseDate);

			// Calculate the time difference in minutes
			const offsetDiff = targetOffset - sourceOffset;

			// Apply the offset to get the correct time in target timezone
			const resultDate = new Date(baseDate.getTime() + offsetDiff * 60000);

			// Format the result in the target timezone
			const timeFormatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				hour12: true,
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});

			const dateFormatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});

			// Get timezone offset
			const offsetFormatter = new Intl.DateTimeFormat('en', {
				timeZone: timezone,
				timeZoneName: 'shortOffset'
			});
			const offset =
				offsetFormatter.formatToParts(resultDate).find((part) => part.type === 'timeZoneName')
					?.value || '';

			return {
				time: timeFormatter.format(resultDate),
				date: dateFormatter.format(resultDate),
				offset: offset
			};
		} catch (error) {
			// Fallback to current time if conversion fails
			console.warn('Time conversion failed:', error);
			return getTimeInTimezone(timezone, referenceTime);
		}
	}

	function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
		// Get the timezone offset in minutes for a given timezone and date
		const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);

		// Create a date formatter for the target timezone
		const formatter = new Intl.DateTimeFormat('sv-SE', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});

		// Get the local time in the target timezone
		const localTimeString = formatter.format(utcDate);
		const localTime = new Date(localTimeString);

		// Calculate the offset
		return (localTime.getTime() - utcDate.getTime()) / 60000;
	}

	function getTimeInTimezone(timezone: string, referenceTime: Date = new Date()): TimeInfo {
		const timeFormatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			hour12: true,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});

		const dateFormatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});

		// Get timezone offset
		const offsetFormatter = new Intl.DateTimeFormat('en', {
			timeZone: timezone,
			timeZoneName: 'shortOffset'
		});
		const offset =
			offsetFormatter.formatToParts(referenceTime).find((part) => part.type === 'timeZoneName')
				?.value || '';

		return {
			time: timeFormatter.format(referenceTime),
			date: dateFormatter.format(referenceTime),
			offset: offset
		};
	}

	function getCityName(timezone: string): string {
		const city = availableCities.find((c) => c.timezone === timezone);
		return city ? city.name : timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
	}

	function addCity(event: Event) {
		const select = event.target as HTMLSelectElement;
		const timezone = select.value;
		if (timezone && !selectedCities.includes(timezone)) {
			selectedCities = [...selectedCities, timezone];
			// Save to localStorage
			localStorage.setItem('selectedCities', JSON.stringify(selectedCities));
		}
		select.value = '';
	}

	function removeCity(timezone: string) {
		selectedCities = selectedCities.filter((tz) => tz !== timezone);
		// Save to localStorage
		localStorage.setItem('selectedCities', JSON.stringify(selectedCities));
	}

	function getTimezoneAbbreviation(timezone: string): string {
		try {
			// Use current time to get the correct seasonal abbreviation
			const now = new Date();
			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				timeZoneName: 'shortGeneric'
			});
			const parts = formatter.formatToParts(now);
			const timeZoneName = parts.find((part) => part.type === 'timeZoneName');

			// If shortGeneric doesn't work well, try short
			if (!timeZoneName || timeZoneName.value.includes('GMT')) {
				const shortFormatter = new Intl.DateTimeFormat('en-US', {
					timeZone: timezone,
					timeZoneName: 'short'
				});
				const shortParts = shortFormatter.formatToParts(now);
				const shortTimeZoneName = shortParts.find((part) => part.type === 'timeZoneName');
				return shortTimeZoneName ? shortTimeZoneName.value : '';
			}

			return timeZoneName ? timeZoneName.value : '';
		} catch (e) {
			console.warn('Failed to get timezone abbreviation:', e);
			return '';
		}
	}

	function getCityWithTimezone(city: AvailableCity): string {
		const abbreviation = getTimezoneAbbreviation(city.timezone);
		return abbreviation ? `${city.name} (${abbreviation})` : city.name;
	}

	function toggleCustomTime() {
		useCustomTime = !useCustomTime;
		if (!useCustomTime) {
			customTimeInput = '';
			customTimezone = 'Local';
		}
		updateUrl();
	}

	function setCurrentTime() {
		const now = new Date();
		customTimeInput = now.toTimeString().slice(0, 5); // HH:MM format
		useCustomTime = true;
		updateUrl();
	}

	function clearCustomTime() {
		customTimeInput = '';
		customTimezone = 'Local';
		useCustomTime = false;
		updateUrl();
	}

	function convertFromEpoch() {
		errorMessage = '';
		try {
			const timestamp = parseInt(epochInput);
			if (isNaN(timestamp)) {
				throw new Error('Invalid epoch timestamp');
			}

			// Handle both seconds and milliseconds
			const date = epochInput.length >= 13 ? new Date(timestamp) : new Date(timestamp * 1000);

			if (isNaN(date.getTime())) {
				throw new Error('Invalid epoch timestamp');
			}

			humanResult = `Local: ${formatDate(date)} at ${formatTime(date)}\nUTC: ${date.toUTCString()}\nISO: ${formatISO(date)}`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Conversion failed';
			humanResult = '';
		}
		updateUrl();
	}

	function convertToEpoch() {
		if (!humanInput) {
			epochResult = '';
			errorMessage = '';
			return;
		}
		try {
			const date = new Date(humanInput);
			if (isNaN(date.getTime())) {
				throw new Error('Invalid date format');
			}
			epochResult = String(Math.floor(date.getTime() / 1000));
			errorMessage = '';
		} catch (error) {
			epochResult = '';
			errorMessage = error instanceof Error ? error.message : 'An error occurred';
		}
		updateUrl();
	}

	function getCurrentEpoch() {
		const now = new Date();
		epochInput = Math.floor(now.getTime() / 1000).toString();
		convertFromEpoch();
	}

	function getCurrentDateTime() {
		const now = new Date();
		humanInput = now.toISOString().slice(0, 16); // Format for datetime-local input
		convertToEpoch();
	}

	function clearResults() {
		epochInput = '';
		humanInput = '';
		epochResult = '';
		humanResult = '';
		errorMessage = '';
	}

	// Get timezone info
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const timezoneOffset = $derived(currentTime.getTimezoneOffset());
	const offsetHours = $derived(Math.abs(Math.floor(timezoneOffset / 60)));
	const offsetMinutes = $derived(Math.abs(timezoneOffset % 60));
	const offsetSign = $derived(timezoneOffset <= 0 ? '+' : '-');
	const offsetString = $derived(
		`UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`
	);
</script>

<div class="mx-auto max-w-6xl space-y-8">
	<!-- Time Display with Custom Time Input -->
	<div class="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 p-8 text-white">
		<h2 class="mb-6 text-2xl font-bold">
			{useCustomTime && customTimeInput ? 'Custom Time Conversion' : 'Current Date & Time'}
		</h2>

		<!-- Custom Time Input Toggle -->
		<div class="mb-6 flex flex-wrap gap-2">
			<button
				onclick={toggleCustomTime}
				class="rounded-md bg-white/20 px-4 py-2 text-white backdrop-blur transition-colors hover:bg-white/30"
			>
				{useCustomTime ? 'Show Current Time' : 'Convert Custom Time'}
			</button>
			{#if useCustomTime}
				<button
					onclick={setCurrentTime}
					class="rounded-md bg-white/20 px-4 py-2 text-white backdrop-blur transition-colors hover:bg-white/30"
				>
					Use Current Time
				</button>
				<button
					onclick={clearCustomTime}
					class="rounded-md bg-white/20 px-4 py-2 text-white backdrop-blur transition-colors hover:bg-white/30"
				>
					Clear
				</button>
			{/if}
		</div>

		{#if useCustomTime}
			<!-- Custom Time Input -->
			<div class="mb-6 grid gap-4 md:grid-cols-2">
				<div>
					<label for="custom-time-input" class="mb-2 block text-sm font-medium">Time</label>
					<input
						id="custom-time-input"
						type="time"
						bind:value={customTimeInput}
						class="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/70 backdrop-blur focus:border-white/40 focus:ring-2 focus:ring-white/20"
						oninput={updateUrl}
					/>
				</div>
				<div>
					<label for="custom-timezone-select" class="mb-2 block text-sm font-medium"
						>Source Timezone</label
					>
					<select
						id="custom-timezone-select"
						bind:value={customTimezone}
						class="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white backdrop-blur focus:border-white/40 focus:ring-2 focus:ring-white/20"
						onchange={updateUrl}
					>
						<option value="Local">Local</option>
						<option value="UTC">UTC</option>
						{#each availableCities as city (city.timezone)}
							<option value={city.timezone}>{getCityWithTimezone(city)}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Local Time -->
			<div class="rounded-lg bg-white/10 p-6 backdrop-blur">
				<h3 class="mb-2 text-lg font-semibold">Local Time</h3>
				<div class="mb-2 font-mono text-3xl font-bold">{formatTime(currentTime)}</div>
				<div class="mb-2 text-sm opacity-90">{formatDate(currentTime)}</div>
				<div class="text-xs opacity-75">{timezone} ({offsetString})</div>
			</div>

			<!-- UTC Time -->
			<div class="rounded-lg bg-white/10 p-6 backdrop-blur">
				<h3 class="mb-2 text-lg font-semibold">UTC Time</h3>
				<div class="mb-2 font-mono text-3xl font-bold">
					{formatTime(new Date(currentTime.getTime() + currentTime.getTimezoneOffset() * 60000))}
				</div>
				<div class="mb-2 text-sm opacity-90">
					{new Date(
						currentTime.getTime() + currentTime.getTimezoneOffset() * 60000
					).toLocaleDateString('en-US', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric'
					})}
				</div>
				<div class="text-xs opacity-75">Coordinated Universal Time</div>
			</div>
		</div>

		<!-- Current Epoch -->
		<div class="mt-6 rounded-lg bg-white/10 p-4 backdrop-blur">
			<div class="mb-1 text-sm opacity-90">Current Epoch Timestamp</div>
			<div class="font-mono text-lg">{Math.floor(currentTime.getTime() / 1000)}</div>
		</div>
	</div>

	<!-- World Clock -->
	<div class="rounded-xl border border-gray-100 bg-white shadow-lg">
		<div class="border-b border-gray-100 p-6">
			<h2 class="text-2xl font-bold text-gray-800">
				{useCustomTime && customTimeInput ? 'Time Conversion Results' : 'World Clock'}
			</h2>
			<p class="mt-2 text-gray-600">
				{useCustomTime && customTimeInput
					? `Showing ${customTimeInput} from ${getCityName(customTimezone)} converted to different cities`
					: 'View current time in different cities around the world'}
			</p>
		</div>

		<div class="p-6">
			<!-- Add City Selector -->
			<div class="mb-6">
				<label class="block">
					<span class="text-sm font-medium text-gray-700">Add City</span>
					<select
						onchange={addCity}
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 md:w-auto"
					>
						<option value="">Select a city to add...</option>
						{#each availableCities.filter((city) => !selectedCities.includes(city.timezone)) as city (city.timezone)}
							<option value={city.timezone}>{getCityWithTimezone(city)}</option>
						{/each}
					</select>
				</label>
			</div>

			<!-- Cities Grid -->
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each selectedCities as timezone (timezone)}
					{@const timeInfo = getCustomTimeInTimezone(timezone, currentTime)}
					<div class="relative rounded-lg border border-gray-200 bg-gray-50 p-4">
						<button
							onclick={() => removeCity(timezone)}
							aria-label="Remove {timezone}"
							class="absolute top-2 right-2 text-gray-400 transition-colors hover:text-red-500"
							title="Remove city"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								></path>
							</svg>
						</button>

						<h3 class="mb-2 pr-6 font-semibold text-gray-800">{getCityName(timezone)}</h3>
						<div class="mb-1 font-mono text-xl font-bold text-blue-600">{timeInfo.time}</div>
						<div class="mb-1 text-sm text-gray-600">{timeInfo.date}</div>
						<div class="text-xs text-gray-500">{timezone} ({timeInfo.offset})</div>
					</div>
				{/each}
			</div>

			{#if selectedCities.length === 0}
				<div class="py-8 text-center text-gray-500">
					<p>No cities selected. Add some cities to see their current time.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Epoch Converter -->
	<div class="rounded-xl border border-gray-100 bg-white shadow-lg">
		<div class="border-b border-gray-100 p-6">
			<h2 class="text-2xl font-bold text-gray-800">Epoch Converter</h2>
			<p class="mt-2 text-gray-600">Convert between Unix timestamps and human-readable dates</p>
		</div>

		<div class="p-6">
			<div class="grid gap-8 lg:grid-cols-2">
				<!-- Epoch to Human -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-gray-800">Epoch to Human Readable</h3>

					<div class="space-y-3">
						<label class="block">
							<span class="text-sm font-medium text-gray-700">Epoch Timestamp</span>
							<input
								type="text"
								bind:value={epochInput}
								placeholder="1640995200 or 1640995200000"
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								oninput={convertFromEpoch}
							/>
							<span class="text-xs text-gray-500">Enter seconds or milliseconds</span>
						</label>

						<div class="flex gap-2">
							<button
								onclick={getCurrentEpoch}
								class="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
							>
								Use Current Time
							</button>
							<button
								onclick={() => {
									epochInput = '';
									humanResult = '';
								}}
								class="rounded-md bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400"
							>
								Clear
							</button>
						</div>

						{#if humanResult}
							<div class="rounded-md border border-green-200 bg-green-50 p-3">
								<div class="mb-1 text-sm font-medium text-green-800">Converted Date:</div>
								<pre class="text-sm whitespace-pre-wrap text-green-700">{humanResult}</pre>
							</div>
						{/if}
					</div>
				</div>

				<!-- Human to Epoch -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-gray-800">Human Readable to Epoch</h3>

					<div class="space-y-3">
						<label class="block">
							<span class="text-sm font-medium text-gray-700">Date & Time</span>
							<input
								type="datetime-local"
								bind:value={humanInput}
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								oninput={convertToEpoch}
							/>
							<span class="text-xs text-gray-500">Or enter any valid date string</span>
						</label>

						<input
							type="text"
							bind:value={humanInput}
							placeholder="2024-01-01 12:00:00 or Dec 25, 2024"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
							oninput={convertToEpoch}
						/>

						<div class="flex gap-2">
							<button
								onclick={getCurrentDateTime}
								class="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
							>
								Use Current Time
							</button>
							<button
								onclick={() => {
									humanInput = '';
									epochResult = '';
								}}
								class="rounded-md bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400"
							>
								Clear
							</button>
						</div>

						{#if epochResult}
							<div class="rounded-md border border-green-200 bg-green-50 p-3">
								<div class="mb-1 text-sm font-medium text-green-800">Converted Epoch:</div>
								<pre
									class="font-mono text-sm whitespace-pre-wrap text-green-700">{epochResult}</pre>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Error Message -->
			{#if errorMessage}
				<div class="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
					<div class="text-sm text-red-800">
						<svg class="mr-1 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						{errorMessage}
					</div>
				</div>
			{/if}

			<!-- Clear All Button -->
			<div class="mt-6 text-center">
				<button
					onclick={clearResults}
					class="rounded-md bg-gray-500 px-6 py-2 text-white transition-colors hover:bg-gray-600"
				>
					Clear All
				</button>
			</div>
		</div>
	</div>

	<!-- Quick Reference -->
	<div class="rounded-xl bg-gray-50 p-6">
		<h3 class="mb-4 text-lg font-semibold text-gray-800">Quick Reference</h3>
		<div class="grid gap-6 text-sm text-gray-600 md:grid-cols-3">
			<div>
				<h4 class="mb-2 font-medium text-gray-800">Epoch Time Info</h4>
				<ul class="space-y-1">
					<li>• Epoch time starts from January 1, 1970 00:00:00 UTC</li>
					<li>• Usually measured in seconds since epoch</li>
					<li>• JavaScript uses milliseconds (multiply by 1000)</li>
					<li>• Also known as Unix timestamp</li>
				</ul>
			</div>
			<div>
				<h4 class="mb-2 font-medium text-gray-800">Supported Date Formats</h4>
				<ul class="space-y-1">
					<li>• ISO 8601: 2024-01-01T12:00:00Z</li>
					<li>• RFC 2822: Mon, 01 Jan 2024 12:00:00 GMT</li>
					<li>• US Format: January 1, 2024 12:00 PM</li>
					<li>• Short Format: 1/1/2024 12:00</li>
				</ul>
			</div>
			<div>
				<h4 class="mb-2 font-medium text-gray-800">Time Conversion Features</h4>
				<ul class="space-y-1">
					<li>• World Clock: View multiple cities at once</li>
					<li>• Custom Time: Convert specific time across timezones</li>
					<li>• Real-time Updates: All times update automatically</li>
					<li>• Add/Remove Cities: Customize your world clock (saved automatically)</li>
					<li>• Local Timezone: Use "Local" for your system timezone</li>
				</ul>
			</div>
		</div>
	</div>
</div>
