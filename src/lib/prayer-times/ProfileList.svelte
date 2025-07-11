<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Profile, PrayerTimes } from './types';
	import { calculationMethods } from './constants';
	import { getNextPrayerForProfile, formatTime } from './utils';

	let {
		profiles = [],
		profilePrayerTimes = new Map(),
		sharingInProgress = false
	}: {
		profiles: Profile[];
		profilePrayerTimes: Map<string, PrayerTimes>;
		sharingInProgress: boolean;
	} = $props();

	const dispatch = createEventDispatcher<{
		activate: Profile;
		edit: Profile;
		delete: string;
		share: Profile;
		'create-new': void;
	}>();

	function handleActivate(profile: Profile) {
		if (!profile.isActive) {
			dispatch('activate', profile);
		}
	}

	function handleEdit(event: MouseEvent, profile: Profile) {
		event.stopPropagation();
		dispatch('edit', profile);
	}

	function handleDelete(event: MouseEvent, profileId: string) {
		event.stopPropagation();
		if (confirm('Are you sure you want to delete this profile?')) {
			dispatch('delete', profileId);
		}
	}

	function handleShare(event: MouseEvent, profile: Profile) {
		event.stopPropagation();
		dispatch('share', profile);
	}

	function handleCreateNew() {
		dispatch('create-new');
	}
</script>

<div class="rounded-xl bg-white p-6 shadow-lg">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-xl font-bold text-gray-800">Prayer Profiles</h3>
		<button
			onclick={handleCreateNew}
			class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
		>
			Add Profile
		</button>
	</div>

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each profiles as profile (profile.id)}
			<div
				class="cursor-pointer rounded-lg border p-4 transition-all duration-200 {profile.isActive
					? 'border-blue-500 bg-blue-50'
					: 'border-gray-200 hover:border-gray-300 hover:shadow-md'}"
				onclick={() => handleActivate(profile)}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && handleActivate(profile)}
			>
				<div class="flex items-start justify-between">
					<div class="flex-1">
						<div class="mb-2 flex items-center gap-2">
							<h4 class="font-semibold {profile.isActive ? 'text-blue-800' : 'text-gray-800'}">
								{profile.name}
							</h4>
							{#if profile.isActive}
								<span class="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">Active</span>
							{/if}
						</div>
						<p class="text-sm text-gray-600">
							{calculationMethods[profile.calculationMethod]?.name || profile.calculationMethod}
						</p>
						<p class="mt-1 text-xs text-gray-500">
							{profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)}
						</p>

						{#if profilePrayerTimes.get(profile.id)}
							{@const profileTimes = profilePrayerTimes.get(profile.id)!}
							{@const nextPrayerForThisProfile = getNextPrayerForProfile(profile, profileTimes)}
							{#if nextPrayerForThisProfile}
								<div class="mt-2 text-xs {profile.isActive ? 'text-blue-700' : 'text-gray-600'}">
									<span class="font-medium">Next: {nextPrayerForThisProfile.name}</span>
									<span class="ml-1">{formatTime(nextPrayerForThisProfile.time)}</span>
									{#if nextPrayerForThisProfile.timeRemaining}
										<span class="ml-1 opacity-75">({nextPrayerForThisProfile.timeRemaining})</span>
									{/if}
								</div>
							{/if}
						{/if}
					</div>
					<div class="flex items-center space-x-2">
						<button
							onclick={(e) => handleShare(e, profile)}
							class="p-1 text-sm text-green-600 hover:text-green-700 {sharingInProgress
								? 'cursor-wait opacity-50'
								: ''}"
							disabled={sharingInProgress}
							title={sharingInProgress ? 'Sharing...' : 'Share Profile'}
						>
							{sharingInProgress ? '⏳' : '🔗'}
						</button>
						<button
							onclick={(e) => handleEdit(e, profile)}
							class="p-1 text-sm text-blue-600 hover:text-blue-700"
							title="Edit Profile"
						>
							✏️
						</button>
						<button
							onclick={(e) => handleDelete(e, profile.id)}
							class="p-1 text-sm text-red-600 hover:text-red-700"
							title="Delete Profile"
						>
							🗑️
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
