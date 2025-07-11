export function executeCode(code: string): Promise<string> {
	return new Promise((resolve) => {
		const iframe = document.createElement('iframe');
		iframe.style.display = 'none';

		// The script that will run inside the iframe
		const iframeScript = `
			self.onmessage = (e) => {
				const { code, port } = e.data;
				let output = '';
				const log = (...args) => {
					const message = args.map(arg => {
						if (arg instanceof Error) return arg.toString();
						return typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2);
					}).join(' ');
					output += message + '\\n';
				};
				const originalLog = console.log;
				console.log = log;

				try {
					new Function(code)();
				} catch (err) {
					log(err);
				} finally {
					console.log = originalLog;
					port.postMessage(output.trim());
					port.close();
				}
			};
		`;

		iframe.srcdoc = `<script>${iframeScript}<\/script>`;
		document.body.appendChild(iframe);

		const cleanup = () => {
			if (document.body.contains(iframe)) {
				document.body.removeChild(iframe);
			}
		};

		iframe.onload = () => {
			const channel = new MessageChannel();
			channel.port1.onmessage = (e) => {
				resolve(e.data);
				cleanup();
			};

			// Timeout to prevent hanging
			setTimeout(() => {
				resolve('Execution timed out after 5 seconds.');
				cleanup();
			}, 5000);

			iframe.contentWindow?.postMessage({ code, port: channel.port2 }, '*', [channel.port2]);
		};

		iframe.onerror = (err) => {
			resolve(`Iframe loading error: ${err.toString()}`);
			cleanup();
		};
	});
}
