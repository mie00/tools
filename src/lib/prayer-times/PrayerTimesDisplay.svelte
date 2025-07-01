<script lang="ts">
	import type { Profile, PrayerTimes } from './types';
	import { formatTime, getNextPrayerForProfile } from './utils';
	import { calculationMethods } from './constants';

	export let activeProfile: Profile;
	export let prayerTimes: PrayerTimes;

	let currentTime = new Date();

	// Update current time every minute
	setInterval(() => {
		currentTime = new Date();
	}, 60000);

	$: nextPrayer = getNextPrayerForProfile(activeProfile, prayerTimes);

	$: prayers = [
		{ name: 'Fajr', time: prayerTimes.fajr, arabic: 'الفجر' },
		{ name: 'Sunrise', time: prayerTimes.sunrise, arabic: 'الشروق' },
		{ name: 'Dhuhr', time: prayerTimes.dhuhr, arabic: 'الظهر' },
		{ name: 'Asr', time: prayerTimes.asr, arabic: 'العصر' },
		{ name: 'Maghrib', time: prayerTimes.maghrib, arabic: 'المغرب' },
		{ name: 'Isha', time: prayerTimes.isha, arabic: 'العشاء' }
	];
</script>

<div class="rounded-xl bg-white p-8 shadow-lg">
	<div class="mb-8 text-center">
		<h2 class="mb-2 text-3xl font-bold text-gray-800">Prayer Times</h2>
		<p class="text-lg text-gray-600">{activeProfile.name}</p>
		<p class="text-sm text-gray-500">
			{calculationMethods[activeProfile.calculationMethod]?.name || activeProfile.calculationMethod}
		</p>
	</div>

	{#if nextPrayer}
		<div
			class="mb-8 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 text-center"
		>
			<h3 class="mb-2 text-xl font-semibold text-blue-800">Next Prayer</h3>
			<div class="mb-1 text-3xl font-bold text-blue-900">{nextPrayer.name}</div>
			<div class="text-2xl text-blue-700">{formatTime(nextPrayer.time)}</div>
			{#if nextPrayer.timeRemaining}
				<div class="mt-2 text-sm text-blue-600">in {nextPrayer.timeRemaining}</div>
			{/if}
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each prayers as prayer}
			<div
				class="rounded-lg border border-gray-200 p-4 text-center {nextPrayer?.name === prayer.name
					? 'border-blue-300 bg-blue-50'
					: 'bg-gray-50'}"
			>
				<h4
					class="text-lg font-semibold {nextPrayer?.name === prayer.name
						? 'text-blue-800'
						: 'text-gray-800'} mb-1"
				>
					{prayer.name}
				</h4>
				<p
					class="text-sm {nextPrayer?.name === prayer.name
						? 'text-blue-600'
						: 'text-gray-600'} mb-2"
				>
					{prayer.arabic}
				</p>
				<p
					class="font-mono text-xl {nextPrayer?.name === prayer.name
						? 'text-blue-900'
						: 'text-gray-900'}"
				>
					{formatTime(prayer.time)}
				</p>
			</div>
		{/each}
	</div>

	<div class="mt-6 text-center text-sm text-gray-500">
		<p>
			Times calculated for {activeProfile.latitude.toFixed(4)}, {activeProfile.longitude.toFixed(4)}
		</p>
		<p>Date: {prayerTimes.date}</p>
		<p class="mt-2">
			Current time: {currentTime.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			})}
		</p>
	</div>
</div>
