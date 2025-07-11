import {
	Coordinates,
	PrayerTimes as AdhanPrayerTimes,
	Madhab,
	HighLatitudeRule,
	CalculationMethod
} from 'adhan';
import type { Profile, PrayerTimes, NextPrayer, City, SearchResult, MawaqitConfig } from './types';
import { calculationMethods, countryMethodMapping } from './constants';

/**
 * Gets the UTC offset string (e.g., "+02:00" or "-04:00") for a given IANA timezone and date.
 * This is crucial for creating correct Date objects from time strings in different timezones.
 * @param timeZone The IANA timezone name (e.g., 'America/New_York').
 * @param date The date for which to get the offset (important for DST).
 * @returns The UTC offset string or null if the timezone is invalid.
 */
function getUtcOffset(timeZone: string, date: Date): string | null {
	try {
		// Use Intl.DateTimeFormat to find the offset. 'longOffset' gives "GMT-4", "GMT+5:30", etc.
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			timeZoneName: 'longOffset'
		});
		const parts = formatter.formatToParts(date);
		const gmtPart = parts.find((part) => part.type === 'timeZoneName');

		if (!gmtPart) return null;

		// Convert "GMT-4" or "GMT+5:30" to a standard offset format "-04:00" or "+05:30"
		const offsetString = gmtPart.value.replace('GMT', '');
		const [hoursStr, minutesStr] = offsetString.split(':');
		const hours = parseInt(hoursStr, 10);
		const minutes = parseInt(minutesStr || '0', 10);
		const sign = hours < 0 || Object.is(hours, -0) ? '-' : '+';
		const absHours = Math.abs(hours);

		return `${sign}${String(absHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
	} catch (error) {
		// This will catch invalid timezone identifiers
		console.error(`Failed to get UTC offset for timezone ${timeZone}:`, error);
		return null;
	}
}

export function calculateSearchScore(
	searchTerm: string,
	cityName: string,
	countryCode: string
): number {
	// No normalization, just substring matching
	if (!searchTerm || !cityName) return 0;

	let score = 0;

	const city = cityName;
	const search = searchTerm;

	const idx = city.toLowerCase().indexOf(search.toLowerCase());

	if (idx === -1) {
		// No substring match at all
		return 0;
	}

	// Substring match found
	// Score is based on how many characters are missing (penalty)
	// Missing chars at the end give less penalty than at the start
	const missingAtStart = idx;
	const missingAtEnd = city.length - (idx + search.length);

	// Penalty: chars missing at start count as 2, at end as 1
	const penalty = missingAtStart * 2 + missingAtEnd * 1;

	// Base score for substring match
	score = 1000 - penalty;

	// If perfect match, give max score
	if (city === search) {
		score = 2000;
	}

	// If search is a prefix, give a bonus
	else if (idx === 0) {
		score += 100;
	}

	// If search is a suffix, give a small bonus
	else if (idx + search.length === city.length) {
		score += 50;
	}

	// Never negative
	if (score < 0) score = 0;

	return score;
}

export function searchCities(query: string, cities: City[]): SearchResult[] {
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
			(city) => city.country.toUpperCase() === countryCodeFilter.toUpperCase()
		);
	}

	const results: SearchResult[] = filteredCities
		.map((city) => {
			let bestScore = 0;
			let matchedName = city.name;

			// Score for primary name
			const primaryScore = calculateSearchScore(searchTerm, city.name, city.country);
			if (primaryScore > bestScore) {
				bestScore = primaryScore;
			}

			// Score for alternate names
			if (city.altnames) {
				const allAltNames = Object.values(city.altnames).flat();
				for (const altname of allAltNames) {
					const altScore = calculateSearchScore(searchTerm, altname, city.country);
					if (altScore > bestScore) {
						bestScore = altScore;
						matchedName = altname;
					}
				}
			}

			return {
				city,
				score: bestScore,
				matchedName
			};
		})
		.filter((result) => result.score > 0)
		.sort((a, b) => b.score - a.score) // Sort by score descending
		.slice(0, 10); // Limit to 10 results

	return results;
}

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
				field += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			result.push(field);
			field = '';
		} else {
			field += char;
		}
	}
	result.push(field); // Add the last field
	return result;
}

export function parseCsv(csvText: string): City[] {
	const lines = csvText.trim().split('\n');
	const cities: City[] = [];

	// Skip header line
	for (let i = 1; i < lines.length; i++) {
		if (!lines[i]) continue;
		const fields = parseCsvLine(lines[i]);
		const [country, name, altnames, lat, lng, timezone, altitude, languages] = fields;

		if (country && name && lat && lng) {
			const city: City = {
				country: country.trim(),
				name: name.trim(),
				lat: parseFloat(lat.trim()),
				lng: parseFloat(lng.trim()),
				altitude: parseFloat(altitude.trim()),
				languages: languages.split(',').map((lang) => lang.trim())
			};

			if (timezone) {
				city.timezone = timezone.trim();
			}

			if (altnames) {
				try {
					// Handle both JSON array and simple comma-separated strings for altnames
					if (altnames.startsWith('{') && altnames.endsWith('}')) {
						// Handle single-quoted JSON with possible inner single quotes
						let fixedAltnames = altnames;
						if (altnames.startsWith("{'")) {
							// Replace outer single quotes with double quotes, but preserve inner single quotes
							fixedAltnames = altnames
								.replace(/([\{\[,]\s*)'/g, '$1"')
								.replace(/'(\s*[\}\],:])/g, '"$1');
							// Replace all occurrences of \x followed by two hex digits with a JSON-compatible unicode escape
							fixedAltnames = fixedAltnames.replace(
								/\\x([0-9a-fA-F]{2})/g,
								(_, hex) => '\\u00' + hex.toLowerCase()
							);
						}
						const parsedAltnames = JSON.parse(fixedAltnames);
						city.altnames = parsedAltnames;
					}
				} catch (e) {
					// eslint-disable-next-line no-console
					console.warn(`Could not parse altnames for city ${name}: ${altnames}`);
				}
			}

			cities.push(city);
		}
	}

	return cities;
}

export function calculateTimesFromMawaqitConfig(
	config: MawaqitConfig,
	adjustments: Profile['adjustments']
): PrayerTimes {
	const now = new Date();
	const today = now.toLocaleDateString('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}); // YYYY-MM-DD
	const dayOfMonth = String(now.getDate());

	// Find today's prayer times from the calendar
	const calendarDay = config.calendar.find((day) => day[dayOfMonth]);

	if (!calendarDay) {
		// Fallback to default times if calendar data is not available
		return {
			fajr: config.times[0] || '05:00',
			sunrise: config.shuruq || '06:30',
			dhuhr: config.times[1] || '12:00',
			asr: config.times[2] || '15:00',
			maghrib: config.times[3] || '18:00',
			isha: config.times[4] || '19:30',
			date: today,
			time: formatTimeForDisplay(now, config.timezone)
		};
	}

	const times = calendarDay[dayOfMonth];
	const fajr = applyTimeAdjustment(times[0], adjustments.fajr);
	// Mawaqit sunrise is often in times[1], but can also be in a separate 'shuruq' field
	const sunrise = applyTimeAdjustment(times[1] || config.shuruq || '06:30', adjustments.sunrise);
	const dhuhr = applyTimeAdjustment(times[2], adjustments.dhuhr);
	const asr = applyTimeAdjustment(times[3], adjustments.asr);
	const maghrib = applyTimeAdjustment(times[4], adjustments.maghrib);
	const isha = applyTimeAdjustment(times[5], adjustments.isha);

	return {
		fajr,
		sunrise,
		dhuhr,
		asr,
		maghrib,
		isha,
		date: today,
		time: formatTimeForDisplay(now, config.timezone)
	};
}

function applyTimeAdjustment(timeString: string, adjustmentMinutes: number): string {
	if (adjustmentMinutes === 0) return timeString;

	const [hours, minutes] = timeString.split(':').map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);

	const adjustedDate = addMinutes(date, adjustmentMinutes);
	return formatTimeForDisplay(adjustedDate, date.toLocaleTimeString('en-GB', { hourCycle: 'h23' }));
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
	if (profile.profileType === 'mawaqit' && profile.mawaqitConfig) {
		return calculateTimesFromMawaqitConfig(profile.mawaqitConfig, profile.adjustments);
	}

	// Handle calculated profiles (existing logic)
	const now = new Date();
	const method = calculationMethods[profile.calculationMethod];

	if (!profile.timezone) {
		throw new Error('Profile timezone is missing, cannot calculate times accurately.');
	}

	const timeZone = profile.timezone;

	// Get the current date in the target timezone to prevent off-by-one-day errors.
	const nowInZone = new Date(new Date().toLocaleString('en-US', { timeZone }));

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

	const formattedTimes = {
		fajr: formatTimeForDisplay(
			addMinutes(prayerTimes.fajr, profile.adjustments.fajr),
			profile.timezone
		),
		sunrise: formatTimeForDisplay(
			addMinutes(prayerTimes.sunrise, profile.adjustments.sunrise),
			profile.timezone
		),
		dhuhr: formatTimeForDisplay(
			addMinutes(prayerTimes.dhuhr, profile.adjustments.dhuhr),
			profile.timezone
		),
		asr: formatTimeForDisplay(
			addMinutes(prayerTimes.asr, profile.adjustments.asr),
			profile.timezone
		),
		maghrib: formatTimeForDisplay(
			addMinutes(prayerTimes.maghrib, profile.adjustments.maghrib),
			profile.timezone
		),
		isha: formatTimeForDisplay(
			addMinutes(prayerTimes.isha, profile.adjustments.isha),
			profile.timezone
		),
		date: now.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }),
		time: formatTimeForDisplay(now, profile.timezone)
	};

	return formattedTimes;
}

export function addMinutes(date: Date, minutes: number): Date {
	date.setMinutes(date.getMinutes() + minutes);
	return date;
}

export function formatTimeForDisplay(date: Date, timeZone: string): string {
	// Use 'en-GB' for a reliable HH:mm 24-hour format in the specified timezone.
	return date.toLocaleTimeString('en-GB', {
		timeZone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
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
	if (!profile.timezone) {
		console.warn('Profile is missing timezone. Cannot accurately calculate next prayer.');
		return null; // Cannot proceed without a timezone
	}

	const now = new Date();

	// Get today's date components (year, month, day) in the PROFILE'S timezone.
	// This prevents bugs where the user's local date is ahead or behind the profile's date.
	const dateParts = new Intl.DateTimeFormat('en-CA', {
		timeZone: profile.timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);

	const year = dateParts.find((p) => p.type === 'year')?.value;
	const month = dateParts.find((p) => p.type === 'month')?.value;
	const day = dateParts.find((p) => p.type === 'day')?.value;

	if (!year || !month || !day) {
		console.error('Could not determine the current date in the profile timezone.');
		return null;
	}
	const dateInProfileTimezone = `${year}-${month}-${day}`;

	// Get the UTC offset for the profile's timezone for today's date to handle DST.
	const offset = getUtcOffset(profile.timezone, now);
	if (!offset) {
		console.error(`Could not get UTC offset for timezone: ${profile.timezone}`);
		return null;
	}

	const prayerNameMapping = {
		fajr: 'Fajr',
		sunrise: 'Sunrise',
		dhuhr: 'Dhuhr',
		asr: 'Asr',
		maghrib: 'Maghrib',
		isha: 'Isha'
	};

	const prayerTimesWithDates = Object.entries(prayerTimes)
		.filter(([key]) => prayerNameMapping[key as keyof typeof prayerNameMapping])
		.map(([key, time]) => {
			if (typeof time !== 'string' || !time.includes(':')) return null;

			// Construct a full ISO 8601 string with the correct offset.
			// e.g., "2024-08-01T05:30:00-04:00" for a time in New York (EDT).
			const isoString = `${dateInProfileTimezone}T${time}:00${offset}`;
			const prayerDate = new Date(isoString);

			// Handle cases where parsing might fail for some reason
			if (isNaN(prayerDate.getTime())) {
				return null;
			}

			return {
				name: prayerNameMapping[key as keyof typeof prayerNameMapping],
				time: time,
				date: prayerDate
			};
		})
		.filter(Boolean) as { name: string; time: string; date: Date }[];

	// Find the first prayer that is in the future
	let nextPrayer = prayerTimesWithDates.find((p) => p.date.getTime() > now.getTime());

	// If all prayers for today have passed, the next prayer is Fajr of the next day.
	if (!nextPrayer && prayerTimesWithDates.length > 0) {
		const fajrPrayer = prayerTimesWithDates[0];
		// Create a new date for tomorrow's Fajr
		const tomorrowFajrDate = new Date(fajrPrayer.date.getTime());
		tomorrowFajrDate.setDate(tomorrowFajrDate.getDate() + 1);
		nextPrayer = { ...fajrPrayer, date: tomorrowFajrDate };
	}

	if (!nextPrayer) {
		return null;
	}

	const diff = nextPrayer.date.getTime() - now.getTime();
	const hours = Math.floor(diff / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	return {
		name: nextPrayer.name,
		time: nextPrayer.time,
		timeRemaining: `${hours}h ${minutes}m`
	};
}

export function calculateTimeRemaining(currentMinutes: number, prayerMinutes: number): string {
	let diff = prayerMinutes - currentMinutes;
	if (diff < 0) {
		// This case should ideally be handled by the next day's prayer logic
		// but as a fallback, we calculate time until tomorrow.
		diff += 24 * 60;
	}
	const hours = Math.floor(diff / 60);
	const minutes = diff % 60;
	return `${hours}h ${minutes}m`;
}

export function getSuggestedCalculationMethod(countryCode: string): string {
	return countryMethodMapping[countryCode] || 'MWL';
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371; // Earth's radius in kilometers
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

// Find the closest city from the cities array
export function findClosestCity(latitude: number, longitude: number, cities: City[]): City | null {
	if (!cities || cities.length === 0) {
		return null;
	}

	let closestCity: City | null = null;
	let minDistance = Infinity;

	for (const city of cities) {
		const distance = calculateDistance(latitude, longitude, city.lat, city.lng);
		if (distance < minDistance) {
			minDistance = distance;
			closestCity = city;
		}
	}

	return closestCity;
}

export async function enrichLocationData(
	latitude: number,
	longitude: number,
	cities: City[] = []
): Promise<{ country?: string; timezone?: string; closestCity?: City }> {
	try {
		const closestCity = findClosestCity(latitude, longitude, cities);

		if (closestCity) {
			return {
				country: closestCity.country,
				timezone: closestCity.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
				closestCity
			};
		}

		// Fallback if no city found
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return { timezone };
	} catch (error) {
		console.error('Error enriching location data:', error);
		return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
	}
}
