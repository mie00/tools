<script lang="ts">
	let inputUrl = '';
	let urlComponents: any = {};
	let searchParams: Array<{
		key: string;
		value: string;
		keyDecoded: string;
		valueDecoded: string;
	}> = [];
	let error = '';
	let copiedItem = '';

	function parseUrl(url: string) {
		error = '';
		urlComponents = {};
		searchParams = [];

		if (!url.trim()) {
			return;
		}

		try {
			// Add protocol if missing
			let processedUrl = url;
			if (!url.match(/^https?:\/\//i)) {
				processedUrl = 'https://' + url;
			}

			const parsedUrl = new URL(processedUrl);

			urlComponents = {
				full: parsedUrl.href,
				protocol: parsedUrl.protocol,
				hostname: parsedUrl.hostname,
				port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'),
				pathname: parsedUrl.pathname,
				search: parsedUrl.search,
				hash: parsedUrl.hash,
				origin: parsedUrl.origin,
				host: parsedUrl.host
			};

			// Add decoded versions
			urlComponents.pathnameDecoded = decodeURIComponent(urlComponents.pathname);
			urlComponents.hashDecoded = urlComponents.hash ? decodeURIComponent(urlComponents.hash) : '';

			// Parse search parameters
			if (parsedUrl.searchParams) {
				searchParams = [];
				for (const [key, value] of parsedUrl.searchParams.entries()) {
					searchParams.push({
						key,
						value,
						keyDecoded: decodeURIComponent(key),
						valueDecoded: decodeURIComponent(value)
					});
				}
			}
		} catch (e) {
			error = 'Invalid URL format';
		}
	}

	$: parseUrl(inputUrl);

	async function copyToClipboard(text: string, itemId: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedItem = itemId;
			setTimeout(() => {
				copiedItem = '';
			}, 2000);
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	}

	function clearInput() {
		inputUrl = '';
	}
</script>

<div class="space-y-6">
	<div class="text-center">
		<h2 class="mb-2 text-2xl font-bold text-gray-800">URL Examiner</h2>
		<p class="text-gray-600">Break down URLs into components and examine search parameters</p>
	</div>

	<!-- Input Section -->
	<div class="space-y-4">
		<div>
			<label for="url-input" class="mb-2 block text-sm font-medium text-gray-700">
				Enter URL to examine
			</label>
			<div class="flex gap-2">
				<input
					id="url-input"
					type="text"
					bind:value={inputUrl}
					placeholder="https://example.com/path?param1=value1&param2=value2#section"
					class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				/>
				<button
					on:click={clearInput}
					class="rounded-lg bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600"
				>
					Clear
				</button>
			</div>
			{#if error}
				<p class="mt-2 text-sm text-red-600">{error}</p>
			{/if}
		</div>
	</div>

	{#if Object.keys(urlComponents).length > 0 && !error}
		<!-- URL Components -->
		<div class="space-y-4">
			<h3 class="text-lg font-semibold text-gray-800">URL Components</h3>
			<div class="grid gap-3">
				{#each Object.entries(urlComponents) as [key, value]}
					{#if value}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
							<div class="mb-1 flex items-center justify-between">
								<span class="text-sm font-medium text-gray-700 capitalize"
									>{key.replace(/([A-Z])/g, ' $1')}</span
								>
								<button
									on:click={() => copyToClipboard(String(value), `component-${key}`)}
									class="rounded px-2 py-1 text-xs {copiedItem === `component-${key}`
										? 'bg-green-500'
										: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
									title="Copy to clipboard"
								>
									{copiedItem === `component-${key}` ? 'Copied!' : 'Copy'}
								</button>
							</div>
							<div class="font-mono text-sm break-all text-gray-800">{value}</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Search Parameters -->
		{#if searchParams.length > 0}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-800">Search Parameters</h3>
				<div class="space-y-3">
					{#each searchParams as param}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
							<div class="grid gap-3 md:grid-cols-2">
								<!-- Key -->
								<div>
									<div class="mb-2 flex items-center justify-between">
										<span class="text-sm font-medium text-gray-700">Key</span>
										<button
											on:click={() => copyToClipboard(param.key, `key-${param.key}`)}
											class="rounded px-2 py-1 text-xs {copiedItem === `key-${param.key}`
												? 'bg-green-500'
												: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
										>
											{copiedItem === `key-${param.key}` ? 'Copied!' : 'Copy'}
										</button>
									</div>
									<div class="space-y-1">
										<div class="text-sm text-gray-600">Raw:</div>
										<div class="rounded border bg-white p-2 font-mono text-xs break-all">
											{param.key}
										</div>
										{#if param.key !== param.keyDecoded}
											<div class="text-sm text-gray-600">Decoded:</div>
											<div class="rounded border bg-white p-2 font-mono text-xs break-all">
												{param.keyDecoded}
											</div>
										{/if}
									</div>
								</div>

								<!-- Value -->
								<div>
									<div class="mb-2 flex items-center justify-between">
										<span class="text-sm font-medium text-gray-700">Value</span>
										<button
											on:click={() => copyToClipboard(param.value, `value-${param.key}`)}
											class="rounded px-2 py-1 text-xs {copiedItem === `value-${param.key}`
												? 'bg-green-500'
												: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
										>
											{copiedItem === `value-${param.key}` ? 'Copied!' : 'Copy'}
										</button>
									</div>
									<div class="space-y-1">
										<div class="text-sm text-gray-600">Raw:</div>
										<div class="rounded border bg-white p-2 font-mono text-xs break-all">
											{param.value}
										</div>
										{#if param.value !== param.valueDecoded}
											<div class="text-sm text-gray-600">Decoded:</div>
											<div class="rounded border bg-white p-2 font-mono text-xs break-all">
												{param.valueDecoded}
											</div>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
