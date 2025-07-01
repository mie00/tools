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
		} catch (e) {
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
		} catch (e) {
			error = 'Camera access denied or not available';
		}
	}
	
	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach(track => track.stop());
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
		reader.onload = function(e) {
			const img = new Image();
			img.onload = function() {
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

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Camera Section -->
	<div class="bg-gray-50 rounded-lg p-6">
		<h3 class="text-lg font-semibold mb-4 flex items-center">
			📷 Scan with Camera
		</h3>
		
		<div class="space-y-4">
			{#if !isScanning}
				<button
					on:click={startCamera}
					class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
				>
					Start Camera
				</button>
			{:else}
				<button
					on:click={stopCamera}
					class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium"
				>
					Stop Camera
				</button>
			{/if}
			
			<div class="relative">
				<video
					bind:this={videoElement}
					class="w-full max-w-md mx-auto rounded-lg bg-black"
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
	<div class="bg-gray-50 rounded-lg p-6">
		<h3 class="text-lg font-semibold mb-4 flex items-center">
			📁 Upload Image
		</h3>
		
		<div class="space-y-4">
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				on:change={handleFileUpload}
				class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
			/>
			<p class="text-sm text-gray-600">
				Select an image file containing a QR code to decode
			</p>
		</div>
	</div>
	
	<!-- Results Section -->
	{#if result}
		<div class="bg-green-50 border border-green-200 rounded-lg p-6">
			<h3 class="text-lg font-semibold text-green-800 mb-4 flex items-center">
				✅ QR Code Detected
			</h3>
			
			<div class="space-y-4">
				<div class="bg-white rounded-lg p-4 border">
					<p class="font-mono text-sm break-all">{result}</p>
				</div>
				
				<div class="flex gap-2 flex-wrap">
					<button
						on:click={copyToClipboard}
						class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
					>
						📋 Copy
					</button>
					
					{#if isUrl(result)}
						<button
							on:click={openLink}
							class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
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
		<div class="bg-red-50 border border-red-200 rounded-lg p-6">
			<h3 class="text-lg font-semibold text-red-800 mb-2 flex items-center">
				❌ Error
			</h3>
			<p class="text-red-700">{error}</p>
		</div>
	{/if}
	
	<!-- Instructions -->
	<div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
		<h3 class="text-lg font-semibold text-blue-800 mb-2 flex items-center">
			💡 How to use
		</h3>
		<ul class="text-blue-700 space-y-1 text-sm">
			<li>• Use the camera to scan QR codes in real-time</li>
			<li>• Upload an image file containing a QR code</li>
			<li>• Results will be displayed and can be copied or opened as links</li>
			<li>• Works with URLs, text, contact info, WiFi passwords, and more</li>
		</ul>
	</div>
</div> 