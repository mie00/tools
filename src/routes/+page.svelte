<script lang="ts">
	import Calculator from '$lib/Calculator.svelte';
	import QRCodeReader from '$lib/QRCodeReader.svelte';
	import UnitConverter from '$lib/UnitConverter.svelte';
	import CurrencyConverter from '$lib/CurrencyConverter.svelte';
	import NoteTaking from '$lib/NoteTaking.svelte';
	import DateTime from '$lib/DateTime.svelte';
	import StockTracker from '$lib/StockTracker.svelte';
	
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
	{#if selectedTool === null}
		<!-- Home Page - App Grid -->
		<div class="container mx-auto px-4 py-8">
			<header class="text-center mb-12">
				<h1 class="text-4xl font-bold text-gray-800 mb-4">My Tools</h1>
				<p class="text-gray-600 text-lg">A collection of useful utilities</p>
			</header>
			
			<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
				{#each tools as tool}
					<button
						on:click={() => selectTool(tool.id)}
						class="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100 relative"
					>
						{#if tool.usesAPI}
							<div class="absolute top-3 right-3 bg-blue-100 text-blue-600 p-1 rounded-full" title="Uses external API">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM12 9v2"></path>
								</svg>
							</div>
						{/if}
						<div class="text-4xl mb-3">{tool.icon}</div>
						<h3 class="font-semibold text-gray-800 mb-2">{tool.name}</h3>
						<p class="text-sm text-gray-500">{tool.description}</p>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Tool View -->
		<div class="container mx-auto px-4 py-8">
			<header class="mb-8">
				<button
					on:click={goHome}
					class="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
				>
					<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
					</svg>
					Back to Tools
				</button>
				<h1 class="text-3xl font-bold text-gray-800">
					{tools.find(t => t.id === selectedTool)?.name}
				</h1>
			</header>
			
			<div class="bg-white rounded-2xl shadow-lg p-6">
				{#if selectedTool === 'calculator'}
					<Calculator />
				{:else if selectedTool === 'datetime'}
					<DateTime />
				{:else if selectedTool === 'unitconverter'}
					<UnitConverter />
				{:else if selectedTool === 'currencyconverter'}
					<CurrencyConverter />
				{:else if selectedTool === 'qrcode'}
					<QRCodeReader />
				{:else if selectedTool === 'notetaking'}
					<NoteTaking />
				{:else if selectedTool === 'stocktracker'}
					<StockTracker />
				{:else}
					<div class="text-center py-12">
						<div class="text-6xl mb-4">{tools.find(t => t.id === selectedTool)?.icon}</div>
						<h3 class="text-xl font-semibold text-gray-800 mb-2">Coming Soon</h3>
						<p class="text-gray-600">This tool is under development.</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
