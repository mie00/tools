<script lang="ts">
	import { ipToCountry, getCountryName } from './utils/ip-to-country';
	import T from './T.svelte';

	let stunServer = $state('stun:stun.l.google.com:19302');
	let candidates: { ip: string; type: string; country?: string; countryName?: string }[] = $state(
		[]
	);
	let error: string | null = $state(null);
	let isLoading = $state(false);

	async function enrichWithCountry(ip: string) {
		try {
			const countryCode = await ipToCountry(ip);
			const countryName = getCountryName(countryCode);
			return { countryCode, countryName };
		} catch (err) {
			console.error('Failed to get country for IP:', ip, err);
			return { countryCode: 'XX', countryName: 'Unknown' };
		}
	}

	function getIPs() {
		candidates = [];
		error = null;
		isLoading = true;

		try {
			const pc = new RTCPeerConnection({
				iceServers: [{ urls: stunServer }]
			});

			pc.onicecandidate = async (event) => {
				if (event.candidate?.candidate) {
					const candidateStr = event.candidate.candidate;
					const parts = candidateStr.split(' ');
					if (parts.length < 5) return;

					const ip = parts[4];
					// Very basic validation
					if (!ip.includes('.') && !ip.includes(':')) {
						return;
					}

					const type = candidateStr.includes('srflx')
						? 'Server Reflexive (Public)'
						: candidateStr.includes('host')
							? 'Host (Local)'
							: candidateStr.includes('relay')
								? 'Relay'
								: 'Unknown';

					if (!candidates.some((c) => c.ip === ip)) {
						// Add candidate without country info first
						const newCandidate = { ip, type };
						candidates = [...candidates, newCandidate];

						// Enrich with country info asynchronously
						try {
							const { countryCode, countryName } = await enrichWithCountry(ip);
							// Update the specific candidate with country info
							candidates = candidates.map((c) =>
								c.ip === ip ? { ...c, country: countryCode, countryName } : c
							);
						} catch (err) {
							console.error('Failed to enrich IP with country:', err);
						}
					}
				}
			};

			pc.createDataChannel('');
			pc.createOffer()
				.then((offer) => pc.setLocalDescription(offer))
				.catch((err) => {
					error = `Failed to create offer: ${(err as Error).message}`;
					isLoading = false;
				});

			// Stop loading after a reasonable timeout
			setTimeout(() => {
				isLoading = false;
			}, 5000);
		} catch (err) {
			error = `Error creating peer connection: ${(err as Error).message}`;
			isLoading = false;
		}
	}
</script>

<div class="container mx-auto p-4">
	<!-- Online Indicator -->
	<div
		class="mb-6 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3"
	>
		<div class="flex items-center space-x-2">
			<svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM12 9v2"
				></path>
			</svg>
			<span class="text-sm font-medium text-blue-800">Uses WebRTC & Public STUN Server</span>
		</div>
		<div class="text-xs text-blue-600">
			<T>Runs fully in your browser using a public STUN server</T>
		</div>
	</div>

	<div class="mb-4">
		<label for="stun-server" class="block text-sm font-medium text-gray-400"
			><T>STUN Server URL</T></label
		>
		<input
			type="text"
			id="stun-server"
			bind:value={stunServer}
			class="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
			placeholder="e.g., stun:stun.l.google.com:19302"
		/>
	</div>

	<button
		onclick={getIPs}
		disabled={isLoading}
		class="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
	>
		{isLoading ? 'Detecting IPs...' : 'Get IPs'}
	</button>

	{#if error}
		<div class="mt-4 rounded-md bg-red-900 p-3 text-white">
			<strong><T>Error:</T></strong>
			{error}
		</div>
	{/if}

	{#if candidates.length > 0}
		<div class="mt-4">
			<h2 class="text-xl font-semibold"><T>Detected IP Addresses:</T></h2>
			<div class="mt-2 space-y-2">
				{#each candidates as candidate (candidate.ip)}
					<div class="rounded-lg border border-gray-600 bg-gray-800 p-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center space-x-3">
								<span class="rounded bg-gray-100 px-2 py-1 font-mono text-sm">{candidate.ip}</span>
								<span class="font-medium text-gray-300">{candidate.type}</span>
							</div>
							<div class="flex items-center space-x-2">
								{#if candidate.country}
									<div class="flex items-center space-x-2">
										<span class="rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">
											{candidate.country}
										</span>
										<span class="text-sm text-gray-300"><T key={candidate.countryName} /></span>
									</div>
								{:else}
									<span class="text-xs text-gray-500"><T>Loading country...</T></span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
