<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import T from './T.svelte';

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

	type TimeMode = 'current' | 'custom' | 'epoch';

	let currentTime: Date = $state(new Date());
	let timeInterval: ReturnType<typeof setInterval> | undefined;
	let epochInput: string = $state('');

	// Custom time input variables
	let customTimeInput: string = $state('');
	let customDateInput: string = $state('');
	let customTimezone: string = $state('Local');

	// Mode state - replaces useCustomTime and showEpochConverter
	let timeMode: TimeMode = $state('current');

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

			// Mode
			if (timeMode !== 'current') {
				params.set('mode', timeMode);
			} else {
				params.delete('mode');
			}

			// Custom time params
			if (customTimeInput) {
				params.set('time', customTimeInput);
			} else {
				params.delete('time');
			}

			if (customDateInput) {
				params.set('date', customDateInput);
			} else {
				params.delete('date');
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

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	function loadFromUrl() {
		// Load mode
		const mode = $page.url.searchParams.get('mode') as TimeMode;
		if (mode && ['current', 'custom', 'epoch'].includes(mode)) {
			timeMode = mode;
		}

		// Load custom time params
		const time = $page.url.searchParams.get('time');
		const date = $page.url.searchParams.get('date');
		const customTz = $page.url.searchParams.get('custom_tz');

		if (time) {
			customTimeInput = time;
			timeMode = 'custom';
		}
		if (date) {
			customDateInput = date;
		}
		if (customTz) {
			customTimezone = customTz;
		}

		// Load epoch converter params
		const epoch = $page.url.searchParams.get('epoch');

		if (epoch) {
			epochInput = epoch;
			timeMode = 'epoch';
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

	function getCustomTimeInTimezone(timezone: string, _referenceTime: Date): TimeInfo {
		// Use the display time (which handles current, custom, and epoch modes)
		return getTimeInTimezone(timezone, displayTime());
	}

	function createDateInTimezone(
		hours: number,
		minutes: number,
		timezone: string,
		baseDate: Date
	): Date {
		// Simple and reliable approach using the inverse of what we want to achieve
		// We'll create a date and iteratively find the UTC time that produces our desired local time

		const year = baseDate.getFullYear();
		const month = baseDate.getMonth();
		const day = baseDate.getDate();

		// Start with a rough estimate: create date with desired time in local timezone
		let testDate = new Date(year, month, day, hours, minutes, 0, 0);

		// Now check what time this shows up as in our target timezone
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});

		// Get the current time as it appears in the target timezone
		const targetTimeString = formatter.format(testDate);
		const [targetHours, targetMinutes] = targetTimeString.split(':').map(Number);

		// Calculate the difference between what we got and what we wanted
		const wantedMinutes = hours * 60 + minutes;
		const gotMinutes = targetHours * 60 + targetMinutes;
		const diffMinutes = wantedMinutes - gotMinutes;

		// Adjust the date by the difference
		testDate = new Date(testDate.getTime() + diffMinutes * 60000);

		return testDate;
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

	function setMode(mode: TimeMode) {
		timeMode = mode;

		if (mode === 'custom' && !customTimeInput) {
			const now = new Date();
			customTimeInput = now.toTimeString().slice(0, 5); // HH:MM format
			customDateInput = now.toISOString().slice(0, 10); // YYYY-MM-DD format
		}

		updateUrl();
	}

	function clearCurrentMode() {
		if (timeMode === 'custom') {
			customTimeInput = '';
			customDateInput = '';
			customTimezone = 'Local';
		} else if (timeMode === 'epoch') {
			epochInput = '';
		}

		timeMode = 'current';
		updateUrl();
	}

	// Get timezone info
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	// Derived value for display time - current time, custom time, or epoch time
	const displayTime = $derived(() => {
		if (timeMode === 'epoch' && epochInput) {
			try {
				const timestamp = parseInt(epochInput);
				if (isNaN(timestamp)) {
					return currentTime;
				}
				// Handle both seconds and milliseconds
				const date = epochInput.length >= 13 ? new Date(timestamp) : new Date(timestamp * 1000);
				if (isNaN(date.getTime())) {
					return currentTime;
				}
				return date;
			} catch (error) {
				console.warn('Epoch time conversion failed:', error);
				return currentTime;
			}
		}

		if (timeMode === 'custom' && customTimeInput) {
			try {
				const [hours, minutes] = customTimeInput.split(':');
				if (!hours || !minutes) {
					return currentTime;
				}

				let sourceTimezoneName = customTimezone;
				// Handle Local timezone
				if (customTimezone === 'Local') {
					sourceTimezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
				}

				// Use custom date if provided, otherwise use today's date
				const baseDate = customDateInput ? new Date(customDateInput + 'T00:00:00') : new Date();

				// Create a date representing the input time in the source timezone
				const sourceDate = createDateInTimezone(
					parseInt(hours),
					parseInt(minutes),
					sourceTimezoneName,
					baseDate
				);

				return sourceDate;
			} catch (error) {
				console.warn('Custom time conversion failed:', error);
				return currentTime;
			}
		}

		return currentTime;
	});

	// Update timezone info to use display time
	const displayTimezoneOffset = $derived(displayTime().getTimezoneOffset());
	const displayOffsetHours = $derived(Math.abs(Math.floor(displayTimezoneOffset / 60)));
	const displayOffsetMinutes = $derived(Math.abs(displayTimezoneOffset % 60));
	const displayOffsetSign = $derived(displayTimezoneOffset <= 0 ? '+' : '-');
	const displayOffsetString = $derived(
		`UTC${displayOffsetSign}${displayOffsetHours.toString().padStart(2, '0')}:${displayOffsetMinutes.toString().padStart(2, '0')}`
	);
</script>

<div class="mx-auto max-w-6xl space-y-8">
	<!-- Time Display with Custom Time Input -->
	<div class="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 p-8 text-white">
		<h2 class="mb-6 text-2xl font-bold">
			{timeMode === 'custom' && customTimeInput
				? 'Custom Time Conversion'
				: timeMode === 'epoch' && epochInput
					? 'Epoch Time Conversion'
					: timeMode === 'epoch'
						? 'Epoch Converter'
						: 'Current Date & Time'}
		</h2>

		<!-- Mode Selection -->
		<div class="mb-6 flex flex-wrap gap-2">
			<button
				onclick={() => setMode('current')}
				class="rounded-md px-4 py-2 text-white backdrop-blur transition-colors {timeMode ===
				'current'
					? 'bg-white/30'
					: 'bg-white/20 hover:bg-white/30'}"
			>
				Current Time
			</button>
			<button
				onclick={() => setMode('custom')}
				class="rounded-md px-4 py-2 text-white backdrop-blur transition-colors {timeMode ===
				'custom'
					? 'bg-white/30'
					: 'bg-white/20 hover:bg-white/30'}"
			>
				Custom Time
			</button>
			<button
				onclick={() => setMode('epoch')}
				class="rounded-md px-4 py-2 text-white backdrop-blur transition-colors {timeMode === 'epoch'
					? 'bg-white/30'
					: 'bg-white/20 hover:bg-white/30'}"
			>
				Epoch Converter
			</button>
			{#if timeMode !== 'current'}
				<button
					onclick={clearCurrentMode}
					class="rounded-md bg-white/20 px-4 py-2 text-white backdrop-blur transition-colors hover:bg-white/30"
				>
					Clear
				</button>
			{/if}
		</div>

		{#if timeMode === 'custom'}
			<!-- Custom Time Input -->
			<div class="mb-6 grid gap-4 md:grid-cols-3">
				<div>
					<label for="custom-time-input" class="mb-2 block text-sm font-medium"><T>Time</T></label>
					<input
						id="custom-time-input"
						type="time"
						bind:value={customTimeInput}
						class="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/70 backdrop-blur focus:border-white/40 focus:ring-2 focus:ring-white/20"
						oninput={updateUrl}
					/>
				</div>
				<div>
					<label for="custom-date-input" class="mb-2 block text-sm font-medium"><T>Date</T></label>
					<input
						id="custom-date-input"
						type="date"
						bind:value={customDateInput}
						class="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/70 backdrop-blur focus:border-white/40 focus:ring-2 focus:ring-white/20"
						oninput={updateUrl}
					/>
				</div>
				<div>
					<label for="custom-timezone-select" class="mb-2 block text-sm font-medium"
						><T>Source Timezone</T></label
					>
					<select
						id="custom-timezone-select"
						bind:value={customTimezone}
						class="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white backdrop-blur focus:border-white/40 focus:ring-2 focus:ring-white/20"
						onchange={updateUrl}
					>
						<option value="Local"><T>Local</T></option>
						<option value="UTC"><T>UTC</T></option>
						{#each availableCities as city (city.timezone)}
							<option value={city.timezone}>{getCityWithTimezone(city)}</option>
						{/each}
					</select>
				</div>
			</div>
		{:else if timeMode === 'epoch'}
			<!-- Epoch Converter Input -->
			<div class="mb-6">
				<div>
					<label for="epoch-input" class="mb-2 block text-sm font-medium"
						><T>Epoch Timestamp</T></label
					>
					<input
						id="epoch-input"
						type="text"
						bind:value={epochInput}
						placeholder="1640995200 or 1640995200000"
						class="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/70 backdrop-blur focus:border-white/40 focus:ring-2 focus:ring-white/20"
						oninput={updateUrl}
					/>
					<span class="text-xs text-white/70"><T>Enter seconds or milliseconds since epoch</T></span
					>
				</div>
				<div class="mt-3 flex gap-2">
					<button
						onclick={() => {
							epochInput = Math.floor(Date.now() / 1000).toString();
							updateUrl();
						}}
						class="rounded-md bg-white/20 px-3 py-1 text-sm text-white backdrop-blur transition-colors hover:bg-white/30"
					>
						Use Current Time
					</button>
				</div>
			</div>
		{/if}

		<div class="grid gap-6 md:grid-cols-3">
			<!-- Local Time -->
			<div class="rounded-lg bg-white/10 p-6 backdrop-blur">
				<h3 class="mb-2 text-lg font-semibold"><T>Local Time</T></h3>
				<div class="mb-2 font-mono text-3xl font-bold">{formatTime(displayTime())}</div>
				<div class="mb-2 text-sm opacity-90">{formatDate(displayTime())}</div>
				<div class="text-xs opacity-75">{timezone} ({displayOffsetString})</div>
			</div>

			<!-- UTC Time -->
			<div class="rounded-lg bg-white/10 p-6 backdrop-blur">
				<h3 class="mb-2 text-lg font-semibold"><T>UTC Time</T></h3>
				<div class="mb-2 font-mono text-3xl font-bold">
					{formatTime(
						new Date(displayTime().getTime() + displayTime().getTimezoneOffset() * 60000)
					)}
				</div>
				<div class="mb-2 text-sm opacity-90">
					{new Date(
						displayTime().getTime() + displayTime().getTimezoneOffset() * 60000
					).toLocaleDateString('en-US', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric'
					})}
				</div>
				<div class="text-xs opacity-75"><T>Coordinated Universal Time</T></div>
			</div>

			<!-- Epoch Timestamp -->
			<div class="rounded-lg bg-white/10 p-6 backdrop-blur">
				<h3 class="mb-2 text-lg font-semibold"><T>Epoch Timestamp</T></h3>
				<div class="mb-2 font-mono text-3xl font-bold">
					{Math.floor(displayTime().getTime() / 1000)}
				</div>
				<div class="text-xs opacity-75"><T>Seconds since Unix epoch</T></div>
			</div>
		</div>
	</div>

	<!-- World Clock -->
	<div class="rounded-xl border border-gray-100 bg-white shadow-lg">
		<div class="border-b border-gray-100 p-6">
			<h2 class="text-2xl font-bold text-gray-800">
				{(timeMode === 'custom' && customTimeInput) ||
				((timeMode as TimeMode) === 'epoch' && epochInput)
					? 'Time Conversion Results'
					: 'World Clock'}
			</h2>
			<p class="mt-2 text-gray-600">
				{timeMode === 'custom' && customTimeInput
					? `Showing ${customTimeInput} from ${getCityName(customTimezone)} converted to different cities`
					: (timeMode as TimeMode) === 'epoch' && epochInput
						? `Showing epoch timestamp ${epochInput} converted to different cities`
						: 'View current time in different cities around the world'}
			</p>
		</div>

		<div class="p-6">
			<!-- Add City Selector -->
			<div class="mb-6">
				<label class="block">
					<span class="text-sm font-medium text-gray-700"><T>Add City</T></span>
					<select
						onchange={addCity}
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 md:w-auto"
					>
						<option value=""><T>Select a city to add...</T></option>
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
					<p><T>No cities selected. Add some cities to see their current time.</T></p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Quick Reference -->
	<div class="rounded-xl bg-gray-50 p-6">
		<h3 class="mb-4 text-lg font-semibold text-gray-800"><T>Quick Reference</T></h3>
		<div class="grid gap-6 text-sm text-gray-600 md:grid-cols-3">
			<div>
				<h4 class="mb-2 font-medium text-gray-800"><T>Epoch Time Info</T></h4>
				<ul class="space-y-1">
					<li>• Epoch time starts from January 1, 1970 00:00:00 UTC</li>
					<li>• Usually measured in seconds since epoch</li>
					<li>• JavaScript uses milliseconds (multiply by 1000)</li>
					<li>• Also known as Unix timestamp</li>
				</ul>
			</div>
			<div>
				<h4 class="mb-2 font-medium text-gray-800"><T>Supported Date Formats</T></h4>
				<ul class="space-y-1">
					<li>• ISO 8601: 2024-01-01T12:00:00Z</li>
					<li>• RFC 2822: Mon, 01 Jan 2024 12:00:00 GMT</li>
					<li>• US Format: January 1, 2024 12:00 PM</li>
					<li>• Short Format: 1/1/2024 12:00</li>
				</ul>
			</div>
			<div>
				<h4 class="mb-2 font-medium text-gray-800"><T>Time Conversion Features</T></h4>
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
