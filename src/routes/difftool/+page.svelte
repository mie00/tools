<script lang="ts">
	import DiffTool from '$lib/DiffTool.svelte';
	import ToolLayout from '$lib/ToolLayout.svelte';
</script>

<ToolLayout title="Diff Tool">
	<p class="mb-4 text-gray-600">
		Compare and visualize differences between text, JSON, and YAML files with comprehensive
		configuration options.
	</p>
	<DiffTool />
</ToolLayout>
