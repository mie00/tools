<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { translationStore } from '$lib/translation';
	import GlobalPlaylist from '$lib/sound-library/GlobalPlaylist.svelte';
	// import { page } from '$app/stores';

	let { children } = $props();
	let isRTL = $state(false);

	// Subscribe to translation store for RTL changes
	$effect(() => {
		const unsubscribe = translationStore.subscribe((state) => {
			if (state.isReady) {
				isRTL = translationStore.isCurrentLanguageRTL();

				// Apply RTL to document
				if (typeof window !== 'undefined') {
					if (isRTL) {
						document.documentElement.setAttribute('dir', 'rtl');
						document.documentElement.classList.add('rtl');
					} else {
						document.documentElement.setAttribute('dir', 'ltr');
						document.documentElement.classList.remove('rtl');
					}
				}
			}
		});
		return () => unsubscribe();
	});

	// Handle GitHub Pages SPA redirect and initialize translation
	onMount(async () => {
		// Initialize translation system
		await translationStore.initialize();
		isRTL = translationStore.isCurrentLanguageRTL();

		// Set initial RTL state
		if (typeof window !== 'undefined') {
			if (isRTL) {
				document.documentElement.setAttribute('dir', 'rtl');
				document.documentElement.classList.add('rtl');
			} else {
				document.documentElement.setAttribute('dir', 'ltr');
				document.documentElement.classList.remove('rtl');
			}

			// Handle GitHub Pages SPA redirect
			const query = window.location.search;
			if (query.startsWith('?/')) {
				// Extract and decode the path from the query parameter
				const encodedPath = query.slice(2);
				try {
					const decodedPath = decodeURIComponent(encodedPath);
					const fullPath = '/' + decodedPath;

					// Navigate to the correct route and replace the current history entry
					goto(fullPath, { replaceState: true });
				} catch (error) {
					console.error('Error decoding redirected path:', error);
					// Fallback to home page
					goto('/', { replaceState: true });
				}
			}
		}
	});
</script>

{@render children()}

<!-- Global playlist component available on all pages -->
<GlobalPlaylist />

<style>
	/* Global RTL support - applied to html element via JavaScript */
	:global(html.rtl) {
		direction: rtl;
		text-align: right;
	}

	:global(html.rtl) :global(body) {
		direction: rtl;
		text-align: right;
	}

	/* Adjust specific layout elements for RTL */
	:global(html.rtl) :global(.language-dropdown .absolute) {
		left: auto;
		right: 0;
	}

	:global(html.rtl) :global(.justify-center) {
		flex-direction: row;
	}
</style>
