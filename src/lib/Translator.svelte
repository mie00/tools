<script lang="ts">
	// Note: This component uses experimental Chrome AI APIs (LanguageDetector and Translator)
	// which are available in Chrome 138+ but don't have TypeScript definitions yet.
	// The linter errors are expected and the functionality works in compatible browsers.

	import { onMount } from 'svelte';
	import T from './T.svelte';

	let inputText = $state('');
	let translatedText = $state('');
	let detectedLanguage = $state('');
	let sourceLanguage = $state('auto');
	let targetLanguage = $state('en');
	let isLoading = $state(false);
	let error = $state('');
	let downloadProgress = $state(0);
	let isDownloading = $state(false);
	let autoTranslateFromUrl = $state(false);

	// Persistent settings
	const STORAGE_KEY = 'translator-settings';

	function saveSettings() {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify({
						sourceLanguage,
						targetLanguage
					})
				);
			} catch (e) {
				console.warn('Failed to save translator settings:', e);
			}
		}
	}

	function loadSettings() {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem(STORAGE_KEY);
				if (saved) {
					const settings = JSON.parse(saved);
					// Validate settings before applying
					if (
						settings.sourceLanguage &&
						sourceLanguages.some((lang) => lang.code === settings.sourceLanguage)
					) {
						sourceLanguage = settings.sourceLanguage;
					}
					if (
						settings.targetLanguage &&
						supportedLanguages.some((lang) => lang.code === settings.targetLanguage)
					) {
						targetLanguage = settings.targetLanguage;
					}
				}
			} catch (e) {
				console.warn('Failed to load translator settings:', e);
			}
		}
	}

	function loadFromUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);

			// URL parameters override saved settings
			const urlSourceLang = params.get('from');
			const urlTargetLang = params.get('to');
			const urlText = params.get('text');

			if (urlSourceLang && sourceLanguages.some((lang) => lang.code === urlSourceLang)) {
				sourceLanguage = urlSourceLang;
			}
			if (urlTargetLang && supportedLanguages.some((lang) => lang.code === urlTargetLang)) {
				targetLanguage = urlTargetLang;
			}
			if (urlText) {
				inputText = decodeURIComponent(urlText);
				// Trigger translation after APIs are ready
				autoTranslateFromUrl = true;
			}
		}
	}

	// API availability states
	let detectorAvailable = $state(false);
	let translatorAvailable = $state(false);
	let speechSynthesisAvailable = $state(false);

	// Speech synthesis state
	let isSpeakingInput = $state(false);
	let isSpeakingOutput = $state(false);
	let voices: SpeechSynthesisVoice[] = [];
	let synth: SpeechSynthesis | null = null;

	// Language detector and translator instances
	let detector: any = null;
	let translator: any = null;

	// Supported languages for translation
	const supportedLanguages = [
		{ code: 'en', name: 'English' },
		{ code: 'es', name: 'Spanish' },
		{ code: 'fr', name: 'French' },
		{ code: 'de', name: 'German' },
		{ code: 'it', name: 'Italian' },
		{ code: 'pt', name: 'Portuguese' },
		{ code: 'ru', name: 'Russian' },
		{ code: 'ja', name: 'Japanese' },
		{ code: 'ko', name: 'Korean' },
		{ code: 'zh', name: 'Chinese' },
		{ code: 'ar', name: 'Arabic' },
		{ code: 'hi', name: 'Hindi' },
		{ code: 'nl', name: 'Dutch' },
		{ code: 'tr', name: 'Turkish' }
	];

	// Source languages with auto detect option
	const sourceLanguages = [{ code: 'auto', name: 'Auto Detect' }, ...supportedLanguages];

	onMount(async () => {
		loadSettings();
		await checkAPIAvailability();
		initializeSpeechSynthesis();
		loadFromUrl(); // Load URL parameters after settings are loaded

		// Auto-translate if text was loaded from URL and APIs are available
		if (autoTranslateFromUrl && inputText.trim() && detectorAvailable && translatorAvailable) {
			// Small delay to ensure all components are fully initialized
			setTimeout(() => {
				translateText();
			}, 200);
		}
	});

	async function checkAPIAvailability() {
		try {
			// Check Language Detector API
			if ('LanguageDetector' in self) {
				const detectorAvailability = await (self as any).LanguageDetector.availability();
				if (detectorAvailability !== 'unavailable') {
					detectorAvailable = true;
					await initializeDetector();
				}
			}

			// Check Translator API - just check if it exists for now
			// We'll check specific language pairs when translating
			if ('Translator' in self) {
				translatorAvailable = true;
			}

			if (!detectorAvailable || !translatorAvailable) {
				error =
					'Language detection and translation APIs are not available in this browser. Please use Chrome 138+ on desktop.';
			}
		} catch (err) {
			error = 'Error checking API availability: ' + String(err);
		}
	}

	async function initializeDetector() {
		try {
			// @ts-ignore - Chrome AI API is experimental
			const availability = await (self as any).LanguageDetector.availability();

			if (availability === 'available') {
				// @ts-ignore - Chrome AI API is experimental
				detector = await (self as any).LanguageDetector.create();
			} else if (availability === 'downloadable' || availability === 'downloading') {
				isDownloading = true;
				// @ts-ignore - Chrome AI API is experimental
				detector = await (self as any).LanguageDetector.create({
					monitor(m: any) {
						m.addEventListener('downloadprogress', (e: any) => {
							downloadProgress = Math.round(e.loaded * 100);
						});
					}
				});
				await detector.ready;
				isDownloading = false;
			}
		} catch (err) {
			error = 'Error initializing language detector: ' + String(err);
		}
	}

	let translationTimeout: ReturnType<typeof setTimeout>;

	async function translateText() {
		if (!inputText.trim()) {
			translatedText = '';
			return;
		}

		error = '';

		try {
			// Determine actual source language
			let actualSourceLanguage = sourceLanguage;

			if (sourceLanguage === 'auto' && detector) {
				const results = await detector.detect(inputText);
				if (results.length > 0 && results[0].detectedLanguage !== 'und') {
					actualSourceLanguage = results[0].detectedLanguage;
					const confidence = Math.round(results[0].confidence * 100);

					// Find language name for display
					const langName =
						supportedLanguages.find((lang) => lang.code === actualSourceLanguage)?.name ||
						actualSourceLanguage;
					detectedLanguage = `${langName} (${confidence}% confidence)`;
				} else {
					actualSourceLanguage = 'en'; // Fallback
				}
			} else if (sourceLanguage !== 'auto') {
				detectedLanguage = '';
			}

			// Skip translation if source and target are the same
			if (actualSourceLanguage === targetLanguage) {
				translatedText = inputText;
				return;
			}

			// Check if translator is available for the language pair
			// @ts-ignore - Chrome AI API is experimental
			const translatorAvailability = await (self as any).Translator.availability({
				sourceLanguage: actualSourceLanguage,
				targetLanguage: targetLanguage
			});

			if (translatorAvailability === 'unavailable') {
				error = `Translation from ${actualSourceLanguage} to ${targetLanguage} is not available.`;
				return;
			}

			// Reset translator if language pair has changed
			if (
				translator &&
				(translator.sourceLanguage !== actualSourceLanguage ||
					translator.targetLanguage !== targetLanguage)
			) {
				translator.destroy();
				translator = null;
			}

			// Initialize translator if needed
			if (!translator) {
				if (translatorAvailability === 'downloadable' || translatorAvailability === 'downloading') {
					isDownloading = true;
					isLoading = true;
					// @ts-ignore - Chrome AI API is experimental
					translator = await (self as any).Translator.create({
						sourceLanguage: actualSourceLanguage,
						targetLanguage: targetLanguage,
						monitor(m: any) {
							m.addEventListener('downloadprogress', (e: any) => {
								downloadProgress = Math.round(e.loaded * 100);
							});
						}
					});
					await translator.ready;
					isLoading = false;
					isDownloading = false;
				} else {
					// @ts-ignore - Chrome AI API is experimental
					translator = await (self as any).Translator.create({
						sourceLanguage: actualSourceLanguage,
						targetLanguage: targetLanguage
					});
				}
			}

			// Split text into paragraphs and translate each separately
			const paragraphs = inputText
				.split(/\n\s*\n/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);

			if (paragraphs.length === 0) {
				translatedText = '';
				return;
			}

			// If there's only one paragraph, translate directly
			if (paragraphs.length === 1) {
				translatedText = await translator.translate(inputText);
			} else {
				// Translate each paragraph separately
				const translatedParagraphs = [];
				for (let i = 0; i < paragraphs.length; i++) {
					const translatedParagraph = await translator.translate(paragraphs[i]);
					translatedParagraphs.push(translatedParagraph);
				}
				// Join paragraphs back together with double line breaks
				translatedText = translatedParagraphs.join('\n\n');
			}
		} catch (err) {
			error = 'Translation error: ' + String(err);
		}
	}

	function handleLanguageChange() {
		// Reset translator when languages change
		if (translator) {
			translator.destroy();
			translator = null;
		}
		// Save settings when they change
		saveSettings();
		// Trigger translation if there's input text
		if (inputText.trim()) {
			debouncedTranslate();
		}
	}

	// Save settings when they change
	$effect(() => {
		if (typeof window !== 'undefined' && sourceLanguage && targetLanguage) {
			saveSettings();
		}
	});

	function debouncedTranslate() {
		clearTimeout(translationTimeout);
		translationTimeout = setTimeout(() => {
			translateText();
		}, 500); // Wait 500ms after user stops typing
	}

	function flipLanguages() {
		if (sourceLanguage === 'auto') return; // Can't flip from auto

		// Swap languages
		const tempLang = sourceLanguage;
		sourceLanguage = targetLanguage;
		targetLanguage = tempLang;

		// Swap text content
		const tempText = inputText;
		inputText = translatedText;
		translatedText = tempText;

		// Clear detected language since we're now manual
		detectedLanguage = '';

		// Retranslate
		handleLanguageChange();
	}

	// Manual translation trigger (removed reactive statement to prevent infinite loops)

	function initializeSpeechSynthesis() {
		if ('speechSynthesis' in window) {
			synth = window.speechSynthesis;
			speechSynthesisAvailable = true;

			// Load voices (may take a moment to populate)
			voices = synth.getVoices();

			// Listen for voices changed event (Chrome compatibility)
			synth.addEventListener('voiceschanged', () => {
				voices = synth?.getVoices() || [];
			});
		}
	}

	function findBestVoice(languageCode: string) {
		if (!voices.length) return null;

		// First try exact match
		let voice = voices.find((v) => v.lang === languageCode);
		if (voice) return voice;

		// Then try language without region (e.g., 'en' for 'en-US')
		const langOnly = languageCode.split('-')[0];
		voice = voices.find((v) => v.lang.startsWith(langOnly));
		if (voice) return voice;

		// Fallback to default voice
		return voices.find((v) => v.default) || voices[0];
	}

	function speakText(text: string, languageCode: string, isInput = true) {
		if (!synth || !text.trim()) return;

		// Stop any current speech
		synth.cancel();

		// Create utterance
		const utterance = new SpeechSynthesisUtterance(text);

		// Find appropriate voice
		const voice = findBestVoice(languageCode);
		if (voice) {
			utterance.voice = voice;
		}

		// Set speech parameters
		utterance.rate = 1.4;
		utterance.pitch = 1;
		utterance.volume = 0.8;

		// Update speaking state
		if (isInput) {
			isSpeakingInput = true;
		} else {
			isSpeakingOutput = true;
		}

		// Handle speech events
		utterance.onstart = () => {
			// Already set above
		};

		utterance.onend = () => {
			if (isInput) {
				isSpeakingInput = false;
			} else {
				isSpeakingOutput = false;
			}
		};

		utterance.onerror = () => {
			if (isInput) {
				isSpeakingInput = false;
			} else {
				isSpeakingOutput = false;
			}
		};

		// Speak the text
		synth.speak(utterance);
	}

	function stopSpeaking() {
		if (synth) {
			synth.cancel();
			isSpeakingInput = false;
			isSpeakingOutput = false;
		}
	}

	function handleSpeakInput() {
		if (!inputText.trim()) return;

		let langCode = sourceLanguage;
		if (sourceLanguage === 'auto') {
			// Try to get detected language code
			const detectedLang = detectedLanguage.toLowerCase();
			const foundLang = supportedLanguages.find((lang) =>
				detectedLang.includes(lang.name.toLowerCase())
			);
			langCode = foundLang ? foundLang.code : 'en';
		}

		speakText(inputText, langCode, true);
	}

	function handleSpeakOutput() {
		if (!translatedText.trim()) return;
		speakText(translatedText, targetLanguage, false);
	}

	// Reactive effect to trigger translation when input changes
	$effect(() => {
		if (inputText.trim()) {
			debouncedTranslate();
		} else {
			translatedText = '';
			detectedLanguage = '';
		}
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<div class="container mx-auto px-4 py-8">
		<header class="mb-8">
			<a href="/" class="mb-4 inline-flex items-center text-blue-600 hover:text-blue-800">
				<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"
					></path>
				</svg>
				Back to Tools
			</a>
			<h1 class="text-3xl font-bold text-gray-800"><T>Language Translator</T></h1>
		</header>

		<div class="rounded-2xl bg-white p-6 shadow-lg">
			<div class="mb-4">
				<p class="text-gray-600">
					Translate text using Chrome's built-in AI - works offline and protects your privacy
				</p>
			</div>

			{#if error}
				<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
					<h3 class="mb-2 font-semibold text-red-800">⚠️ Error</h3>
					<p class="mb-3 text-red-700">{error}</p>
					<details>
						<summary class="cursor-pointer font-medium text-red-600 hover:text-red-800"
							><T>Requirements</T></summary
						>
						<ul class="mt-2 list-inside list-disc text-sm text-red-600">
							<li>Chrome 138+ on desktop</li>
							<li>Windows 10/11, macOS 13+, or Linux</li>
							<li>At least 22 GB free storage</li>
							<li>GPU with 4+ GB VRAM</li>
							<li><T>Unmetered internet connection</T></li>
						</ul>
					</details>
				</div>
			{/if}

			{#if isDownloading}
				<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
					<h3 class="mb-3 font-semibold text-blue-800">📥 Downloading AI Model...</h3>
					<div class="mb-2 h-2 w-full rounded-full bg-blue-200">
						<div
							class="h-2 rounded-full bg-blue-600 transition-all duration-300"
							style="width: {downloadProgress}%"
						></div>
					</div>
					<p class="text-sm text-blue-700">{downloadProgress}% complete</p>
				</div>
			{/if}

			{#if detectorAvailable && translatorAvailable}
				<div class="relative mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
					<!-- Source side -->
					<div class="space-y-3">
						<div>
							<label for="source-language" class="mb-2 block text-sm font-medium text-gray-700"
								><T>From:</T></label
							>
							<select
								id="source-language"
								bind:value={sourceLanguage}
								onchange={handleLanguageChange}
								disabled={isLoading}
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								{#each sourceLanguages as lang (lang.code)}
									<option value={lang.code}>{lang.name}</option>
								{/each}
							</select>
						</div>

						<div class="relative">
							<label for="input-text" class="mb-2 block text-sm font-medium text-gray-700"
								><T>Enter text:</T></label
							>
							<textarea
								id="input-text"
								bind:value={inputText}
								placeholder="Type or paste text here..."
								rows="8"
								disabled={isLoading}
								class="w-full resize-none rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
							></textarea>
							{#if detectedLanguage}
								<div
									class="absolute -top-6 left-0 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800"
								>
									🔍 {detectedLanguage}
								</div>
							{/if}
							{#if speechSynthesisAvailable && inputText.trim()}
								<button
									onclick={isSpeakingInput ? stopSpeaking : handleSpeakInput}
									disabled={isLoading}
									class="absolute top-8 right-2 rounded bg-blue-500 p-1 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
									title={isSpeakingInput ? 'Stop speaking' : 'Speak text'}
									aria-label={isSpeakingInput ? 'Stop speaking' : 'Speak text'}
								>
									{#if isSpeakingInput}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 4h4v16H6zM14 4h4v16h-4z"
											></path>
										</svg>
									{:else}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a2.5 2.5 0 002.5-2.5S13 5 10.5 5 8 6.5 8 7.5V10zm6 0h1.5a2.5 2.5 0 002.5-2.5S16 5 13.5 5 11 6.5 11 7.5V10z"
											></path>
										</svg>
									{/if}
								</button>
							{/if}
						</div>
					</div>

					<!-- Flip button -->
					<div
						class="flex items-center justify-center lg:absolute lg:top-1/2 lg:left-1/2 lg:z-10 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:transform"
					>
						<button
							onclick={flipLanguages}
							disabled={sourceLanguage === 'auto' || isLoading}
							class="transform rounded-full border-2 border-blue-500 bg-white p-2 text-blue-600 shadow-md transition-all duration-200 hover:scale-105 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
							title="Flip languages and text"
							aria-label="Flip languages and text"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
								></path>
							</svg>
						</button>
					</div>

					<!-- Target side -->
					<div class="space-y-3">
						<div>
							<label for="target-language" class="mb-2 block text-sm font-medium text-gray-700"
								><T>To:</T></label
							>
							<select
								id="target-language"
								bind:value={targetLanguage}
								onchange={handleLanguageChange}
								disabled={isLoading}
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								{#each supportedLanguages as lang (lang.code)}
									<option value={lang.code}>{lang.name}</option>
								{/each}
							</select>
						</div>

						<div class="relative">
							<label for="output-text" class="mb-2 block text-sm font-medium text-gray-700"
								><T>Translation:</T></label
							>
							<textarea
								id="output-text"
								bind:value={translatedText}
								placeholder="Translation will appear here automatically..."
								rows="8"
								readonly
								class="w-full resize-none rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
							></textarea>
							{#if speechSynthesisAvailable && translatedText.trim()}
								<button
									onclick={isSpeakingOutput ? stopSpeaking : handleSpeakOutput}
									disabled={isLoading}
									class="absolute top-8 right-2 rounded bg-green-500 p-1 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
									title={isSpeakingOutput ? 'Stop speaking' : 'Speak translation'}
									aria-label={isSpeakingOutput ? 'Stop speaking' : 'Speak translation'}
								>
									{#if isSpeakingOutput}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 4h4v16H6zM14 4h4v16h-4z"
											></path>
										</svg>
									{:else}
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a2.5 2.5 0 002.5-2.5S13 5 10.5 5 8 6.5 8 7.5V10zm6 0h1.5a2.5 2.5 0 002.5-2.5S16 5 13.5 5 11 6.5 11 7.5V10z"
											></path>
										</svg>
									{/if}
								</button>
							{/if}
							{#if isLoading}
								<div
									class="bg-opacity-75 absolute inset-0 flex items-center justify-center rounded-md bg-gray-50"
								>
									<div class="flex items-center gap-2 text-blue-600">
										<svg
											class="h-4 w-4 animate-spin"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											></circle>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
										<span class="text-sm"><T>Translating...</T></span>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<div class="rounded-lg bg-gray-50 p-4">
					<h3 class="mb-2 font-semibold text-gray-800">ℹ️ About This Translator</h3>
					<ul class="space-y-1 text-sm text-gray-600">
						<li>
							<strong><T>Privacy-first:</T></strong> All translation happens locally in your browser
						</li>
						<li>
							<strong><T>Offline capable:</T></strong> Works without internet after initial model download
						</li>
						<li>
							<strong><T>Auto-detection:</T></strong> Automatically detects the source language
						</li>
						<li><strong><T>High accuracy:</T></strong> Powered by Chrome's built-in AI models</li>
						<li>
							<strong><T>Text-to-speech:</T></strong> Click the play buttons to hear text in the appropriate
							language
						</li>
					</ul>
				</div>
			{/if}
		</div>
	</div>
</div>
