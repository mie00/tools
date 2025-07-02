<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let selectedColor = '#3b82f6';
	let hexInput = '#3b82f6';
	let rgbR = 59;
	let rgbG = 130;
	let rgbB = 246;
	let hslH = 217;
	let hslS = 91;
	let hslL = 60;

	// Predefined color palette
	const colorPalette = [
		'#f43f5e',
		'#ec4899',
		'#a855f7',
		'#8b5cf6',
		'#6366f1',
		'#3b82f6',
		'#0ea5e9',
		'#06b6d4',
		'#10b981',
		'#84cc16',
		'#eab308',
		'#f59e0b',
		'#ef4444',
		'#6b7280',
		'#374151',
		'#000000'
	];

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);
			
			if (hexInput !== '#3b82f6') {
				params.set('hex', hexInput);
			} else {
				params.delete('hex');
			}
			
			goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
		}
	}

	function loadFromUrl() {
		const hex = $page.url.searchParams.get('hex');
		
		if (hex && /^#[0-9A-F]{6}$/i.test(hex)) {
			hexInput = hex;
			updateFromHex();
		}
	}

	onMount(() => {
		loadFromUrl();
	});

	// Watch for state changes and update URL
	$: if (typeof window !== 'undefined' && hexInput) {
		updateUrl();
	}

	function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result
			? {
					r: parseInt(result[1], 16),
					g: parseInt(result[2], 16),
					b: parseInt(result[3], 16)
				}
			: null;
	}

	function rgbToHex(r: number, g: number, b: number): string {
		return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
	}

	function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
		r /= 255;
		g /= 255;
		b /= 255;

		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		let h = 0,
			s = 0,
			l = (max + min) / 2;

		if (max !== min) {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

			switch (max) {
				case r:
					h = (g - b) / d + (g < b ? 6 : 0);
					break;
				case g:
					h = (b - r) / d + 2;
					break;
				case b:
					h = (r - g) / d + 4;
					break;
			}
			h /= 6;
		}

		return {
			h: Math.round(h * 360),
			s: Math.round(s * 100),
			l: Math.round(l * 100)
		};
	}

	function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
		h /= 360;
		s /= 100;
		l /= 100;

		const hue2rgb = (p: number, q: number, t: number) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;

		return {
			r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
			g: Math.round(hue2rgb(p, q, h) * 255),
			b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
		};
	}

	function updateFromHex() {
		const rgb = hexToRgb(hexInput);
		if (rgb) {
			selectedColor = hexInput;
			rgbR = rgb.r;
			rgbG = rgb.g;
			rgbB = rgb.b;
			const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
			hslH = hsl.h;
			hslS = hsl.s;
			hslL = hsl.l;
		}
	}

	function updateFromRgb() {
		selectedColor = rgbToHex(rgbR, rgbG, rgbB);
		hexInput = selectedColor;
		const hsl = rgbToHsl(rgbR, rgbG, rgbB);
		hslH = hsl.h;
		hslS = hsl.s;
		hslL = hsl.l;
	}

	function updateFromHsl() {
		const rgb = hslToRgb(hslH, hslS, hslL);
		rgbR = rgb.r;
		rgbG = rgb.g;
		rgbB = rgb.b;
		selectedColor = rgbToHex(rgb.r, rgb.g, rgb.b);
		hexInput = selectedColor;
	}

	function selectPaletteColor(color: string) {
		hexInput = color;
		updateFromHex();
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	// Generate color variants
	$: lighterColor = `hsl(${hslH}, ${hslS}%, ${Math.min(100, hslL + 20)}%)`;
	$: darkerColor = `hsl(${hslH}, ${hslS}%, ${Math.max(0, hslL - 20)}%)`;
	$: complementaryColor = `hsl(${(hslH + 180) % 360}, ${hslS}%, ${hslL}%)`;
</script>

<div class="space-y-6">
	<div class="text-center">
		<h2 class="mb-2 text-2xl font-bold text-gray-800">Color Picker</h2>
		<p class="text-gray-600">Pick colors and convert between different formats</p>
	</div>

	<!-- Main Color Display -->
	<div class="text-center">
		<div
			class="mx-auto h-32 w-32 rounded-full border-4 border-gray-300 shadow-lg"
			style="background-color: {selectedColor};"
		></div>
		<p class="mt-2 font-mono text-lg">{selectedColor}</p>
	</div>

	<!-- Color Input Methods -->
	<div class="grid gap-4 md:grid-cols-3">
		<!-- HEX Input -->
		<div class="space-y-2">
			<label for="hex-input" class="block text-sm font-medium text-gray-700">HEX</label>
			<div class="flex gap-2">
				<input
					id="hex-input"
					type="text"
					bind:value={hexInput}
					on:input={updateFromHex}
					class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
					placeholder="#000000"
				/>
				<button
					on:click={() => copyToClipboard(hexInput)}
					class="rounded-lg bg-blue-500 px-3 py-2 text-white transition-colors hover:bg-blue-600"
				>
					📋
				</button>
			</div>
		</div>

		<!-- RGB Input -->
		<div class="space-y-2">
			<label for="rgb-r" class="block text-sm font-medium text-gray-700">RGB</label>
			<div class="space-y-1">
				<input
					id="rgb-r"
					type="range"
					min="0"
					max="255"
					bind:value={rgbR}
					on:input={updateFromRgb}
					class="w-full accent-red-500"
				/>
				<input
					type="range"
					min="0"
					max="255"
					bind:value={rgbG}
					on:input={updateFromRgb}
					class="w-full accent-green-500"
				/>
				<input
					type="range"
					min="0"
					max="255"
					bind:value={rgbB}
					on:input={updateFromRgb}
					class="w-full accent-blue-500"
				/>
			</div>
			<div class="flex gap-1 text-sm">
				<input
					type="number"
					min="0"
					max="255"
					bind:value={rgbR}
					on:input={updateFromRgb}
					class="w-16 rounded border px-2 py-1"
				/>
				<input
					type="number"
					min="0"
					max="255"
					bind:value={rgbG}
					on:input={updateFromRgb}
					class="w-16 rounded border px-2 py-1"
				/>
				<input
					type="number"
					min="0"
					max="255"
					bind:value={rgbB}
					on:input={updateFromRgb}
					class="w-16 rounded border px-2 py-1"
				/>
				<button
					on:click={() => copyToClipboard(`rgb(${rgbR}, ${rgbG}, ${rgbB})`)}
					class="rounded bg-blue-500 px-2 py-1 text-white transition-colors hover:bg-blue-600"
				>
					📋
				</button>
			</div>
		</div>

		<!-- HSL Input -->
		<div class="space-y-2">
			<label for="hsl-h" class="block text-sm font-medium text-gray-700">HSL</label>
			<div class="space-y-1">
				<input
					id="hsl-h"
					type="range"
					min="0"
					max="360"
					bind:value={hslH}
					on:input={updateFromHsl}
					class="w-full"
				/>
				<input
					type="range"
					min="0"
					max="100"
					bind:value={hslS}
					on:input={updateFromHsl}
					class="w-full"
				/>
				<input
					type="range"
					min="0"
					max="100"
					bind:value={hslL}
					on:input={updateFromHsl}
					class="w-full"
				/>
			</div>
			<div class="flex gap-1 text-sm">
				<input
					type="number"
					min="0"
					max="360"
					bind:value={hslH}
					on:input={updateFromHsl}
					class="w-16 rounded border px-2 py-1"
				/>
				<input
					type="number"
					min="0"
					max="100"
					bind:value={hslS}
					on:input={updateFromHsl}
					class="w-16 rounded border px-2 py-1"
				/>
				<input
					type="number"
					min="0"
					max="100"
					bind:value={hslL}
					on:input={updateFromHsl}
					class="w-16 rounded border px-2 py-1"
				/>
				<button
					on:click={() => copyToClipboard(`hsl(${hslH}, ${hslS}%, ${hslL}%)`)}
					class="rounded bg-blue-500 px-2 py-1 text-white transition-colors hover:bg-blue-600"
				>
					📋
				</button>
			</div>
		</div>
	</div>

	<!-- Color Palette -->
	<div class="space-y-2">
		<span class="block text-sm font-medium text-gray-700">Quick Colors</span>
		<div class="grid grid-cols-8 gap-2">
			{#each colorPalette as color}
				<button
					aria-label="Select color {color}"
					on:click={() => selectPaletteColor(color)}
					class="h-10 w-full rounded-lg border-2 transition-transform hover:scale-110 {selectedColor ===
					color
						? 'border-gray-800'
						: 'border-gray-300'}"
					style="background-color: {color};"
				></button>
			{/each}
		</div>
	</div>

	<!-- Color Variants -->
	<div class="space-y-2">
		<span class="block text-sm font-medium text-gray-700">Color Variants</span>
		<div class="grid grid-cols-3 gap-4">
			<div class="text-center">
				<div
					class="mx-auto h-16 w-16 rounded-lg border border-gray-300"
					style="background-color: {lighterColor};"
				></div>
				<p class="mt-1 text-sm">Lighter</p>
			</div>
			<div class="text-center">
				<div
					class="mx-auto h-16 w-16 rounded-lg border border-gray-300"
					style="background-color: {selectedColor};"
				></div>
				<p class="mt-1 text-sm">Original</p>
			</div>
			<div class="text-center">
				<div
					class="mx-auto h-16 w-16 rounded-lg border border-gray-300"
					style="background-color: {darkerColor};"
				></div>
				<p class="mt-1 text-sm">Darker</p>
			</div>
		</div>
		<div class="mt-4 text-center">
			<div
				class="mx-auto h-16 w-16 rounded-lg border border-gray-300"
				style="background-color: {complementaryColor};"
			></div>
			<p class="mt-1 text-sm">Complementary</p>
		</div>
	</div>
</div>
