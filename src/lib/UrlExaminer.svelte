<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import T from './T.svelte';

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

	// Body tab state
	let activeBodyTab = $state('raw');

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
	let urlUpdateTimeout: ReturnType<typeof setTimeout>;
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
	let parseTimeout: ReturnType<typeof setTimeout>;
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

		if (parsedCurl.cookies && Object.keys(parsedCurl.cookies).length > 0) {
			const cookieString = Object.entries(parsedCurl.cookies)
				.map(([name, value]) => `${name}=${value}`)
				.join('; ');
			command.push(`-b '${cookieString}'`);
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

	function saveCurlCookieKeyChange(oldKey: string) {
		if (!parsedCurl) return;
		const newKey = editingValue;
		if (newKey !== oldKey) {
			parsedCurl.cookies[newKey] = parsedCurl.cookies[oldKey];
			delete parsedCurl.cookies[oldKey];
		}
		rebuildAndUpdateInput();
		cancelEditing();
	}

	function saveCurlCookieValueChange(key: string) {
		if (!parsedCurl) return;
		parsedCurl.cookies[key] = editingValue;
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

	function deleteCurlHeader(key: string) {
		if (!parsedCurl) return;
		delete parsedCurl.headers[key];
		rebuildAndUpdateInput();
	}

	function deleteCurlCookie(name: string) {
		if (!parsedCurl) return;
		delete parsedCurl.cookies[name];
		rebuildAndUpdateInput();
	}

	function deleteSearchParam(index: number) {
		searchParams.splice(index, 1);
		searchParams = [...searchParams];
		rebuildAndUpdateInput();
	}

	function addNewCurlHeader() {
		if (!parsedCurl) return;
		const newKey = 'New-Header';
		let counter = 1;
		let finalKey = newKey;

		// Ensure unique key name
		while (parsedCurl.headers[finalKey]) {
			finalKey = `${newKey}-${counter}`;
			counter++;
		}

		parsedCurl.headers[finalKey] = 'value';
		rebuildAndUpdateInput();
	}

	function addNewCurlCookie() {
		if (!parsedCurl) return;
		const newName = 'newCookie';
		let counter = 1;
		let finalName = newName;

		// Ensure unique cookie name
		while (parsedCurl.cookies[finalName]) {
			finalName = `${newName}${counter}`;
			counter++;
		}

		parsedCurl.cookies[finalName] = 'value';
		rebuildAndUpdateInput();
	}

	function addNewSearchParam() {
		const newParam = {
			key: 'newParam',
			value: 'value',
			keyDecoded: 'newParam',
			valueDecoded: 'value'
		};
		searchParams.push(newParam);
		searchParams = [...searchParams];
		rebuildAndUpdateInput();
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
	 * Handles proper shell-style quoting and escaping.
	 */
	function parseCurl(curlCommand: string) {
		const result: {
			url: string;
			method: string;
			headers: Record<string, string>;
			cookies: Record<string, string>;
			body: string | null;
			bodyPretty?: string;
		} = {
			url: '',
			method: 'GET',
			headers: {},
			cookies: {},
			body: null
		};

		// Tokenize the command properly handling quotes and escapes
		function tokenize(str: string): string[] {
			const tokens: string[] = [];
			let current = '';
			let inSingleQuote = false;
			let inDoubleQuote = false;
			let inAnsiCQuote = false; // For $'string' format
			let escaped = false;

			function processAnsiCEscape(char: string, i: number): { result: string; skipChars: number } {
				switch (char) {
					case 'a':
						return { result: '\x07', skipChars: 0 }; // alert (bell)
					case 'b':
						return { result: '\b', skipChars: 0 }; // backspace
					case 'e':
						return { result: '\x1b', skipChars: 0 }; // escape character
					case 'f':
						return { result: '\f', skipChars: 0 }; // form feed
					case 'n':
						return { result: '\n', skipChars: 0 }; // new line
					case 'r':
						return { result: '\r', skipChars: 0 }; // carriage return
					case 't':
						return { result: '\t', skipChars: 0 }; // horizontal tab
					case 'v':
						return { result: '\v', skipChars: 0 }; // vertical tab
					case '\\':
						return { result: '\\', skipChars: 0 }; // backslash
					case "'":
						return { result: "'", skipChars: 0 }; // single quote
					case 'x': {
						// \xHH - hexadecimal
						const hex = str.substr(i + 1, 2);
						const match = hex.match(/^[0-9a-fA-F]{1,2}/);
						if (match) {
							const value = parseInt(match[0], 16);
							return { result: String.fromCharCode(value), skipChars: match[0].length };
						}
						return { result: char, skipChars: 0 };
					}
					case 'c': {
						// \cx - control character
						const controlChar = str[i + 1];
						if (controlChar) {
							const code = controlChar.toUpperCase().charCodeAt(0);
							if (code >= 64 && code <= 95) {
								// @-_
								return { result: String.fromCharCode(code - 64), skipChars: 1 };
							}
						}
						return { result: char, skipChars: 0 };
					}
					default: {
						// \nnn - octal
						const octal = str.substr(i - 1, 3);
						const match = octal.match(/^[0-7]{1,3}/);
						if (match) {
							const value = parseInt(match[0], 8);
							if (value <= 255) {
								return { result: String.fromCharCode(value), skipChars: match[0].length - 1 };
							}
						}
						return { result: '\\' + char, skipChars: 0 };
					}
				}
			}

			for (let i = 0; i < str.length; i++) {
				const char = str[i];
				const nextChar = str[i + 1];

				if (escaped) {
					if (inAnsiCQuote) {
						const escapeResult = processAnsiCEscape(char, i + 1);
						current += escapeResult.result;
						i += escapeResult.skipChars;
					} else {
						current += char;
					}
					escaped = false;
					continue;
				}

				if (char === '\\' && (inAnsiCQuote || !inSingleQuote)) {
					escaped = true;
					continue;
				}

				// Check for $'string' start
				if (char === '$' && nextChar === "'" && !inSingleQuote && !inDoubleQuote && !inAnsiCQuote) {
					inAnsiCQuote = true;
					i++; // Skip the single quote after $
					continue;
				}

				if (char === "'" && inAnsiCQuote) {
					inAnsiCQuote = false;
					continue;
				}

				if (char === "'" && !inDoubleQuote && !inAnsiCQuote) {
					inSingleQuote = !inSingleQuote;
					continue;
				}

				if (char === '"' && !inSingleQuote && !inAnsiCQuote) {
					inDoubleQuote = !inDoubleQuote;
					continue;
				}

				if (!inSingleQuote && !inDoubleQuote && !inAnsiCQuote && /\s/.test(char)) {
					if (current) {
						tokens.push(current);
						current = '';
					}
					continue;
				}

				current += char;
			}

			if (current) {
				tokens.push(current);
			}

			return tokens;
		}

		const tokens = tokenize(curlCommand.trim());

		if (tokens.length === 0) {
			throw new Error('Empty cURL command');
		}

		let i = 0;

		// Skip 'curl' if present
		if (tokens[i]?.toLowerCase() === 'curl') {
			i++;
		}

		// The URL should be the first non-option argument
		while (i < tokens.length) {
			const token = tokens[i];

			// Skip options that take arguments
			if (
				[
					'-X',
					'--request',
					'-H',
					'--header',
					'-d',
					'--data',
					'--data-raw',
					'--data-binary',
					'-u',
					'--user',
					'-A',
					'--user-agent',
					'-b',
					'--cookie',
					'-c',
					'--cookie-jar',
					'--connect-timeout',
					'--max-time',
					'-o',
					'--output',
					'-w',
					'--write-out'
				].includes(token)
			) {
				i += 2; // Skip option and its argument
				continue;
			}

			// Skip standalone flags
			if (token.startsWith('-')) {
				i++;
				continue;
			}

			// This should be the URL
			result.url = token;
			i++;
			break;
		}

		// Reset to parse all options
		i = 0;
		if (tokens[i]?.toLowerCase() === 'curl') {
			i++;
		}

		while (i < tokens.length) {
			const token = tokens[i];
			const nextToken = tokens[i + 1];

			switch (token) {
				case '-X':
				case '--request':
					if (nextToken) {
						result.method = nextToken.toUpperCase();
						i += 2;
					} else {
						i++;
					}
					break;

				case '-H':
				case '--header':
					if (nextToken) {
						const colonIndex = nextToken.indexOf(':');
						if (colonIndex > 0) {
							const key = nextToken.substring(0, colonIndex).trim();
							const value = nextToken.substring(colonIndex + 1).trim();
							result.headers[key] = value;
						}
						i += 2;
					} else {
						i++;
					}
					break;

				case '-d':
				case '--data':
				case '--data-raw':
					if (nextToken) {
						result.body = nextToken;
						if (result.method === 'GET') {
							result.method = 'POST';
						}
						i += 2;
					} else {
						i++;
					}
					break;

				case '--data-binary':
					if (nextToken) {
						result.body = nextToken;
						if (result.method === 'GET') {
							result.method = 'POST';
						}
						i += 2;
					} else {
						i++;
					}
					break;

				case '-u':
				case '--user':
					if (nextToken) {
						// Basic auth - could be parsed further if needed
						const authHeader = 'Basic ' + btoa(nextToken);
						result.headers['Authorization'] = authHeader;
						i += 2;
					} else {
						i++;
					}
					break;

				case '-A':
				case '--user-agent':
					if (nextToken) {
						result.headers['User-Agent'] = nextToken;
						i += 2;
					} else {
						i++;
					}
					break;

				case '-b':
				case '--cookie':
					if (nextToken) {
						// Parse cookies in format "name1=value1; name2=value2"
						const cookiePairs = nextToken.split(';');
						for (const pair of cookiePairs) {
							const trimmed = pair.trim();
							const equalIndex = trimmed.indexOf('=');
							if (equalIndex > 0) {
								const name = trimmed.substring(0, equalIndex).trim();
								const value = trimmed.substring(equalIndex + 1).trim();
								result.cookies[name] = value;
							}
						}
						i += 2;
					} else {
						i++;
					}
					break;

				case '-c':
				case '--cookie-jar':
					// Cookie jar is for storing cookies, not sending them
					// We'll skip this but consume the argument
					if (nextToken) {
						i += 2;
					} else {
						i++;
					}
					break;

				default:
					// Skip unknown options or the URL (already handled)
					i++;
					break;
			}
		}

		// Try to pretty-print JSON body
		if (result.body) {
			try {
				const jsonBody = JSON.parse(result.body);
				result.bodyPretty = JSON.stringify(jsonBody, null, 2);
			} catch (e) {
				// Not JSON, keep as-is
				console.debug('Body is not JSON:', e);
			}
		}

		if (!result.url) {
			throw new Error('No URL found in cURL command');
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
		<p class="text-gray-600">
			<T>Enter a URL or a cURL command to see a breakdown of its components.</T>
		</p>
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
				<h3 class="text-lg font-semibold text-gray-800"><T>cURL Components</T></h3>

				<!-- Method -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
					<div class="mb-1 flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700"><T>Method</T></span>
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
									><T>Edit</T></button
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
								class="rounded bg-green-500 px-2 py-1 text-xs text-white"><T>Save</T></button
							>
							<button
								onclick={cancelEditing}
								class="rounded bg-gray-400 px-2 py-1 text-xs text-white"><T>Cancel</T></button
							>
						</div>
					{:else}
						<div class="font-mono text-sm break-all text-gray-800">{parsedCurl.method}</div>
					{/if}
				</div>

				<!-- Headers -->
				<div class="space-y-4">
					<h4 class="text-md font-semibold text-gray-800"><T>Headers</T></h4>
					<div class="space-y-3">
						{#if Object.keys(parsedCurl.headers).length > 0}
							{#each Object.entries(parsedCurl.headers) as [key, value] (key)}
								<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
									<div class="grid gap-3 md:grid-cols-2">
										<div>
											<div class="mb-2 flex items-center justify-between">
												<span class="text-sm font-medium text-gray-700"><T>Header Key</T></span>
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
															><T>Edit</T></button
														>
													{/if}
													<button
														onclick={() => deleteCurlHeader(key)}
														class="rounded bg-red-500 px-2 py-1 text-xs text-white transition-colors hover:bg-red-600"
														title="Delete header"
														aria-label="Delete header"
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="16"
															height="16"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
															class="lucide lucide-trash-2"
															><path d="M3 6h18L21 20H5L3 6" /><path d="M16 10V18" /><path
																d="M8 10V18"
															/><path d="M12 6V18" /></svg
														>
													</button>
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
														class="rounded bg-green-500 px-2 py-1 text-xs text-white"
														><T>Save</T></button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white"
														><T>Cancel</T></button
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
												<span class="text-sm font-medium text-gray-700"><T>Header Value</T></span>
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
															><T>Edit</T></button
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
														class="rounded bg-green-500 px-2 py-1 text-xs text-white"
														><T>Save</T></button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white"
														><T>Cancel</T></button
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
						{:else}
							<p class="text-sm text-gray-500 italic"><T>No headers present</T></p>
						{/if}
						<button
							onclick={addNewCurlHeader}
							class="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
						>
							Add New Header
						</button>
					</div>
				</div>

				<!-- Cookies -->
				<div class="space-y-4">
					<h4 class="text-md font-semibold text-gray-800"><T>Cookies</T></h4>
					<div class="space-y-3">
						{#if Object.keys(parsedCurl.cookies).length > 0}
							{#each Object.entries(parsedCurl.cookies) as [name, value] (name)}
								<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
									<div class="grid gap-3 md:grid-cols-2">
										<div>
											<div class="mb-2 flex items-center justify-between">
												<span class="text-sm font-medium text-gray-700"><T>Cookie Name</T></span>
												<div class="flex items-center gap-2">
													<button
														onclick={() => copyToClipboard(name, `curl-cookie-name-${name}`)}
														class="rounded px-2 py-1 text-xs {copiedItem ===
														`curl-cookie-name-${name}`
															? 'bg-green-500'
															: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
													>
														{copiedItem === `curl-cookie-name-${name}` ? 'Copied!' : 'Copy'}
													</button>
													{#if editingKey !== `curl-cookie-name-${name}`}
														<button
															onclick={() => startEditing(`curl-cookie-name-${name}`, name)}
															class="rounded bg-gray-500 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
															><T>Edit</T></button
														>
													{/if}
													<button
														onclick={() => deleteCurlCookie(name)}
														class="rounded bg-red-500 px-2 py-1 text-xs text-white transition-colors hover:bg-red-600"
														title="Delete cookie"
														aria-label="Delete cookie"
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="16"
															height="16"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
															class="lucide lucide-trash-2"
															><path d="M3 6h18L21 20H5L3 6" /><path d="M16 10V18" /><path
																d="M8 10V18"
															/><path d="M12 6V18" /></svg
														>
													</button>
												</div>
											</div>
											{#if editingKey === `curl-cookie-name-${name}`}
												<div class="mt-1 flex items-center gap-2">
													<input
														class="w-full rounded border p-1 font-mono text-xs"
														bind:value={editingValue}
													/>
													<button
														onclick={() => saveCurlCookieKeyChange(name)}
														class="rounded bg-green-500 px-2 py-1 text-xs text-white"
														><T>Save</T></button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white"
														><T>Cancel</T></button
													>
												</div>
											{:else}
												<div class="rounded border bg-white p-2 font-mono text-xs break-all">
													{name}
												</div>
											{/if}
										</div>
										<div>
											<div class="mb-2 flex items-center justify-between">
												<span class="text-sm font-medium text-gray-700"><T>Cookie Value</T></span>
												<div class="flex items-center gap-2">
													<button
														onclick={() =>
															copyToClipboard(String(value), `curl-cookie-value-${name}`)}
														class="rounded px-2 py-1 text-xs {copiedItem ===
														`curl-cookie-value-${name}`
															? 'bg-green-500'
															: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
													>
														{copiedItem === `curl-cookie-value-${name}` ? 'Copied!' : 'Copy'}
													</button>
													{#if editingKey !== `curl-cookie-value-${name}`}
														<button
															onclick={() =>
																startEditing(`curl-cookie-value-${name}`, String(value))}
															class="rounded bg-gray-500 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
															><T>Edit</T></button
														>
													{/if}
												</div>
											</div>
											{#if editingKey === `curl-cookie-value-${name}`}
												<div class="mt-1 flex items-center gap-2">
													<input
														class="w-full rounded border p-1 font-mono text-xs"
														bind:value={editingValue}
													/>
													<button
														onclick={() => saveCurlCookieValueChange(name)}
														class="rounded bg-green-500 px-2 py-1 text-xs text-white"
														><T>Save</T></button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white"
														><T>Cancel</T></button
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
						{:else}
							<p class="text-sm text-gray-500 italic"><T>No cookies present</T></p>
						{/if}
						<button
							onclick={addNewCurlCookie}
							class="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
						>
							Add New Cookie
						</button>
					</div>
				</div>

				<!-- Body -->
				{#if parsedCurl.body}
					<div class="space-y-2">
						<h4 class="text-md font-semibold text-gray-800"><T>Body</T></h4>
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
							<div class="mb-1 flex items-center justify-between">
								<span class="text-sm font-medium text-gray-700"><T>Request Body</T></span>
								<div class="flex items-center gap-2">
									<button
										onclick={() =>
											copyToClipboard(
												activeBodyTab === 'preview' && parsedCurl.bodyPretty
													? parsedCurl.bodyPretty
													: parsedCurl.body,
												'curl-body'
											)}
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
											><T>Edit</T></button
										>
									{/if}
								</div>
							</div>

							<!-- Tabs (only show if JSON is detected) -->
							{#if parsedCurl.bodyPretty}
								<div class="mb-3 flex border-b border-gray-200">
									<button
										onclick={() => (activeBodyTab = 'raw')}
										class="px-4 py-2 text-sm font-medium {activeBodyTab === 'raw'
											? 'border-b-2 border-blue-500 text-blue-600'
											: 'text-gray-500 hover:text-gray-700'}"
									>
										Raw
									</button>
									<button
										onclick={() => (activeBodyTab = 'preview')}
										class="px-4 py-2 text-sm font-medium {activeBodyTab === 'preview'
											? 'border-b-2 border-blue-500 text-blue-600'
											: 'text-gray-500 hover:text-gray-700'}"
									>
										Preview
									</button>
								</div>
							{/if}

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
											class="rounded bg-green-500 px-2 py-1 text-xs text-white"><T>Save</T></button
										>
										<button
											onclick={cancelEditing}
											class="ml-2 rounded bg-gray-400 px-2 py-1 text-xs text-white"
											><T>Cancel</T></button
										>
									</div>
								</div>
							{:else}
								<!-- Tab content -->
								{#if parsedCurl.bodyPretty}
									{#if activeBodyTab === 'raw'}
										<pre
											class="max-h-60 overflow-auto rounded border bg-white p-2 font-mono text-xs break-all"><code
												>{parsedCurl.body}</code
											></pre>
									{:else}
										<pre
											class="max-h-60 overflow-auto rounded border bg-white p-2 font-mono text-xs"><code
												>{parsedCurl.bodyPretty}</code
											></pre>
									{/if}
								{:else}
									<!-- No JSON detected, show raw body -->
									<pre
										class="max-h-60 overflow-auto rounded border bg-white p-2 font-mono text-xs break-all"><code
											>{parsedCurl.body}</code
										></pre>
								{/if}
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
				<h3 class="text-lg font-semibold text-gray-800"><T>URL Components</T></h3>
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
												><T>Edit</T></button
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
											class="rounded bg-green-500 px-2 py-1 text-xs text-white"><T>Save</T></button
										>
										<button
											onclick={cancelEditing}
											class="rounded bg-gray-400 px-2 py-1 text-xs text-white"><T>Cancel</T></button
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
		<div class="space-y-4">
			<h3 class="text-lg font-semibold text-gray-800"><T>Search Parameters</T></h3>
			<div class="space-y-3">
				{#if searchParams.length > 0}
					{#each searchParams as param, i (`${param.key}-${i}`)}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
							<div class="grid gap-3 md:grid-cols-2">
								<!-- Key -->
								<div>
									<div class="mb-2 flex items-center justify-between">
										<span class="text-sm font-medium text-gray-700"><T>Key</T></span>
										<div class="flex items-center gap-2">
											<button
												onclick={() => copyToClipboard(param.key, `key-${param.key}`)}
												class="rounded px-2 py-1 text-xs {copiedItem === `key-${param.key}`
													? 'bg-green-500'
													: 'bg-blue-500'} text-white transition-colors hover:bg-blue-600"
											>
												{copiedItem === `key-${param.key}` ? 'Copied!' : 'Copy'}
											</button>
											<button
												onclick={() => deleteSearchParam(i)}
												class="rounded bg-red-500 px-2 py-1 text-xs text-white transition-colors hover:bg-red-600"
												title="Delete parameter"
												aria-label="Delete parameter"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="12"
													height="12"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													class="lucide lucide-trash-2"
													><path d="m3 6 18 0" /><path
														d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
													/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line
														x1="10"
														x2="10"
														y1="11"
														y2="17"
													/><line x1="14" x2="14" y1="11" y2="17" /></svg
												>
											</button>
										</div>
									</div>
									<div class="space-y-1">
										<div class="flex items-center justify-between text-sm text-gray-600">
											Raw:
											{#if editingKey !== `param-key-${i}`}
												<button
													onclick={() => startEditing(`param-key-${i}`, param.key)}
													class="rounded bg-gray-500 px-2 py-1 text-xs text-white"
													><T>Edit</T></button
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
													class="rounded bg-green-500 px-2 py-1 text-xs text-white"
													><T>Save</T></button
												>
												<button
													onclick={cancelEditing}
													class="rounded bg-gray-400 px-2 py-1 text-xs text-white"
													><T>Cancel</T></button
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
														class="rounded bg-gray-500 px-2 py-1 text-xs text-white"
														><T>Edit</T></button
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
														class="rounded bg-green-500 px-2 py-1 text-xs text-white"
														><T>Save</T></button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white"
														><T>Cancel</T></button
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
										<span class="text-sm font-medium text-gray-700"><T>Value</T></span>
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
													class="rounded bg-gray-500 px-2 py-1 text-xs text-white"
													><T>Edit</T></button
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
													class="rounded bg-green-500 px-2 py-1 text-xs text-white"
													><T>Save</T></button
												>
												<button
													onclick={cancelEditing}
													class="rounded bg-gray-400 px-2 py-1 text-xs text-white"
													><T>Cancel</T></button
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
														class="rounded bg-gray-500 px-2 py-1 text-xs text-white"
														><T>Edit</T></button
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
														class="rounded bg-green-500 px-2 py-1 text-xs text-white"
														><T>Save</T></button
													>
													<button
														onclick={cancelEditing}
														class="rounded bg-gray-400 px-2 py-1 text-xs text-white"
														><T>Cancel</T></button
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
				{:else}
					<p class="text-sm text-gray-500 italic"><T>No search parameters present</T></p>
				{/if}
				<button
					onclick={addNewSearchParam}
					class="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
				>
					Add New Search Parameter
				</button>
			</div>
		</div>
	{/if}
</div>
