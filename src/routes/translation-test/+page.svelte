<script lang="ts">
	import { onMount } from 'svelte';
	import { T } from '$lib';
	import { translationStore, supportedLanguages } from '$lib/translation';
	import ToolLayout from '$lib/ToolLayout.svelte';

	let currentLanguage = $state('en');

	onMount(async () => {
		await translationStore.initialize();
		currentLanguage = translationStore.getCurrentLanguage().code;
	});

	async function changeLanguage(langCode: string) {
		await translationStore.setLanguage(langCode);
		currentLanguage = translationStore.getCurrentLanguage().code;
	}
</script>

<ToolLayout title="Translation Test">
	<div class="mb-6">
		<h2 class="mb-4 text-xl font-semibold">
			<T>Language Selection</T>
		</h2>
		<div class="flex flex-wrap gap-2">
			{#each supportedLanguages as lang (lang.code)}
				<button
					onclick={() => changeLanguage(lang.code)}
					class="rounded-lg px-3 py-2 text-sm transition-colors"
					class:bg-blue-600={currentLanguage === lang.code}
					class:text-white={currentLanguage === lang.code}
					class:bg-gray-200={currentLanguage !== lang.code}
					class:text-gray-700={currentLanguage !== lang.code}
				>
					{lang.nativeName}
				</button>
			{/each}
		</div>
	</div>

	<div class="space-y-4">
		<h2 class="text-xl font-semibold">
			<T>T Component Demo</T>
		</h2>

		<div class="rounded-lg bg-gray-50 p-4">
			<h3 class="mb-2 font-medium">
				<T>Using slot content:</T>
			</h3>
			<p class="text-lg">
				<T>Hello World</T>
			</p>
			<p>
				<T>This is a longer sentence that should be translated properly.</T>
			</p>
		</div>

		<div class="rounded-lg bg-gray-50 p-4">
			<h3 class="mb-2 font-medium">
				<T>Using key prop:</T>
			</h3>
			<p class="text-lg">
				<T key="Welcome to the translation system!" />
			</p>
			<p>
				<T key="The translation happens automatically when you change languages." />
			</p>
		</div>

		<div class="rounded-lg bg-gray-50 p-4">
			<h3 class="mb-2 font-medium">
				<T>Mixed content:</T>
			</h3>
			<p>
				🎉 <T>Congratulations!</T>
				<T>You have successfully implemented the T component.</T> 🎊
			</p>
		</div>
	</div>

	<div class="mt-6 rounded-lg bg-blue-50 p-4">
		<h3 class="mb-2 font-semibold text-blue-800">
			<T>Instructions:</T>
		</h3>
		<ol class="list-inside list-decimal space-y-1 text-blue-700">
			<li><T>Select different languages using the buttons above</T></li>
			<li><T>Watch how the text automatically translates</T></li>
			<li><T>Notice RTL support for Arabic language</T></li>
			<li><T>The component falls back to original text if translation fails</T></li>
		</ol>
	</div>
</ToolLayout>
