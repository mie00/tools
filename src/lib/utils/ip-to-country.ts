/**
 * Converts an IP address to a country code using binary search on precomputed data
 * Logic and data from https://github.com/phuslu/iploc
 */

// Convert IP string to 32-bit integer in little endian format
function ipToInt(ip: string): number {
	const parts = ip.split('.').map(Number);
	if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) {
		throw new Error('Invalid IP address format');
	}

	// Convert to little endian 32-bit integer
	return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
}

// Cache for the binary data and country codes
let ipv4LeData: Uint32Array | null = null;
let countryData: string | null = null;

// Load the binary data files
async function loadData(): Promise<void> {
	if (ipv4LeData && countryData) {
		return; // Already loaded
	}

	try {
		// Load the little endian binary file
		const ipv4Response = await fetch('/ipv4le.bin');
		const ipv4Buffer = await ipv4Response.arrayBuffer();
		ipv4LeData = new Uint32Array(ipv4Buffer);

		// Load the country codes text file
		const countryResponse = await fetch('/ipv4.txt');
		countryData = await countryResponse.text();
	} catch (error) {
		throw new Error(`Failed to load IP geolocation data: ${(error as Error).message}`);
	}
}

// Binary search to find the IP range
function binarySearch(target: number, data: Uint32Array): number {
	let left = 0;
	let right = data.length - 1;
	let result = -1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const midValue = data[mid];

		if (midValue <= target) {
			result = mid;
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}

	return result;
}

/**
 * Convert IP address to country code
 * @param ip IP address string (e.g., "192.168.1.1")
 * @returns Promise<string> Two-character country code (e.g., "US")
 */
export async function ipToCountry(ip: string): Promise<string> {
	try {
		// Load data if not already loaded
		await loadData();

		if (!ipv4LeData || !countryData) {
			throw new Error('Failed to load geolocation data');
		}

		// Convert IP to integer
		const ipInt = ipToInt(ip);

		// Perform binary search to find the range
		const location = binarySearch(ipInt, ipv4LeData);

		if (location === -1) {
			return 'ZZ'; // Unknown country
		}

		// Calculate byte location in country data (location * 2)
		const countryByteLocation = location * 2;

		// Extract 2-character country code
		if (countryByteLocation + 1 < countryData.length) {
			const countryCode = countryData.substr(countryByteLocation, 2);
			return countryCode || 'ZZ';
		}

		return 'ZZ'; // Unknown country
	} catch (error) {
		console.error('Error converting IP to country:', error);
		return 'ZZ'; // Return unknown on error
	}
}

/**
 * Get country name from country code (comprehensive mapping for prayer times)
 */
export function getCountryName(countryCode: string): string {
	const countryNames: Record<string, string> = {
		// Major countries
		US: 'United States',
		GB: 'United Kingdom',
		CA: 'Canada',
		DE: 'Germany',
		FR: 'France',
		JP: 'Japan',
		CN: 'China',
		IN: 'India',
		BR: 'Brazil',
		AU: 'Australia',
		RU: 'Russia',
		IT: 'Italy',
		ES: 'Spain',
		KR: 'South Korea',
		NL: 'Netherlands',
		SE: 'Sweden',
		NO: 'Norway',
		DK: 'Denmark',
		FI: 'Finland',
		CH: 'Switzerland',
		AT: 'Austria',
		BE: 'Belgium',
		IE: 'Ireland',

		// Muslim-majority countries and regions commonly using prayer times
		SA: 'Saudi Arabia',
		AE: 'United Arab Emirates',
		EG: 'Egypt',
		TR: 'Turkey',
		ID: 'Indonesia',
		MY: 'Malaysia',
		PK: 'Pakistan',
		BD: 'Bangladesh',
		IR: 'Iran',
		IQ: 'Iraq',
		SY: 'Syria',
		JO: 'Jordan',
		LB: 'Lebanon',
		KW: 'Kuwait',
		QA: 'Qatar',
		OM: 'Oman',
		BH: 'Bahrain',
		YE: 'Yemen',
		MA: 'Morocco',
		DZ: 'Algeria',
		TN: 'Tunisia',
		LY: 'Libya',
		SD: 'Sudan',
		NG: 'Nigeria',
		SN: 'Senegal',
		ML: 'Mali',
		NE: 'Niger',
		BF: 'Burkina Faso',
		GM: 'Gambia',
		GN: 'Guinea',
		SL: 'Sierra Leone',
		LR: 'Liberia',
		CI: "Côte d'Ivoire",
		GH: 'Ghana',
		TG: 'Togo',
		BJ: 'Benin',
		TD: 'Chad',
		CF: 'Central African Republic',
		CM: 'Cameroon',
		SO: 'Somalia',
		DJ: 'Djibouti',
		ER: 'Eritrea',
		ET: 'Ethiopia',
		KE: 'Kenya',
		TZ: 'Tanzania',
		UG: 'Uganda',
		MZ: 'Mozambique',
		MW: 'Malawi',
		ZM: 'Zambia',
		ZW: 'Zimbabwe',
		ZA: 'South Africa',
		AF: 'Afghanistan',
		UZ: 'Uzbekistan',
		KZ: 'Kazakhstan',
		KG: 'Kyrgyzstan',
		TJ: 'Tajikistan',
		TM: 'Turkmenistan',
		AZ: 'Azerbaijan',
		AM: 'Armenia',
		GE: 'Georgia',
		MD: 'Moldova',
		UA: 'Ukraine',
		BY: 'Belarus',
		LT: 'Lithuania',
		LV: 'Latvia',
		EE: 'Estonia',
		PL: 'Poland',
		CZ: 'Czech Republic',
		SK: 'Slovakia',
		HU: 'Hungary',
		RO: 'Romania',
		BG: 'Bulgaria',
		RS: 'Serbia',
		HR: 'Croatia',
		SI: 'Slovenia',
		BA: 'Bosnia and Herzegovina',
		ME: 'Montenegro',
		MK: 'North Macedonia',
		AL: 'Albania',
		GR: 'Greece',
		CY: 'Cyprus',
		MT: 'Malta',
		PT: 'Portugal',
		LU: 'Luxembourg',
		AD: 'Andorra',
		MC: 'Monaco',
		SM: 'San Marino',
		VA: 'Vatican City',
		LI: 'Liechtenstein',
		IS: 'Iceland',

		// Asian countries with significant Muslim populations
		TH: 'Thailand',
		SG: 'Singapore',
		BN: 'Brunei',
		PH: 'Philippines',
		VN: 'Vietnam',
		LA: 'Laos',
		KH: 'Cambodia',
		MM: 'Myanmar',
		NP: 'Nepal',
		BT: 'Bhutan',
		LK: 'Sri Lanka',
		MV: 'Maldives',

		// African countries
		MG: 'Madagascar',
		MU: 'Mauritius',
		SC: 'Seychelles',
		KM: 'Comoros',
		RE: 'Réunion',
		MR: 'Mauritania',
		CV: 'Cape Verde',
		ST: 'São Tomé and Príncipe',
		GQ: 'Equatorial Guinea',
		GA: 'Gabon',
		CG: 'Republic of the Congo',
		CD: 'Democratic Republic of the Congo',
		AO: 'Angola',
		NA: 'Namibia',
		BW: 'Botswana',
		SZ: 'Eswatini',
		LS: 'Lesotho',

		// European countries
		MX: 'Mexico',
		GT: 'Guatemala',
		BZ: 'Belize',
		SV: 'El Salvador',
		HN: 'Honduras',
		NI: 'Nicaragua',
		CR: 'Costa Rica',
		PA: 'Panama',
		CU: 'Cuba',
		JM: 'Jamaica',
		HT: 'Haiti',
		DO: 'Dominican Republic',
		TT: 'Trinidad and Tobago',
		BB: 'Barbados',

		// South American countries
		VE: 'Venezuela',
		GY: 'Guyana',
		SR: 'Suriname',
		GF: 'French Guiana',
		CO: 'Colombia',
		EC: 'Ecuador',
		PE: 'Peru',
		BO: 'Bolivia',
		PY: 'Paraguay',
		UY: 'Uruguay',
		AR: 'Argentina',
		CL: 'Chile',
		FK: 'Falkland Islands',

		// Oceania
		NZ: 'New Zealand',
		FJ: 'Fiji',
		PG: 'Papua New Guinea',
		SB: 'Solomon Islands',
		VU: 'Vanuatu',
		NC: 'New Caledonia',
		PF: 'French Polynesia',
		WS: 'Samoa',
		TO: 'Tonga',
		TV: 'Tuvalu',
		NR: 'Nauru',
		KI: 'Kiribati',
		MH: 'Marshall Islands',
		FM: 'Micronesia',
		PW: 'Palau',

		// Unknown
		ZZ: 'Unknown'
	};

	return countryNames[countryCode] || countryCode;
}
