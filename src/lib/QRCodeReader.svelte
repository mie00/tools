<script>
	import { onMount } from 'svelte';

	let fileInput;
	let videoElement;
	let canvasElement;
	let result = '';
	let error = '';
	let isScanning = false;
	let stream = null;
	let jsQR = null;

	onMount(async () => {
		// Load jsQR library dynamically
		try {
			const module = await import('https://cdn.skypack.dev/jsqr');
			jsQR = module.default;
		} catch {
			error = 'Failed to load QR code scanner library';
		}
	});

	async function startCamera() {
		try {
			error = '';
			result = '';

			if (!jsQR) {
				error = 'QR scanner library not loaded yet';
				return;
			}

			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' } // Prefer back camera
			});

			videoElement.srcObject = stream;
			videoElement.play();
			isScanning = true;

			// Start scanning loop
			scanQRCode();
		} catch {
			error = 'Camera access denied or not available';
		}
	}

	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
			stream = null;
		}
		isScanning = false;
		videoElement.srcObject = null;
	}

	function scanQRCode() {
		if (!isScanning || !jsQR) return;

		if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
			const canvas = canvasElement;
			const context = canvas.getContext('2d');

			canvas.width = videoElement.videoWidth;
			canvas.height = videoElement.videoHeight;

			context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
			const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

			const code = jsQR(imageData.data, imageData.width, imageData.height);

			if (code) {
				result = code.data;
				stopCamera();
				return;
			}
		}

		requestAnimationFrame(scanQRCode);
	}

	function handleFileUpload(event) {
		const file = event.target.files[0];
		if (!file) return;

		error = '';
		result = '';

		if (!jsQR) {
			error = 'QR scanner library not loaded yet';
			return;
		}

		const reader = new FileReader();
		reader.onload = function (e) {
			const img = new Image();
			img.onload = function () {
				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d');

				canvas.width = img.width;
				canvas.height = img.height;
				context.drawImage(img, 0, 0);

				const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
				const code = jsQR(imageData.data, imageData.width, imageData.height);

				if (code) {
					result = code.data;
				} else {
					error = 'No QR code found in the image';
				}
			};
			img.src = e.target.result;
		};
		reader.readAsDataURL(file);
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

	function isUrl(text) {
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
					on:click={startCamera}
					class="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
				>
					Start Camera
				</button>
			{:else}
				<button
					on:click={stopCamera}
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
				on:change={handleFileUpload}
				class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
			/>
			<p class="text-sm text-gray-600">Select an image file containing a QR code to decode</p>
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
						on:click={copyToClipboard}
						class="rounded-lg bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
					>
						📋 Copy
					</button>

					{#if isUrl(result)}
						<button
							on:click={openLink}
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
