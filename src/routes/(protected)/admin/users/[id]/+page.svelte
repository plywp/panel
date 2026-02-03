<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { navigating } from '$app/stores';
	import {
		ArrowLeft,
		Ban,
		KeyRound,
		LogOut,
		RefreshCw,
		Save,
		Shield,
		Trash2,
		User,
		UserCheck,
		UserCog,
		UserX
	} from 'lucide-svelte';

	import { client } from '$lib/auth-client';

	import LanguageSwitcher from '$lib/components/lang-switcher.svelte';

	export let data: {
		user: any | null;
		error: string | null;
	};

	type SaveState = { kind: 'idle' | 'saving' | 'ok' | 'error'; message?: string };

	let state: SaveState = { kind: 'idle' };

	$: user = data.user;

	let name = '';
	let image = '';
	let lang = '';
	let role = user?.role ?? 'user';

	let banEnabled = false;
	let banReason = '';
	let banExpiresIn = '';
	let newPassword = '';

	let sessions: Array<any> = [];
	let sessionsLoading = false;

	$: if (user) {
		name = user.name ?? '';
		image = user.image ?? '';
		lang = user.lang ?? '';
		role = user.role ?? 'user';

		banEnabled = Boolean(user.banned);
		banReason = user.banReason ?? '';
		banExpiresIn = '';
	}

	function setMsg(kind: SaveState['kind'], message?: string) {
		state = { kind, message };
		if (kind === 'ok') setTimeout(() => (state = { kind: 'idle' }), 1500);
	}

	async function saveProfile() {
		if (!user) return;
		setMsg('saving', 'Saving…');

		const { error } = await client.admin.updateUser({
			userId: user.id,
			data: { name, image, lang }
		});

		if (error) return setMsg('error', error.message ?? 'Failed to update user');
		setMsg('ok', 'Saved');
	}

	async function saveRole() {
		if (!user) return;
		setMsg('saving', 'Updating role…');

		const { error } = await client.admin.setRole({
			userId: user.id,
			role
		});

		if (error) return setMsg('error', error.message ?? 'Failed to set role');
		setMsg('ok', 'Role updated');
	}

	async function applyBan() {
		if (!user) return;
		setMsg('saving', 'Applying ban…');

		const expires = banExpiresIn.trim() ? Number(banExpiresIn.trim()) : undefined;
		if (expires !== undefined && (!Number.isFinite(expires) || expires <= 0)) {
			return setMsg('error', 'banExpiresIn must be a positive number of seconds');
		}

		const { error } = await client.admin.banUser({
			userId: user.id,
			banReason: banReason?.trim() || undefined,
			banExpiresIn: expires
		});

		if (error) return setMsg('error', error.message ?? 'Failed to ban user');
		setMsg('ok', 'User banned');
	}

	async function removeBan() {
		if (!user) return;
		setMsg('saving', 'Removing ban…');

		const { error } = await client.admin.unbanUser({ userId: user.id });

		if (error) return setMsg('error', error.message ?? 'Failed to unban user');
		setMsg('ok', 'User unbanned');
	}

	async function setPassword() {
		if (!user) return;
		if (newPassword.trim().length < 8) return setMsg('error', 'Password too short (min 8 chars)');
		setMsg('saving', 'Setting password…');

		const { error } = await client.admin.setUserPassword({
			userId: user.id,
			newPassword
		});

		if (error) return setMsg('error', error.message ?? 'Failed to set password');
		newPassword = '';
		setMsg('ok', 'Password updated');
	}

	async function loadSessions() {
		if (!user) return;
		sessionsLoading = true;
		try {
			const { data: s, error } = await client.admin.listUserSessions({ userId: user.id });
			if (error) return setMsg('error', error.message ?? 'Failed to load sessions');
			sessions = Array.isArray(s) ? s : [];
		} finally {
			sessionsLoading = false;
		}
	}

	async function revokeSession(sessionToken: string) {
		setMsg('saving', 'Revoking session…');
		const { error } = await client.admin.revokeUserSession({ sessionToken });
		if (error) return setMsg('error', error.message ?? 'Failed to revoke session');
		setMsg('ok', 'Session revoked');
		await loadSessions();
	}

	async function impersonate() {
		if (!user) return;
		setMsg('saving', 'Starting impersonation…');
		const { error } = await client.admin.impersonateUser({ userId: user.id });
		if (error) return setMsg('error', error.message ?? 'Failed to impersonate');
		setMsg('ok', 'Impersonating');
	}

	async function stopImpersonating() {
		setMsg('saving', 'Stopping impersonation…');
		const { error } = await client.admin.stopImpersonating();
		if (error) return setMsg('error', error.message ?? 'Failed to stop impersonating');
		setMsg('ok', 'Stopped');
	}

	async function removeUser() {
		if (!user) return;
		const ok = confirm('Hard delete this user? This cannot be undone.');
		if (!ok) return;

		setMsg('saving', 'Deleting user…');
		const { error } = await client.admin.removeUser({ userId: user.id });
		if (error) return setMsg('error', error.message ?? 'Failed to delete user');
		setMsg('ok', 'User deleted');
	}
</script>

<Card.Root>
	<Card.Header class="space-y-2">
		<a class="flex items-center gap-1 text-sm hover:underline" href="/admin/users">
			<ArrowLeft class="size-4" />
			Back
		</a>

		{#if $navigating}
			<div class="h-6 w-72 animate-pulse rounded bg-muted"></div>
		{:else if !user}
			<Card.Title>User not found</Card.Title>
		{:else}
			<Card.Title class="flex items-center gap-2 text-lg">
				<User class="size-4" />
				Manage user: {user.name ?? user.email ?? user.id} — {user.role}
			</Card.Title>
			{#if state.kind !== 'idle'}
				<div class="text-sm text-muted-foreground">{state.kind}: {state.message}</div>
			{/if}
		{/if}
	</Card.Header>

	<Card.Content>
		{#if user}
			<div class="space-y-6">
				<section class="space-y-4">
					<div class="text-sm font-semibold text-muted-foreground">Profile</div>

					<div class="grid gap-2">
						<Label for="name">Name</Label>
						<Input id="name" bind:value={name} />
					</div>

					<div class="grid gap-2">
						<Label for="image">Image URL</Label>
						<Input id="image" bind:value={image} />
					</div>

					<div class="grid gap-2">
						<Label for="lang">Language</Label>
						<LanguageSwitcher {lang} onChange={(value) => (lang = value)} />
					</div>

					<div class="grid gap-2">
						<Label for="email">Email</Label>
						<Input id="email" value={user.email ?? ''} disabled />
					</div>

					<div class="grid gap-2">
						<Label for="joined">Joined</Label>
						<Input id="joined" value={new Date(user.createdAt).toLocaleString()} disabled />
					</div>

					<Button class="w-full" disabled={state.kind === 'saving'} onclick={saveProfile}>
						<Save class="size-4" />
						Save profile
					</Button>
				</section>

				<Separator />

				<section class="space-y-4">
					<div class="text-sm font-semibold text-muted-foreground">Role</div>

					<div class="grid gap-2">
						<Label>Role</Label>
						<Select.Root
							type="single"
							name="role"
							value={role}
							onValueChange={(value) => (role = value)}
						>
							<Select.Trigger class="w-full">
								{role || 'Select a role'}
							</Select.Trigger>

							<Select.Portal>
								<Select.Content>
									<Select.Item value="user">user</Select.Item>
									<Select.Item value="admin">admin</Select.Item>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					</div>

					<Button class="w-full" disabled={state.kind === 'saving'} onclick={saveRole}>
						<Shield class="size-4" />
						Update role
					</Button>
				</section>

				<Separator />

				<section class="space-y-4">
					<div class="text-sm font-semibold text-muted-foreground">Ban</div>

					<div class="flex items-center justify-between rounded-md border p-3">
						<div class="space-y-0.5">
							<div class="text-sm font-medium">Banned</div>
							<div class="text-xs text-muted-foreground">
								{user.banned ? 'User cannot access the app' : 'User is active'}
							</div>
						</div>
						<Switch checked={banEnabled} onCheckedChange={(v) => (banEnabled = v)} />
					</div>

					{#if user.banned}
						<div class="grid gap-2">
							<Label>Ban reason</Label>
							<Input value={user.banReason ?? ''} disabled />
						</div>

						<div class="grid gap-2">
							<Label>Ban expires</Label>
							<Input
								value={user.banExpires ? new Date(user.banExpires).toLocaleString() : 'Never'}
								disabled
							/>
						</div>

						<Button
							variant="destructive"
							class="w-full"
							disabled={state.kind === 'saving'}
							onclick={removeBan}
						>
							<UserCheck class="size-4" />
							Unban user
						</Button>
					{:else}
						<div class="grid gap-2">
							<Label for="banReason">Ban reason</Label>
							<Input id="banReason" bind:value={banReason} placeholder="Optional" />
						</div>

						<div class="grid gap-2">
							<Label for="banExpiresIn">Ban expires in (seconds)</Label>
							<Input
								id="banExpiresIn"
								bind:value={banExpiresIn}
								placeholder="Optional (blank = never)"
							/>
						</div>

						<Button
							variant="destructive"
							class="w-full"
							disabled={state.kind === 'saving'}
							onclick={applyBan}
						>
							<Ban class="size-4" />
							Ban user
						</Button>
					{/if}
				</section>

				<Separator />

				<section class="space-y-4">
					<div class="text-sm font-semibold text-muted-foreground">Password</div>

					<div class="grid gap-2">
						<Label for="newPassword">New password</Label>
						<Input id="newPassword" type="password" bind:value={newPassword} />
					</div>

					<Button class="w-full" disabled={state.kind === 'saving'} onclick={setPassword}>
						<KeyRound class="size-4" />
						Set password
					</Button>
				</section>

				<Separator />

				<section class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="text-sm font-semibold text-muted-foreground">Sessions</div>
						<Button variant="outline" size="sm" disabled={sessionsLoading} onclick={loadSessions}>
							<RefreshCw class="size-4" />
							{sessionsLoading ? 'Loading…' : 'Refresh'}
						</Button>
					</div>

					{#if sessions.length === 0}
						<div class="text-sm text-muted-foreground">No sessions loaded.</div>
					{:else}
						<div class="space-y-2">
							{#each sessions as s (s.sessionToken ?? s.id)}
								<div class="flex items-center justify-between gap-3 rounded-md border p-3">
									<div class="min-w-0">
										<div class="truncate text-sm font-medium">{s.userAgent ?? 'Session'}</div>
										<div class="text-xs text-muted-foreground">
											Expires: {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : '—'}
										</div>
									</div>
									<Button
										variant="outline"
										size="sm"
										disabled={state.kind === 'saving'}
										onclick={() => revokeSession(s.sessionToken)}
									>
										<LogOut class="size-4" />
										Revoke
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<Separator />

				<section class="space-y-3">
					<div class="text-sm font-semibold text-muted-foreground">Support tools</div>
					<div class="flex flex-wrap gap-2">
						<Button variant="outline" disabled={state.kind === 'saving'} onclick={impersonate}>
							<UserCog class="size-4" />
							Impersonate
						</Button>
						<Button
							variant="outline"
							disabled={state.kind === 'saving'}
							onclick={stopImpersonating}
						>
							<UserX class="size-4" />
							Stop impersonating
						</Button>
						<Button variant="destructive" disabled={state.kind === 'saving'} onclick={removeUser}>
							<Trash2 class="size-4" />
							Delete user
						</Button>
					</div>
				</section>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
