<script lang="ts">
	let {
		showModal = $bindable(),
		apiKeyInput = $bindable(),
		apiKeyError = $bindable(),
		isValidating = $bindable(),
		onsubmit,
		oncancel
	} = $props<{
		showModal?: boolean;
		apiKeyInput?: string;
		apiKeyError?: string;
		isValidating?: boolean;
		onsubmit: (_apiKey: string) => void;
		oncancel: () => void;
	}>();

	function handleSubmit() {
		if (apiKeyInput?.trim()) {
			onsubmit(apiKeyInput.trim());
		}
	}

	function handleCancel() {
		oncancel();
	}

	function handleClose() {
		// This function is no longer needed as createEventDispatcher is removed
		// Keeping it for now in case it's called elsewhere, but it will do nothing.
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSubmit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			handleCancel();
		}
	}
</script>

{#if showModal}
	<!-- Modal Backdrop -->
	<div
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
		onclick={handleClose}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="api-key-title"
		tabindex="-1"
	>
		<!-- Modal Content -->
		<div class="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" role="document">
			<h3 id="api-key-title" class="mb-4 text-xl font-bold text-gray-800">
				Setup Alpha Vantage API Key
			</h3>

			<p class="mb-4 text-gray-600">
				To use the Stock Tracker, you need a free API key from Alpha Vantage.
			</p>

			<div class="space-y-4">
				<!-- Get API Key Link -->
				<div>
					<a
						href="https://www.alphavantage.co/support/#api-key"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800"
					>
						<span>Get your free API key here</span>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							></path>
						</svg>
					</a>
				</div>

				<!-- API Key Input -->
				<div>
					<label for="api-key-input" class="mb-2 block text-sm font-medium text-gray-700">
						Enter your API key:
					</label>
					<input
						id="api-key-input"
						type="text"
						bind:value={apiKeyInput}
						onkeydown={handleKeydown}
						placeholder="Your Alpha Vantage API key"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
						disabled={isValidating}
					/>
				</div>

				<!-- Error Message -->
				{#if apiKeyError}
					<div class="rounded-md border border-red-200 bg-red-50 p-3">
						<div class="flex items-center space-x-2">
							<svg
								class="h-5 w-5 flex-shrink-0 text-red-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								></path>
							</svg>
							<span class="text-sm text-red-700">{apiKeyError}</span>
						</div>
					</div>
				{/if}

				<!-- Action Buttons -->
				<div class="flex space-x-3">
					<button
						onclick={handleSubmit}
						disabled={!apiKeyInput.trim() || isValidating}
						class="flex flex-1 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
					>
						{#if isValidating}
							<svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							Validating...
						{:else}
							Save API Key
						{/if}
					</button>
					<button
						onclick={handleCancel}
						disabled={isValidating}
						class="flex-1 rounded-md bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancel
					</button>
				</div>

				<!-- Instructions -->
				<div class="rounded-md bg-blue-50 p-3">
					<div class="text-sm text-blue-800">
						<p class="mb-1 font-medium">Instructions:</p>
						<ol class="list-inside list-decimal space-y-1 text-xs">
							<li>Click the link above to get your free API key</li>
							<li>Sign up or log in to Alpha Vantage</li>
							<li>Copy your API key and paste it above</li>
							<li>Your key will be validated and saved locally</li>
						</ol>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
