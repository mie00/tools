<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { children } = $props();

	// Handle GitHub Pages SPA redirect
	onMount(() => {
		if (typeof window !== 'undefined') {
			const query = window.location.search;
			if (query.startsWith('?/')) {
				// Extract the path from the query parameter
				const path = query.slice(2).replace(/~and~/g, '&').replace(/~question~/g, '?');
				const fullPath = '/' + path;

				// Navigate to the correct route and replace the current history entry
				goto(fullPath, { replaceState: true });
			}
		}
	});
</script>

{@render children()}
