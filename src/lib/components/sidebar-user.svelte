<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { signOut } from '$lib/auth-client';
	import { hashEmail } from '$lib/email-hash';

	type User = {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	};

	const { user } = $props<{ user?: User | null }>();

	let avatarUrl = $state<string | null>(null);

	const initial = $derived(
		(user?.name?.trim()?.[0] ?? user?.email?.trim()?.[0] ?? '?').toUpperCase()
	);

	$effect(async () => {
		const email = user?.email?.trim() ?? '';
		const img = user?.image?.trim() ?? '';

		// Prefer provided image, else use hashed email avatar, else fallback
		if (img) {
			avatarUrl = img;
			return;
		}

		avatarUrl = email ? await hashEmail(email) : null;
	});

	const handleLogout = async () => {
		await signOut();
		goto('/sign-in');
	};
</script>

<div class="w-full rounded-lg border bg-background/50 p-3">
	<div class="flex items-center gap-3">
		<Avatar.Root class="h-9 w-9">
			{#if avatarUrl}
				<Avatar.Image src={avatarUrl} alt={user?.name ?? 'User'} />
			{/if}
			<Avatar.Fallback>{initial}</Avatar.Fallback>
		</Avatar.Root>

		<div class="min-w-0 flex-1">
			<div class="truncate text-sm font-medium">{user?.name ?? 'User'}</div>
			<div class="truncate text-xs text-muted-foreground">{user?.email ?? ''}</div>
		</div>

		<Button size="sm" variant="outline" onclick={handleLogout}>Sign out</Button>
	</div>
</div>
