<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Profile } from './types';
	import { calculationMethods } from './constants';

	export let profile: Profile;

	const dispatch = createEventDispatcher<{
		save: Profile;
		cancel: void;
	}>();

	// Create a copy to avoid mutating the original
	let editingProfile: Profile = { ...profile };

	function handleSave() {
		dispatch('save', editingProfile);
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="rounded-xl bg-white p-8 shadow-lg">
	<h3 class="mb-6 text-2xl font-bold text-gray-800">Edit Profile: {profile.name}</h3>

	<form on:submit|preventDefault={handleSave}>
		<div class="space-y-4">
			<div>
				<label for="edit-profile-name" class="mb-2 block text-sm font-medium text-gray-700">Profile Name</label>
				<input
					id="edit-profile-name"
					type="text"
					bind:value={editingProfile.name}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
					required
				/>
			</div>

			<div>
				<label for="edit-calculation-method" class="mb-2 block text-sm font-medium text-gray-700">Calculation Method</label>
				<select
					id="edit-calculation-method"
					bind:value={editingProfile.calculationMethod}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				>
					{#each Object.entries(calculationMethods) as [key, method]}
						<option value={key}>{method.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="edit-madhab" class="mb-2 block text-sm font-medium text-gray-700">Madhab</label>
				<select
					id="edit-madhab"
					bind:value={editingProfile.madhab}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				>
					<option value="shafi">Shafi/Maliki/Hanbali</option>
					<option value="hanafi">Hanafi</option>
				</select>
			</div>

			<div>
				<label for="edit-high-latitude-rule" class="mb-2 block text-sm font-medium text-gray-700">High Latitude Rule</label>
				<select
					id="edit-high-latitude-rule"
					bind:value={editingProfile.highLatitudeRule}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				>
					<option value="middle_of_night">Middle of Night</option>
					<option value="seventh_of_night">Seventh of Night</option>
					<option value="twilight_angle">Twilight Angle</option>
				</select>
			</div>

			<!-- Prayer Time Adjustments -->
			<div class="pt-4">
				<h4 class="mb-2 text-lg font-semibold">Time Adjustments (in minutes)</h4>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="adj-fajr" class="mb-1 block text-sm font-medium text-gray-700">Fajr</label>
						<input id="adj-fajr" type="number" bind:value={editingProfile.adjustments.fajr} class="w-full rounded-md border px-2 py-1" />
					</div>
					<div>
						<label for="adj-sunrise" class="mb-1 block text-sm font-medium text-gray-700">Sunrise</label>
						<input id="adj-sunrise" type="number" bind:value={editingProfile.adjustments.sunrise} class="w-full rounded-md border px-2 py-1" />
					</div>
					<div>
						<label for="adj-dhuhr" class="mb-1 block text-sm font-medium text-gray-700">Dhuhr</label>
						<input id="adj-dhuhr" type="number" bind:value={editingProfile.adjustments.dhuhr} class="w-full rounded-md border px-2 py-1" />
					</div>
					<div>
						<label for="adj-asr" class="mb-1 block text-sm font-medium text-gray-700">Asr</label>
						<input id="adj-asr" type="number" bind:value={editingProfile.adjustments.asr} class="w-full rounded-md border px-2 py-1" />
					</div>
					<div>
						<label for="adj-maghrib" class="mb-1 block text-sm font-medium text-gray-700">Maghrib</label>
						<input id="adj-maghrib" type="number" bind:value={editingProfile.adjustments.maghrib} class="w-full rounded-md border px-2 py-1" />
					</div>
					<div>
						<label for="adj-isha" class="mb-1 block text-sm font-medium text-gray-700">Isha</label>
						<input id="adj-isha" type="number" bind:value={editingProfile.adjustments.isha} class="w-full rounded-md border px-2 py-1" />
					</div>
				</div>
			</div>
		</div>

		<div class="mt-6 flex justify-end space-x-3">
			<button
				on:click={handleSave}
				class="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
			>
				Save Changes
			</button>
			<button
				on:click={handleCancel}
				class="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
			>
				Cancel
			</button>
		</div>
	</form>
</div>
