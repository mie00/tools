// Entity ID generation utilities

import type { EntityConfig, EntityIdStrategy } from './types';

export class EntityIdGenerator {
	static generateHash(data: any, fields?: string[]): string {
		try {
			let hashInput = '';
			if (fields && typeof data === 'object' && data !== null) {
				hashInput = fields.map((field) => String(data[field] || '')).join('|');
			} else {
				hashInput = JSON.stringify(data);
			}

			// Simple hash function (djb2)
			let hash = 5381;
			for (let i = 0; i < hashInput.length; i++) {
				hash = (hash << 5) + hash + hashInput.charCodeAt(i);
			}
			return `hash_${Math.abs(hash).toString(36)}`;
		} catch (error) {
			console.warn('Failed to generate hash, falling back to timestamp:', error);
			return `hash_${Date.now()}`;
		}
	}

	static generateUuid(): string {
		// Simple UUID v4 implementation
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	static generateTimestamp(): string {
		return `ts_${Date.now()}`;
	}

	static generate(strategy: EntityIdStrategy, data?: any, config?: EntityConfig): string {
		switch (strategy) {
			case 'hash':
				return this.generateHash(data, config?.hashFields);
			case 'uuid':
				return this.generateUuid();
			case 'timestamp':
				return this.generateTimestamp();
			case 'custom':
				return config?.customGenerator?.() || this.generateUuid();
			default:
				return this.generateUuid();
		}
	}
}

// Utility functions for specific entity types
export const CalculatorHistoryId = {
	generate: () => EntityIdGenerator.generate('uuid')
};

export const UnitConversionHistoryId = {
	generate: () => EntityIdGenerator.generate('uuid')
};

export const PrayerProfileId = {
	generate: (config: any) =>
		EntityIdGenerator.generate('hash', config, {
			strategy: 'hash',
			hashFields: [
				'latitude',
				'longitude',
				'calculationMethod',
				'timezone',
				'madhab',
				'highLatitudeRule'
			]
		})
};

export const AudioFileId = {
	generate: (fileContent: ArrayBuffer) => EntityIdGenerator.generate('hash', fileContent)
};

export const NoteId = {
	generate: () => EntityIdGenerator.generate('uuid')
};

export const ChatSessionId = {
	generate: () => EntityIdGenerator.generate('uuid')
};

export const SavedFunctionId = {
	generate: (functionDef: any) =>
		EntityIdGenerator.generate('hash', functionDef, {
			strategy: 'hash',
			hashFields: ['expression', 'parameters']
		})
};
