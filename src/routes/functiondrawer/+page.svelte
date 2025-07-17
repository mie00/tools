<script lang="ts">
	import FunctionDrawer from '$lib/FunctionDrawer.svelte';
	import ToolLayout from '$lib/ToolLayout.svelte';
</script>

<ToolLayout title="Function Drawer">
	<p class="mb-4 text-gray-600">
		Draw mathematical functions using Python expressions. Drag to pan, scroll to zoom.
	</p>
	<FunctionDrawer />
</ToolLayout>
