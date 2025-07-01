export interface Profile {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	timezone: string;
	calculationMethod: string;
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
	// Mawaqit-specific fields
	profileType?: 'calculated' | 'mawaqit';
	mawaqitConfig?: MawaqitConfig;
}

export interface MawaqitConfig {
	name: string;
	timezone: string;
	latitude: number;
	longitude: number;
	times: string[]; // [fajr, dhuhr, asr, maghrib, isha]
	shuruq?: string;
	jumua?: string;
	calendar: Array<{
		[day: string]: string[]; // day of month -> [fajr, shuruq, dhuhr, asr, maghrib, isha]
	}>;
	// Optional additional properties from mawaqit
	hijriDateEnabled?: boolean;
	iqamaEnabled?: boolean;
	countryCode?: string;
	association?: string;
	site?: string;
}

export interface PrayerTimes {
	fajr: string;
	sunrise: string;
	dhuhr: string;
	asr: string;
	maghrib: string;
	isha: string;
	date: string;
}

export interface City {
	country: string;
	name: string;
	lat: number;
	lng: number;
}

export interface CalculationMethodInfo {
	name: string;
	method: () => any;
	region: string[];
}

export interface SearchResult {
	city: City;
	score: number;
}

export interface NextPrayer {
	name: string;
	time: string;
	timeRemaining?: string;
}
