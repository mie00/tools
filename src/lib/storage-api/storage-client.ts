// Base storage client implementation

import type {
	EntityStorage,
	EntityStorageOptions,
	StorageFilter,
	StorageListOptions,
	EntityWithId
} from './types';
import { EntityIdGenerator } from './entity-id';

export class BaseEntityStorage<T> implements EntityStorage<T> {
	private adapter: EntityStorageOptions['adapter'];
	private keyPrefix: string;
	private generateId: () => string;

	constructor(options: EntityStorageOptions) {
		this.adapter = options.adapter;
		this.keyPrefix = options.keyPrefix;
		this.generateId = options.generateId || (() => EntityIdGenerator.generateUuid());
	}

	protected getAdapter(): EntityStorageOptions['adapter'] {
		return this.adapter;
	}

	protected getKeyPrefix(): string {
		return this.keyPrefix;
	}

	private getKey(id: string): string {
		return `${this.keyPrefix}:${id}`;
	}

	private getMetadataKey(): string {
		return `${this.keyPrefix}:metadata`;
	}

	async get(id: string): Promise<T | null> {
		try {
			return await this.adapter.get<T>(this.getKey(id));
		} catch (error) {
			console.warn(`Failed to get entity ${id}:`, error);
			return null;
		}
	}

	async set(id: string, data: T): Promise<void> {
		try {
			await this.adapter.set(this.getKey(id), data);
		} catch (error) {
			console.warn(`Failed to set entity ${id}:`, error);
			throw error;
		}
	}

	async delete(id: string): Promise<void> {
		try {
			await this.adapter.delete(this.getKey(id));
		} catch (error) {
			console.warn(`Failed to delete entity ${id}:`, error);
		}
	}

	async list(filter?: StorageFilter<T>): Promise<(T & { id: string })[]> {
		try {
			const keys = await this.adapter.list(this.keyPrefix + ':');
			const items: (T & { id: string })[] = [];

			for (const key of keys) {
				const id = key.replace(this.keyPrefix + ':', '');
				const data = await this.adapter.get<T>(key);
				if (data) {
					const item = { ...data, id } as T & { id: string };
					if (!filter || filter(item)) {
						items.push(item);
					}
				}
			}

			return items;
		} catch (error) {
			console.warn('Failed to list entities:', error);
			return [];
		}
	}

	async exists(id: string): Promise<boolean> {
		try {
			return await this.adapter.exists(this.getKey(id));
		} catch (error) {
			console.warn(`Failed to check if entity ${id} exists:`, error);
			return false;
		}
	}

	async clear(): Promise<void> {
		try {
			await this.adapter.clear(this.keyPrefix + ':');
		} catch (error) {
			console.warn('Failed to clear entities:', error);
		}
	}

	async create(data: T): Promise<string> {
		const id = this.generateId();
		await this.set(id, data);
		return id;
	}

	async update(id: string, data: Partial<T>): Promise<void> {
		const existing = await this.get(id);
		if (!existing) {
			throw new Error(`Entity with id ${id} not found`);
		}
		const updated = { ...existing, ...data } as T;
		await this.set(id, updated);
	}

	async count(): Promise<number> {
		const items = await this.list();
		return items.length;
	}

	async paginate(options: StorageListOptions = {}): Promise<{
		items: (T & { id: string })[];
		total: number;
		offset: number;
		limit: number;
	}> {
		const allItems = await this.list();
		const total = allItems.length;
		const offset = options.offset || 0;
		const limit = options.limit || total;

		let items = allItems;

		// Apply sorting if specified
		if (options.sortBy) {
			items = items.sort((a, b) => {
				const aVal = (a as any)[options.sortBy!];
				const bVal = (b as any)[options.sortBy!];
				const compareResult = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
				return options.sortOrder === 'desc' ? -compareResult : compareResult;
			});
		}

		// Apply pagination
		items = items.slice(offset, offset + limit);

		return { items, total, offset, limit };
	}
}
