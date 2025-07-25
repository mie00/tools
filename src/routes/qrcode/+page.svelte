<script lang="ts">
	import QRCode from '$lib/QRCode.svelte';
	import { T } from '$lib';
</script>

<svelte:head>
	<title>QR Code Generator & Scanner - Tools App</title>
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
			<h1 class="text-3xl font-bold text-gray-800"><T>QR Code Generator & Scanner</T></h1>
		</header>

		<div class="rounded-2xl bg-white p-6 shadow-lg">
			<QRCode />
		</div>
	</div>
</div>
