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
	createdAt: string;
}

export interface OllamaConfig {
	endpoint: string;
	temperature: number;
	topK: number;
} 