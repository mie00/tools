// Chat sessions storage API

import { BaseEntityStorage } from '../storage-client';
import { ChatSessionId } from '../entity-id';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: string;
	model?: string;
	metadata?: Record<string, any>;
}

export interface ChatSession {
	title: string;
	messages: ChatMessage[];
	model: string;
	settings: {
		temperature?: number;
		maxTokens?: number;
		systemPrompt?: string;
		[key: string]: any;
	};
	createdAt: string;
	updatedAt: string;
	lastMessageAt: string;
	messageCount: number;
	archived: boolean;
	pinned: boolean;
	tags?: string[];
}

export class ChatSessionStorage extends BaseEntityStorage<ChatSession> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'chat_sessions',
			generateId: ChatSessionId.generate
		});
	}

	async createSession(
		title: string,
		model: string,
		settings: ChatSession['settings'] = {}
	): Promise<string> {
		const session: ChatSession = {
			title,
			messages: [],
			model,
			settings,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			lastMessageAt: new Date().toISOString(),
			messageCount: 0,
			archived: false,
			pinned: false
		};

		return this.create(session);
	}

	async addMessage(
		sessionId: string,
		message: Omit<ChatMessage, 'id' | 'timestamp'>
	): Promise<void> {
		const session = await this.get(sessionId);
		if (!session) throw new Error('Session not found');

		const newMessage: ChatMessage = {
			...message,
			id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date().toISOString()
		};

		const updatedMessages = [...session.messages, newMessage];
		await this.update(sessionId, {
			messages: updatedMessages,
			updatedAt: new Date().toISOString(),
			lastMessageAt: new Date().toISOString(),
			messageCount: updatedMessages.length
		});
	}

	async updateMessage(sessionId: string, messageId: string, content: string): Promise<void> {
		const session = await this.get(sessionId);
		if (!session) throw new Error('Session not found');

		const messageIndex = session.messages.findIndex((m) => m.id === messageId);
		if (messageIndex === -1) throw new Error('Message not found');

		session.messages[messageIndex].content = content;
		await this.update(sessionId, {
			messages: session.messages,
			updatedAt: new Date().toISOString()
		});
	}

	async deleteMessage(sessionId: string, messageId: string): Promise<void> {
		const session = await this.get(sessionId);
		if (!session) throw new Error('Session not found');

		const updatedMessages = session.messages.filter((m) => m.id !== messageId);
		await this.update(sessionId, {
			messages: updatedMessages,
			messageCount: updatedMessages.length,
			updatedAt: new Date().toISOString()
		});
	}

	async getRecentSessions(limit: number = 20): Promise<(ChatSession & { id: string })[]> {
		const sessions = await this.list((session) => !session.archived);
		return sessions
			.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
			.slice(0, limit);
	}

	async getPinnedSessions(): Promise<(ChatSession & { id: string })[]> {
		return this.list((session) => session.pinned && !session.archived);
	}

	async getArchivedSessions(): Promise<(ChatSession & { id: string })[]> {
		return this.list((session) => session.archived);
	}

	async searchSessions(query: string): Promise<(ChatSession & { id: string })[]> {
		const lowerQuery = query.toLowerCase();
		return this.list(
			(session) =>
				!session.archived &&
				(session.title.toLowerCase().includes(lowerQuery) ||
					session.messages.some((msg) => msg.content.toLowerCase().includes(lowerQuery)) ||
					session.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
					false)
		);
	}

	async archiveSession(id: string): Promise<void> {
		await this.update(id, {
			archived: true,
			updatedAt: new Date().toISOString()
		});
	}

	async unarchiveSession(id: string): Promise<void> {
		await this.update(id, {
			archived: false,
			updatedAt: new Date().toISOString()
		});
	}

	async pinSession(id: string): Promise<void> {
		await this.update(id, { pinned: true });
	}

	async unpinSession(id: string): Promise<void> {
		await this.update(id, { pinned: false });
	}

	async clearMessages(sessionId: string): Promise<void> {
		await this.update(sessionId, {
			messages: [],
			messageCount: 0,
			updatedAt: new Date().toISOString()
		});
	}
}
