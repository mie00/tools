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
	$: timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	$: timezoneOffset = currentTime.getTimezoneOffset();
	$: offsetHours = Math.abs(Math.floor(timezoneOffset / 60));
	$: offsetMinutes = Math.abs(timezoneOffset % 60);
	$: offsetSign = timezoneOffset <= 0 ? '+' : '-';
	$: offsetString = `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;
</script>

<div class="max-w-4xl mx-auto space-y-8">
	<!-- Current Time Display -->
	<div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-8 text-center">
		<h2 class="text-2xl font-bold mb-6">Current Date & Time</h2>
		
		<div class="grid md:grid-cols-2 gap-6">
			<!-- Local Time -->
			<div class="bg-white/10 backdrop-blur rounded-lg p-6">
				<h3 class="text-lg font-semibold mb-2">Local Time</h3>
				<div class="text-3xl font-mono font-bold mb-2">{formatTime(currentTime)}</div>
				<div class="text-sm opacity-90 mb-2">{formatDate(currentTime)}</div>
				<div class="text-xs opacity-75">{timezone} ({offsetString})</div>
			</div>
			
			<!-- UTC Time -->
			<div class="bg-white/10 backdrop-blur rounded-lg p-6">
				<h3 class="text-lg font-semibold mb-2">UTC Time</h3>
				<div class="text-3xl font-mono font-bold mb-2">{formatTime(new Date(currentTime.getTime() + currentTime.getTimezoneOffset() * 60000))}</div>
				<div class="text-sm opacity-90 mb-2">{new Date(currentTime.getTime() + currentTime.getTimezoneOffset() * 60000).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
				<div class="text-xs opacity-75">Coordinated Universal Time</div>
			</div>
		</div>
		
		<!-- Current Epoch -->
		<div class="mt-6 bg-white/10 backdrop-blur rounded-lg p-4">
			<div class="text-sm opacity-90 mb-1">Current Epoch Timestamp</div>
			<div class="font-mono text-lg">{Math.floor(currentTime.getTime() / 1000)}</div>
		</div>
	</div>

	<!-- Epoch Converter -->
	<div class="bg-white rounded-xl shadow-lg border border-gray-100">
		<div class="border-b border-gray-100 p-6">
			<h2 class="text-2xl font-bold text-gray-800">Epoch Converter</h2>
			<p class="text-gray-600 mt-2">Convert between Unix timestamps and human-readable dates</p>
		</div>
		
		<div class="p-6">
			<div class="grid lg:grid-cols-2 gap-8">
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
								class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								on:input={convertFromEpoch}
							/>
							<span class="text-xs text-gray-500">Enter seconds or milliseconds</span>
						</label>
						
						<div class="flex gap-2">
							<button
								on:click={getCurrentEpoch}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
							>
								Use Current Time
							</button>
							<button
								on:click={() => {epochInput = ''; humanResult = '';}}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
							>
								Clear
							</button>
						</div>
						
						{#if humanResult}
							<div class="bg-green-50 border border-green-200 rounded-md p-3">
								<div class="text-sm font-medium text-green-800 mb-1">Converted Date:</div>
								<pre class="text-sm text-green-700 whitespace-pre-wrap">{humanResult}</pre>
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
								class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								on:input={convertToEpoch}
							/>
							<span class="text-xs text-gray-500">Or enter any valid date string</span>
						</label>
						
						<input
							type="text"
							bind:value={humanInput}
							placeholder="2024-01-01 12:00:00 or Dec 25, 2024"
							class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							on:input={convertToEpoch}
						/>
						
						<div class="flex gap-2">
							<button
								on:click={getCurrentDateTime}
								class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
							>
								Use Current Time
							</button>
							<button
								on:click={() => {humanInput = ''; epochResult = '';}}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
							>
								Clear
							</button>
						</div>
						
						{#if epochResult}
							<div class="bg-green-50 border border-green-200 rounded-md p-3">
								<div class="text-sm font-medium text-green-800 mb-1">Converted Epoch:</div>
								<pre class="text-sm text-green-700 whitespace-pre-wrap font-mono">{epochResult}</pre>
							</div>
						{/if}
					</div>
				</div>
			</div>
			
			<!-- Error Message -->
			{#if errorMessage}
				<div class="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
					<div class="text-sm text-red-800">
						<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
						{errorMessage}
					</div>
				</div>
			{/if}
			
			<!-- Clear All Button -->
			<div class="mt-6 text-center">
				<button
					on:click={clearResults}
					class="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
				>
					Clear All
				</button>
			</div>
		</div>
	</div>

	<!-- Quick Reference -->
	<div class="bg-gray-50 rounded-xl p-6">
		<h3 class="text-lg font-semibold text-gray-800 mb-4">Quick Reference</h3>
		<div class="grid md:grid-cols-2 gap-6 text-sm text-gray-600">
			<div>
				<h4 class="font-medium text-gray-800 mb-2">Epoch Time Info</h4>
				<ul class="space-y-1">
					<li>• Epoch time starts from January 1, 1970 00:00:00 UTC</li>
					<li>• Usually measured in seconds since epoch</li>
					<li>• JavaScript uses milliseconds (multiply by 1000)</li>
					<li>• Also known as Unix timestamp</li>
				</ul>
			</div>
			<div>
				<h4 class="font-medium text-gray-800 mb-2">Supported Date Formats</h4>
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