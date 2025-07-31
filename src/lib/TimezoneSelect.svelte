<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import T from './T.svelte';

	const timezones = [
		"Local", "UTC",
		"CST6CDT", "EST5EDT", "Pacific/Wake", "Pacific/Honolulu", "Pacific/Niue", "Pacific/Noumea", 
		"Pacific/Wallis", "Pacific/Pohnpei", "Pacific/Tahiti", "Pacific/Chatham", "Pacific/Nauru", 
		"Pacific/Gambier", "Pacific/Pago_Pago", "Pacific/Bougainville", "Pacific/Palau", "Pacific/Efate", 
		"Pacific/Kwajalein", "Pacific/Norfolk", "Pacific/Apia", "Pacific/Chuuk", "Pacific/Easter", 
		"Pacific/Galapagos", "Pacific/Midway", "Pacific/Tarawa", "Pacific/Kiritimati", "Pacific/Fakaofo", 
		"Pacific/Majuro", "Pacific/Port_Moresby", "Pacific/Saipan", "Pacific/Kosrae", "Pacific/Guadalcanal", 
		"Pacific/Guam", "Pacific/Auckland", "Pacific/Marquesas", "Pacific/Kanton", "Pacific/Rarotonga", 
		"Pacific/Pitcairn", "Pacific/Funafuti", "Pacific/Fiji", "Pacific/Tongatapu", "PST8PDT", "CET", 
		"Etc/GMT+11", "Etc/GMT-6", "Etc/GMT", "Etc/GMT-9", "Etc/GMT+6", "Etc/GMT+12", "Etc/GMT-10", 
		"Etc/GMT+3", "Etc/GMT-3", "Etc/GMT+9", "Etc/GMT-4", "Etc/GMT+7", "Etc/GMT-13", "Etc/GMT-8", 
		"Etc/GMT+4", "Etc/GMT-7", "Etc/UTC", "Etc/GMT-12", "Etc/GMT-14", "Etc/GMT+5", "Etc/GMT-2", 
		"Etc/GMT-1", "Etc/GMT-5", "Etc/GMT+1", "Etc/GMT+10", "Etc/GMT+2", "Etc/GMT+8", "Etc/GMT-11", 
		"MET", "Antarctica/Rothera", "Antarctica/Palmer", "Antarctica/Vostok", "Antarctica/DumontDUrville", 
		"Antarctica/Troll", "Antarctica/McMurdo", "Antarctica/Syowa", "Antarctica/Davis", "Antarctica/Casey", 
		"Antarctica/Macquarie", "Antarctica/Mawson", "Factory", "WET", "America/Ojinaga", "America/Fortaleza", 
		"America/Nuuk", "America/Whitehorse", "America/Grand_Turk", "America/Toronto", "America/Mazatlan", 
		"America/Grenada", "America/Hermosillo", "America/Fort_Nelson", "America/Costa_Rica", "America/Boa_Vista", 
		"America/Iqaluit", "America/Maceio", "America/Scoresbysund", "America/Metlakatla", "America/Matamoros", 
		"America/Regina", "America/North_Dakota/New_Salem", "America/North_Dakota/Center", "America/North_Dakota/Beulah", 
		"America/Barbados", "America/Monterrey", "America/El_Salvador", "America/Coyhaique", "America/Inuvik", 
		"America/Atikokan", "America/Cayman", "America/Nassau", "America/Adak", "America/Paramaribo", 
		"America/Aruba", "America/Panama", "America/Eirunepe", "America/Port_of_Spain", "America/Argentina/Ushuaia", 
		"America/Argentina/Catamarca", "America/Argentina/Jujuy", "America/Argentina/La_Rioja", "America/Argentina/San_Juan", 
		"America/Argentina/Cordoba", "America/Argentina/Rio_Gallegos", "America/Argentina/San_Luis", "America/Argentina/Mendoza", 
		"America/Argentina/Tucuman", "America/Argentina/Salta", "America/Argentina/Buenos_Aires", "America/Santiago", 
		"America/Sitka", "America/Manaus", "America/Bahia_Banderas", "America/Thule", "America/Mexico_City", 
		"America/St_Johns", "America/Guayaquil", "America/Belem", "America/Kentucky/Louisville", "America/Kentucky/Monticello", 
		"America/Bogota", "America/Juneau", "America/Guatemala", "America/Porto_Velho", "America/Winnipeg", 
		"America/Nome", "America/Detroit", "America/Noronha", "America/St_Vincent", "America/Dawson", 
		"America/La_Paz", "America/Tijuana", "America/Montevideo", "America/Miquelon", "America/Belize", 
		"America/Resolute", "America/Martinique", "America/Edmonton", "America/Halifax", "America/Los_Angeles", 
		"America/Blanc-Sablon", "America/Cambridge_Bay", "America/Moncton", "America/St_Kitts", "America/Anchorage", 
		"America/Asuncion", "America/St_Thomas", "America/Anguilla", "America/Dominica", "America/Yakutat", 
		"America/Vancouver", "America/Araguaina", "America/Port-au-Prince", "America/Curacao", "America/Montserrat", 
		"America/Rankin_Inlet", "America/Cancun", "America/Ciudad_Juarez", "America/Glace_Bay", "America/New_York", 
		"America/Punta_Arenas", "America/Phoenix", "America/Campo_Grande", "America/Dawson_Creek", "America/Caracas", 
		"America/Santo_Domingo", "America/Menominee", "America/Lima", "America/Managua", "America/Danmarkshavn", 
		"America/Tegucigalpa", "America/Swift_Current", "America/Creston", "America/Bahia", "America/Antigua", 
		"America/Puerto_Rico", "America/Cayenne", "America/Cuiaba", "America/Denver", "America/Guadeloupe", 
		"America/St_Lucia", "America/Indiana/Winamac", "America/Indiana/Tell_City", "America/Indiana/Marengo", 
		"America/Indiana/Indianapolis", "America/Indiana/Knox", "America/Indiana/Petersburg", "America/Indiana/Vincennes", 
		"America/Indiana/Vevay", "America/Boise", "America/Guyana", "America/Chihuahua", "America/Rio_Branco", 
		"America/Santarem", "America/Havana", "America/Merida", "America/Goose_Bay", "America/Jamaica", 
		"America/Recife", "America/Sao_Paulo", "America/Chicago", "America/Tortola", "MST7MDT", "Atlantic/Madeira", 
		"Atlantic/St_Helena", "Atlantic/South_Georgia", "Atlantic/Canary", "Atlantic/Stanley", "Atlantic/Cape_Verde", 
		"Atlantic/Bermuda", "Atlantic/Reykjavik", "Atlantic/Faroe", "Atlantic/Azores", "Indian/Mahe", 
		"Indian/Mauritius", "Indian/Reunion", "Indian/Mayotte", "Indian/Antananarivo", "Indian/Maldives", 
		"Indian/Comoro", "Indian/Chagos", "Indian/Kerguelen", "Indian/Cocos", "Indian/Christmas", "EST", 
		"Europe/Riga", "Europe/Kirov", "Europe/Sarajevo", "Europe/Brussels", "Europe/Guernsey", "Europe/Warsaw", 
		"Europe/Saratov", "Europe/Kaliningrad", "Europe/Paris", "Europe/Vaduz", "Europe/Andorra", "Europe/Prague", 
		"Europe/Gibraltar", "Europe/London", "Europe/Belgrade", "Europe/Budapest", "Europe/Kyiv", "Europe/Isle_of_Man", 
		"Europe/Athens", "Europe/Helsinki", "Europe/Simferopol", "Europe/Stockholm", "Europe/Bucharest", 
		"Europe/Istanbul", "Europe/Vilnius", "Europe/Moscow", "Europe/Sofia", "Europe/Monaco", "Europe/Amsterdam", 
		"Europe/Dublin", "Europe/Oslo", "Europe/Astrakhan", "Europe/Tallinn", "Europe/Minsk", "Europe/Chisinau", 
		"Europe/Vienna", "Europe/Skopje", "Europe/Lisbon", "Europe/Luxembourg", "Europe/Madrid", "Europe/Zurich", 
		"Europe/Ljubljana", "Europe/Berlin", "Europe/Copenhagen", "Europe/Samara", "Europe/Volgograd", 
		"Europe/Rome", "Europe/Ulyanovsk", "Europe/Jersey", "Europe/Zagreb", "Europe/Tirane", "Europe/Malta", 
		"Australia/Lord_Howe", "Australia/Melbourne", "Australia/Sydney", "Australia/Brisbane", "Australia/Broken_Hill", 
		"Australia/Lindeman", "Australia/Eucla", "Australia/Hobart", "Australia/Darwin", "Australia/Perth", 
		"Australia/Adelaide", "Africa/Bissau", "Africa/Douala", "Africa/Kinshasa", "Africa/Mogadishu", 
		"Africa/Juba", "Africa/Brazzaville", "Africa/Gaborone", "Africa/Nouakchott", "Africa/Niamey", 
		"Africa/Khartoum", "Africa/Lusaka", "Africa/Accra", "Africa/Mbabane", "Africa/Tripoli", "Africa/Ndjamena", 
		"Africa/Algiers", "Africa/Freetown", "Africa/Addis_Ababa", "Africa/Ceuta", "Africa/Windhoek", 
		"Africa/Libreville", "Africa/Nairobi", "Africa/Maputo", "Africa/Tunis", "Africa/Malabo", "Africa/Johannesburg", 
		"Africa/Porto-Novo", "Africa/Bangui", "Africa/Blantyre", "Africa/Maseru", "Africa/Lome", "Africa/Lubumbashi", 
		"Africa/Conakry", "Africa/Dakar", "Africa/Banjul", "Africa/Lagos", "Africa/Kigali", "Africa/Bujumbura", 
		"Africa/Harare", "Africa/Djibouti", "Africa/Sao_Tome", "Africa/Bamako", "Africa/Cairo", "Africa/Casablanca", 
		"Africa/Ouagadougou", "Africa/Asmara", "Africa/Abidjan", "Africa/Kampala", "Africa/Dar_es_Salaam", 
		"Africa/El_Aaiun", "Africa/Monrovia", "Africa/Luanda", "EET", "Asia/Jakarta", "Asia/Magadan", 
		"Asia/Hebron", "Asia/Barnaul", "Asia/Seoul", "Asia/Chita", "Asia/Gaza", "Asia/Krasnoyarsk", 
		"Asia/Qatar", "Asia/Kamchatka", "Asia/Jayapura", "Asia/Yakutsk", "Asia/Dhaka", "Asia/Hong_Kong", 
		"Asia/Kolkata", "Asia/Phnom_Penh", "Asia/Tashkent", "Asia/Famagusta", "Asia/Beirut", "Asia/Yangon", 
		"Asia/Aqtobe", "Asia/Irkutsk", "Asia/Kuching", "Asia/Macau", "Asia/Dili", "Asia/Makassar", 
		"Asia/Dubai", "Asia/Yekaterinburg", "Asia/Karachi", "Asia/Vientiane", "Asia/Baku", "Asia/Khandyga", 
		"Asia/Tbilisi", "Asia/Vladivostok", "Asia/Thimphu", "Asia/Aqtau", "Asia/Oral", "Asia/Almaty", 
		"Asia/Colombo", "Asia/Kuala_Lumpur", "Asia/Ulaanbaatar", "Asia/Muscat", "Asia/Aden", "Asia/Dushanbe", 
		"Asia/Tokyo", "Asia/Qostanay", "Asia/Novosibirsk", "Asia/Manila", "Asia/Tomsk", "Asia/Tehran", 
		"Asia/Hovd", "Asia/Sakhalin", "Asia/Novokuznetsk", "Asia/Kabul", "Asia/Qyzylorda", "Asia/Bahrain", 
		"Asia/Srednekolymsk", "Asia/Amman", "Asia/Taipei", "Asia/Jerusalem", "Asia/Shanghai", "Asia/Damascus", 
		"Asia/Riyadh", "Asia/Bangkok", "Asia/Brunei", "Asia/Kuwait", "Asia/Ho_Chi_Minh", "Asia/Kathmandu", 
		"Asia/Yerevan", "Asia/Singapore", "Asia/Bishkek", "Asia/Samarkand", "Asia/Pontianak", "Asia/Ust-Nera", 
		"Asia/Nicosia", "Asia/Omsk", "Asia/Pyongyang", "Asia/Urumqi", "Asia/Baghdad", "Asia/Anadyr", 
		"Asia/Atyrau", "Asia/Ashgabat", "HST", "MST"
	];

	let {
		value = $bindable(''),
		placeholder = 'Select timezone...',
		class: className = '',
		disabled = false,
		onchange
	}: {
		value?: string;
		placeholder?: string;
		class?: string;
		disabled?: boolean;
		onchange?: (timezone: string) => void;
	} = $props();

	const dispatch = createEventDispatcher<{
		change: string;
	}>();

	let isDropdownOpen = $state(false);
	let searchQuery = $state('');
	let selectedIndex = $state(-1);
	let dropdownRef: HTMLDivElement | undefined;
	let inputRef: HTMLInputElement | undefined;

	let filteredTimezones = $state(timezones);

	$effect(() => {
		if (!searchQuery.trim()) {
			filteredTimezones = timezones;
			return;
		}
		
		const query = searchQuery.toLowerCase().trim();
		
		const filtered = timezones.filter(tz => {
			const timezone = tz.toLowerCase();
			const displayName = getTimezoneDisplayName(tz).toLowerCase();
			const abbreviation = getTimezoneAbbreviation(tz).toLowerCase();
			
			// Exact matches first
			if (timezone.includes(query) || displayName.includes(query) || abbreviation.includes(query)) {
				return true;
			}
			
			// Fuzzy search - check if query characters appear in order
			const searchText = timezone + ' ' + displayName + ' ' + abbreviation;
			let queryIndex = 0;
			for (let i = 0; i < searchText.length && queryIndex < query.length; i++) {
				if (searchText[i] === query[queryIndex]) {
					queryIndex++;
				}
			}
			return queryIndex === query.length;
		});
		
		filteredTimezones = filtered.sort((a, b) => {
			// Sort by relevance - exact matches first, then fuzzy matches
			const aLower = a.toLowerCase();
			const bLower = b.toLowerCase();
			const aDisplay = getTimezoneDisplayName(a).toLowerCase();
			const bDisplay = getTimezoneDisplayName(b).toLowerCase();
			
			const aExact = aLower.includes(query) || aDisplay.includes(query);
			const bExact = bLower.includes(query) || bDisplay.includes(query);
			
			if (aExact && !bExact) return -1;
			if (!aExact && bExact) return 1;
			
			// If both exact or both fuzzy, sort alphabetically
			return a.localeCompare(b);
		});
	});

	function getTimezoneDisplayName(timezone: string): string {
		if (timezone === 'Local') return 'Local';
		if (timezone === 'UTC') return 'UTC';
		// Convert timezone to readable format
		return timezone.replace(/_/g, ' ').replace('/', ' / ');
	}

	function getTimezoneAbbreviation(timezone: string): string {
		if (timezone === 'Local') {
			// Get local timezone abbreviation
			try {
				const now = new Date();
				const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
				const formatter = new Intl.DateTimeFormat('en-US', {
					timeZone: localTimezone,
					timeZoneName: 'short'
				});
				const parts = formatter.formatToParts(now);
				const timeZoneName = parts.find(part => part.type === 'timeZoneName');
				return timeZoneName ? ` (${timeZoneName.value})` : '';
			} catch (e) {
				return '';
			}
		}
		
		try {
			const now = new Date();
			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				timeZoneName: 'short'
			});
			const parts = formatter.formatToParts(now);
			const timeZoneName = parts.find(part => part.type === 'timeZoneName');
			return timeZoneName ? ` (${timeZoneName.value})` : '';
		} catch (e) {
			return '';
		}
	}

	function selectTimezone(timezone: string) {
		value = timezone;
		searchQuery = '';
		isDropdownOpen = false;
		selectedIndex = -1;
		
		dispatch('change', timezone);
		onchange?.(timezone);
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (!isDropdownOpen) {
			if (event.key === 'ArrowDown' || event.key === 'Enter') {
				event.preventDefault();
				isDropdownOpen = true;
				selectedIndex = 0;
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredTimezones.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedIndex >= 0 && filteredTimezones[selectedIndex]) {
					selectTimezone(filteredTimezones[selectedIndex]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				isDropdownOpen = false;
				selectedIndex = -1;
				inputRef?.blur();
				break;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isDropdownOpen = false;
			selectedIndex = -1;
		}
	}

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});

	$effect(() => {
		// Reset selected index when search changes
		selectedIndex = -1;
	});
</script>

<div class="relative" bind:this={dropdownRef}>
	<input
		bind:this={inputRef}
		type="text"
		value={isDropdownOpen ? searchQuery : (value ? getTimezoneDisplayName(value) + getTimezoneAbbreviation(value) : '')}
		{placeholder}
		{disabled}
		readonly={!isDropdownOpen}
		class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none {className}"
		onclick={() => {
			if (!disabled) {
				searchQuery = '';
				isDropdownOpen = true;
			}
		}}
		onkeydown={handleInputKeydown}
		oninput={(e) => {
			const target = e.target as HTMLInputElement;
			searchQuery = target.value;
			isDropdownOpen = true;
		}}
	/>

	{#if isDropdownOpen}
		<div class="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg">
			{#if filteredTimezones.length === 0}
				<div class="px-3 py-2 text-gray-500 text-sm">
					<T>No timezones found</T>
				</div>
			{:else}
				{#each filteredTimezones as timezone, index (timezone)}
					<button
						type="button"
						class="w-full text-left px-3 py-2 text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none {index === selectedIndex ? 'bg-blue-50 text-blue-600' : ''}"
						onclick={() => selectTimezone(timezone)}
					>
						<div class="truncate">
							{getTimezoneDisplayName(timezone)}<span class="text-gray-500 text-sm">{getTimezoneAbbreviation(timezone)}</span>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>