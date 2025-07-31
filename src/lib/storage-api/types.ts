// Core storage API types and interfaces

export interface StorageAdapter {
	get<T>(key: string): Promise<T | null>;
	set<T>(key: string, value: T): Promise<void>;
	delete(key: string): Promise<void>;
	list(prefix?: string): Promise<string[]>;
	clear(prefix?: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	getSize(): Promise<number>;
	getAvailableSpace?(): Promise<number>;
	isSupported?(): Promise<boolean>;
}

export interface EntityStorageOptions {
	adapter: StorageAdapter;
	keyPrefix: string;
	generateId?: () => string;
}

export interface EntityStorage<T> {
	get(id: string): Promise<T | null>;
	set(id: string, data: T): Promise<void>;
	delete(id: string): Promise<void>;
	list(filter?: (item: T & { id: string }) => boolean): Promise<(T & { id: string })[]>;
	exists(id: string): Promise<boolean>;
	clear(): Promise<void>;
	create(data: T): Promise<string>;
	update(id: string, data: Partial<T>): Promise<void>;
}

export interface StorageFilter<T> {
	(item: T & { id: string }): boolean;
}

export interface StorageListOptions {
	limit?: number;
	offset?: number;
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
}

export interface EntityWithId<T> extends Record<string, any> {
	id: string;
	data: T;
	createdAt: string;
	updatedAt: string;
}

export interface StorageMetadata {
	version: string;
	createdAt: string;
	updatedAt: string;
	entityCount: number;
}

export type EntityIdStrategy = 'hash' | 'uuid' | 'timestamp' | 'custom';

export interface EntityConfig {
	strategy: EntityIdStrategy;
	hashFields?: string[];
	customGenerator?: () => string;
}
