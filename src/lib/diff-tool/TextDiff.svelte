<script lang="ts">
	import { onMount } from 'svelte';
	import * as diffLib from 'diff';
	import T from '../T.svelte';

	let {
		leftInput = $bindable(''),
		rightInput = $bindable('')
	}: {
		leftInput: string;
		rightInput: string;
	} = $props();

	// Configuration options
	let config = $state({
		// Basic diff options
		ignoreCase: false,
		ignoreWhitespace: false,
		newlineIsToken: false,

		// Line diff options
		stripTrailingCr: false,

		// Word diff options
		ignoreWhitespaceChange: false,

		// Character diff options
		ignoreWhitespaceAtEndOfLine: false,

		// Display options
		showInlineDiff: true,
		showSideBySide: false,
		contextLines: 3,
		showLineNumbers: true,
		showStats: true,

		// Diff algorithm
		diffType: 'lines' as
			| 'lines'
			| 'words'
			| 'wordsWithSpace'
			| 'chars'
			| 'sentences'
			| 'css'
			| 'json'
	});

	let diffResult = $state<any[]>([]);
	let diffStats = $state({ additions: 0, deletions: 0, total: 0 });
	let isCalculating = $state(false);
	let showLargeSizeWarning = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Constants for performance limits
	const MAX_SAFE_SIZE = 50000; // characters
	const LARGE_SIZE_WARNING = 10000; // characters
	const DEBOUNCE_DELAY = 300; // milliseconds

	onMount(() => {
		calculateDiff();
	});

	function getInputSizes() {
		return {
			leftSize: leftInput?.length || 0,
			rightSize: rightInput?.length || 0,
			totalSize: (leftInput?.length || 0) + (rightInput?.length || 0)
		};
	}

	function checkSizeWarnings() {
		const { totalSize } = getInputSizes();
		showLargeSizeWarning = totalSize > LARGE_SIZE_WARNING;
		return totalSize <= MAX_SAFE_SIZE;
	}

	async function calculateDiff() {
		if (!leftInput && !rightInput) {
			diffResult = [];
			diffStats = { additions: 0, deletions: 0, total: 0 };
			isCalculating = false;
			return;
		}

		if (!checkSizeWarnings()) {
			diffResult = [];
			diffStats = { additions: 0, deletions: 0, total: 0 };
			isCalculating = false;
			return;
		}

		isCalculating = true;

		// Use setTimeout to make this async and prevent UI blocking
		setTimeout(() => {
			try {
				let options: any = {
					ignoreCase: config.ignoreCase,
					ignoreWhitespace: config.ignoreWhitespace,
					newlineIsToken: config.newlineIsToken,
					stripTrailingCr: config.stripTrailingCr,
					ignoreWhitespaceChange: config.ignoreWhitespaceChange,
					ignoreWhitespaceAtEndOfLine: config.ignoreWhitespaceAtEndOfLine
				};

				// Remove undefined options
				options = Object.fromEntries(
					Object.entries(options).filter(([_, value]) => value !== false && value !== undefined)
				);

				let result;
				switch (config.diffType) {
					case 'lines':
						result = diffLib.diffLines(leftInput, rightInput, options);
						break;
					case 'words':
						result = diffLib.diffWords(leftInput, rightInput, options);
						break;
					case 'wordsWithSpace':
						result = diffLib.diffWordsWithSpace(leftInput, rightInput, options);
						break;
					case 'chars':
						result = diffLib.diffChars(leftInput, rightInput, options);
						break;
					case 'sentences':
						result = diffLib.diffSentences(leftInput, rightInput, options);
						break;
					case 'css':
						result = diffLib.diffCss(leftInput, rightInput, options);
						break;
					case 'json':
						try {
							const leftObj = JSON.parse(leftInput);
							const rightObj = JSON.parse(rightInput);
							result = diffLib.diffJson(leftObj, rightObj, options);
						} catch {
							result = diffLib.diffLines(leftInput, rightInput, options);
						}
						break;
					default:
						result = diffLib.diffLines(leftInput, rightInput, options);
				}

				diffResult = result || [];

				// Calculate stats
				let additions = 0;
				let deletions = 0;
				let total = 0;

				diffResult.forEach((part) => {
					if (part.added) additions += part.count || 1;
					else if (part.removed) deletions += part.count || 1;
					total += part.count || 1;
				});

				diffStats = { additions, deletions, total };
			} catch (err) {
				console.error('Error calculating diff:', err);
				diffResult = [];
				diffStats = { additions: 0, deletions: 0, total: 0 };
			} finally {
				isCalculating = false;
			}
		}, 0);
	}

	function debouncedCalculateDiff() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			calculateDiff();
		}, DEBOUNCE_DELAY);
	}

	// Reactive calculation with debouncing
	$effect(() => {
		// Reference the reactive variables so the effect tracks them
		leftInput;
		rightInput;
		config.diffType;
		config.ignoreCase;
		config.ignoreWhitespace;
		config.newlineIsToken;
		config.stripTrailingCr;
		config.ignoreWhitespaceChange;
		config.ignoreWhitespaceAtEndOfLine;

		if (diffLib) {
			debouncedCalculateDiff();
		}
	});

	function resetConfig() {
		config = {
			ignoreCase: false,
			ignoreWhitespace: false,
			newlineIsToken: false,
			stripTrailingCr: false,
			ignoreWhitespaceChange: false,
			ignoreWhitespaceAtEndOfLine: false,
			showInlineDiff: true,
			showSideBySide: false,
			contextLines: 3,
			showLineNumbers: true,
			showStats: true,
			diffType: 'lines'
		};
	}

	function exportDiff() {
		const diffText = diffResult
			.map((part) => {
				const prefix = part.added ? '+' : part.removed ? '-' : ' ';
				return part.value
					.split('\n')
					.map((line: string) => prefix + line)
					.join('\n');
			})
			.join('');

		const blob = new Blob([diffText], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'diff-result.patch';
		a.click();
		URL.revokeObjectURL(url);
	}

	let showConfig = $state(false);
</script>

<div class="space-y-6">
	<!-- Size Warning Banner -->
	{#if showLargeSizeWarning}
		<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-yellow-800"><T>Large Input Detected</T></h3>
					<div class="mt-2 text-sm text-yellow-700">
						<p>
							You're working with large text inputs ({getInputSizes().totalSize.toLocaleString()} characters).
							Diff calculation may take longer and could impact performance.
						</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Max Size Exceeded Warning -->
	{#if getInputSizes().totalSize > MAX_SAFE_SIZE}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800"><T>Input Too Large</T></h3>
					<div class="mt-2 text-sm text-red-700">
						<p>
							Input size ({getInputSizes().totalSize.toLocaleString()} characters) exceeds the maximum
							safe limit ({MAX_SAFE_SIZE.toLocaleString()} characters). Please reduce the input size
							to enable diff calculation.
						</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Configuration Panel -->
	<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
		<button
			onclick={() => (showConfig = !showConfig)}
			class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50"
		>
			<span class="font-semibold text-gray-900">⚙️ Configuration</span>
			<span class="text-gray-500">{showConfig ? '−' : '+'}</span>
		</button>

		{#if showConfig}
			<div class="space-y-4 border-t border-gray-200 p-4">
				<!-- Diff Algorithm -->
				<div>
					<label for="diff-algorithm" class="mb-2 block text-sm font-medium text-gray-700"
						><T>Diff Algorithm</T></label
					>
					<select
						id="diff-algorithm"
						bind:value={config.diffType}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					>
						<option value="lines"><T>Lines</T></option>
						<option value="words"><T>Words</T></option>
						<option value="wordsWithSpace">Words (with spaces)</option>
						<option value="chars"><T>Characters</T></option>
						<option value="sentences"><T>Sentences</T></option>
						<option value="css"><T>CSS</T></option>
						<option value="json"><T>JSON</T></option>
					</select>
				</div>

				<!-- Basic Options -->
				<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.ignoreCase}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Ignore Case</T></span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.ignoreWhitespace}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Ignore Whitespace</T></span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.ignoreWhitespaceChange}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Ignore Whitespace Changes</T></span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.ignoreWhitespaceAtEndOfLine}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Ignore EOL Whitespace</T></span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.newlineIsToken}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Newline as Token</T></span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.stripTrailingCr}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Strip Trailing CR</T></span>
					</label>
				</div>

				<!-- Display Options -->
				<div class="border-t pt-4">
					<h4 class="mb-2 text-sm font-medium text-gray-700"><T>Display Options</T></h4>
					<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
						<label class="flex items-center space-x-2">
							<input
								type="checkbox"
								bind:checked={config.showLineNumbers}
								class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-sm text-gray-700"><T>Show Line Numbers</T></span>
						</label>
						<label class="flex items-center space-x-2">
							<input
								type="checkbox"
								bind:checked={config.showStats}
								class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-sm text-gray-700"><T>Show Statistics</T></span>
						</label>
						<label class="flex items-center space-x-2">
							<input
								type="checkbox"
								bind:checked={config.showInlineDiff}
								class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-sm text-gray-700"><T>Inline Diff</T></span>
						</label>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex gap-2 border-t pt-4">
					<button
						onclick={resetConfig}
						class="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200"
					>
						Reset to Defaults
					</button>
					<button
						onclick={exportDiff}
						disabled={diffResult.length === 0}
						class="rounded-md bg-blue-100 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Export Diff
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input Areas -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Left Input -->
		<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-3">
				<h3 class="text-sm font-medium text-gray-900">
					Original
					{#if leftInput}
						<span class="text-xs font-normal text-gray-500">
							({leftInput.length.toLocaleString()} chars)
						</span>
					{/if}
				</h3>
			</div>
			<div class="p-4">
				<textarea
					bind:value={leftInput}
					placeholder="Enter original text..."
					class="h-64 w-full resize-none rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				></textarea>
			</div>
		</div>

		<!-- Right Input -->
		<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-3">
				<h3 class="text-sm font-medium text-gray-900">
					Modified
					{#if rightInput}
						<span class="text-xs font-normal text-gray-500">
							({rightInput.length.toLocaleString()} chars)
						</span>
					{/if}
				</h3>
			</div>
			<div class="p-4">
				<textarea
					bind:value={rightInput}
					placeholder="Enter modified text..."
					class="h-64 w-full resize-none rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				></textarea>
			</div>
		</div>
	</div>

	<!-- Statistics and Results -->
	<!-- Statistics -->
	{#if config.showStats && diffResult.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h3 class="mb-2 text-sm font-medium text-gray-900"><T>Statistics</T></h3>
			<div class="flex gap-4 text-sm">
				<span class="text-green-600">+{diffStats.additions} additions</span>
				<span class="text-red-600">-{diffStats.deletions} deletions</span>
				<span class="text-gray-600">{diffStats.total} total changes</span>
			</div>
		</div>
	{/if}

	<!-- Diff Result -->
	<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
		<div class="rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-3">
			<h3 class="flex items-center gap-2 text-sm font-medium text-gray-900">
				Diff Result
				{#if isCalculating}
					<div class="flex items-center gap-2">
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
						></div>
						<span class="text-xs text-blue-600"><T>Calculating...</T></span>
					</div>
				{/if}
			</h3>
		</div>
		<div class="p-4">
			{#if isCalculating}
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
					></div>
					<p class="text-gray-500"><T>Calculating differences...</T></p>
				</div>
			{:else if getInputSizes().totalSize > MAX_SAFE_SIZE}
				<p class="py-8 text-center text-red-500">
					Input size too large for diff calculation. Please reduce input size.
				</p>
			{:else if diffResult.length === 0}
				<p class="py-8 text-center text-gray-500">
					{leftInput || rightInput
						? 'No differences found'
						: 'Enter text in both fields to see differences'}
				</p>
			{:else}
				<pre
					class="overflow-x-auto font-mono text-sm whitespace-pre-wrap">{#each diffResult as part, index (index)}<span
							class="{part.added
								? 'bg-green-100 text-green-800'
								: part.removed
									? 'bg-red-100 text-red-800'
									: 'text-gray-700'} {part.added || part.removed ? 'px-1' : ''}">{part.value}</span
						>{/each}</pre>
			{/if}
		</div>
	</div>
</div>
