// Audio files storage API

import { BaseEntityStorage } from '../storage-client';
import { AudioFileId } from '../entity-id';
import type { StorageAdapter } from '../types';
import { OPFSAdapter } from '../adapters/opfs';

export interface AudioFileMetadata {
	name: string;
	duration: number;
	size: number;
	type: string;
	folderId: string;
	uploadedAt: string;
	tags?: string[];
}

export interface AudioFileData extends AudioFileMetadata {
	file: File | null;
	url: string;
}

export class AudioFileStorage extends BaseEntityStorage<AudioFileMetadata> {
	private opfsAdapter: OPFSAdapter | null = null;

	constructor(adapter: StorageAdapter) {
		super({
			adapter,
			keyPrefix: 'audio_files',
			generateId: () => AudioFileId.generate(new ArrayBuffer(0))
		});

		if (adapter instanceof OPFSAdapter) {
			this.opfsAdapter = adapter;
		}
	}

	async addAudioFile(file: File, folderId: string = 'root', tags?: string[]): Promise<string> {
		const id = AudioFileId.generate(await file.arrayBuffer());

		const metadata: AudioFileMetadata = {
			name: file.name,
			duration: 0, // Will be set after loading
			size: file.size,
			type: file.type,
			folderId,
			uploadedAt: new Date().toISOString(),
			tags
		};

		await this.getAdapter().set(`${this.getKeyPrefix()}:${id}`, metadata);

		if (this.opfsAdapter) {
			await this.opfsAdapter.setBinaryFile(`audio_files_data/${id}`, file);
		}

		return id;
	}

	async getAudioFileData(id: string): Promise<AudioFileData | null> {
		const metadata = await this.get(id);
		if (!metadata) return null;

		let file: File | null = null;
		let url = '';

		if (this.opfsAdapter) {
			file = await this.opfsAdapter.getBinaryFile(`audio_files_data/${id}`);
			if (file) {
				url = URL.createObjectURL(file);
			}
		}

		return {
			...metadata,
			file,
			url
		};
	}

	async createBlobURL(id: string): Promise<string | null> {
		if (this.opfsAdapter) {
			return this.opfsAdapter.createBlobURL(`audio_files_data/${id}`);
		}
		return null;
	}

	async deleteAudioFile(id: string): Promise<void> {
		await this.delete(id);

		if (this.opfsAdapter) {
			await this.opfsAdapter.delete(`audio_files_data/${id}`);
		}
	}

	async getByFolder(folderId: string): Promise<(AudioFileMetadata & { id: string })[]> {
		return this.list((file) => file.folderId === folderId);
	}

	async searchByName(query: string): Promise<(AudioFileMetadata & { id: string })[]> {
		return this.list((file) => file.name.toLowerCase().includes(query.toLowerCase()));
	}

	async searchByTags(tags: string[]): Promise<(AudioFileMetadata & { id: string })[]> {
		return this.list((file) => file.tags?.some((tag) => tags.includes(tag)) || false);
	}

	async updateDuration(id: string, duration: number): Promise<void> {
		await this.update(id, { duration });
	}

	async moveToFolder(id: string, newFolderId: string): Promise<void> {
		await this.update(id, { folderId: newFolderId });
	}

	async getTotalSize(): Promise<number> {
		const files = await this.list();
		return files.reduce((total, file) => total + file.size, 0);
	}
}
