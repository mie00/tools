import { writable } from 'svelte/store';
import type { ChatTopic, OllamaConfig } from './types';

export const persistentTopics = writable<ChatTopic[]>([]);
export const persistentConfig = writable<OllamaConfig>({
	endpoint: 'http://localhost:11434',
	temperature: 0.8,
	topK: 40
});
export const activeTopicId = writable<string | null>(null); 