<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	// Combined state
	let inputText = $state('');
	let urlComponents: any = $state({});
	let searchParams: Array<{
		key: string;
		value: string;
		keyDecoded: string;
		valueDecoded: string;
	}> = $state([]);
	let parsedCurl: any = $state(null);
	let error = $state('');
	let copiedItem = $state('');

	// Editing state
	let editingKey: string | null = $state(null);
	let editingValue = $state('');

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			if (inputText) {
				params.set('input', inputText);
			} else {
				params.delete('input');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	function loadFromUrl() {
		const input = $page.url.searchParams.get('input');

		if (input) {
			inputText = input;
		}
	}

	onMount(() => {
		loadFromUrl();
	});

	// Watch for state changes and update URL - debounced to prevent infinite loops
	let urlUpdateTimeout: NodeJS.Timeout;
	$effect(() => {
		if (typeof window !== 'undefined' && inputText !== undefined) {
			clearTimeout(urlUpdateTimeout);
			urlUpdateTimeout = setTimeout(() => {
				updateUrl();
			}, 100);
		}
	});

	// Track the last input value to detect if we're in a rebuild cycle
	let lastInputValue = '';
	let isRebuildingInput = false;

	// Debounced parsing effect to prevent infinite loops
	let parseTimeout: NodeJS.Timeout;
	$effect(() => {
		// Skip parsing if we're currently rebuilding the input to prevent circular updates
		if (isRebuildingInput) {
			return;
		}

		// Also skip if the input hasn't actually changed (helps prevent unnecessary processing)
		if (inputText === lastInputValue) {
			return;
		}

		clearTimeout(parseTimeout);
		parseTimeout = setTimeout(() => {
			// Reset states for each new input
			urlComponents = {};
			searchParams = [];
			parsedCurl = null;
			error = '';

			const trimmedInput = inputText.trim();

			if (trimmedInput) {
				if (trimmedInput.toLowerCase().startsWith('curl')) {
					try {
						const curlResult = parseCurl(trimmedInput);
						parsedCurl = curlResult;
						if (curlResult.url) {
							// Now parse the URL from the curl command
							parseUrl(curlResult.url);
						} else {
							// curl command is valid but has no URL
							error = 'cURL command does not contain a URL to examine.';
						}
					} catch (e: any) {
						error = e.message || 'Failed to parse cURL command.';
					}
				} else {
					parseUrl(trimmedInput);
				}
			}

			// Update the last input value after processing
			lastInputValue = inputText;
		}, 150);
	});

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
			console.warn('Failed to parse URL:', e);
			error = 'Invalid URL format';
		}
	}

	function rebuildUrl() {
		let newUrl = '';
		newUrl += (urlComponents.protocol || 'https://') + '//';
		newUrl += urlComponents.hostname || '';

		if (urlComponents.port && urlComponents.port !== '80' && urlComponents.port !== '443') {
			newUrl += ':' + urlComponents.port;
		}

		newUrl += urlComponents.pathname || '/';

		if (searchParams.length > 0) {
			const params = new URLSearchParams();
			for (const p of searchParams) {
				params.append(p.key, p.value);
			}
			newUrl += '?' + params.toString();
		}

		if (urlComponents.hash) {
			newUrl += urlComponents.hash;
		}
		return newUrl;
	}

	function rebuildCurl() {
		if (!parsedCurl) return '';

		const command = ['curl'];
		command.push(`'${parsedCurl.url}'`);

		if (parsedCurl.method && parsedCurl.method.toUpperCase() !== 'GET') {
			command.push(`-X ${parsedCurl.method}`);
		}

		if (parsedCurl.headers) {
			for (const [key, value] of Object.entries(parsedCurl.headers)) {
				command.push(`-H '${key}: ${value}'`);
			}
		}

		if (parsedCurl.body) {
			const escapedBody = parsedCurl.body.replace(/'/g, "'\\''");
			command.push(`--data-raw '${escapedBody}'`);
		}

		return command.join(' ');
	}

	function rebuildAndUpdateInput() {
		// Set flag to prevent circular parsing while we update the input
		isRebuildingInput = true;

		if (parsedCurl) {
			if (Object.keys(urlComponents).length > 0) {
				parsedCurl.url = rebuildUrl();
			}
			inputText = rebuildCurl();
		} else if (Object.keys(urlComponents).length > 0) {
			inputText = rebuildUrl();
		}

		// Update the last input value to match the rebuilt input
		lastInputValue = inputText;

		// Reset flag after a brief delay to allow reactive updates to settle
		setTimeout(() => {
			isRebuildingInput = false;
		}, 50);
	}

	function startEditing(key: string, value: string) {
		editingKey = key;
		editingValue = value;
	}

	function cancelEditing() {
		editingKey = null;
		editingValue = '';
	}

	function saveUrlComponentChange(key: string) {
		if (!editingKey) return;
		urlComponents[key] = editingValue;
		if (key === 'pathnameDecoded') {
			urlComponents['pathname'] = encodeURIComponent(editingValue);
		} else if (key === 'pathname') {
			urlComponents['pathnameDecoded'] = decodeURIComponent(editingValue);
		} else if (key === 'hashDecoded') {
			urlComponents['hash'] = encodeURIComponent(editingValue);
		} else if (key === 'hash') {
			try {
				urlComponents['hashDecoded'] = decodeURIComponent(editingValue);
			} catch (e) {
				console.warn('Failed to decode hash:', e);
				urlComponents['hashDecoded'] = editingValue;
			}
		}
		rebuildAndUpdateInput();
		cancelEditing();
	}

	function saveCurlMethodChange() {
		if (!parsedCurl) return;
		parsedCurl.method = editingValue;
		rebuildAndUpdateInput();
		cancelEditing();
	}

	function saveCurlHeaderKeyChange(oldKey: string) {
		if (!parsedCurl) return;
		const newKey = editingValue;
		if (newKey !== oldKey) {
			parsedCurl.headers[newKey] = parsedCurl.headers[oldKey];
			delete parsedCurl.headers[oldKey];
		}
		rebuildAndUpdateInput();
		cancelEditing();
	}

	function saveCurlHeaderValueChange(key: string) {
		if (!parsedCurl) return;
		parsedCurl.headers[key] = editingValue;
		rebuildAndUpdateInput();
		cancelEditing();
	}

	function saveCurlBodyChange() {
		if (!parsedCurl) return;
		parsedCurl.body = editingValue;
		try {
			parsedCurl.bodyPretty = JSON.stringify(JSON.parse(editingValue), null, 2);
		} catch (e) {
			console.warn('Failed to parse JSON body:', e);
			parsedCurl.bodyPretty = undefined;
		}
		rebuildAndUpdateInput();
		cancelEditing();
	}

	function saveSearchParamChange(index: number, field: 'key' | 'value', isDecoded: boolean) {
		const param = searchParams[index];
		if (isDecoded) {
			if (field === 'key') {
				param.keyDecoded = editingValue;
				param.key = encodeURIComponent(editingValue);
			} else {
				param.valueDecoded = editingValue;
				param.value = encodeURIComponent(editingValue);
			}
		} else {
			if (field === 'key') {
				param.key = editingValue;
				param.keyDecoded = decodeURIComponent(editingValue);
			} else {
				param.value = editingValue;
				param.valueDecoded = decodeURIComponent(editingValue);
			}
		}
		searchParams = [...searchParams];
		rebuildAndUpdateInput();
		cancelEditing();
	}

	/**
	 * Parses a cURL command string into its components.
	 * This is a simplified implementation.
	 */
	function parseCurl(curlCommand: string) {
		const result: {
			url: string;
			method: string;
			headers: Record<string, string>;
			body: string | null;
			bodyPretty?: string;
		} = {
			url: '',
			method: 'GET',
			headers: {},
			body: null
		};

		// A simple regex to capture key parts of a curl command.
		// This is not exhaustive and has limitations.
		const parts = curlCommand.match(/'[^']*'|"[^"]*"|\S+/g) || [];

		let i = 0;
		// first part is curl
		if (parts[i].toLowerCase() === 'curl') {
			i++;
		}

		result.url = parts[i++].replace(/'/g, '');

		for (; i < parts.length; i++) {
			const part = parts[i];
			const nextPart = parts[i + 1];

			const unquote = (str: string) => str?.replace(/^['"]|['"]$/g, '');

			switch (part) {
				case '-X':
				case '--request':
					result.method = nextPart;
					i++;
					break;
				case '-H':
				case '--header': {
					const [key, ...valueParts] = nextPart.split(':');
					const value = valueParts.join(':').trim();
					result.headers[unquote(key)] = unquote(value);
					i++;
					break;
				}
				case '-d':
				case '--data':
				case '--data-raw':
					result.body = unquote(nextPart);
					result.method = 'POST';
					i++;
					break;
				case '--data-binary':
					result.body = unquote(nextPart);
					result.method = 'POST';
					i++;
					break;
			}
		}

		if (result.body) {
			try {
				const jsonBody = JSON.parse(result.body);
				result.bodyPretty = JSON.stringify(jsonBody, null, 2);
			} catch (e) {
				// not a json body - this is expected for non-JSON content
				console.debug('Body is not JSON:', e);
			}
		}

		return result;
	}

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
		inputText = '';
	}
</script>

<div class="space-y-6">
	<div class="text-center">
		<h2 class="mb-2 text-2xl font-bold text-gray-800">URL & cURL Examiner</h2>
		<p class="text-gray-600">Enter a URL or a cURL command to see a breakdown of its components.</p>
	</div>

	<!-- Input Section -->
	<div class="space-y-4">
		<div>
			<label for="input-area" class="mb-2 block text-sm font-medium text-gray-700">
				Enter URL or cURL Command
			</label>
			<div class="flex flex-col gap-2">
				<textarea
					id="input-area"
					bind:value={inputText}
					placeholder="curl 'https://api.example.com/items' -H 'Authorization: Bearer token'"
					class="h-32 flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
					rows="4"
				></textarea>
				<button
					onclick={clearInput}
					class="self-end rounded-lg bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600"
				>
					Clear
				</button>
			</div>
			{#if error}
				<p class="mt-2 text-sm text-red-600">{error}</p>
			{/if}
		</div>
	</div>

	<!-- Results -->
	{#if !error}
		<!-- cURL Components -->
		{#if parsedCurl}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-800">cURL Components</h3>

				<!-- Method -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
					<div class="mb-1 flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Method</span>
						<div class="flex items-center gap-2">
							<button
								onclick={() => copyToClipboard(parsedCurl.method, 'curl-method')}
								class="rounded px-2 py-1 text-xs {copiedItem === 'curl-method'
									? 'bg-green-500'
									: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
								title="Copy to clipboard"
							>
								{copiedItem === 'curl-method' ? 'Copied!' : 'Copy'}
							</button>
							{#if editingKey !== 'curl-method'}
								<button
									onclick={() => startEditing('curl-method', parsedCurl.method)}
									class="rounded bg-gray-500 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
									>Edit</button
								>
							{/if}
						</div>
					</div>
					{#if editingKey === 'curl-method'}
						<div class="mt-1 flex items-center gap-2">
							<input
								class="w-full rounded border p-1 font-mono text-sm"
								bind:value={editingValue}
							/>
							<button
								onclick={saveCurlMethodChange}
								class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
							>
							<button
								onclick={cancelEditing}
								class="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
							>
						</div>
					{:else}
						<div class="font-mono text-sm break-all text-gray-800">{parsedCurl.method}</div>
					{/if}
				</div>

				<!-- Headers -->
				{#if Object.keys(parsedCurl.headers).length > 0}
					<div class="space-y-4">
						<h4 class="text-md font-semibold text-gray-800">Headers</h4>
						<div class="space-y-3">
							{#each Object.entries(parsedCurl.headers) as [key, value] (key)}
								<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
									<div class="grid gap-3 md:grid-cols-2">
										<div>
											<div class="mb-2 flex items-center justify-between">
												<span class="text-sm font-medium text-gray-700">Header Key</span>
												<div class="flex items-center gap-2">
													<button
														onclick={() => copyToClipboard(key, `curl-header-key-${key}`)}
														class="rounded px-2 py-1 text-xs {copiedItem ===
														`curl-header-key-${key}`
															? 'bg-green-500'
															: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
													>
														{copiedItem === `curl-header-key-${key}` ? 'Copied!' : 'Copy'}
													</button>
													{#if editingKey !== `curl-header-key-${key}`}
														<button
															onclick={() => startEditing(`curl-header-key-${key}`, key)}
															class="rounded bg-gray-500 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
															>Edit</button
														>
													{/if}
												</div>
											</div>
											{#if editingKey === `curl-header-key-${key}`}
												<div class="mt-1 flex items-center gap-2">
													<input
														class="w-full rounded border p-1 font-mono text-xs"
														bind:value={editingValue}
													/>
													<button
														onclick={() => saveCurlHeaderKeyChange(key)}
														class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
													>
												</div>
											{:else}
												<div class="rounded border bg-white p-2 font-mono text-xs break-all">
													{key}
												</div>
											{/if}
										</div>
										<div>
											<div class="mb-2 flex items-center justify-between">
												<span class="text-sm font-medium text-gray-700">Header Value</span>
												<div class="flex items-center gap-2">
													<button
														onclick={() =>
															copyToClipboard(String(value), `curl-header-value-${key}`)}
														class="rounded px-2 py-1 text-xs {copiedItem ===
														`curl-header-value-${key}`
															? 'bg-green-500'
															: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
													>
														{copiedItem === `curl-header-value-${key}` ? 'Copied!' : 'Copy'}
													</button>
													{#if editingKey !== `curl-header-value-${key}`}
														<button
															onclick={() =>
																startEditing(`curl-header-value-${key}`, String(value))}
															class="rounded bg-gray-500 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
															>Edit</button
														>
													{/if}
												</div>
											</div>
											{#if editingKey === `curl-header-value-${key}`}
												<div class="mt-1 flex items-center gap-2">
													<input
														class="w-full rounded border p-1 font-mono text-xs"
														bind:value={editingValue}
													/>
													<button
														onclick={() => saveCurlHeaderValueChange(key)}
														class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
													>
												</div>
											{:else}
												<div class="rounded border bg-white p-2 font-mono text-xs break-all">
													{value}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Body -->
				{#if parsedCurl.body}
					<div class="space-y-2">
						<h4 class="text-md font-semibold text-gray-800">Body</h4>
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
							<div class="mb-1 flex items-center justify-between">
								<span class="text-sm font-medium text-gray-700">Request Body</span>
								<div class="flex items-center gap-2">
									<button
										onclick={() => copyToClipboard(parsedCurl.body, 'curl-body')}
										class="rounded px-2 py-1 text-xs {copiedItem === 'curl-body'
											? 'bg-green-500'
											: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
										title="Copy to clipboard"
									>
										{copiedItem === 'curl-body' ? 'Copied!' : 'Copy'}
									</button>
									{#if editingKey !== 'curl-body'}
										<button
											onclick={() => startEditing('curl-body', parsedCurl.body || '')}
											class="rounded bg-gray-500 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
											>Edit</button
										>
									{/if}
								</div>
							</div>
							{#if editingKey === 'curl-body'}
								<div class="mt-1 flex flex-col items-end gap-2">
									<textarea
										class="w-full rounded border p-1 font-mono text-xs"
										rows="5"
										bind:value={editingValue}
									></textarea>
									<div>
										<button
											onclick={saveCurlBodyChange}
											class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
										>
										<button
											onclick={cancelEditing}
											class="ml-2 rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
										>
									</div>
								</div>
							{:else}
								<pre
									class="max-h-60 overflow-auto rounded border bg-white p-2 font-mono text-xs break-all"><code
										>{parsedCurl.bodyPretty || parsedCurl.body}</code
									></pre>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- URL Components -->
		{#if Object.keys(urlComponents).length > 0}
			{@const editableUrlComponents = [
				'protocol',
				'hostname',
				'port',
				'pathname',
				'pathnameDecoded',
				'hash',
				'hashDecoded'
			]}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-800">URL Components</h3>
				<div class="grid gap-3">
					{#each Object.entries(urlComponents) as [key, value] (key)}
						{#if value}
							<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
								<div class="mb-1 flex items-center justify-between">
									<span class="text-sm font-medium text-gray-700 capitalize"
										>{key.replace(/([A-Z])/g, ' $1')}</span
									>
									<div class="flex items-center gap-2">
										<button
											onclick={() => copyToClipboard(String(value), `component-${key}`)}
											class="rounded px-2 py-1 text-xs {copiedItem === `component-${key}`
												? 'bg-green-500'
												: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
											title="Copy to clipboard"
										>
											{copiedItem === `component-${key}` ? 'Copied!' : 'Copy'}
										</button>
										{#if editableUrlComponents.includes(key) && editingKey !== `component-${key}`}
											<button
												onclick={() => startEditing(`component-${key}`, String(value))}
												class="rounded bg-gray-500 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
												>Edit</button
											>
										{/if}
									</div>
								</div>
								{#if editingKey === `component-${key}`}
									<div class="mt-1 flex items-center gap-2">
										<input
											class="w-full rounded border p-1 font-mono text-sm"
											bind:value={editingValue}
										/>
										<button
											onclick={() => saveUrlComponentChange(key)}
											class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
										>
										<button
											onclick={cancelEditing}
											class="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
										>
									</div>
								{:else}
									<div class="font-mono text-sm break-all text-gray-800">{value}</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Search Parameters -->
		{#if searchParams.length > 0}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-gray-800">Search Parameters</h3>
				<div class="space-y-3">
					{#each searchParams as param, i (`${param.key}-${i}`)}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
							<div class="grid gap-3 md:grid-cols-2">
								<!-- Key -->
								<div>
									<div class="mb-2 flex items-center justify-between">
										<span class="text-sm font-medium text-gray-700">Key</span>
										<button
											onclick={() => copyToClipboard(param.key, `key-${param.key}`)}
											class="rounded px-2 py-1 text-xs {copiedItem === `key-${param.key}`
												? 'bg-green-500'
												: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
										>
											{copiedItem === `key-${param.key}` ? 'Copied!' : 'Copy'}
										</button>
									</div>
									<div class="space-y-1">
										<div class="flex items-center justify-between text-sm text-gray-600">
											Raw:
											{#if editingKey !== `param-key-${i}`}
												<button
													onclick={() => startEditing(`param-key-${i}`, param.key)}
													class="rounded bg-gray-500 px-2 py-1 text-xs text-white">Edit</button
												>
											{/if}
										</div>
										{#if editingKey === `param-key-${i}`}
											<div class="mt-1 flex items-center gap-2">
												<input
													class="w-full rounded border p-1 font-mono text-xs"
													bind:value={editingValue}
												/>
												<button
													onclick={() => saveSearchParamChange(i, 'key', false)}
													class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
												>
												<button
													onclick={cancelEditing}
													class="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
												>
											</div>
										{:else}
											<div class="rounded border bg-white p-2 font-mono text-xs break-all">
												{param.key}
											</div>
										{/if}

										{#if param.key !== param.keyDecoded}
											<div class="flex items-center justify-between text-sm text-gray-600">
												Decoded:
												{#if editingKey !== `param-key-decoded-${i}`}
													<button
														onclick={() => startEditing(`param-key-decoded-${i}`, param.keyDecoded)}
														class="rounded bg-gray-500 px-2 py-1 text-xs text-white">Edit</button
													>
												{/if}
											</div>
											{#if editingKey === `param-key-decoded-${i}`}
												<div class="mt-1 flex items-center gap-2">
													<input
														class="w-full rounded border p-1 font-mono text-xs"
														bind:value={editingValue}
													/>
													<button
														onclick={() => saveSearchParamChange(i, 'key', true)}
														class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
													>
												</div>
											{:else}
												<div class="rounded border bg-white p-2 font-mono text-xs break-all">
													{param.keyDecoded}
												</div>
											{/if}
										{/if}
									</div>
								</div>

								<!-- Value -->
								<div>
									<div class="mb-2 flex items-center justify-between">
										<span class="text-sm font-medium text-gray-700">Value</span>
										<button
											onclick={() => copyToClipboard(param.value, `value-${param.key}`)}
											class="rounded px-2 py-1 text-xs {copiedItem === `value-${param.key}`
												? 'bg-green-500'
												: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
										>
											{copiedItem === `value-${param.key}` ? 'Copied!' : 'Copy'}
										</button>
									</div>
									<div class="space-y-1">
										<div class="flex items-center justify-between text-sm text-gray-600">
											Raw:
											{#if editingKey !== `param-value-${i}`}
												<button
													onclick={() => startEditing(`param-value-${i}`, param.value)}
													class="rounded bg-gray-500 px-2 py-1 text-xs text-white">Edit</button
												>
											{/if}
										</div>
										{#if editingKey === `param-value-${i}`}
											<div class="mt-1 flex items-center gap-2">
												<input
													class="w-full rounded border p-1 font-mono text-xs"
													bind:value={editingValue}
												/>
												<button
													onclick={() => saveSearchParamChange(i, 'value', false)}
													class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
												>
												<button
													onclick={cancelEditing}
													class="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
												>
											</div>
										{:else}
											<div class="rounded border bg-white p-2 font-mono text-xs break-all">
												{param.value}
											</div>
										{/if}

										{#if param.value !== param.valueDecoded}
											<div class="flex items-center justify-between text-sm text-gray-600">
												Decoded:
												{#if editingKey !== `param-value-decoded-${i}`}
													<button
														onclick={() =>
															startEditing(`param-value-decoded-${i}`, param.valueDecoded)}
														class="rounded bg-gray-500 px-2 py-1 text-xs text-white">Edit</button
													>
												{/if}
											</div>
											{#if editingKey === `param-value-decoded-${i}`}
												<div class="mt-1 flex items-center gap-2">
													<input
														class="w-full rounded border p-1 font-mono text-xs"
														bind:value={editingValue}
													/>
													<button
														onclick={() => saveSearchParamChange(i, 'value', true)}
														class="rounded bg-green-500 px-2 py-1 text-xs text-white">Save</button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white">Cancel</button
													>
												</div>
											{:else}
												<div class="rounded border bg-white p-2 font-mono text-xs break-all">
													{param.valueDecoded}
												</div>
											{/if}
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
