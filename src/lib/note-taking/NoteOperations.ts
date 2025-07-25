import type { MediaData } from './MediaHandler';

export interface Note {
	id: number;
	text: string;
	topic: string;
	timestamp: string;
	order: number;
	media?: MediaData;
}

export class NoteOperations {
	static createNote(
		text: string,
		topic: string,
		existingNotes: Note[],
		mediaData?: MediaData
	): Note {
		return {
			id: Date.now(),
			text: text.trim(),
			topic: topic,
			timestamp: new Date().toISOString(),
			order: existingNotes.filter((n) => n.topic === topic).length,
			media: mediaData
		};
	}

	static addNote(notes: Note[], newNote: Note): Note[] {
		return [...notes, newNote];
	}

	static deleteNote(notes: Note[], noteId: number): Note[] {
		return notes.filter((n) => n.id !== noteId);
	}

	static updateNote(notes: Note[], updatedNote: Note): Note[] {
		return notes.map((n) => (n.id === updatedNote.id ? updatedNote : n));
	}

	static moveNoteToTopic(notes: Note[], noteId: number, newTopic: string): Note[] {
		return notes.map((n) => {
			if (n.id === noteId) {
				return {
					...n,
					topic: newTopic,
					order: notes.filter((note) => note.topic === newTopic).length
				};
			}
			return n;
		});
	}

	static reorderNotesInTopic(notes: Note[], draggedNote: Note, dropNote: Note): Note[] {
		if (draggedNote.topic !== dropNote.topic) {
			return notes; // Can't reorder across different topics
		}

		// Get all notes in the same topic
		const topicNotes = notes.filter((n) => n.topic === draggedNote.topic);
		const otherNotes = notes.filter((n) => n.topic !== draggedNote.topic);

		const draggedIndex = topicNotes.findIndex((n) => n.id === draggedNote.id);
		const dropIndex = topicNotes.findIndex((n) => n.id === dropNote.id);

		// Reorder within topic
		topicNotes.splice(draggedIndex, 1);
		topicNotes.splice(dropIndex, 0, draggedNote);

		// Update order values
		topicNotes.forEach((note, index) => {
			note.order = index;
		});

		return [...otherNotes, ...topicNotes];
	}

	static filterNotesByTopic(notes: Note[], selectedTopic: string): Note[] {
		return notes
			.filter((note) => note.topic === selectedTopic)
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
	}

	static deleteNotesInTopic(notes: Note[], topicToDelete: string): Note[] {
		return notes.map((n) => (n.topic === topicToDelete ? { ...n, topic: 'Main' } : n));
	}

	static getNotesWithMedia(notes: Note[]): Note[] {
		return notes.filter((n) => n.media);
	}

	static deleteNotesWithMedia(notes: Note[]): Note[] {
		return notes.filter((n) => !n.media);
	}

	static formatTimestamp(timestamp: string): string {
		return new Date(timestamp).toLocaleString();
	}

	static searchNotes(notes: Note[], searchTerm: string): Note[] {
		if (!searchTerm.trim()) return notes;

		const term = searchTerm.toLowerCase();
		return notes.filter(
			(note) =>
				note.text.toLowerCase().includes(term) ||
				note.topic.toLowerCase().includes(term) ||
				(note.media?.name && note.media.name.toLowerCase().includes(term))
		);
	}

	static getNotesStats(notes: Note[]): {
		total: number;
		withMedia: number;
		topics: number;
		totalSize: number;
	} {
		const withMedia = notes.filter((n) => n.media).length;
		const topics = new Set(notes.map((n) => n.topic)).size;
		const totalSize = notes.reduce((sum, note) => {
			return sum + (note.media?.size || 0);
		}, 0);

		return {
			total: notes.length,
			withMedia,
			topics,
			totalSize
		};
	}
}
