<script lang="ts">
	import Calculator from '$lib/Calculator.svelte';
	import QRCodeReader from '$lib/QRCodeReader.svelte';
	import UnitConverter from '$lib/UnitConverter.svelte';
	import CurrencyConverter from '$lib/CurrencyConverter.svelte';
	import NoteTaking from '$lib/NoteTaking.svelte';
	import DateTime from '$lib/DateTime.svelte';
	import StockTracker from '$lib/StockTracker.svelte';
	import TextTools from '$lib/TextTools.svelte';
	import ColorPicker from '$lib/ColorPicker.svelte';
	import Base64 from '$lib/Base64.svelte';
	import JsonFormatter from '$lib/JsonFormatter.svelte';
	import Azkar from '$lib/Azkar.svelte';
	import LLMChat from '$lib/LLMChat.svelte';

	let selectedTool: string | null = null;

	const tools = [
		{
			id: 'calculator',
			name: 'Calculator',
			icon: '🧮',
			description: 'Simple calculator'
		},
		{
			id: 'datetime',
			name: 'Date & Time',
			icon: '🕐',
			description: 'Current time and epoch converter'
		},
		{
			id: 'unitconverter',
			name: 'Unit Converter',
			icon: '📏',
			description: 'Convert between units'
		},
		{
			id: 'currencyconverter',
			name: 'Currency Converter',
			icon: '💱',
			description: 'Convert currencies with live rates',
			usesAPI: true
		},
		{
			id: 'texttools',
			name: 'Text Tools',
			icon: '📝',
			description: 'Text manipulation utilities'
		},
		{
			id: 'colorpicker',
			name: 'Color Picker',
			icon: '🎨',
			description: 'Color utilities'
		},
		{
			id: 'base64',
			name: 'Base64',
			icon: '🔐',
			description: 'Encode/decode Base64'
		},
		{
			id: 'jsonformat',
			name: 'JSON Formatter',
			icon: '📋',
			description: 'Format and validate JSON'
		},
		{
			id: 'qrcode',
			name: 'QR Code Reader',
			icon: '📱',
			description: 'Scan and read QR codes'
		},
		{
			id: 'notetaking',
			name: 'Note Taking',
			icon: '📓',
			description: 'Personal notes with topics and organization'
		},
		{
			id: 'stocktracker',
			name: 'Stock Tracker',
			icon: '📈',
			description: 'Track stock prices and view charts',
			usesAPI: true
		},
		{
			id: 'azkar',
			name: 'Azkar',
			icon: '📿',
			description: 'Islamic prayers and dhikr with progress tracking'
		},
		{
			id: 'llmchat',
			name: 'LLM Chat',
			icon: '🤖',
			description: 'Chat with local Gemma AI using MediaPipe (WebGPU)'
		}
	];

	function selectTool(toolId: string) {
		selectedTool = selectedTool === toolId ? null : toolId;
	}

	function goHome() {
		selectedTool = null;
	}
</script>

<svelte:head>
	<title>Tools App</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<!-- Home Page - App Grid -->
	<div class="container mx-auto px-4 py-8">
		<header class="mb-12 text-center">
			<h1 class="mb-4 text-4xl font-bold text-gray-800">My Tools</h1>
			<p class="text-lg text-gray-600">A collection of useful utilities</p>
		</header>

		<div class="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
			{#each tools as tool (tool.id)}
				<a
					href="/{tool.id}"
					class="relative transform rounded-2xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl block text-center"
				>
					{#if tool.usesAPI}
						<div
							class="absolute top-3 right-3 rounded-full bg-blue-100 p-1 text-blue-600"
							title="Uses external API"
						>
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM12 9v2"
								></path>
							</svg>
						</div>
					{/if}
					<div class="mb-3 text-4xl">{tool.icon}</div>
					<h3 class="mb-2 font-semibold text-gray-800">{tool.name}</h3>
					<p class="text-sm text-gray-500">{tool.description}</p>
				</a>
			{/each}
		</div>
	</div>
</div>
