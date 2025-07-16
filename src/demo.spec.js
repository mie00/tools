import { expect, test } from 'vitest';
import { getCountryName } from './lib/utils/ip-to-country.js';

test('getCountryName should return full country names for prayer time profiles', () => {
	// Test major countries
	expect(getCountryName('US')).toBe('United States');
	expect(getCountryName('GB')).toBe('United Kingdom');
	expect(getCountryName('CA')).toBe('Canada');

	// Test Muslim-majority countries commonly using prayer times
	expect(getCountryName('SA')).toBe('Saudi Arabia');
	expect(getCountryName('AE')).toBe('United Arab Emirates');
	expect(getCountryName('EG')).toBe('Egypt');
	expect(getCountryName('TR')).toBe('Turkey');
	expect(getCountryName('ID')).toBe('Indonesia');
	expect(getCountryName('MY')).toBe('Malaysia');
	expect(getCountryName('PK')).toBe('Pakistan');

	// Test unknown country code fallback
	expect(getCountryName('ZZ')).toBe('Unknown');
	expect(getCountryName('XX')).toBe('XX'); // Should return the code itself if not found
});

test('enhanced prayer profile names should be more user-friendly', () => {
	// Test that we get readable country names instead of codes
	expect(getCountryName('SA')).not.toBe('SA'); // Should not just return the code
	expect(getCountryName('AE')).toContain('United Arab'); // Should be readable
	expect(getCountryName('MA')).toBe('Morocco'); // Should map correctly
});
