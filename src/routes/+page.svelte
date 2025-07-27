<script lang="ts">
	import { onMount } from 'svelte';
	// Components are loaded dynamically through routing, not imported directly
	import SmartInputSuggestions from '$lib/SmartInputSuggestions.svelte';
	import { translationStore, supportedLanguages, type Language } from '$lib/translation';
	import { T } from '$lib';

	let _selectedTool: string | null = $state(null);
	let draggedIndex: number | null = $state(null);
	let draggedOverIndex: number | null = $state(null);
	let draggedElement: HTMLElement | null = $state(null);
	let dragPreview: HTMLElement | null = $state(null);
	let mouseX = $state(0);
	let mouseY = $state(0);

	// Translation state
	let currentLanguage: Language = $state({
		code: 'en',
		name: 'English',
		nativeName: 'English',
		rtl: false
	});
	let showLanguageDropdown = $state(false);

	// Make tools reactive so we can reorder them
	let tools = $state([
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
			id: 'translator',
			name: 'Language Translator',
			icon: '🌐',
			description: 'Translate text using Chrome AI - works offline'
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
			name: 'QR Code Generator & Scanner',
			icon: '📱',
			description: 'Generate and scan QR codes'
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
			icon: '💬',
			description: 'Chat with AI models - both local (WebGPU) and remote (Ollama)'
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
		},
		{
			id: 'functiondrawer',
			name: 'Function Drawer',
			icon: '📈',
			description: 'Draw mathematical functions using Python expressions with numpy'
		},
		{
			id: 'difftool',
			name: 'Diff Tool',
			icon: '🔀',
			description: 'Compare and visualize differences between text, JSON, and YAML'
		},
		{
			id: 'stunip',
			name: 'STUN IP Finder',
			icon: '🌐',
			description: 'Find your public and local IP addresses using STUN',
			usesAPI: true
		},
		{
			id: 'soundlibrary',
			name: 'Sound Library',
			icon: '🎵',
			description: 'Upload, organize, and play audio files with tags and folders'
		}
	]);

	// selectTool and goHome functions removed as they're not used (navigation is handled by routing)

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

	// Language functions
	async function handleLanguageChange(languageCode: string) {
		await translationStore.setLanguage(languageCode);
		updateCurrentLanguage();
		showLanguageDropdown = false;
	}

	// Update current language when changed
	function updateCurrentLanguage() {
		currentLanguage = translationStore.getCurrentLanguage();
	}

	// Close language dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Element;
		if (!target.closest('.language-dropdown')) {
			showLanguageDropdown = false;
		}
	}

	// Load saved order from localStorage on mount
	onMount(() => {
		// Update current language (initialization handled in layout)
		updateCurrentLanguage();

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
		document.addEventListener('click', handleClickOutside);

		// Cleanup function
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('click', handleClickOutside);
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
			<div class="mb-4 flex items-center justify-center gap-4">
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
					<span class="font-medium"><T>View on GitHub</T></span>
				</a>

				<!-- Language Selector -->
				{#if false}
					<div class="language-dropdown relative">
						<button
							onclick={() => (showLanguageDropdown = !showLanguageDropdown)}
							class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-all duration-300 hover:scale-105 hover:bg-blue-700"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
								></path>
							</svg>
							<span class="font-medium">{currentLanguage.nativeName}</span>
							<svg
								class="h-4 w-4 transition-transform"
								class:rotate-180={showLanguageDropdown}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								></path>
							</svg>
						</button>

						{#if showLanguageDropdown}
							<div
								class="absolute top-full left-0 z-50 mt-2 max-h-80 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
							>
								{#each supportedLanguages as language (language.code)}
									<button
										onclick={() => handleLanguageChange(language.code)}
										class="flex w-full items-center gap-3 px-4 py-3 text-left text-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-blue-50"
										class:bg-blue-100={currentLanguage.code === language.code}
										class:font-semibold={currentLanguage.code === language.code}
									>
										<span class="flex-1">{language.nativeName}</span>
										<span class="text-sm text-gray-500">{language.name}</span>
										{#if currentLanguage.code === language.code}
											<svg
												class="h-4 w-4 text-blue-600"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												></path>
											</svg>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
			<h1 class="mb-4 text-4xl font-bold text-gray-800">
				<T>My Tools</T>
			</h1>
			<p class="text-lg text-gray-600">
				<T>A collection of useful utilities</T>
			</p>
			<p class="mt-2 text-sm text-gray-500">
				💡 <T>Drag and drop to reorder your tools</T>
			</p>
		</header>

		<!-- Smart Input Suggestions Section -->
		<div class="mx-auto mb-12 max-w-3xl">
			<div class="rounded-2xl bg-white p-6 shadow-lg">
				<SmartInputSuggestions />
			</div>
		</div>

		<div class="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
			{#each tools as tool, index (tool.id)}
				<div
					role="listitem"
					draggable="true"
					ondragstart={(e) => handleDragStart(e, index)}
					ondragover={(e) => handleDragOver(e, index)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, index)}
					ondragend={handleDragEnd}
					class="group relative block transform cursor-move rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl
						{draggedIndex === index ? 'scale-95 opacity-50 shadow-2xl' : ''}
						{draggedOverIndex === index && draggedIndex !== index
						? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
						: ''}"
				>
					{#if tool.usesAPI}
						<div class="group/indicator absolute top-3 right-3">
							<div class="cursor-pointer rounded-full bg-blue-100 p-1 text-blue-600">
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2zM12 9v2"
									></path>
								</svg>
							</div>
							<div
								class="absolute right-0 z-20 mt-2 hidden w-48 rounded-lg border border-blue-200 bg-white p-3 text-xs text-blue-800 shadow-lg group-hover/indicator:block"
							>
								This tool uses an online API and requires internet access.
							</div>
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
					<h3 class="mb-2 font-semibold text-gray-800">
						<T>{tool.name}</T>
					</h3>
					<p class="text-sm text-gray-500">
						<T>{tool.description}</T>
					</p>

					<!-- Clickable overlay for navigation -->
					<a
						href="/{tool.id}"
						aria-label={tool.name}
						class="absolute inset-0 z-10"
						onclick={(e) => {
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

<style>
	/* Local page styles - RTL handled at document level */
</style>
