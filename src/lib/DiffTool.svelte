<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import TextDiff from './diff-tool/TextDiff.svelte';
	import JsonDiff from './diff-tool/JsonDiff.svelte';
	import YamlDiff from './diff-tool/YamlDiff.svelte';
	import T from './T.svelte';

	type DiffMode = 'text' | 'json' | 'yaml';

	let mode: DiffMode = $state('text');
	let leftInput = $state('');
	let rightInput = $state('');
	let wrapLines = $state(true);

	// URL parameter sync
	let urlUpdateTimeout: ReturnType<typeof setTimeout>;

	function updateUrl() {
		if (typeof window === 'undefined') return;

		clearTimeout(urlUpdateTimeout);
		urlUpdateTimeout = setTimeout(() => {
			const params = new URLSearchParams();

			if (mode !== 'text') params.set('mode', mode);
			if (leftInput.trim()) params.set('left', encodeURIComponent(leftInput));
			if (rightInput.trim()) params.set('right', encodeURIComponent(rightInput));
			if (!wrapLines) params.set('wrap', 'false');

			const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
			goto(newUrl, { replaceState: true, noScroll: true });
		}, 500);
	}

	function loadFromUrl() {
		if (typeof window === 'undefined') return;

		const urlParams = $page.url.searchParams;
		const urlMode = urlParams.get('mode') as DiffMode;
		const urlLeft = urlParams.get('left');
		const urlRight = urlParams.get('right');
		const urlWrap = urlParams.get('wrap');

		if (urlMode && ['text', 'json', 'yaml'].includes(urlMode)) {
			mode = urlMode;
		}

		if (urlLeft) {
			leftInput = decodeURIComponent(urlLeft);
		}

		if (urlRight) {
			rightInput = decodeURIComponent(urlRight);
		}

		if (urlWrap !== null) {
			wrapLines = urlWrap !== 'false';
		}
	}

	// Watch for changes and update URL
	$effect(() => {
		updateUrl();
	});

	onMount(() => {
		loadFromUrl();
	});

	function clearInputs() {
		leftInput = '';
		rightInput = '';
	}

	function swapInputs() {
		const temp = leftInput;
		leftInput = rightInput;
		rightInput = temp;
	}

	function loadSampleData() {
		switch (mode) {
			case 'text':
				leftInput = `Hello, World!
This is the first line.
This line will be changed.
This line will be removed.
Common line here.`;
				rightInput = `Hello, World!
This is the first line.
This line has been changed.
Common line here.
This is a new line.`;
				break;
			case 'json':
				leftInput = JSON.stringify(
					{
						name: 'John Doe',
						age: 30,
						city: 'New York',
						hobbies: ['reading', 'swimming'],
						address: {
							street: '123 Main St',
							zip: '10001'
						}
					},
					null,
					2
				);
				rightInput = JSON.stringify(
					{
						name: 'John Smith',
						age: 31,
						city: 'New York',
						hobbies: ['reading', 'cycling', 'swimming'],
						address: {
							street: '456 Oak Ave',
							zip: '10001'
						},
						email: 'john@example.com'
					},
					null,
					2
				);
				break;
			case 'yaml':
				leftInput = `name: John Doe
age: 30
city: New York
hobbies:
  - reading
  - swimming
address:
  street: 123 Main St
  zip: "10001"`;
				rightInput = `name: John Smith
age: 31
city: New York
hobbies:
  - reading
  - cycling
  - swimming
address:
  street: 456 Oak Ave
  zip: "10001"
email: john@example.com`;
				break;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header with Mode Selection -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-gray-900"><T>Diff Tool</T></h1>
			<div class="flex gap-2">
				<button
					onclick={() => (wrapLines = !wrapLines)}
					class="rounded-md px-3 py-2 text-sm transition-colors {wrapLines
						? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					title="Toggle line wrapping"
				>
					{wrapLines ? '📝' : '📄'} Wrap
				</button>
				<button
					onclick={clearInputs}
					class="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200"
					title="Clear both inputs"
				>
					Clear
				</button>
				<button
					onclick={swapInputs}
					class="rounded-md bg-blue-100 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-200"
					title="Swap left and right inputs"
				>
					↔ Swap
				</button>
				<button
					onclick={loadSampleData}
					class="rounded-md bg-green-100 px-3 py-2 text-sm text-green-700 transition-colors hover:bg-green-200"
					title="Load sample data"
				>
					📄 Sample
				</button>
			</div>
		</div>

		<!-- Mode Selection Tabs -->
		<div class="flex gap-1 rounded-lg bg-gray-100 p-1">
			<button
				onclick={() => (mode = 'text')}
				class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors {mode === 'text'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				📝 Text
			</button>
			<button
				onclick={() => (mode = 'json')}
				class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors {mode === 'json'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				🔧 JSON
			</button>
			<button
				onclick={() => (mode = 'yaml')}
				class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors {mode === 'yaml'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				📋 YAML
			</button>
		</div>
	</div>

	<!-- Mode-specific Diff Component -->
	{#if mode === 'text'}
		<TextDiff bind:leftInput bind:rightInput {wrapLines} />
	{:else if mode === 'json'}
		<JsonDiff bind:leftInput bind:rightInput {wrapLines} />
	{:else if mode === 'yaml'}
		<YamlDiff bind:leftInput bind:rightInput {wrapLines} />
	{/if}
</div>
