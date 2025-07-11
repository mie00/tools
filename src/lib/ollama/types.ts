// Types
export interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: string;
	error?: boolean;
	isLoading?: boolean;
	isThinking?: boolean;
}

export interface ChatTopic {
	id: string;
	name: string;
	messages: Message[];
	systemPrompt: string;
	model: string;
	modelSource: 'local' | 'remote'; // New: specify if using local or remote model
	createdAt: string;
	lastUpdated?: string; // New: track when topic was last updated
	isDraft?: boolean; // New: track if topic is a draft (not yet saved)
}

export interface OllamaConfig {
	endpoint: string;
	temperature: number;
	topK: number;
}

export interface LocalModelConfig {
	modelPath: string;
	maxTokens: number;
	topK: number;
	temperature: number;
	randomSeed: number;
}

export interface ModelLoadingProgress {
	status: string;
	file: string;
	progress: number;
}

export interface FileProgress {
	name: string;
	progress: number;
	loaded: number;
	total: number;
}

export interface ChatConfig {
	// Remote model settings
	ollama: OllamaConfig;
	// Local model settings
	local: LocalModelConfig;
	// WebGPU support flags
	webGpuSupported: boolean;
	shaderF16Supported: boolean;
	// Default model source
	defaultModelSource: 'local' | 'remote';
} 