<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';

	export let code: string;
	export let type: 'js' | 'html';

	let iframe: HTMLIFrameElement;
	let output = '';

	function executeJs() {
		if (!iframe) return;
		output = '';
		const channel = new MessageChannel();
		iframe.contentWindow?.postMessage({ code, port: channel.port2 }, '*', [channel.port2]);
		channel.port1.onmessage = (e) => {
			output += e.data + '\n';
		};
	}

	onMount(() => {
		if (type === 'js') {
			// A short delay to ensure the iframe is ready to receive messages
			const timeoutId = setTimeout(() => {
				executeJs();
			}, 100);
			return () => clearTimeout(timeoutId);
		}
	});
</script>

{#if type === 'html'}
	<iframe title="HTML Output" sandbox="allow-scripts" srcdoc={code} class="h-64 w-full border"
	></iframe>
{:else if type === 'js'}
	<div class="text-black">
		<iframe
			bind:this={iframe}
			title="JavaScript Execution Frame"
			srcdoc={`<script>self.onmessage = (e) => { const { code, port } = e.data; const log = (...args) => { port.postMessage(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)).join(' ')); }; const originalLog = console.log; console.log = log; try { new Function(code)(); } catch (err) { port.postMessage(err.toString()); } finally { console.log = originalLog; port.close(); } };<\/script>`}
			class="hidden"
			on:load={executeJs}
		></iframe>
		<pre class="mt-2 max-h-64 overflow-auto rounded border bg-gray-100 p-2 text-sm">{@html output ||
				'Executing...'}</pre>
	</div>
{/if}
