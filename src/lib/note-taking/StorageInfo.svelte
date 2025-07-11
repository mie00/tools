<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StorageInfo } from './StorageManager';
	import type { Note } from './NoteOperations';

	let {
		storageInfo,
		showStorageWarning = false,
		notes = [],
		formatBytes
	}: {
		storageInfo: StorageInfo;
		showStorageWarning: boolean;
		notes: Note[];
		formatBytes: (_bytes: number) => string;
	} = $props();

	const dispatch = createEventDispatcher<{
		clearAllData: void;
		clearMediaNotes: void;
	}>();

	function clearAllData() {
		dispatch('clearAllData');
	}

	function clearMediaNotes() {
		dispatch('clearMediaNotes');
	}

	let usagePercentage = $derived(
		storageInfo.quota > 0 ? (storageInfo.used / storageInfo.quota) * 100 : 0
	);
	let mediaNotesCount = $derived(notes.filter((n) => n.media).length);
</script>

<!-- Storage Warning -->
{#if showStorageWarning}
	<div class="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
		<div class="flex items-start space-x-3">
			<svg
				class="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z"
				></path>
			</svg>
			<div class="flex-1">
				<h3 class="text-sm font-medium text-orange-800">Storage Warning</h3>
				<p class="mt-1 text-sm text-orange-700">
					You're using {usagePercentage.toFixed(1)}% of your available storage ({formatBytes(
						storageInfo.used
					)} / {formatBytes(storageInfo.quota)}).
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#if mediaNotesCount > 0}
						<button
							onclick={clearMediaNotes}
							class="rounded-md bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700"
						>
							Clear Media Notes ({mediaNotesCount})
						</button>
					{/if}
					<button
						onclick={clearAllData}
						class="rounded-md border border-orange-600 px-3 py-1 text-sm text-orange-600 hover:bg-orange-600 hover:text-white"
					>
						Clear All Data
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Storage Info Panel -->
<details class="mb-4 rounded-lg border border-gray-200 bg-white">
	<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
		📊 Storage Usage: {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)}
		{#if storageInfo.quota > 0}
			({usagePercentage.toFixed(1)}%)
		{/if}
	</summary>
	<div class="border-t border-gray-200 px-4 py-3">
		{#if storageInfo.quota > 0}
			<!-- Storage Progress Bar -->
			<div class="mb-4">
				<div class="mb-1 flex justify-between text-sm text-gray-600">
					<span>Used: {formatBytes(storageInfo.used)}</span>
					<span>Available: {formatBytes(storageInfo.available)}</span>
				</div>
				<div class="h-2 w-full rounded-full bg-gray-200">
					<div
						class="h-2 rounded-full transition-all duration-300 {usagePercentage > 80
							? 'bg-red-500'
							: usagePercentage > 60
								? 'bg-yellow-500'
								: 'bg-green-500'}"
						style="width: {Math.min(usagePercentage, 100)}%"
					></div>
				</div>
			</div>
		{/if}

		<!-- Storage Stats -->
		<div class="grid grid-cols-2 gap-4 text-sm">
			<div>
				<p class="text-gray-600">Total Notes</p>
				<p class="font-medium">{notes.length}</p>
			</div>
			<div>
				<p class="text-gray-600">Notes with Media</p>
				<p class="font-medium">{mediaNotesCount}</p>
			</div>
		</div>

		<!-- Management Actions -->
		<div class="mt-4 flex flex-wrap gap-2">
			{#if mediaNotesCount > 0}
				<button
					onclick={clearMediaNotes}
					class="rounded-md bg-yellow-600 px-3 py-1 text-sm text-white hover:bg-yellow-700"
				>
					Clear Media Notes
				</button>
			{/if}
			<button
				onclick={clearAllData}
				class="rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
			>
				Clear All Data
			</button>
		</div>

		<div class="mt-3 text-xs text-gray-500">
			<p>💡 Media files are stored as Base64 in browser localStorage</p>
			<p>Consider downloading important files before clearing data</p>
		</div>
	</div>
</details>
