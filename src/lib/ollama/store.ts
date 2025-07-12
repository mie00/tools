import { writable } from 'svelte/store';
import type { ChatTopic, ChatConfig } from './types';

export const persistentTopics = writable<ChatTopic[]>([]);
export const persistentConfig = writable<ChatConfig>({
	ollama: {
		endpoint: 'http://localhost:11434',
		temperature: 0.8,
		topK: 40
	},
	local: {
		modelPath: 'onnx-community/Qwen3-0.6B-ONNX',
		maxTokens: 1000,
		topK: 40,
		temperature: 0.8,
		randomSeed: 101
	},
	webGpuSupported: false,
	shaderF16Supported: false,
	defaultModelSource: 'local' // Set local as default
});
export const activeTopicId = writable<string | null>(null);

// LLM runtime state for sharing across components
export const llmState = writable<{
	isModelLoaded: boolean;
	worker: Worker | null;
	hasInitializationError: boolean;
}>({
	isModelLoaded: false,
	worker: null,
	hasInitializationError: false
});

// Persistent LLM state (excluding worker which can't be serialized)
export const persistentLlmState = writable<{
	isModelLoaded: boolean;
	hasInitializationError: boolean;
}>({
	isModelLoaded: false,
	hasInitializationError: false
});
