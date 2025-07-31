// Notes storage API

import { BaseEntityStorage } from '../storage-client';
import { NoteId } from '../entity-id';

export interface Note {
	title: string;
	content: string;
	topic: string;
	createdAt: string;
	updatedAt: string;
	tags?: string[];
	mediaIds?: string[];
	archived: boolean;
	pinned: boolean;
}

export class NoteStorage extends BaseEntityStorage<Note> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'notes',
			generateId: NoteId.generate
		});
	}

	async createNote(title: string, content: string, topic: string = 'general'): Promise<string> {
		const note: Note = {
			title,
			content,
			topic,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			archived: false,
			pinned: false
		};

		return this.create(note);
	}

	async getByTopic(topic: string): Promise<(Note & { id: string })[]> {
		return this.list((note) => note.topic === topic && !note.archived);
	}

	async getArchived(): Promise<(Note & { id: string })[]> {
		return this.list((note) => note.archived);
	}

	async getPinned(): Promise<(Note & { id: string })[]> {
		return this.list((note) => note.pinned && !note.archived);
	}

	async searchNotes(query: string): Promise<(Note & { id: string })[]> {
		const lowerQuery = query.toLowerCase();
		return this.list(
			(note) =>
				!note.archived &&
				(note.title.toLowerCase().includes(lowerQuery) ||
					note.content.toLowerCase().includes(lowerQuery) ||
					note.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
					false)
		);
	}

	async archiveNote(id: string): Promise<void> {
		await this.update(id, {
			archived: true,
			updatedAt: new Date().toISOString()
		});
	}

	async unarchiveNote(id: string): Promise<void> {
		await this.update(id, {
			archived: false,
			updatedAt: new Date().toISOString()
		});
	}

	async pinNote(id: string): Promise<void> {
		await this.update(id, { pinned: true });
	}

	async unpinNote(id: string): Promise<void> {
		await this.update(id, { pinned: false });
	}

	async addMediaToNote(noteId: string, mediaId: string): Promise<void> {
		const note = await this.get(noteId);
		if (!note) throw new Error('Note not found');

		const mediaIds = note.mediaIds || [];
		if (!mediaIds.includes(mediaId)) {
			await this.update(noteId, {
				mediaIds: [...mediaIds, mediaId],
				updatedAt: new Date().toISOString()
			});
		}
	}

	async removeMediaFromNote(noteId: string, mediaId: string): Promise<void> {
		const note = await this.get(noteId);
		if (!note) throw new Error('Note not found');

		const mediaIds = note.mediaIds || [];
		await this.update(noteId, {
			mediaIds: mediaIds.filter((id) => id !== mediaId),
			updatedAt: new Date().toISOString()
		});
	}
}
