<script lang="ts">
	import T from '../T.svelte';

	let {
		leftInput = $bindable(''),
		rightInput = $bindable(''),
		wrapLines = true
	}: {
		leftInput: string;
		rightInput: string;
		wrapLines?: boolean;
	} = $props();

	interface DiffItem {
		path: string;
		type: 'added' | 'removed' | 'changed' | 'unchanged';
		leftValue?: any;
		rightValue?: any;
		valueType: string;
	}

	let parseError = $state('');
	let leftParsed: any = $state(null);
	let rightParsed: any = $state(null);
	let diffResult: DiffItem[] = $state([]);
	let diffStats = $state({ added: 0, removed: 0, changed: 0, unchanged: 0 });

	// Configuration options
	let config = $state({
		showUnchanged: false,
		sortByPath: true,
		ignoreArrayOrder: false,
		maxDepth: 10,
		ignoreCase: false,
		treatNullAsUndefined: false,
		showValueTypes: true,
		preserveWhitespace: false
	});

	// Simple YAML parser (basic implementation)
	function parseYaml(yamlText: string): any {
		if (!yamlText.trim()) return null;

		const lines = yamlText.split('\n');
		const result: any = {};
		let current = result;
		const stack: any[] = [result];
		const indentStack: number[] = [0];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith('#')) continue;

			const indent = line.length - line.trimStart().length;

			// Handle indentation changes
			while (indentStack.length > 1 && indent <= indentStack[indentStack.length - 1]) {
				stack.pop();
				indentStack.pop();
			}

			current = stack[stack.length - 1];

			// Parse key-value pairs
			if (trimmed.includes(':')) {
				const colonIndex = trimmed.indexOf(':');
				let key = trimmed.substring(0, colonIndex).trim();
				let value = trimmed.substring(colonIndex + 1).trim();

				// Remove quotes if present
				if (
					(key.startsWith('"') && key.endsWith('"')) ||
					(key.startsWith("'") && key.endsWith("'"))
				) {
					key = key.slice(1, -1);
				}

				if (!value) {
					// Empty value, likely an object
					current[key] = {};
					stack.push(current[key]);
					indentStack.push(indent);
				} else if (value.startsWith('[') && value.endsWith(']')) {
					// Inline array
					try {
						current[key] = JSON.parse(value);
					} catch {
						current[key] = value;
					}
				} else if (value.startsWith('{') && value.endsWith('}')) {
					// Inline object
					try {
						current[key] = JSON.parse(value);
					} catch {
						current[key] = value;
					}
				} else {
					// Regular value
					current[key] = parseValue(value);
				}
			} else if (trimmed.startsWith('- ')) {
				// Array item
				const value = trimmed.substring(2).trim();
				if (!Array.isArray(current)) {
					// Convert to array if not already
					const keys = Object.keys(current);
					if (keys.length === 0) {
						Object.assign(current, []);
					}
				}
				if (Array.isArray(current)) {
					current.push(parseValue(value));
				}
			}
		}

		return result;
	}

	function parseValue(value: string): any {
		// Handle special values
		if (value === 'null' || value === '~') return null;
		if (value === 'true') return true;
		if (value === 'false') return false;

		// Handle numbers
		if (/^-?\d+$/.test(value)) return parseInt(value, 10);
		if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

		// Handle quoted strings
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			return value.slice(1, -1);
		}

		// Return as string
		return value;
	}

	function parseInputs() {
		parseError = '';
		leftParsed = null;
		rightParsed = null;

		try {
			if (leftInput.trim()) {
				leftParsed = parseYaml(leftInput);
			}
		} catch (err) {
			parseError = 'Left YAML parsing error: ' + (err as Error).message;
			return;
		}

		try {
			if (rightInput.trim()) {
				rightParsed = parseYaml(rightInput);
			}
		} catch (err) {
			parseError = 'Right YAML parsing error: ' + (err as Error).message;
			return;
		}
	}

	function getValueType(value: any): string {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';
		if (Array.isArray(value)) return 'array';
		return typeof value;
	}

	function deepCompare(left: any, right: any, path: string = '', depth: number = 0): DiffItem[] {
		const results: DiffItem[] = [];

		if (depth > config.maxDepth) {
			return results;
		}

		// Handle null/undefined comparison
		if (config.treatNullAsUndefined) {
			if (left === null) left = undefined;
			if (right === null) right = undefined;
		}

		// If values are strictly equal
		if (left === right) {
			if (config.showUnchanged) {
				results.push({
					path,
					type: 'unchanged',
					leftValue: left,
					rightValue: right,
					valueType: getValueType(left)
				});
			}
			return results;
		}

		// If one side is missing
		if (left === undefined && right !== undefined) {
			results.push({
				path,
				type: 'added',
				rightValue: right,
				valueType: getValueType(right)
			});
			return results;
		}

		if (left !== undefined && right === undefined) {
			results.push({
				path,
				type: 'removed',
				leftValue: left,
				valueType: getValueType(left)
			});
			return results;
		}

		// If types are different
		const leftType = getValueType(left);
		const rightType = getValueType(right);

		if (leftType !== rightType) {
			results.push({
				path,
				type: 'changed',
				leftValue: left,
				rightValue: right,
				valueType: `${leftType} → ${rightType}`
			});
			return results;
		}

		// Handle arrays
		if (Array.isArray(left) && Array.isArray(right)) {
			if (config.ignoreArrayOrder) {
				// Compare arrays without considering order
				const leftSet = new Set(left.map((item) => JSON.stringify(item)));
				const rightSet = new Set(right.map((item) => JSON.stringify(item)));

				for (const item of leftSet) {
					if (!rightSet.has(item)) {
						results.push({
							path: `${path}[*]`,
							type: 'removed',
							leftValue: JSON.parse(item),
							valueType: getValueType(JSON.parse(item))
						});
					}
				}

				for (const item of rightSet) {
					if (!leftSet.has(item)) {
						results.push({
							path: `${path}[*]`,
							type: 'added',
							rightValue: JSON.parse(item),
							valueType: getValueType(JSON.parse(item))
						});
					}
				}
			} else {
				// Compare arrays with order
				const maxLength = Math.max(left.length, right.length);

				for (let i = 0; i < maxLength; i++) {
					const currentPath = `${path}[${i}]`;
					const leftItem = i < left.length ? left[i] : undefined;
					const rightItem = i < right.length ? right[i] : undefined;

					results.push(...deepCompare(leftItem, rightItem, currentPath, depth + 1));
				}
			}
			return results;
		}

		// Handle objects
		if (leftType === 'object' && rightType === 'object') {
			const leftKeys = Object.keys(left || {});
			const rightKeys = Object.keys(right || {});
			const allKeys = new Set([...leftKeys, ...rightKeys]);

			for (const key of allKeys) {
				const currentPath = path ? `${path}.${key}` : key;
				const leftValue = left ? left[key] : undefined;
				const rightValue = right ? right[key] : undefined;

				results.push(...deepCompare(leftValue, rightValue, currentPath, depth + 1));
			}
			return results;
		}

		// Handle primitive values
		let leftVal = left;
		let rightVal = right;

		if (config.ignoreCase && typeof left === 'string' && typeof right === 'string') {
			leftVal = left.toLowerCase();
			rightVal = right.toLowerCase();
		}

		if (leftVal !== rightVal) {
			results.push({
				path,
				type: 'changed',
				leftValue: left,
				rightValue: right,
				valueType: leftType
			});
		} else if (config.showUnchanged) {
			results.push({
				path,
				type: 'unchanged',
				leftValue: left,
				rightValue: right,
				valueType: leftType
			});
		}

		return results;
	}

	function calculateDiff() {
		if (parseError) return;

		const results = deepCompare(leftParsed, rightParsed);

		if (config.sortByPath) {
			results.sort((a, b) => a.path.localeCompare(b.path));
		}

		diffResult = results;

		// Calculate statistics
		const stats = { added: 0, removed: 0, changed: 0, unchanged: 0 };
		results.forEach((item) => {
			stats[item.type]++;
		});
		diffStats = stats;
	}

	// Reactive calculation
	$effect(() => {
		parseInputs();
		if (!parseError) {
			calculateDiff();
		} else {
			diffResult = [];
			diffStats = { added: 0, removed: 0, changed: 0, unchanged: 0 };
		}
	});

	function formatValue(value: any): string {
		if (value === undefined) return 'undefined';
		if (value === null) return 'null';
		if (typeof value === 'string') return value;
		if (typeof value === 'object') {
			return JSON.stringify(value, null, 2);
		}
		return String(value);
	}

	function resetConfig() {
		config = {
			showUnchanged: false,
			sortByPath: true,
			ignoreArrayOrder: false,
			maxDepth: 10,
			ignoreCase: false,
			treatNullAsUndefined: false,
			showValueTypes: true,
			preserveWhitespace: false
		};
	}

	function exportDiff() {
		const diffText = diffResult
			.map((item) => {
				const prefix =
					item.type === 'added'
						? '+'
						: item.type === 'removed'
							? '-'
							: item.type === 'changed'
								? '~'
								: ' ';
				const leftVal = item.leftValue !== undefined ? formatValue(item.leftValue) : '';
				const rightVal = item.rightValue !== undefined ? formatValue(item.rightValue) : '';

				if (item.type === 'changed') {
					return `${prefix} ${item.path}: ${leftVal} → ${rightVal}`;
				} else if (item.type === 'added') {
					return `${prefix} ${item.path}: ${rightVal}`;
				} else if (item.type === 'removed') {
					return `${prefix} ${item.path}: ${leftVal}`;
				} else {
					return `${prefix} ${item.path}: ${leftVal}`;
				}
			})
			.join('\n');

		const blob = new Blob([diffText], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'yaml-diff-result.txt';
		a.click();
		URL.revokeObjectURL(url);
	}

	let showConfig = $state(false);
</script>

<div class="space-y-6">
	<!-- Configuration Panel -->
	<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
		<button
			onclick={() => (showConfig = !showConfig)}
			class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50"
		>
			<span class="font-semibold text-gray-900">⚙️ YAML Diff Configuration</span>
			<span class="text-gray-500">{showConfig ? '−' : '+'}</span>
		</button>

		{#if showConfig}
			<div class="space-y-4 border-t border-gray-200 p-4">
				<!-- Comparison Options -->
				<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.showUnchanged}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Show Unchanged</T></span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.sortByPath}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Sort by Path</T></span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.ignoreArrayOrder}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Ignore Array Order</T></span>
					</label>
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
							bind:checked={config.treatNullAsUndefined}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700">Null = Undefined</span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.showValueTypes}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Show Types</T></span>
					</label>
					<label class="flex items-center space-x-2">
						<input
							type="checkbox"
							bind:checked={config.preserveWhitespace}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-sm text-gray-700"><T>Preserve Whitespace</T></span>
					</label>
				</div>

				<!-- Max Depth -->
				<div>
					<label for="max-depth-yaml" class="mb-2 block text-sm font-medium text-gray-700">
						Max Depth: {config.maxDepth}
					</label>
					<input
						id="max-depth-yaml"
						type="range"
						min="1"
						max="20"
						bind:value={config.maxDepth}
						class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
					/>
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
				<h3 class="text-sm font-medium text-gray-900"><T>Original YAML</T></h3>
			</div>
			<div class="p-4">
				<textarea
					bind:value={leftInput}
					placeholder="name: Original
value: 123
items:
  - first
  - second"
					class="h-64 w-full resize-none rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none {wrapLines
						? 'whitespace-pre-wrap'
						: 'whitespace-pre'}"
				></textarea>
			</div>
		</div>

		<!-- Right Input -->
		<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-3">
				<h3 class="text-sm font-medium text-gray-900"><T>Modified YAML</T></h3>
			</div>
			<div class="p-4">
				<textarea
					bind:value={rightInput}
					placeholder="name: Modified
value: 456
items:
  - first
  - third"
					class="h-64 w-full resize-none rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none {wrapLines
						? 'whitespace-pre-wrap'
						: 'whitespace-pre'}"
				></textarea>
			</div>
		</div>
	</div>

	<!-- Parse Error -->
	{#if parseError}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center">
				<span class="mr-2 text-red-600">⚠️</span>
				<p class="text-red-700">{parseError}</p>
			</div>
		</div>
	{:else}
		<!-- Statistics -->
		{#if diffResult.length > 0}
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h3 class="mb-2 text-sm font-medium text-gray-900"><T>Statistics</T></h3>
				<div class="flex gap-4 text-sm">
					<span class="text-green-600">+{diffStats.added} added</span>
					<span class="text-red-600">-{diffStats.removed} removed</span>
					<span class="text-yellow-600">~{diffStats.changed} changed</span>
					{#if config.showUnchanged}
						<span class="text-gray-600">={diffStats.unchanged} unchanged</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Diff Result -->
		<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-3">
				<h3 class="text-sm font-medium text-gray-900"><T>YAML Diff Result</T></h3>
			</div>
			<div class="p-4">
				{#if diffResult.length === 0}
					<p class="py-8 text-center text-gray-500">
						{leftInput || rightInput
							? 'No differences found'
							: 'Enter YAML in both fields to see differences'}
					</p>
				{:else}
					<div class="max-h-96 space-y-2 overflow-y-auto {wrapLines ? '' : 'overflow-x-auto'}">
						{#each diffResult as item, index (index)}
							{@const bgClass =
								item.type === 'added'
									? 'bg-green-50 border-l-4 border-green-500'
									: item.type === 'removed'
										? 'bg-red-50 border-l-4 border-red-500'
										: item.type === 'changed'
											? 'bg-yellow-50 border-l-4 border-yellow-500'
											: 'bg-gray-50 border-l-4 border-gray-300'}
							{@const textClass =
								item.type === 'added'
									? 'text-green-800'
									: item.type === 'removed'
										? 'text-red-800'
										: item.type === 'changed'
											? 'text-yellow-800'
											: 'text-gray-800'}
							<div class="flex items-start gap-3 rounded p-2 text-sm {bgClass}">
								<span class="font-semibold {textClass}">
									{item.type === 'added'
										? '+'
										: item.type === 'removed'
											? '-'
											: item.type === 'changed'
												? '~'
												: '='}
								</span>
								<div class="min-w-0 flex-1">
									<div
										class="font-mono font-medium {wrapLines
											? 'break-all'
											: 'whitespace-nowrap'} text-gray-900"
									>
										{item.path || '(root)'}
									</div>
									{#if config.showValueTypes}
										<div class="mt-1 text-xs text-gray-500">
											{item.valueType}
										</div>
									{/if}
									<div class="mt-1 space-y-1">
										{#if item.type === 'removed' || item.type === 'changed'}
											<div
												class="rounded bg-red-100 p-1 font-mono text-xs {wrapLines
													? 'break-all'
													: 'whitespace-nowrap'} text-red-700"
											>
												- {formatValue(item.leftValue)}
											</div>
										{/if}
										{#if item.type === 'added' || item.type === 'changed'}
											<div
												class="rounded bg-green-100 p-1 font-mono text-xs {wrapLines
													? 'break-all'
													: 'whitespace-nowrap'} text-green-700"
											>
												+ {formatValue(item.rightValue)}
											</div>
										{/if}
										{#if item.type === 'unchanged'}
											<div
												class="rounded bg-gray-100 p-1 font-mono text-xs {wrapLines
													? 'break-all'
													: 'whitespace-nowrap'} text-gray-700"
											>
												{formatValue(item.leftValue)}
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
