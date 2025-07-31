// Audio playlists storage API

import { BaseEntityStorage } from '../storage-client';
import { EntityIdGenerator } from '../entity-id';

export interface AudioPlaylist {
	name: string;
	description?: string;
	fileIds: string[];
	createdAt: string;
	updatedAt: string;
	isGlobal: boolean;
	shuffled: boolean;
	currentIndex: number;
}

export class AudioPlaylistStorage extends BaseEntityStorage<AudioPlaylist> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'audio_playlists',
			generateId: () => EntityIdGenerator.generateUuid()
		});
	}

	async createPlaylist(
		name: string,
		description?: string,
		isGlobal: boolean = false
	): Promise<string> {
		const playlist: AudioPlaylist = {
			name,
			description,
			fileIds: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			isGlobal,
			shuffled: false,
			currentIndex: 0
		};

		return this.create(playlist);
	}

	async addToPlaylist(playlistId: string, fileIds: string[]): Promise<void> {
		const playlist = await this.get(playlistId);
		if (!playlist) throw new Error('Playlist not found');

		const uniqueFileIds = [...new Set([...playlist.fileIds, ...fileIds])];
		await this.update(playlistId, {
			fileIds: uniqueFileIds,
			updatedAt: new Date().toISOString()
		});
	}

	async removeFromPlaylist(playlistId: string, fileIds: string[]): Promise<void> {
		const playlist = await this.get(playlistId);
		if (!playlist) throw new Error('Playlist not found');

		const updatedFileIds = playlist.fileIds.filter((id) => !fileIds.includes(id));
		await this.update(playlistId, {
			fileIds: updatedFileIds,
			updatedAt: new Date().toISOString()
		});
	}

	async reorderPlaylist(playlistId: string, newOrder: string[]): Promise<void> {
		await this.update(playlistId, {
			fileIds: newOrder,
			updatedAt: new Date().toISOString()
		});
	}

	async setCurrentIndex(playlistId: string, index: number): Promise<void> {
		await this.update(playlistId, { currentIndex: index });
	}

	async toggleShuffle(playlistId: string): Promise<void> {
		const playlist = await this.get(playlistId);
		if (!playlist) throw new Error('Playlist not found');

		await this.update(playlistId, { shuffled: !playlist.shuffled });
	}

	async getGlobalPlaylist(): Promise<(AudioPlaylist & { id: string }) | null> {
		const playlists = await this.list((playlist) => playlist.isGlobal);
		return playlists[0] || null;
	}
}
