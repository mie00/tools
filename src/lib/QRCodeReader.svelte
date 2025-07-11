<script lang="ts">
	import { onMount } from 'svelte';

	// Type definitions (JSQRResult was removed as it's not used)

	let fileInput: HTMLInputElement | undefined = $state();
	let videoElement: HTMLVideoElement | undefined = $state();
	let canvasElement: HTMLCanvasElement | undefined = $state();
	let result: string = $state('');
	let error: string = $state('');
	let loading: boolean = $state(false);
	let isScanning: boolean = $state(false);
	let stream: MediaStream | null = $state(null);
	let jsQRLib: any = $state(null);

	onMount(async () => {
		try {
			// @ts-ignore - External CDN module
			const module = await import('https://cdn.skypack.dev/jsqr');
			jsQRLib = module.default;
		} catch (err: unknown) {
			console.error('Failed to load QR scanner library:', err);
			error = 'Failed to load QR scanner library';
		}
	});

	async function startCamera() {
		loading = true;
		error = '';

		try {
			if (!jsQRLib) {
				error = 'QR scanner library not loaded yet';
				return;
			}

			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});

			if (videoElement) {
				videoElement.srcObject = stream;
				videoElement.play();
				isScanning = true;
				scanQRCode();
			}
		} catch (err: unknown) {
			error = 'Camera access denied or not available';
			console.error('Camera error:', err);
		} finally {
			loading = false;
		}
	}

	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
			stream = null;
		}
		isScanning = false;
		if (videoElement) {
			videoElement.srcObject = null;
		}
	}

	function scanQRCode() {
		if (!isScanning || !jsQRLib || !videoElement || !canvasElement) return;

		if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
			const canvas = canvasElement;
			const context = canvas.getContext('2d');

			canvas.width = videoElement.videoWidth;
			canvas.height = videoElement.videoHeight;

			context?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
			const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);

			if (imageData) {
				const code = jsQRLib(imageData.data, imageData.width, imageData.height);

				if (code) {
					result = code.data;
					stopCamera();
					return;
				}
			}
		}

		requestAnimationFrame(scanQRCode);
	}

	function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target?.files?.[0];
		if (!file) return;

		loading = true;
		error = '';

		if (!jsQRLib) {
			error = 'QR scanner library not loaded yet';
			loading = false;
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d');
				canvas.width = img.width;
				canvas.height = img.height;
				context?.drawImage(img, 0, 0);

				const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
				if (imageData) {
					const code = jsQRLib(imageData.data, imageData.width, imageData.height);

					if (code) {
						result = code.data;
					} else {
						error = 'No QR code found in the image';
					}
				}
				loading = false;
			};
			img.src = e.target?.result as string;
		};
		reader.readAsDataURL(file);

		// Reset file input
		target.value = '';
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(result).then(() => {
			// Could add a toast notification here
		});
	}

	function openLink() {
		if (result.startsWith('http://') || result.startsWith('https://')) {
			window.open(result, '_blank');
		}
	}

	function isUrl(text: string): boolean {
		return text.startsWith('http://') || text.startsWith('https://');
	}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<!-- Camera Section -->
	<div class="rounded-lg bg-gray-50 p-6">
		<h3 class="mb-4 flex items-center text-lg font-semibold">📷 Scan with Camera</h3>

		<div class="space-y-4">
			{#if !isScanning}
				<button
					onclick={startCamera}
					disabled={loading}
					class="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
				>
					{loading ? 'Loading...' : 'Start Camera'}
				</button>
			{:else}
				<button
					onclick={stopCamera}
					class="rounded-lg bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600"
				>
					Stop Camera
				</button>
			{/if}

			<div class="relative">
				<video
					bind:this={videoElement}
					class="mx-auto w-full max-w-md rounded-lg bg-black"
					class:hidden={!isScanning}
					autoplay
					muted
					playsinline
				></video>
				<canvas bind:this={canvasElement} class="hidden"></canvas>
			</div>
		</div>
	</div>

	<!-- File Upload Section -->
	<div class="rounded-lg bg-gray-50 p-6">
		<h3 class="mb-4 flex items-center text-lg font-semibold">📁 Upload Image</h3>

		<div class="space-y-4">
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				onchange={handleFileUpload}
				disabled={loading}
				class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
			/>
			<p class="text-sm text-gray-600">
				{loading ? 'Processing image...' : 'Select an image file containing a QR code to decode'}
			</p>
		</div>
	</div>

	<!-- Results Section -->
	{#if result}
		<div class="rounded-lg border border-green-200 bg-green-50 p-6">
			<h3 class="mb-4 flex items-center text-lg font-semibold text-green-800">
				✅ QR Code Detected
			</h3>

			<div class="space-y-4">
				<div class="rounded-lg border bg-white p-4">
					<p class="font-mono text-sm break-all">{result}</p>
				</div>

				<div class="flex flex-wrap gap-2">
					<button
						onclick={copyToClipboard}
						class="rounded-lg bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
					>
						📋 Copy
					</button>

					{#if isUrl(result)}
						<button
							onclick={openLink}
							class="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
						>
							🔗 Open Link
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Section -->
	{#if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-6">
			<h3 class="mb-2 flex items-center text-lg font-semibold text-red-800">❌ Error</h3>
			<p class="text-red-700">{error}</p>
		</div>
	{/if}

	<!-- Instructions -->
	<div class="rounded-lg border border-blue-200 bg-blue-50 p-6">
		<h3 class="mb-2 flex items-center text-lg font-semibold text-blue-800">💡 How to use</h3>
		<ul class="space-y-1 text-sm text-blue-700">
			<li>• Use the camera to scan QR codes in real-time</li>
			<li>• Upload an image file containing a QR code</li>
			<li>• Results will be displayed and can be copied or opened as links</li>
			<li>• Works with URLs, text, contact info, WiFi passwords, and more</li>
		</ul>
	</div>
</div>
