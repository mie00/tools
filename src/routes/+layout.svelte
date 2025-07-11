<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	// import { page } from '$app/stores';

	let { children } = $props();

	// Handle GitHub Pages SPA redirect
	onMount(() => {
		if (typeof window !== 'undefined') {
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
