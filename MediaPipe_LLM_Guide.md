# Local LLM Chat with MediaPipe

This guide explains how to use the Local LLM Chat feature that runs AI models directly in your browser using MediaPipe and WebGPU.

## What is this? 🤖

The Local LLM Chat feature brings AI conversations directly to your browser without any external servers or APIs. It uses:

- **MediaPipe**: Google's framework for on-device AI
- **WebGPU**: Browser acceleration for AI computations
- **Gemma 3n 1B**: Google's newest nano language model
- **Your Browser**: Everything runs locally and privately

## Features ✨

- **🔒 Complete Privacy**: No data leaves your device
- **⚡ Fast Inference**: WebGPU acceleration
- **📱 No Setup**: Works directly in browser
- **💾 Auto-Caching**: Model downloads once and stays cached
- **🌐 Offline Ready**: Works without internet after initial load

## Requirements 📋

### Browser Support

- **Chrome/Edge 113+**: Best support, enable WebGPU in flags
- **Safari 16.4+**: Good WebGPU support
- **Firefox**: Limited WebGPU support (experimental)

### System Requirements

- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: ~500MB for model caching
- **Internet**: Only for initial model download

## How to Use 🚀

1. **Start the app**: Run `npm run dev` and open your tools
2. **Click LLM Chat**: Select the 🤖 LLM Chat tool
3. **Check WebGPU**: Ensure you see "WebGPU Supported"
4. **Wait for Loading**: First load takes 2-5 minutes
5. **Start Chatting**: Type messages and get AI responses!

## Enabling WebGPU 🔧

### Chrome/Edge

1. Open `chrome://flags/#enable-unsafe-webgpu`
2. Set to "Enabled"
3. Restart browser

### Safari

WebGPU is enabled by default in recent versions.

### Firefox

1. Open `about:config`
2. Set `dom.webgpu.enabled` to `true`
3. Restart browser (experimental support)

## Technical Details 🔬

### Model Information

- **Model**: Gemma 3n 1B Instruct
- **Quantization**: INT4 (optimized for efficiency)
- **Size**: ~500MB download
- **Context**: 1000 tokens max
- **Format**: MediaPipe .task format

### Performance Expectations

- **First Load**: 1-3 minutes (model download)
- **Subsequent Loads**: ~5 seconds (cached)
- **Response Time**: 1-2 seconds per response
- **Quality**: Optimized for efficiency, good for conversation and basic tasks

### Privacy & Security

- ✅ All processing happens in your browser
- ✅ No data sent to external servers
- ✅ Model cached locally in browser storage
- ✅ Conversations not stored permanently
- ✅ Works offline after initial setup

## Troubleshooting 🛠️

### "WebGPU Not Supported"

1. **Update Browser**: Use latest Chrome/Safari
2. **Enable Flags**: Follow WebGPU enabling steps above
3. **Check Hardware**: Ensure discrete GPU (if available)
4. **Restart Browser**: After changing flags

### Model Loading Fails

1. **Check Internet**: Stable connection needed for download
2. **Clear Cache**: Browser settings > Clear site data
3. **Try Incognito**: Test in private browsing mode
4. **Check Storage**: Ensure 2GB+ available space

### Slow Performance

1. **Close Other Tabs**: Free up system memory
2. **Check Background Apps**: Close unnecessary programs
3. **Monitor RAM**: Ensure 4GB+ available
4. **Restart Browser**: If experiencing memory leaks

### Chat Not Working

1. **Wait for "Model Loaded"**: Green indicator must show
2. **Check Console**: Open browser dev tools for errors
3. **Refresh Page**: Try reloading the application
4. **Clear Cache**: Reset browser storage if needed

## Limitations ⚠️

- **Context Size**: Limited to 1000 tokens
- **Model Size**: Only 1B parameters (nano model, smaller than ChatGPT)
- **Internet Required**: For initial model download
- **Browser Only**: Doesn't work in all browsers
- **Memory Usage**: Moderate RAM usage (~2-4GB)

## Advantages vs Alternatives 🎯

### vs ChatGPT/Cloud APIs

- ✅ Complete privacy
- ✅ No API costs
- ✅ Works offline
- ❌ Smaller model size
- ❌ Less general knowledge

### vs Ollama

- ✅ No installation required
- ✅ Works in browser
- ✅ Automatic setup
- ❌ Smaller model selection
- ❌ Less configuration options

### vs Python/Local Setup

- ✅ No coding required
- ✅ No environment setup
- ✅ Easy to use
- ❌ Less customization
- ❌ Browser-dependent

## Advanced Usage 🎓

### Model Configuration

The model uses these settings:

```javascript
{
  maxTokens: 1000,     // Maximum response length
  topK: 40,            // Sampling diversity
  temperature: 0.8,    // Response creativity
  randomSeed: 101      // Reproducibility
}
```

### Browser Storage

- Model cached in IndexedDB
- ~1GB storage used
- Persists between sessions
- Can be cleared via browser settings

### Performance Tips

- Close unused tabs before use
- Ensure stable internet for download
- Use latest browser version
- Monitor system memory usage

## Use Cases 💡

### Perfect For:

- **Learning**: Ask questions about topics
- **Coding Help**: Debug code, explain concepts
- **Writing**: Grammar, style, brainstorming
- **Privacy**: Sensitive conversations
- **Offline**: Areas with poor internet

### Less Ideal For:

- **Latest News**: Model has knowledge cutoff
- **Large Documents**: Context size limitations
- **Complex Reasoning**: Smaller model limitations
- **Multiple Languages**: Primarily English-trained

## Future Improvements 🔮

Potential enhancements:

- Support for larger models (4B, 7B)
- Multi-modal capabilities (images + text)
- Custom model fine-tuning
- Better browser compatibility
- Streaming responses
- Context length extensions

## Getting Help 📞

### Community Resources

- **MediaPipe Docs**: [ai.google.dev/edge/mediapipe](https://ai.google.dev/edge/mediapipe)
- **WebGPU Status**: [webgpustatus.org](https://webgpustatus.org)
- **Browser Support**: Check caniuse.com for WebGPU

### Common Issues

Check browser console (F12) for detailed error messages.

---

**Enjoy your private, local AI assistant! 🎉**

_This implementation uses Google's MediaPipe framework and Gemma models to bring AI directly to your browser - no servers, no tracking, just you and your AI._
