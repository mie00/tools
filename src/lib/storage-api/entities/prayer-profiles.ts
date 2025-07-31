// Prayer profiles storage API

import { BaseEntityStorage } from '../storage-client';
import { PrayerProfileId } from '../entity-id';

export interface PrayerProfile {
	name: string;
	latitude: number;
	longitude: number;
	calculationMethod: string;
	timezone: string;
	madhab: string;
	highLatitudeRule: string;
	adjustments: {
		fajr: number;
		sunrise: number;
		dhuhr: number;
		asr: number;
		maghrib: number;
		isha: number;
	};
	isActive: boolean;
	profileType: 'calculated' | 'mawaqit';
	mawaqitConfig?: {
		name: string;
		timezone: string;
		latitude: number;
		longitude: number;
		times: any[];
		calendar: any[];
		shuruq?: string;
		jumua?: string;
		hijriDateEnabled?: boolean;
		iqamaEnabled?: boolean;
		countryCode?: string;
		association?: string;
		site?: string;
	};
}

export class PrayerProfileStorage extends BaseEntityStorage<PrayerProfile> {
	constructor(adapter: any) {
		super({
			adapter,
			keyPrefix: 'prayer_profiles',
			generateId: () => PrayerProfileId.generate({})
		});
	}

	async setActiveProfile(id: string): Promise<void> {
		const profiles = await this.list();

		for (const profile of profiles) {
			const updatedProfile = { ...profile, isActive: profile.id === id };
			await this.set(profile.id, updatedProfile);
		}
	}

	async getActiveProfile(): Promise<(PrayerProfile & { id: string }) | null> {
		const profiles = await this.list((profile) => profile.isActive);
		return profiles[0] || null;
	}

	async findSimilarProfile(
		config: Partial<PrayerProfile>
	): Promise<(PrayerProfile & { id: string }) | null> {
		if (!config.latitude || !config.longitude) return null;

		const profiles = await this.list((profile) => {
			const locationMatch =
				Math.abs(profile.latitude - config.latitude!) < 0.001 &&
				Math.abs(profile.longitude - config.longitude!) < 0.001;

			const methodMatch = profile.calculationMethod === config.calculationMethod;
			const timezoneMatch = profile.timezone === config.timezone;

			if (config.profileType === 'mawaqit' && profile.profileType === 'mawaqit') {
				const mawaqitNameMatch = profile.mawaqitConfig?.name === config.mawaqitConfig?.name;
				return locationMatch && timezoneMatch && mawaqitNameMatch;
			}

			if (config.profileType === 'calculated' && profile.profileType === 'calculated') {
				const madhabMatch = profile.madhab === config.madhab;
				const highLatMatch = profile.highLatitudeRule === config.highLatitudeRule;
				return locationMatch && methodMatch && timezoneMatch && madhabMatch && highLatMatch;
			}

			return false;
		});

		return profiles[0] || null;
	}
}
