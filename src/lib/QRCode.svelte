<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';

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

	// QR Generation states
	let generateText: string = $state('');
	let generatedQRCode: string = $state('');
	let generateError: string = $state('');
	let generateLoading: boolean = $state(false);
	let qrSize: number = $state(256);
	let errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = $state('M');

	// Drag and drop states
	let isDragOver: boolean = $state(false);
	let dragCounter: number = $state(0);

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

		processFile(file);

		// Reset file input
		target.value = '';
	}

	// Drag and drop handlers
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
			isDragOver = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter === 0) {
			isDragOver = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragOver = false;
		dragCounter = 0;

		const files = e.dataTransfer?.files;

		// Handle file drops
		if (files && files.length > 0) {
			const file = files[0];
			if (file.type.startsWith('image/')) {
				processFile(file);
			} else {
				error = 'Please drop an image file';
			}
			return;
		}

		// Handle images dragged from the same page
		const dataTransfer = e.dataTransfer;
		if (dataTransfer) {
			// Try to get image data from various sources
			const imageUrl =
				dataTransfer.getData('text/uri-list') ||
				dataTransfer.getData('text/html')?.match(/src="([^"]*)"?/)?.[1] ||
				dataTransfer.getData('text/plain');

			if (imageUrl) {
				// Check if it's a data URL (base64 image)
				if (imageUrl.startsWith('data:image/')) {
					processDataUrl(imageUrl);
				} else if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) {
					// Handle regular image URLs
					processImageUrl(imageUrl);
				} else {
					error = 'Unable to process the dropped content';
				}
			} else {
				error = 'No image data found in the dropped content';
			}
		}
	}

	function processDataUrl(dataUrl: string) {
		loading = true;
		error = '';

		if (!jsQRLib) {
			error = 'QR scanner library not loaded yet';
			loading = false;
			return;
		}

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
		img.onerror = () => {
			error = 'Failed to load the image';
			loading = false;
		};
		img.src = dataUrl;
	}

	function processImageUrl(imageUrl: string) {
		loading = true;
		error = '';

		if (!jsQRLib) {
			error = 'QR scanner library not loaded yet';
			loading = false;
			return;
		}

		// Create a canvas to load and process the image
		const img = new Image();
		img.crossOrigin = 'anonymous'; // Handle CORS if needed

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

		img.onerror = () => {
			error = 'Failed to load the image from URL';
			loading = false;
		};

		img.src = imageUrl;
	}

	function processFile(file: File) {
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

	// QR Generation functions
	async function generateQRCode() {
		if (!generateText.trim()) {
			generateError = 'Please enter text to generate QR code';
			return;
		}

		generateLoading = true;
		generateError = '';

		try {
			const qrDataURL = await QRCode.toDataURL(generateText, {
				width: qrSize,
				errorCorrectionLevel: errorCorrectionLevel,
				margin: 2,
				color: {
					dark: '#000000',
					light: '#FFFFFF'
				}
			});
			generatedQRCode = qrDataURL;
		} catch (err: unknown) {
			generateError = 'Failed to generate QR code';
			console.error('QR generation error:', err);
		} finally {
			generateLoading = false;
		}
	}

	function downloadQRCode() {
		if (!generatedQRCode) return;

		const link = document.createElement('a');
		link.download = 'qrcode.png';
		link.href = generatedQRCode;
		link.click();
	}

	function copyQRText() {
		navigator.clipboard.writeText(generateText).then(() => {
			// Could add a toast notification here
		});
	}

	function clearGenerated() {
		generatedQRCode = '';
		generateText = '';
		generateError = '';
	}

	// Auto-generate QR code when text changes (with debounce)
	let generateTimeout: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (generateTimeout) clearTimeout(generateTimeout);
		if (generateText.trim()) {
			generateTimeout = setTimeout(() => {
				generateQRCode();
			}, 500);
		} else {
			generatedQRCode = '';
		}
	});
</script>

<div class="mx-auto max-w-4xl space-y-8">
	<!-- QR Code Generation Section -->
	<div class="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
		<h2 class="mb-6 flex items-center text-2xl font-bold text-gray-800">🎯 Generate QR Code</h2>

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Input Section -->
			<div class="space-y-4">
				<div>
					<label for="generateText" class="mb-2 block text-sm font-medium text-gray-700">
						Enter text, URL, or data:
					</label>
					<textarea
						id="generateText"
						bind:value={generateText}
						placeholder="Enter text, URL, WiFi credentials, contact info, etc..."
						class="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
						rows="4"
					></textarea>
				</div>

				<!-- Options -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="qrSize" class="mb-1 block text-sm font-medium text-gray-700">
							Size: {qrSize}px
						</label>
						<input
							id="qrSize"
							type="range"
							bind:value={qrSize}
							min="128"
							max="512"
							step="32"
							class="w-full"
						/>
					</div>

					<div>
						<label for="errorLevel" class="mb-1 block text-sm font-medium text-gray-700">
							Error Correction
						</label>
						<select
							id="errorLevel"
							bind:value={errorCorrectionLevel}
							class="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500"
						>
							<option value="L">Low (7%)</option>
							<option value="M">Medium (15%)</option>
							<option value="Q">Quartile (25%)</option>
							<option value="H">High (30%)</option>
						</select>
					</div>
				</div>

				<!-- Generate Button -->
				<button
					onclick={generateQRCode}
					disabled={generateLoading || !generateText.trim()}
					class="w-full rounded-lg bg-blue-500 px-4 py-3 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
				>
					{generateLoading ? 'Generating...' : 'Generate QR Code'}
				</button>
			</div>

			<!-- Generated QR Code -->
			<div class="flex flex-col items-center space-y-4">
				{#if generatedQRCode}
					<div class="rounded-lg bg-white p-4 shadow-md">
						<img src={generatedQRCode} alt="Generated QR Code" class="mx-auto" />
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							onclick={downloadQRCode}
							class="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
						>
							💾 Download
						</button>
						<button
							onclick={copyQRText}
							class="rounded-lg bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
						>
							📋 Copy Text
						</button>
						<button
							onclick={clearGenerated}
							class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
						>
							🗑️ Clear
						</button>
					</div>
				{:else if generateText.trim()}
					<div
						class="flex h-64 w-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50"
					>
						<span class="text-gray-500">QR Code will appear here</span>
					</div>
				{:else}
					<div
						class="flex h-64 w-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50"
					>
						<span class="text-gray-400">Enter text to generate QR code</span>
					</div>
				{/if}

				{#if generateError}
					<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
						<p class="text-sm text-red-700">{generateError}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- QR Code Reading Section -->
	<div class="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-6">
		<h2 class="mb-6 flex items-center text-2xl font-bold text-gray-800">🔍 Scan QR Code</h2>

		<div class="grid gap-6 lg:grid-cols-2">
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
					<!-- Drag and Drop Zone -->
					<div
						role="button"
						tabindex="0"
						class="relative rounded-lg border-2 border-dashed p-8 text-center transition-colors {isDragOver
							? 'border-blue-500 bg-blue-50'
							: 'border-gray-300 bg-gray-50'} {loading ? 'opacity-50' : ''}"
						ondragenter={handleDragEnter}
						ondragleave={handleDragLeave}
						ondragover={handleDragOver}
						ondrop={handleDrop}
					>
						{#if isDragOver}
							<div class="text-blue-600">
								<svg
									class="mx-auto mb-2 h-12 w-12"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
									></path>
								</svg>
								<p class="text-lg font-medium">Drop image here</p>
							</div>
						{:else}
							<div class="text-gray-500">
								<svg
									class="mx-auto mb-2 h-12 w-12"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
									></path>
								</svg>
								<p class="mb-2 text-lg font-medium">Drag & drop an image here</p>
								<p class="text-sm text-gray-400">or click to browse files</p>
							</div>
						{/if}

						<!-- Hidden file input -->
						<input
							bind:this={fileInput}
							type="file"
							accept="image/*"
							onchange={handleFileUpload}
							disabled={loading}
							class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
						/>
					</div>

					<p class="text-sm text-gray-600">
						{loading
							? 'Processing image...'
							: 'Select or drop an image file containing a QR code to decode'}
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Scan Results Section -->
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
		<div class="grid gap-4 md:grid-cols-2">
			<div>
				<h4 class="mb-2 font-medium text-blue-700">Generate QR Codes:</h4>
				<ul class="space-y-1 text-sm text-blue-600">
					<li>• Enter any text, URL, or data to create a QR code</li>
					<li>• Adjust size and error correction level as needed</li>
					<li>• Download the generated QR code as PNG</li>
					<li>• Supports URLs, text, contact info, WiFi passwords, etc.</li>
				</ul>
			</div>
			<div>
				<h4 class="mb-2 font-medium text-blue-700">Scan QR Codes:</h4>
				<ul class="space-y-1 text-sm text-blue-600">
					<li>• Use the camera to scan QR codes in real-time</li>
					<li>• Upload an image file containing a QR code</li>
					<li>• Results can be copied or opened as links</li>
					<li>• Works with all standard QR code formats</li>
				</ul>
			</div>
		</div>
	</div>
</div>
