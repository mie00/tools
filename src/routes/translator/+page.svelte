<script lang="ts">
	import Translator from '$lib/Translator.svelte';
	import ToolLayout from '$lib/ToolLayout.svelte';
</script>

<ToolLayout title="Language Translator">
	<p class="mb-4 text-gray-600">
		Translate text using Chrome's built-in AI translation capabilities
	</p>
	<Translator />
</ToolLayout>
