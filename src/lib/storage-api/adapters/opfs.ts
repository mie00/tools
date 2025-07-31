// OPFS (Origin Private File System) storage adapter

import type { StorageAdapter } from '../types';

// Type definitions for OPFS (since they may not be in all TypeScript versions)
declare global {
	interface FileSystemDirectoryHandle {
		entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
	}
}

export class OPFSAdapter implements StorageAdapter {
	private rootHandle: FileSystemDirectoryHandle | null = null;

	private async getRootHandle(): Promise<FileSystemDirectoryHandle> {
		if (!this.rootHandle) {
			this.rootHandle = await navigator.storage.getDirectory();
		}
		return this.rootHandle;
	}

	private async ensureDirectory(path: string): Promise<FileSystemDirectoryHandle> {
		const root = await this.getRootHandle();
		const parts = path.split('/').filter(Boolean);

		let currentDir = root;
		for (const part of parts) {
			currentDir = await currentDir.getDirectoryHandle(part, { create: true });
		}

		return currentDir;
	}

	private parseKey(key: string): { directory: string; filename: string } {
		const lastSlash = key.lastIndexOf('/');
		if (lastSlash === -1) {
			return { directory: '', filename: key };
		}
		return {
			directory: key.substring(0, lastSlash),
			filename: key.substring(lastSlash + 1)
		};
	}

	async get<T>(key: string): Promise<T | null> {
		try {
			const { directory, filename } = this.parseKey(key);
			const dirHandle = await this.ensureDirectory(directory);
			const fileHandle = await dirHandle.getFileHandle(filename);
			const file = await fileHandle.getFile();
			const text = await file.text();
			return JSON.parse(text) as T;
		} catch (error) {
			if ((error as any)?.name === 'NotFoundError') {
				return null;
			}
			throw error;
		}
	}

	async set<T>(key: string, value: T): Promise<void> {
		const { directory, filename } = this.parseKey(key);
		const dirHandle = await this.ensureDirectory(directory);
		const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(JSON.stringify(value));
		await writable.close();
	}

	async setBinaryFile(key: string, file: File): Promise<void> {
		const { directory, filename } = this.parseKey(key);
		const dirHandle = await this.ensureDirectory(directory);
		const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(file);
		await writable.close();
	}

	async getBinaryFile(key: string): Promise<File | null> {
		try {
			const { directory, filename } = this.parseKey(key);
			const dirHandle = await this.ensureDirectory(directory);
			const fileHandle = await dirHandle.getFileHandle(filename);
			return await fileHandle.getFile();
		} catch (error) {
			if ((error as any)?.name === 'NotFoundError') {
				return null;
			}
			throw error;
		}
	}

	async createBlobURL(key: string): Promise<string | null> {
		const file = await this.getBinaryFile(key);
		if (!file) return null;
		return URL.createObjectURL(file);
	}

	async delete(key: string): Promise<void> {
		try {
			const { directory, filename } = this.parseKey(key);
			const dirHandle = await this.ensureDirectory(directory);
			await dirHandle.removeEntry(filename);
		} catch (error) {
			if ((error as any)?.name !== 'NotFoundError') {
				throw error;
			}
		}
	}

	async list(prefix?: string): Promise<string[]> {
		const keys: string[] = [];
		await this.collectKeys(await this.getRootHandle(), '', keys, prefix);
		return keys;
	}

	private async collectKeys(
		dirHandle: FileSystemDirectoryHandle,
		currentPath: string,
		keys: string[],
		prefix?: string
	): Promise<void> {
		for await (const [name, handle] of dirHandle.entries()) {
			const fullPath = currentPath ? `${currentPath}/${name}` : name;

			if (handle.kind === 'file') {
				if (!prefix || fullPath.startsWith(prefix)) {
					keys.push(fullPath);
				}
			} else if (handle.kind === 'directory') {
				if (!prefix || prefix.startsWith(fullPath + '/') || fullPath.startsWith(prefix)) {
					await this.collectKeys(handle as FileSystemDirectoryHandle, fullPath, keys, prefix);
				}
			}
		}
	}

	async clear(prefix?: string): Promise<void> {
		if (!prefix) {
			const root = await this.getRootHandle();
			for await (const [name] of root.entries()) {
				await root.removeEntry(name, { recursive: true });
			}
		} else {
			const keys = await this.list(prefix);
			await Promise.all(keys.map((key) => this.delete(key)));
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			const { directory, filename } = this.parseKey(key);
			const dirHandle = await this.ensureDirectory(directory);
			await dirHandle.getFileHandle(filename);
			return true;
		} catch (error) {
			if ((error as any)?.name === 'NotFoundError') {
				return false;
			}
			throw error;
		}
	}

	async getSize(): Promise<number> {
		let totalSize = 0;
		await this.calculateSize(await this.getRootHandle(), totalSize);
		return totalSize;
	}

	private async calculateSize(
		dirHandle: FileSystemDirectoryHandle,
		currentSize: number
	): Promise<number> {
		let size = currentSize;
		for await (const [, handle] of dirHandle.entries()) {
			if (handle.kind === 'file') {
				const file = await (handle as FileSystemFileHandle).getFile();
				size += file.size;
			} else if (handle.kind === 'directory') {
				size = await this.calculateSize(handle as FileSystemDirectoryHandle, size);
			}
		}
		return size;
	}

	async getAvailableSpace(): Promise<number> {
		try {
			const estimate = await navigator.storage.estimate();
			const used = estimate.usage || 0;
			const quota = estimate.quota || 0;
			return quota - used;
		} catch {
			return 0;
		}
	}

	async isSupported(): Promise<boolean> {
		return (
			typeof window !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage
		);
	}
}
