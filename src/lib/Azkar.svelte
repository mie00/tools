<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import azkarJsonData from './azkar.json';

	// Process the JSON data to organize by categories
	function processAzkarData() {
		const categories: Record<string, any[]> = {};

		// The JSON has a 'rows' array where each row is: [category, zekr, description, count, reference, search]
		azkarJsonData.rows.forEach((row: any[], index: number) => {
			const [category, zekr, description, count, reference] = row;

			// Skip entries with empty category or zekr
			if (!category || !zekr) return;

			const azkarItem = {
				id: index + 1,
				text: zekr,
				description: description || '',
				count: parseInt(count) || 1,
				reference: reference || ''
			};

			if (!categories[category]) {
				categories[category] = [];
			}
			categories[category].push(azkarItem);
		});

		// Filter out categories with less than 3 azkar
		const filteredCategories: Record<string, any[]> = {};
		Object.entries(categories).forEach(([category, azkarList]) => {
			if (azkarList.length >= 3) {
				filteredCategories[category] = azkarList;
			}
		});

		return filteredCategories;
	}

	// Process the data from the JSON file
	const azkarData = processAzkarData();

	// Get available categories sorted by number of azkar (descending)
	const availableCategories = Object.entries(azkarData)
		.sort(([, a], [, b]) => b.length - a.length)
		.map(([category]) => category);

	// State for showing categories
	let showAllCategories = false;
	$: displayedCategories = showAllCategories
		? availableCategories
		: availableCategories.slice(0, 7);

	let activeCategory: string = availableCategories[0] || 'أذكار الصباح';
	let progress: Record<number, number> = {};
	let focusedAzkarId: number | null = null;
	let azkarContainer: HTMLElement;

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			const firstCategory = availableCategories[0] || 'أذكار الصباح';
			if (activeCategory !== firstCategory) {
				params.set('category', activeCategory);
			} else {
				params.delete('category');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
		}
	}

	function loadFromUrl() {
		const category = $page.url.searchParams.get('category');

		if (category && availableCategories.includes(category)) {
			activeCategory = category;
		}
	}

	// Load progress from localStorage
	function loadProgress() {
		try {
			const saved = localStorage.getItem('azkar-progress');
			if (saved) {
				progress = JSON.parse(saved);
			}
		} catch (e) {
			console.error('Error loading progress:', e);
		}
	}

	// Save progress to localStorage
	function saveProgress() {
		try {
			localStorage.setItem('azkar-progress', JSON.stringify(progress));
		} catch (e) {
			console.error('Error saving progress:', e);
		}
	}

	// Increment counter for a specific azkar
	function incrementCounter(azkarId: number) {
		progress[azkarId] = (progress[azkarId] || 0) + 1;
		saveProgress();
	}

	// Reset counter for a specific azkar
	function resetCounter(azkarId: number) {
		progress[azkarId] = 0;
		saveProgress();
	}

	// Reset all counters in a category
	function resetCategory(category: string) {
		azkarData[category as keyof typeof azkarData].forEach((azkar) => {
			progress[azkar.id] = 0;
		});
		saveProgress();
	}

	// Reset all counters
	function resetAll() {
		Object.keys(progress).forEach((key) => {
			progress[parseInt(key)] = 0;
		});
		saveProgress();
	}

	// Get completion percentage for a category
	function getCategoryProgress(category: string) {
		const categoryAzkar = azkarData[category as keyof typeof azkarData];
		if (!categoryAzkar) return 0;

		const totalRequired = categoryAzkar.reduce((sum: number, azkar: any) => sum + azkar.count, 0);
		const totalCompleted = categoryAzkar.reduce((sum: number, azkar: any) => {
			const current = Math.min(progress[azkar.id] || 0, azkar.count);
			return sum + current;
		}, 0);
		return Math.round((totalCompleted / totalRequired) * 100);
	}

	// Check if azkar is completed
	function isCompleted(azkar: any) {
		return (progress[azkar.id] || 0) >= azkar.count;
	}

	// Toggle showing all categories
	function toggleShowAllCategories() {
		showAllCategories = !showAllCategories;
	}

	// Focus on a specific azkar
	function focusAzkar(azkarId: number) {
		if (focusedAzkarId === azkarId) {
			focusedAzkarId = null; // Unfocus if already focused
		} else {
			focusedAzkarId = azkarId;
		}
	}

	// Clear focus when switching categories
	function switchCategory(category: string) {
		activeCategory = category;
		focusedAzkarId = null; // Clear focus when changing categories
	}

	// Handle increment button click with focus logic
	function handleIncrementClick(azkar: any) {
		const isCurrentlyCompleted = isCompleted(azkar);

		if (isCurrentlyCompleted) {
			// If already 100% completed, defocus
			focusedAzkarId = null;
		} else {
			// Increment first
			incrementCounter(azkar.id);

			// Check if it's now completed after incrementing
			const isNowCompleted = (progress[azkar.id] || 0) >= azkar.count;

			if (isNowCompleted) {
				// If it just reached 100%, defocus
				focusedAzkarId = null;
			} else {
				// If still not 100%, focus
				focusedAzkarId = azkar.id;
			}
		}
	}

	// Handle clicking outside to defocus
	function handleOutsideClick(event: MouseEvent) {
		if (azkarContainer && !azkarContainer.contains(event.target as Node)) {
			focusedAzkarId = null;
		}
	}

	// Load progress on component mount
	onMount(() => {
		loadProgress();
		loadFromUrl();

		// Add click outside listener
		document.addEventListener('click', handleOutsideClick);

		// Cleanup function
		return () => {
			document.removeEventListener('click', handleOutsideClick);
		};
	});

	// Watch for state changes and update URL
	$: if (typeof window !== 'undefined' && activeCategory) {
		updateUrl();
	}
</script>

<div class="azkar-container" bind:this={azkarContainer}>
	<!-- Header -->
	<div class="header">
		<h2 class="title">أذكار وأدعية</h2>
		<p class="subtitle">تطبيق لتتبع تقدمك في الأذكار اليومية</p>
	</div>

	<!-- Reset All Button -->
	<div class="reset-all-container">
		<button on:click={resetAll} class="reset-all-btn"> إعادة تعيين جميع العدادات </button>
	</div>

	<!-- Category Tabs -->
	<div class="category-tabs">
		<div class="tabs-wrapper">
			{#each displayedCategories as category (category)}
				<button
					on:click={() => switchCategory(category)}
					class="category-tab {activeCategory === category ? 'active' : ''}"
				>
					{category}
					<span class="progress-badge">
						{getCategoryProgress(category)}%
					</span>
					<span class="azkar-count">({azkarData[category].length})</span>
				</button>
			{/each}
		</div>

		<!-- Show More/Less Button -->
		{#if availableCategories.length > 6}
			<div class="show-more-container">
				<button on:click={toggleShowAllCategories} class="show-more-btn">
					{showAllCategories
						? 'إخفاء الفئات الإضافية'
						: `عرض ${availableCategories.length - 6} فئات أخرى`}
					<span class="toggle-icon">{showAllCategories ? '↑' : '↓'}</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Category Reset Button -->
	<div class="category-reset-container">
		<button on:click={() => resetCategory(activeCategory)} class="category-reset-btn">
			إعادة تعيين {activeCategory}
		</button>
	</div>

	<!-- Category Progress Bar -->
	<div class="category-progress">
		<div class="progress-bar">
			<div class="progress-fill" style="width: {getCategoryProgress(activeCategory)}%"></div>
		</div>
		<div class="progress-actions">
			<button class="reset-btn category-reset" on:click={() => resetCategory(activeCategory)}>
				إعادة تعيين الفئة
			</button>
			<button class="reset-btn global-reset" on:click={resetAll}> إعادة تعيين الكل </button>
		</div>
	</div>

	<!-- Azkar List -->
	<div class="azkar-list">
		{#each azkarData[activeCategory as keyof typeof azkarData] || [] as azkar (azkar.id)}
			<div
				class="azkar-card"
				class:completed={isCompleted(azkar)}
				class:focused={focusedAzkarId === azkar.id}
				on:click={() => focusAzkar(azkar.id)}
				role="button"
				tabindex="0"
				on:keydown={(e) => e.key === 'Enter' && focusAzkar(azkar.id)}
			>
				<div class="azkar-header">
					<span class="azkar-id">#{azkar.id}</span>
					{#if azkar.reference}
						<span class="azkar-reference">{azkar.reference}</span>
					{/if}
				</div>

				<div class="azkar-content">
					<p class="azkar-text">{azkar.text}</p>
					{#if azkar.description}
						<p class="azkar-description">{azkar.description}</p>
					{/if}
				</div>

				<div class="azkar-footer">
					<div class="counter-section">
						<div class="count-display">
							<span class="current-count">{progress[azkar.id] || 0}</span>
							<span class="separator">/</span>
							<span class="target-count">{azkar.count}</span>
						</div>

						<div class="counter-controls">
							<button
								class="counter-btn increment"
								on:click|stopPropagation={() => handleIncrementClick(azkar)}
								disabled={false}
							>
								{isCompleted(azkar) ? '✓' : '+'}
							</button>
							<button
								class="counter-btn reset"
								on:click|stopPropagation={() => resetCounter(azkar.id)}
							>
								↺
							</button>
						</div>
					</div>

					<div
						class="progress-indicator"
						style="--progress: {Math.min(((progress[azkar.id] || 0) / azkar.count) * 100, 100)}"
					>
						<div class="progress-circle">
							<span class="progress-text">
								{Math.round(Math.min(((progress[azkar.id] || 0) / azkar.count) * 100, 100))}%
							</span>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.azkar-container {
		max-width: 800px;
		margin: 0 auto;
		direction: rtl;
		text-align: right;
		font-family: 'Amiri', 'Times New Roman', serif;
	}

	.header {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.title {
		font-size: 2rem;
		font-weight: bold;
		color: #1f2937;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		color: #6b7280;
		font-size: 1rem;
	}

	.reset-all-container {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.reset-all-btn {
		background: #ef4444;
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
		font-family: inherit;
	}

	.reset-all-btn:hover {
		background: #dc2626;
	}

	.category-tabs {
		border-bottom: 2px solid #e5e7eb;
		margin-bottom: 1.5rem;
	}

	.tabs-wrapper {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.category-tab {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem 0.5rem 0 0;
		border: none;
		border-bottom: 2px solid transparent;
		background: #f3f4f6;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: inherit;
	}

	.category-tab:hover {
		background: #e5e7eb;
	}

	.category-tab.active {
		background: #3b82f6;
		color: white;
		border-bottom-color: #3b82f6;
	}

	.progress-badge {
		background: white;
		color: #1f2937;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: bold;
	}

	.category-tab.active .progress-badge {
		background: #dbeafe;
		color: #1e40af;
	}

	.azkar-count {
		background: #f3f4f6;
		color: #374151;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: bold;
	}

	.category-tab.active .azkar-count {
		background: rgba(255, 255, 255, 0.3);
		color: white;
	}

	.show-more-container {
		margin-top: 1rem;
		text-align: center;
	}

	.show-more-btn {
		background: #f9fafb;
		border: 2px dashed #d1d5db;
		color: #6b7280;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.show-more-btn:hover {
		background: #f3f4f6;
		border-color: #9ca3af;
		color: #374151;
	}

	.toggle-icon {
		font-size: 1rem;
		transition: transform 0.2s;
	}

	.category-reset-container {
		margin-bottom: 1rem;
		text-align: center;
	}

	.category-reset-btn {
		background: #f97316;
		color: white;
		padding: 0.25rem 0.75rem;
		border-radius: 0.25rem;
		border: none;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background-color 0.2s;
		font-family: inherit;
	}

	.category-reset-btn:hover {
		background: #ea580c;
	}

	.azkar-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.azkar-card {
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		padding: 1.5rem;
		border-right: 4px solid #d1d5db;
		transition: all 0.3s ease;
		cursor: pointer;
		position: relative;
	}

	.azkar-card:hover {
		box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.15);
		transform: translateY(-2px);
	}

	.azkar-card.completed {
		border-right-color: #10b981;
		background: #f0fdf4;
	}

	.azkar-card.focused {
		border-right-color: #f59e0b;
		background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
		box-shadow:
			0 0 0 3px rgba(245, 158, 11, 0.3),
			0 8px 25px -5px rgba(0, 0, 0, 0.2);
		transform: scale(1.02);
		z-index: 10;
	}

	.azkar-card.focused:hover {
		transform: scale(1.02) translateY(-2px);
	}

	.azkar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.azkar-id {
		font-size: 0.875rem;
		color: #2563eb;
		font-weight: 500;
	}

	.azkar-reference {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.azkar-content {
		margin-bottom: 1rem;
	}

	.azkar-text {
		font-size: 1.125rem;
		line-height: 2;
		color: #1f2937;
		margin-bottom: 1rem;
		white-space: pre-line;
	}

	.azkar-description {
		font-size: 1rem;
		color: #6b7280;
		margin-bottom: 1rem;
	}

	.azkar-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.counter-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.count-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.5rem;
		font-weight: bold;
		direction: rtl;
	}

	.current-count {
		color: #2563eb;
	}

	.separator {
		color: #9ca3af;
	}

	.target-count {
		color: #6b7280;
	}

	.counter-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.counter-btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: none;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}

	.counter-btn.increment {
		background: #10b981;
		color: white;
		font-size: 1.25rem;
		min-width: 50px;
	}

	.counter-btn.increment:hover:not(.disabled) {
		background: #059669;
	}

	.counter-btn.reset {
		background: #6b7280;
		color: white;
		font-size: 0.875rem;
	}

	.counter-btn.reset:hover {
		background: #4b5563;
	}

	@property --progress {
		syntax: '<number>';
		initial-value: 0;
		inherits: false;
	}

	.progress-indicator {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: conic-gradient(
			from -90deg,
			#10b981 0deg,
			#10b981 calc(var(--progress) * 3.6deg),
			#e5e7eb calc(var(--progress) * 3.6deg),
			#e5e7eb 360deg
		);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		--progress: 0;
		transition: --progress 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}

	.progress-circle {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: white;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.progress-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
		direction: ltr;
	}

	/* Special styling for completed items */
	.azkar-card.completed .progress-text {
		color: #059669;
	}

	/* Reset buttons in progress actions */
	.reset-btn {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		border: none;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}

	.reset-btn.category-reset {
		background: #f97316;
		color: white;
	}

	.reset-btn.category-reset:hover {
		background: #ea580c;
	}

	.reset-btn.global-reset {
		background: #ef4444;
		color: white;
	}

	.reset-btn.global-reset:hover {
		background: #dc2626;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.azkar-container {
			padding: 0 1rem;
		}

		.counter-section {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.counter-controls {
			justify-content: center;
		}

		.tabs-wrapper {
			justify-content: center;
		}
	}
</style>
