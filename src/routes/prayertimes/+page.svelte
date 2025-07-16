<script lang="ts">
	import { PrayerTimes, T } from '$lib';
</script>

<svelte:head>
	<title>Prayer Times - Tools App</title>
	<meta
		name="description"
		content="Calculate accurate Islamic prayer times based on your location with multiple calculation methods and profile management."
	/>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<div class="container mx-auto px-4 py-8">
		<header class="mb-8">
			<a href="/" class="mb-4 inline-flex items-center text-blue-600 hover:text-blue-800">
				<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"
					></path>
				</svg>
				Back to Tools
			</a>
			<h1 class="text-3xl font-bold text-gray-800"><T>Prayer Times</T></h1>
		</header>

		<PrayerTimes />
	</div>
</div>
