<script>
	import { onMount, onDestroy } from 'svelte';

	let currentTime = new Date();
	let timeInterval;
	let epochInput = '';
	let humanInput = '';
	let epochResult = '';
	let humanResult = '';
	let errorMessage = '';

	onMount(() => {
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

	function formatTime(date) {
		return date.toLocaleTimeString('en-US', {
			hour12: true,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatDate(date) {
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatISO(date) {
		return date.toISOString();
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
			errorMessage = error.message;
			humanResult = '';
		}
	}

	function convertToEpoch() {
		errorMessage = '';
		try {
			const date = new Date(humanInput);
			if (isNaN(date.getTime())) {
				throw new Error('Invalid date format');
			}

			const epochSeconds = Math.floor(date.getTime() / 1000);
			const epochMilliseconds = date.getTime();

			epochResult = `Seconds: ${epochSeconds}\nMilliseconds: ${epochMilliseconds}`;
		} catch (error) {
			errorMessage = error.message;
			epochResult = '';
		}
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
	$: timezoneOffset = currentTime.getTimezoneOffset();
	$: offsetHours = Math.abs(Math.floor(timezoneOffset / 60));
	$: offsetMinutes = Math.abs(timezoneOffset % 60);
	$: offsetSign = timezoneOffset <= 0 ? '+' : '-';
	$: offsetString = `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;
</script>

<div class="mx-auto max-w-4xl space-y-8">
	<!-- Current Time Display -->
	<div class="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 p-8 text-center text-white">
		<h2 class="mb-6 text-2xl font-bold">Current Date & Time</h2>

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
								on:input={convertFromEpoch}
							/>
							<span class="text-xs text-gray-500">Enter seconds or milliseconds</span>
						</label>

						<div class="flex gap-2">
							<button
								on:click={getCurrentEpoch}
								class="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
							>
								Use Current Time
							</button>
							<button
								on:click={() => {
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
								on:input={convertToEpoch}
							/>
							<span class="text-xs text-gray-500">Or enter any valid date string</span>
						</label>

						<input
							type="text"
							bind:value={humanInput}
							placeholder="2024-01-01 12:00:00 or Dec 25, 2024"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
							on:input={convertToEpoch}
						/>

						<div class="flex gap-2">
							<button
								on:click={getCurrentDateTime}
								class="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
							>
								Use Current Time
							</button>
							<button
								on:click={() => {
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
					on:click={clearResults}
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
		<div class="grid gap-6 text-sm text-gray-600 md:grid-cols-2">
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
		</div>
	</div>
</div>
