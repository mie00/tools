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

	<div class="grid gap-6 md:grid-cols-2">
		<div>
			<label class="mb-2 block text-sm font-medium text-gray-700">Profile Name</label>
			<input
				type="text"
				bind:value={editingProfile.name}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
			/>
		</div>

		<div>
			<label class="mb-2 block text-sm font-medium text-gray-700">Calculation Method</label>
			<select
				bind:value={editingProfile.calculationMethod}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
			>
				{#each Object.entries(calculationMethods) as [key, method]}
					<option value={key}>{method.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label class="mb-2 block text-sm font-medium text-gray-700">Madhab</label>
			<select
				bind:value={editingProfile.madhab}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
			>
				<option value="shafi">Shafi/Maliki/Hanbali</option>
				<option value="hanafi">Hanafi</option>
			</select>
		</div>

		<div>
			<label class="mb-2 block text-sm font-medium text-gray-700">High Latitude Rule</label>
			<select
				bind:value={editingProfile.highLatitudeRule}
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
			>
				<option value="middle_of_night">Middle of Night</option>
				<option value="seventh_of_night">Seventh of Night</option>
				<option value="twilight_angle">Twilight Angle</option>
			</select>
		</div>
	</div>

	<!-- Prayer Time Adjustments -->
	<div class="mt-8">
		<h4 class="mb-4 text-lg font-semibold text-gray-800">Prayer Time Adjustments (minutes)</h4>
		<div class="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Fajr</label>
				<input
					type="number"
					min="-30"
					max="30"
					bind:value={editingProfile.adjustments.fajr}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Sunrise</label>
				<input
					type="number"
					min="-30"
					max="30"
					bind:value={editingProfile.adjustments.sunrise}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Dhuhr</label>
				<input
					type="number"
					min="-30"
					max="30"
					bind:value={editingProfile.adjustments.dhuhr}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Asr</label>
				<input
					type="number"
					min="-30"
					max="30"
					bind:value={editingProfile.adjustments.asr}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Maghrib</label>
				<input
					type="number"
					min="-30"
					max="30"
					bind:value={editingProfile.adjustments.maghrib}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Isha</label>
				<input
					type="number"
					min="-30"
					max="30"
					bind:value={editingProfile.adjustments.isha}
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
			</div>
		</div>
		<p class="mt-2 text-sm text-gray-600">
			Positive values add time, negative values subtract time
		</p>
	</div>

	<div class="mt-6 flex space-x-4">
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
</div>
