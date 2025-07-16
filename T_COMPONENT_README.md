# T Component - Translation System

The T component provides automatic translation functionality for your Svelte application using Chrome's built-in AI APIs.

## Features

- **Two usage patterns**: Slot content or key prop
- **Automatic translation**: Uses Chrome's AI translation APIs (similar to Translator.svelte)
- **RTL support**: Automatically handles right-to-left languages like Arabic
- **Fallback behavior**: Returns original text if translation fails
- **Caching**: Translations are cached for performance
- **Persistent language selection**: Language choice is saved in localStorage

## Installation

The T component is already exported from `$lib` and ready to use.

## Usage

### Method 1: Slot Content

```svelte
<script>
	import { T } from '$lib';
</script>

<T>Hello World</T>
<T>This is a longer sentence to translate.</T>
```

### Method 2: Key Prop

```svelte
<T key="Welcome to our application!" />
<T key="Click here to continue" />
```

### Language Selection

Add language selection to your app:

```svelte
<script>
	import { translationStore, supportedLanguages } from '$lib/translation';

	let currentLanguage = 'en';

	async function changeLanguage(langCode) {
		await translationStore.setLanguage(langCode);
		currentLanguage = translationStore.getCurrentLanguage().code;
	}
</script>

{#each supportedLanguages as lang}
	<button onclick={() => changeLanguage(lang.code)}>
		{lang.nativeName}
	</button>
{/each}
```

## Supported Languages

- English (en) - Default
- Arabic (ar) - RTL support
- Chinese (zh)
- French (fr)
- German (de)
- Spanish (es)
- Hindi (hi)
- Italian (it)
- Japanese (ja)
- Korean (ko)
- Dutch (nl)
- Portuguese (pt)
- Russian (ru)
- Turkish (tr)

## RTL Support

RTL support is applied at the page level when an RTL language (like Arabic) is selected. The entire page layout automatically adjusts:

```svelte
<T>مرحبا بالعالم</T> <!-- Page becomes RTL when Arabic is selected -->
```

RTL is handled globally via:

- `document.documentElement.setAttribute('dir', 'rtl')`
- CSS classes applied to the `<html>` element
- No need for individual element styling

## Requirements

- Chrome 138+ on desktop
- Windows 10/11, macOS 13+, or Linux
- At least 22 GB free storage (for AI models)
- GPU with 4+ GB VRAM
- Unmetered internet connection (for initial model download)

## How It Works

1. Translation system initializes in the root layout
2. RTL/LTR is applied globally to the `<html>` element based on current language
3. The T component extracts text from either the key prop or slot content
4. Checks the current language from the translation store
5. If not English, attempts translation using Chrome's AI APIs
6. Falls back to original text if translation fails
7. Caches translations for performance
8. Page-level RTL styling ensures consistent layout direction

## Testing

Visit `/translation-test` to see the component in action with:

- Language selection buttons
- Examples of both usage patterns
- RTL language demonstration
- Fallback behavior testing

## Integration

The T component is already integrated into the main tools page. Language selection is available in the header, and tool names/descriptions are automatically translated when you change languages.

## Performance Notes

- Translations are cached in memory
- Only one translator instance per language pair
- Model download happens once per language pair
- Graceful fallback ensures app remains functional even if AI APIs are unavailable
