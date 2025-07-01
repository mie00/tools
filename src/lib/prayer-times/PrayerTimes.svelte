<script lang="ts">
	import { onMount } from 'svelte';
	import type { Profile, PrayerTimes, City } from './types';
	import { calculateTimesForProfile, parseCsv } from './utils';
	import ProfileList from './ProfileList.svelte';
	import CreateProfileForm from './CreateProfileForm.svelte';
	import EditProfileForm from './EditProfileForm.svelte';
	import PrayerTimesDisplay from './PrayerTimesDisplay.svelte';

	let profiles: Profile[] = [];
	let showCreateForm = false;
	let editingProfile: Profile | null = null;
	let cities: City[] = [];
	let loadingCities = true;
	let profilePrayerTimes = new Map<string, PrayerTimes>();

	$: activeProfile = profiles.find(p => p.isActive) || null;
	$: activePrayerTimes = activeProfile ? profilePrayerTimes.get(activeProfile.id) : null;

	onMount(async () => {
		loadProfiles();
		await loadCities();
		calculateAllPrayerTimes();
	});

	async function loadCities() {
		try {
			const response = await fetch('/world_cities_5000.csv');
			const csvText = await response.text();
			cities = parseCsv(csvText);
		} catch (error) {
			console.error('Error loading cities:', error);
		} finally {
			loadingCities = false;
		}
	}

	function loadProfiles() {
		try {
			const stored = localStorage.getItem('prayerProfiles');
			if (stored) {
				profiles = JSON.parse(stored);
			}
		} catch (error) {
			console.error('Error loading profiles:', error);
		}
	}

	function saveProfiles() {
		try {
			localStorage.setItem('prayerProfiles', JSON.stringify(profiles));
		} catch (error) {
			console.error('Error saving profiles:', error);
		}
	}

	function calculateAllPrayerTimes() {
		profilePrayerTimes.clear();
		for (const profile of profiles) {
			try {
				const times = calculateTimesForProfile(profile);
				profilePrayerTimes.set(profile.id, times);
			} catch (error) {
				console.error(`Error calculating times for profile ${profile.name}:`, error);
			}
		}
		profilePrayerTimes = profilePrayerTimes; // Trigger reactivity
	}

	function handleCreateProfile(event: CustomEvent) {
		const newProfile = event.detail;
		profiles = [...profiles, newProfile];
		saveProfiles();
		calculateAllPrayerTimes();
		showCreateForm = false;
	}

	function handleActivateProfile(event: CustomEvent<Profile>) {
		const profile = event.detail;
		profiles = profiles.map(p => ({ ...p, isActive: p.id === profile.id }));
		saveProfiles();
	}

	function handleEditProfile(event: CustomEvent<Profile>) {
		editingProfile = event.detail;
	}

	function handleSaveEditedProfile(event: CustomEvent<Profile>) {
		const updatedProfile = event.detail;
		profiles = profiles.map(p => p.id === updatedProfile.id ? updatedProfile : p);
		saveProfiles();
		calculateAllPrayerTimes();
		editingProfile = null;
	}

	function handleDeleteProfile(event: CustomEvent<string>) {
		const profileId = event.detail;
		const wasActive = profiles.find(p => p.id === profileId)?.isActive;
		
		profiles = profiles.filter(p => p.id !== profileId);
		
		// If we deleted the active profile, make the first remaining profile active
		if (wasActive && profiles.length > 0) {
			profiles[0].isActive = true;
		}
		
		saveProfiles();
		calculateAllPrayerTimes();
	}

	function handleShowCreateForm() {
		showCreateForm = true;
	}

	function handleCancelCreate() {
		showCreateForm = false;
	}

	function handleCancelEdit() {
		editingProfile = null;
	}

	$: hasProfiles = profiles.length > 0;
	$: shouldShowMainView = hasProfiles && !showCreateForm && !editingProfile;
</script>

<div class="space-y-6">
	{#if editingProfile}
		<EditProfileForm
			profile={editingProfile}
			on:save={handleSaveEditedProfile}
			on:cancel={handleCancelEdit}
		/>
	{:else if showCreateForm || !hasProfiles}
		<CreateProfileForm
			{cities}
			{loadingCities}
			hasExistingProfiles={hasProfiles}
			on:create={handleCreateProfile}
			on:cancel={handleCancelCreate}
		/>
	{:else if shouldShowMainView}
		<!-- Profile List -->
		<ProfileList
			{profiles}
			{profilePrayerTimes}
			on:activate={handleActivateProfile}
			on:edit={handleEditProfile}
			on:delete={handleDeleteProfile}
			on:create-new={handleShowCreateForm}
		/>

		<!-- Prayer Times Display for Active Profile -->
		{#if activeProfile && activePrayerTimes}
			<PrayerTimesDisplay
				{activeProfile}
				prayerTimes={activePrayerTimes}
			/>
		{/if}
	{/if}
</div> 