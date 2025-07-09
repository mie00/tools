<script lang="ts">
	import { onMount } from 'svelte';
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
	import UrlExaminer from '$lib/UrlExaminer.svelte';

	let selectedTool: string | null = null;
	let draggedIndex: number | null = null;
	let draggedOverIndex: number | null = null;
	let draggedElement: HTMLElement | null = null;
	let dragPreview: HTMLElement | null = null;
	let mouseX = 0;
	let mouseY = 0;

	// Make tools reactive so we can reorder them
	let tools = [
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
		},
		{
			id: 'urlexaminer',
			name: 'URL Examiner',
			icon: '🔗',
			description: 'Analyze and break down URLs into components'
		},
		{
			id: 'prayertimes',
			name: 'Prayer Times',
			icon: '🕌',
			description: 'Islamic prayer times with location-based calculation methods'
		}
	];

	function selectTool(toolId: string) {
		selectedTool = selectedTool === toolId ? null : toolId;
	}

	function goHome() {
		selectedTool = null;
	}

	// Drag and drop functions
	function handleDragStart(event: DragEvent, index: number) {
		draggedIndex = index;
		draggedElement = event.target as HTMLElement;

		// Create drag preview
		if (draggedElement) {
			dragPreview = draggedElement.cloneNode(true) as HTMLElement;
			dragPreview.style.position = 'fixed';
			dragPreview.style.top = '0px';
			dragPreview.style.left = '0px';
			dragPreview.style.width = draggedElement.offsetWidth + 'px';
			dragPreview.style.height = draggedElement.offsetHeight + 'px';
			dragPreview.style.zIndex = '9999';
			dragPreview.style.pointerEvents = 'none';
			dragPreview.style.opacity = '0.8';
			dragPreview.style.transform = 'rotate(5deg)';
			dragPreview.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
			document.body.appendChild(dragPreview);
		}

		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', index.toString());
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		event.dataTransfer!.dropEffect = 'move';
		draggedOverIndex = index;

		// Update mouse position for drag preview
		mouseX = event.clientX;
		mouseY = event.clientY;

		// Update drag preview position
		if (dragPreview) {
			dragPreview.style.left = mouseX - dragPreview.offsetWidth / 2 + 'px';
			dragPreview.style.top = mouseY - dragPreview.offsetHeight / 2 + 'px';
		}
	}

	function handleDragLeave() {
		draggedOverIndex = null;
	}

	function handleDrop(event: DragEvent, dropIndex: number) {
		event.preventDefault();

		if (draggedIndex !== null && draggedIndex !== dropIndex) {
			// Reorder the tools array
			const newTools = [...tools];
			const [draggedTool] = newTools.splice(draggedIndex, 1);
			newTools.splice(dropIndex, 0, draggedTool);
			tools = newTools;

			// Save to localStorage
			localStorage.setItem('tools-order', JSON.stringify(tools.map((t) => t.id)));
		}

		// Clean up drag preview
		if (dragPreview) {
			document.body.removeChild(dragPreview);
			dragPreview = null;
		}

		draggedIndex = null;
		draggedOverIndex = null;
		draggedElement = null;
	}

	function handleDragEnd() {
		// Clean up drag preview
		if (dragPreview) {
			document.body.removeChild(dragPreview);
			dragPreview = null;
		}

		draggedIndex = null;
		draggedOverIndex = null;
		draggedElement = null;
	}

	// Load saved order from localStorage on mount
	onMount(() => {
		const savedOrder = localStorage.getItem('tools-order');
		if (savedOrder) {
			try {
				const savedIds = JSON.parse(savedOrder);
				const savedTools = savedIds
					.map((id: string) => tools.find((tool) => tool.id === id))
					.filter(Boolean);

				// Add any new tools that weren't in the saved order
				const newTools = tools.filter((tool) => !savedIds.includes(tool.id));

				tools = [...savedTools, ...newTools];
			} catch (error) {
				console.error('Error loading saved tool order:', error);
			}
		}
		// Initialize tools
		tools = tools;

		// Add global mouse move handler for drag preview
		const handleMouseMove = (event: MouseEvent) => {
			if (dragPreview) {
				mouseX = event.clientX;
				mouseY = event.clientY;
				dragPreview.style.left = mouseX - dragPreview.offsetWidth / 2 + 'px';
				dragPreview.style.top = mouseY - dragPreview.offsetHeight / 2 + 'px';
			}
		};

		document.addEventListener('mousemove', handleMouseMove);

		// Cleanup function
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			if (dragPreview) {
				document.body.removeChild(dragPreview);
			}
		};
	});
</script>

<svelte:head>
	<title>Tools App</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<!-- Home Page - App Grid -->
	<div class="container mx-auto px-4 py-8">
		<header class="mb-12 text-center">
			<div class="mb-4 flex justify-center">
				<a
					href="https://github.com/mie00/tools"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-white transition-all duration-300 hover:scale-105 hover:bg-gray-800"
				>
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
						<path
							d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
						/>
					</svg>
					<span class="font-medium">View on GitHub</span>
				</a>
			</div>
			<h1 class="mb-4 text-4xl font-bold text-gray-800">My Tools</h1>
			<p class="text-lg text-gray-600">A collection of useful utilities</p>
			<p class="mt-2 text-sm text-gray-500">💡 Drag and drop to reorder your tools</p>
		</header>

		<div class="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
			{#each tools as tool, index (tool.id)}
				<div
					role="listitem"
					draggable="true"
					on:dragstart={(e) => handleDragStart(e, index)}
					on:dragover={(e) => handleDragOver(e, index)}
					on:dragleave={handleDragLeave}
					on:drop={(e) => handleDrop(e, index)}
					on:dragend={handleDragEnd}
					class="group relative block transform cursor-move rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl
						{draggedIndex === index ? 'scale-95 opacity-50 shadow-2xl' : ''}
						{draggedOverIndex === index && draggedIndex !== index
						? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
						: ''}"
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

					<!-- Drag handle indicator -->
					<div
						class="absolute top-3 left-3 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 8h16M4 16h16"
							></path>
						</svg>
					</div>

					<div class="mb-3 text-4xl">{tool.icon}</div>
					<h3 class="mb-2 font-semibold text-gray-800">{tool.name}</h3>
					<p class="text-sm text-gray-500">{tool.description}</p>

					<!-- Clickable overlay for navigation -->
					<a
						href="/{tool.id}"
						aria-label={tool.name}
						class="absolute inset-0 z-10"
						on:click={(e) => {
							// Prevent navigation if we're dragging
							if (draggedIndex !== null) {
								e.preventDefault();
							}
						}}
					></a>
				</div>
			{/each}
		</div>
	</div>
</div>
