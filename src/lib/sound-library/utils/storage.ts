import type { AudioFile } from '../stores/globalPlaylist';

interface Folder {
	id: string;
	name: string;
	parentId: string | null;
	children: string[];
}

interface StorageMetadata {
	files: AudioFile[];
	folders: Folder[];
}

/**
 * Shared storage utilities for the sound library
 */
export class SoundLibraryStorage {
	/**
	 * Load metadata only (no file data) from storage
	 */
	static async loadMetadata(): Promise<{ files: AudioFile[]; folders: Folder[] }> {
		try {
			// Check if OPFS is supported
			if (!navigator.storage?.getDirectory) {
				return this.loadFromLocalStorage();
			}

			const opfsRoot = await navigator.storage.getDirectory();

			try {
				const soundLibraryDir = await opfsRoot.getDirectoryHandle('soundLibrary');

				// Load metadata
				const metadataHandle = await soundLibraryDir.getFileHandle('metadata.json');
				const metadataFile = await metadataHandle.getFile();
				const metadataText = await metadataFile.text();
				const metadata: StorageMetadata = JSON.parse(metadataText);

				const folders = metadata.folders || [
					{ id: 'root', name: 'Library', parentId: null, children: [] }
				];

				// Return files with metadata only (no File objects or URLs)
				const files: AudioFile[] = (metadata.files || []).map((fileMetadata) => ({
					...fileMetadata,
					file: null,
					url: ''
				}));

				return { files, folders };
			} catch (_dirError) {
				return this.loadFromLocalStorage();
			}
		} catch (error) {
			console.error('Failed to load from OPFS:', error);
			// Fallback to localStorage
			return this.loadFromLocalStorage();
		}
	}

	/**
	 * Load from localStorage only (fallback)
	 */
	static loadFromLocalStorage(): { files: AudioFile[]; folders: Folder[] } {
		try {
			const savedFiles = localStorage.getItem('soundLibrary_files');
			const savedFolders = localStorage.getItem('soundLibrary_folders');

			const folders = savedFolders
				? JSON.parse(savedFolders)
				: [{ id: 'root', name: 'Library', parentId: null, children: [] }];

			if (savedFiles) {
				const fileMetadata = JSON.parse(savedFiles);
				// Can't restore actual File objects from localStorage, only metadata
				const files = fileMetadata.map((f: any) => ({
					...f,
					file: null,
					url: ''
				}));
				return { files, folders };
			}
		} catch (error) {
			console.error('Failed to load from localStorage:', error);
		}

		return {
			files: [],
			folders: [{ id: 'root', name: 'Library', parentId: null, children: [] }]
		};
	}

	/**
	 * Save files to storage (OPFS with localStorage fallback)
	 */
	static async saveFiles(
		files: AudioFile[],
		folders: Folder[],
		filesToSave?: AudioFile[]
	): Promise<void> {
		try {
			// Check if OPFS is supported
			if (!navigator.storage?.getDirectory) {
				this.saveToLocalStorageOnly(files, folders);
				return;
			}

			const opfsRoot = await navigator.storage.getDirectory();

			// Create soundLibrary directory if it doesn't exist
			const soundLibraryDir = await opfsRoot.getDirectoryHandle('soundLibrary', { create: true });

			// Save files with actual File objects
			const targetFiles = filesToSave || files;
			for (const file of targetFiles) {
				if (file.file) {
					try {
						const fileHandle = await soundLibraryDir.getFileHandle(`${file.id}.audio`, {
							create: true
						});
						const writable = await fileHandle.createWritable();
						await writable.write(file.file);
						await writable.close();
					} catch (error) {
						console.error(`Failed to save file ${file.id}:`, error);
					}
				}
			}

			// Save metadata to OPFS as well
			const metadataHandle = await soundLibraryDir.getFileHandle('metadata.json', { create: true });
			const metadataWritable = await metadataHandle.createWritable();
			const metadata = {
				files: files.map((f) => ({
					...f,
					file: null, // Don't duplicate file in metadata
					url: null // URLs will be recreated
				})),
				folders
			};
			await metadataWritable.write(JSON.stringify(metadata));
			await metadataWritable.close();

			// Also save to localStorage as fallback
			this.saveToLocalStorageOnly(files, folders);
		} catch (error) {
			console.error('Failed to save to OPFS:', error);
			// Fallback to localStorage
			this.saveToLocalStorageOnly(files, folders);
		}
	}

	/**
	 * Save to localStorage only
	 */
	static saveToLocalStorageOnly(files: AudioFile[], folders: Folder[]): void {
		try {
			localStorage.setItem(
				'soundLibrary_files',
				JSON.stringify(
					files.map((f) => ({
						...f,
						file: null, // Don't store File objects
						url: null // Don't store URLs
					}))
				)
			);
			localStorage.setItem('soundLibrary_folders', JSON.stringify(folders));
		} catch (error) {
			console.error('Failed to save to localStorage:', error);
		}
	}

	/**
	 * Load specific files by IDs with actual file data
	 */
	static async loadSpecificFiles(fileIds: string[]): Promise<AudioFile[]> {
		if (fileIds.length === 0) return [];

		try {
			// First get metadata for all files
			const { files: allFiles } = await this.loadMetadata();
			const targetFiles = allFiles.filter((f) => fileIds.includes(f.id));

			// Check if OPFS is supported
			if (!navigator.storage?.getDirectory) {
				// Can't load file data from localStorage, return metadata only
				return targetFiles;
			}

			const opfsRoot = await navigator.storage.getDirectory();
			const soundLibraryDir = await opfsRoot.getDirectoryHandle('soundLibrary');

			// Load actual file data for requested files
			const loadedFiles: AudioFile[] = [];

			for (const fileMetadata of targetFiles) {
				try {
					const fileHandle = await soundLibraryDir.getFileHandle(`${fileMetadata.id}.audio`);
					const file = await fileHandle.getFile();

					const audioFile: AudioFile = {
						...fileMetadata,
						file,
						url: URL.createObjectURL(file)
					};

					// Re-extract duration from the restored audio file with error handling
					const audio = new Audio();
					audio.addEventListener('loadedmetadata', () => {
						audioFile.metadata.duration = audio.duration;
					});

					// Add error handling for blob URL issues
					let restoreRetryCount = 0;
					audio.addEventListener('error', (e) => {
						if (restoreRetryCount < 1) {
							restoreRetryCount++;
							// Recreate blob URL if it failed
							try {
								URL.revokeObjectURL(audioFile.url);
								audioFile.url = URL.createObjectURL(file);
								audio.src = audioFile.url;
								audio.load();
							} catch (recreateError) {
								console.error(
									`Failed to recreate blob URL for ${fileMetadata.name}:`,
									recreateError
								);
							}
						}
					});

					// Set the source after setting up error handlers
					audio.src = audioFile.url;

					loadedFiles.push(audioFile);
				} catch (fileError) {
					console.warn(`Failed to load file ${fileMetadata.id}:`, fileError);
					// Keep the metadata even if file is missing
					loadedFiles.push({
						...fileMetadata,
						file: null,
						url: ''
					});
				}
			}

			const successfullyLoaded = loadedFiles.filter((f) => f.file && f.url).length;
			console.log(`📂  Loaded ${successfullyLoaded}/${fileIds.length} requested files with data`);

			return loadedFiles;
		} catch (error) {
			console.error('Failed to load specific files from OPFS:', error);
			// Fallback to metadata only
			const { files: allFiles } = await this.loadMetadata();
			return allFiles.filter((f) => fileIds.includes(f.id));
		}
	}

	/**
	 * Load files only (without folders) - returns metadata only for lazy loading
	 */
	static async loadFilesOnly(): Promise<AudioFile[]> {
		const { files } = await this.loadMetadata();
		return files;
	}

	/**
	 * Unload specific files by revoking their blob URLs and clearing file data
	 */
	static unloadFiles(files: AudioFile[], fileIdsToUnload: string[]): void {
		let unloadedCount = 0;

		for (const file of files) {
			if (fileIdsToUnload.includes(file.id) && file.url) {
				try {
					URL.revokeObjectURL(file.url);
					file.url = '';
					file.file = null;
					unloadedCount++;
				} catch (error) {
					console.error(`Failed to unload file ${file.id}:`, error);
				}
			}
		}

		console.log(`🗑️  Unloaded ${unloadedCount} files from memory`);
	}

	/**
	 * Load files from storage (OPFS or localStorage fallback) - DEPRECATED, use loadMetadata instead
	 */
	static async loadFiles(): Promise<{ files: AudioFile[]; folders: Folder[] }> {
		return this.loadMetadata();
	}
}
