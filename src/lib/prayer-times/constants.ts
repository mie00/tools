import { CalculationMethod } from 'adhan';
import type { CalculationMethodInfo } from './types';

export const calculationMethods: Record<string, CalculationMethodInfo> = {
	MWL: {
		name: 'Muslim World League',
		method: CalculationMethod.MuslimWorldLeague,
		region: ['Europe', 'Far East', 'parts of US']
	},
	ISNA: {
		name: 'Islamic Society of North America',
		method: CalculationMethod.NorthAmerica,
		region: ['North America']
	},
	EGYPT: {
		name: 'Egyptian General Authority of Survey',
		method: CalculationMethod.Egyptian,
		region: ['Africa', 'Syria', 'Lebanon', 'Malaysia', 'Egypt']
	},
	MAKKAH: {
		name: 'Umm al-Qura University, Makkah',
		method: CalculationMethod.UmmAlQura,
		region: ['Arabian Peninsula', 'Saudi Arabia']
	},
	KARACHI: {
		name: 'University of Islamic Sciences, Karachi',
		method: CalculationMethod.Karachi,
		region: ['Pakistan', 'Afghanistan', 'Bangladesh', 'India']
	},
	TEHRAN: {
		name: 'Institute of Geophysics, University of Tehran',
		method: CalculationMethod.Tehran,
		region: ['Iran', 'Some Shia communities']
	},
	SINGAPORE: {
		name: 'Majlis Ugama Islam Singapura',
		method: CalculationMethod.Singapore,
		region: ['Singapore', 'Southeast Asia']
	},
	KUWAIT: {
		name: 'Kuwait',
		method: CalculationMethod.Kuwait,
		region: ['Kuwait', 'Gulf Region']
	},
	QATAR: {
		name: 'Qatar',
		method: CalculationMethod.Qatar,
		region: ['Qatar', 'Gulf Region']
	},
	UOIF: {
		name: 'Union des Organisations Islamiques de France',
		method: CalculationMethod.MoonsightingCommittee,
		region: ['France', 'Some European regions']
	}
};

export const countryMethodMapping: Record<string, string> = {
	'Egypt': 'EGYPT', 'EG': 'EGYPT',
	'Saudi Arabia': 'MAKKAH', 'SA': 'MAKKAH',
	'United Arab Emirates': 'MAKKAH', 'AE': 'MAKKAH',
	'Pakistan': 'KARACHI', 'PK': 'KARACHI',
	'India': 'KARACHI', 'IN': 'KARACHI',
	'Bangladesh': 'KARACHI', 'BD': 'KARACHI',
	'Afghanistan': 'KARACHI', 'AF': 'KARACHI',
	'Iran': 'TEHRAN', 'IR': 'TEHRAN',
	'United States': 'ISNA', 'US': 'ISNA',
	'Canada': 'ISNA', 'CA': 'ISNA',
	'France': 'UOIF', 'FR': 'UOIF',
	'Singapore': 'SINGAPORE', 'SG': 'SINGAPORE',
	'Malaysia': 'EGYPT', 'MY': 'EGYPT',
	'Indonesia': 'KARACHI', 'ID': 'KARACHI',
	'Turkey': 'MWL', 'TR': 'MWL',
	'Morocco': 'EGYPT', 'MA': 'EGYPT',
	'Algeria': 'EGYPT', 'DZ': 'EGYPT',
	'Tunisia': 'EGYPT', 'TN': 'EGYPT',
	'Libya': 'EGYPT', 'LY': 'EGYPT',
	'Jordan': 'EGYPT', 'JO': 'EGYPT',
	'Syria': 'EGYPT', 'SY': 'EGYPT',
	'Lebanon': 'EGYPT', 'LB': 'EGYPT',
	'Iraq': 'MAKKAH', 'IQ': 'MAKKAH',
	'Kuwait': 'KUWAIT', 'KW': 'KUWAIT',
	'Qatar': 'QATAR', 'QA': 'QATAR',
	'Bahrain': 'MAKKAH', 'BH': 'MAKKAH',
	'Oman': 'MAKKAH', 'OM': 'MAKKAH',
	'Yemen': 'MAKKAH', 'YE': 'MAKKAH'
}; 