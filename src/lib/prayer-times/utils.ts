import { Coordinates, PrayerTimes as AdhanPrayerTimes, Madhab, HighLatitudeRule } from 'adhan';
import type { Profile, PrayerTimes, NextPrayer, City, SearchResult, MawaqitConfig } from './types';
import { calculationMethods, countryMethodMapping } from './constants';

export function normalizeToAscii(str: string): string {
	return (
		str
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '') // Remove accents
			// Convert common non-ASCII characters to ASCII equivalents
			.replace(/[àáâãäåā]/g, 'a')
			.replace(/[èéêëē]/g, 'e')
			.replace(/[ìíîïī]/g, 'i')
			.replace(/[òóôõöøō]/g, 'o')
			.replace(/[ùúûüū]/g, 'u')
			.replace(/[ñ]/g, 'n')
			.replace(/[ç]/g, 'c')
			.replace(/[ß]/g, 'ss')
			.replace(/[æ]/g, 'ae')
			.replace(/[œ]/g, 'oe')
			.replace(/[ÿ]/g, 'y')
			.replace(/[ł]/g, 'l')
			.replace(/[đ]/g, 'd')
			.replace(/[ř]/g, 'r')
			.replace(/[š]/g, 's')
			.replace(/[ž]/g, 'z')
			.replace(/[č]/g, 'c')
			.replace(/[ť]/g, 't')
			.replace(/[ň]/g, 'n')
			.replace(/[ý]/g, 'y')
			.replace(/[ů]/g, 'u')
			.replace(/[ě]/g, 'e')
			.replace(/[^a-z0-9\s]/g, '') // Remove remaining special characters
			.replace(/\s+/g, ' ')
			.trim()
	);
}

export function calculateSearchScore(
	searchTerm: string,
	cityName: string,
	countryCode: string
): number {
	const normalizedSearch = normalizeToAscii(searchTerm);
	const normalizedCity = normalizeToAscii(cityName);
	const normalizedCountry = normalizeToAscii(countryCode);
	const combinedText = `${normalizedCity} ${normalizedCountry}`;

	let score = 0;

	// Perfect match (highest score)
	if (normalizedCity === normalizedSearch || normalizedCountry === normalizedSearch) {
		score += 1000;
	}

	// Exact substring match in city name
	else if (normalizedCity.includes(normalizedSearch)) {
		// Prefix match gets higher score
		if (normalizedCity.startsWith(normalizedSearch)) {
			score += 800;
		} else {
			score += 600;
		}
	}

	// Exact substring match in country
	else if (normalizedCountry.includes(normalizedSearch)) {
		if (normalizedCountry.startsWith(normalizedSearch)) {
			score += 400;
		} else {
			score += 300;
		}
	}

	// Substring match in combined text
	else if (combinedText.includes(normalizedSearch)) {
		score += 200;
	}

	// Word boundary matches (space-separated words)
	else {
		const searchWords = normalizedSearch.split(' ').filter((w) => w.length > 0);
		const cityWords = normalizedCity.split(' ').filter((w) => w.length > 0);
		const countryWords = normalizedCountry.split(' ').filter((w) => w.length > 0);

		let wordMatches = 0;
		let partialMatches = 0;

		for (const searchWord of searchWords) {
			// Check for word matches in city
			for (const cityWord of cityWords) {
				if (cityWord === searchWord) {
					wordMatches += 20;
				} else if (cityWord.startsWith(searchWord) || searchWord.startsWith(cityWord)) {
					partialMatches += 10;
				}
			}

			// Check for word matches in country
			for (const countryWord of countryWords) {
				if (countryWord === searchWord) {
					wordMatches += 15;
				} else if (countryWord.startsWith(searchWord) || searchWord.startsWith(countryWord)) {
					partialMatches += 8;
				}
			}
		}

		score += wordMatches + partialMatches;
	}

	// Bonus for shorter city names (more specific)
	if (score > 0) {
		score += Math.max(0, 20 - normalizedCity.length);
	}

	return score;
}

export function searchCities(query: string, cities: City[]): City[] {
	if (!query.trim()) {
		return [];
	}

	const trimmedQuery = query.trim();

	// Check if query contains country code filter (format: "CC,search_term")
	let countryCodeFilter: string | null = null;
	let searchTerm: string = trimmedQuery;

	if (trimmedQuery.includes(',')) {
		const parts = trimmedQuery.split(',', 2);
		const possibleCountryCode = parts[0].trim().toUpperCase();
		const possibleSearchTerm = parts[1].trim();

		// Check if first part looks like a country code (2-3 letters)
		if (
			possibleCountryCode.length >= 2 &&
			possibleCountryCode.length <= 3 &&
			/^[A-Z]+$/.test(possibleCountryCode) &&
			possibleSearchTerm.length > 0
		) {
			countryCodeFilter = possibleCountryCode;
			searchTerm = possibleSearchTerm;
		}
	}

	// Filter cities by country code if specified
	let filteredCities = cities;
	if (countryCodeFilter) {
		filteredCities = cities.filter(
			(city) => normalizeToAscii(city.country).toUpperCase() === countryCodeFilter
		);
	}

	const results: SearchResult[] = filteredCities
		.map((city) => ({
			city,
			score: calculateSearchScore(searchTerm, city.name, city.country)
		}))
		.filter((result) => result.score > 0)
		.sort((a, b) => b.score - a.score) // Sort by score descending
		.slice(0, 10); // Limit to 10 results

	return results.map((result) => result.city);
}

export function parseCsv(csvText: string): City[] {
	const lines = csvText.trim().split('\n');
	const cities: City[] = [];

	// Skip header line
	for (let i = 1; i < lines.length; i++) {
		const [country, name, lat, lng] = lines[i].split(',');
		if (country && name && lat && lng) {
			cities.push({
				country: country.trim(),
				name: name.trim(),
				lat: parseFloat(lat.trim()),
				lng: parseFloat(lng.trim())
			});
		}
	}

	return cities;
}

export function calculateTimesFromMawaqitConfig(
	config: MawaqitConfig,
	adjustments: Profile['adjustments']
): PrayerTimes {
	const now = new Date();
	const currentMonth = now.getMonth(); // 0-indexed (0 = January)
	const currentDay = now.getDate();

	// Get today's prayer times from the calendar
	const monthData = config.calendar[currentMonth];
	const todayData = monthData?.[currentDay.toString()];

	if (!todayData || todayData.length < 6) {
		// Fallback to default times if calendar data is not available
		return {
			fajr: config.times[0] || '05:00',
			sunrise: config.shuruq || '06:30',
			dhuhr: config.times[1] || '12:00',
			asr: config.times[2] || '15:30',
			maghrib: config.times[3] || '18:00',
			isha: config.times[4] || '19:30',
			date: now.toDateString()
		};
	}

	// Parse times from calendar: [fajr, shuruq, dhuhr, asr, maghrib, isha]
	let [fajr, sunrise, dhuhr, asr, maghrib, isha] = todayData;

	// Apply adjustments
	fajr = applyTimeAdjustment(fajr, adjustments.fajr);
	sunrise = applyTimeAdjustment(sunrise, adjustments.sunrise);
	dhuhr = applyTimeAdjustment(dhuhr, adjustments.dhuhr);
	asr = applyTimeAdjustment(asr, adjustments.asr);
	maghrib = applyTimeAdjustment(maghrib, adjustments.maghrib);
	isha = applyTimeAdjustment(isha, adjustments.isha);

	return {
		fajr,
		sunrise,
		dhuhr,
		asr,
		maghrib,
		isha,
		date: now.toDateString()
	};
}

function applyTimeAdjustment(timeString: string, adjustmentMinutes: number): string {
	if (adjustmentMinutes === 0) return timeString;

	const [hours, minutes] = timeString.split(':').map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);

	const adjustedDate = addMinutes(date, adjustmentMinutes);
	return formatTimeForDisplay(adjustedDate);
}

export function parseMawaqitConfig(jsonData: any): MawaqitConfig | null {
	try {
		// Validate required fields
		if (!jsonData.latitude || !jsonData.longitude || !jsonData.timezone || !jsonData.calendar) {
			return null;
		}

		return {
			name: jsonData.name || jsonData.label || 'Imported Mosque',
			timezone: jsonData.timezone,
			latitude: parseFloat(jsonData.latitude),
			longitude: parseFloat(jsonData.longitude),
			times: jsonData.times || [],
			shuruq: jsonData.shuruq,
			jumua: jsonData.jumua,
			calendar: jsonData.calendar,
			hijriDateEnabled: jsonData.hijriDateEnabled,
			iqamaEnabled: jsonData.iqamaEnabled,
			countryCode: jsonData.countryCode,
			association: jsonData.association,
			site: jsonData.site
		};
	} catch (error) {
		console.error('Error parsing mawaqit config:', error);
		return null;
	}
}

export function calculateTimesForProfile(profile: Profile): PrayerTimes {
	// Handle mawaqit-based profiles
	if (profile.profileType === 'mawaqit' && profile.mawaqitConfig) {
		return calculateTimesFromMawaqitConfig(profile.mawaqitConfig, profile.adjustments);
	}

	// Handle calculated profiles (existing logic)
	const now = new Date();
	const method = calculationMethods[profile.calculationMethod];

	// Set up coordinates
	const coordinates = new Coordinates(profile.latitude, profile.longitude);

	// Get calculation parameters
	const params = method.method();

	// Set madhab
	if (profile.madhab === 'hanafi') {
		params.madhab = Madhab.Hanafi;
	} else {
		params.madhab = Madhab.Shafi;
	}

	// Set high latitude rule
	switch (profile.highLatitudeRule) {
		case 'seventh_of_night':
			params.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;
			break;
		case 'twilight_angle':
			params.highLatitudeRule = HighLatitudeRule.TwilightAngle;
			break;
		default:
			params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;
	}

	// Calculate prayer times
	const prayerTimes = new AdhanPrayerTimes(coordinates, now, params);

	// Apply adjustments (in minutes)
	const adjustedTimes = {
		fajr: addMinutes(prayerTimes.fajr, profile.adjustments.fajr),
		sunrise: addMinutes(prayerTimes.sunrise, profile.adjustments.sunrise),
		dhuhr: addMinutes(prayerTimes.dhuhr, profile.adjustments.dhuhr),
		asr: addMinutes(prayerTimes.asr, profile.adjustments.asr),
		maghrib: addMinutes(prayerTimes.maghrib, profile.adjustments.maghrib),
		isha: addMinutes(prayerTimes.isha, profile.adjustments.isha)
	};

	return {
		fajr: formatTimeForDisplay(adjustedTimes.fajr),
		sunrise: formatTimeForDisplay(adjustedTimes.sunrise),
		dhuhr: formatTimeForDisplay(adjustedTimes.dhuhr),
		asr: formatTimeForDisplay(adjustedTimes.asr),
		maghrib: formatTimeForDisplay(adjustedTimes.maghrib),
		isha: formatTimeForDisplay(adjustedTimes.isha),
		date: now.toLocaleDateString()
	};
}

export function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60000);
}

export function formatTimeForDisplay(date: Date): string {
	return date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}

export function formatTime(time: string): string {
	try {
		const [hours, minutes] = time.split(':');
		const date = new Date();
		date.setHours(parseInt(hours), parseInt(minutes));
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});
	} catch {
		return time;
	}
}

export function getNextPrayerForProfile(
	profile: Profile,
	prayerTimes: PrayerTimes
): NextPrayer | null {
	if (!prayerTimes) return null;

	// Get current time in the profile's timezone
	const now = new Date();
	const prayers = [
		{ name: 'Fajr', time: prayerTimes.fajr },
		{ name: 'Dhuhr', time: prayerTimes.dhuhr },
		{ name: 'Asr', time: prayerTimes.asr },
		{ name: 'Maghrib', time: prayerTimes.maghrib },
		{ name: 'Isha', time: prayerTimes.isha }
	];

	const currentMinutes = now.getHours() * 60 + now.getMinutes();

	for (const prayer of prayers) {
		const [hours, minutes] = prayer.time.split(':');
		const prayerMinutes = parseInt(hours) * 60 + parseInt(minutes);

		if (prayerMinutes > currentMinutes) {
			const timeRemaining = calculateTimeRemaining(currentMinutes, prayerMinutes);
			return {
				name: prayer.name,
				time: prayer.time,
				timeRemaining
			};
		}
	}

	// If no prayer found today, return tomorrow's Fajr
	const tomorrowMinutes = 24 * 60; // Minutes in a day
	const fajrMinutes =
		parseInt(prayerTimes.fajr.split(':')[0]) * 60 + parseInt(prayerTimes.fajr.split(':')[1]);
	const timeRemaining = calculateTimeRemaining(currentMinutes, tomorrowMinutes + fajrMinutes);

	return {
		name: 'Fajr',
		time: prayerTimes.fajr,
		timeRemaining
	};
}

export function calculateTimeRemaining(currentMinutes: number, prayerMinutes: number): string {
	const diffMinutes = prayerMinutes - currentMinutes;
	const hours = Math.floor(diffMinutes / 60);
	const minutes = diffMinutes % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else {
		return `${minutes}m`;
	}
}

export function getSuggestedCalculationMethod(countryCode: string): string {
	return countryMethodMapping[countryCode] || 'MWL';
}

export async function enrichLocationData(
	latitude: number,
	longitude: number
): Promise<{ country?: string; timezone?: string }> {
	try {
		// Get timezone
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Try to get country and suggest calculation method
		const response = await fetch(
			`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
		);

		if (response.ok) {
			const data = await response.json();
			const country = data.countryName || data.countryCode;
			return { country, timezone };
		}

		return { timezone };
	} catch (error) {
		console.error('Error enriching location data:', error);
		return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
	}
}
