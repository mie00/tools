<script lang="ts">
	import { onMount } from 'svelte';

	const { code, type } = $props<{
		code: string;
		type: 'js' | 'html';
	}>();

	/* eslint-disable no-useless-escape */
	const SRC_DOC = `<script>
        self.onmessage = (e) => {
            const {
                code,
                port
            } = e.data;
            const log = (...args) => {
                port.postMessage(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)).join(' '));
            };
            const originalLog = console.log;
            console.log = log;
            try {
                new Function(code)();
            } catch (err) {
                port.postMessage(err.toString());
            } finally {
                console.log = originalLog;
                port.close();
            }
        };
    <\/script>
    `;
	/* eslint-enable no-useless-escape */

	let iframe: HTMLIFrameElement = $state() as HTMLIFrameElement;
	let output = $state('');

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
			title="JavaScript Executor"
			srcdoc={SRC_DOC}
			class="hidden"
			onload={executeJs}
		></iframe>
		<!-- Safe: output is from sandboxed iframe execution -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<pre class="mt-2 max-h-64 overflow-auto rounded border bg-gray-100 p-2 text-sm">{@html output ||
				'Executing...'}</pre>
	</div>
{/if}
