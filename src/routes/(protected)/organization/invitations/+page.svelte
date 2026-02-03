<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Separator from '$lib/components/ui/separator';
	import { Mail, Send, Inbox, RefreshCw } from 'lucide-svelte';
	import { client } from '$lib/auth-client';

	type Invitation = {
		id: string;
		email: string;
		role: string;
		status: string;
		organizationId?: string;
		organizationName?: string;
		expiresAt?: string | Date;
		createdAt?: string | Date;
	};

	let inviteEmail = '';
	let inviteRole = 'member';
	let sending = false;
	let activeMemberRole: string | null = null;
	let canInvite = false;

	let orgInvites: Invitation[] = [];
	let userInvites: Invitation[] = [];
	let loading = false;

	const inviteRoleOptions = () => {
		if (activeMemberRole === 'owner') return ['member', 'admin', 'owner'];
		if (activeMemberRole === 'admin') return ['member', 'admin'];
		return ['member'];
	};

	async function loadInvites() {
		loading = true;
		try {
			const [
				{ data: orgData, error: orgError },
				{ data: userData, error: userError },
				{ data: roleData, error: roleError }
			] = await Promise.all([
				client.organization.listInvitations(),
				client.organization.listUserInvitations(),
				client.organization.getActiveMemberRole()
			]);

			if (orgError) {
				throw new Error(typeof orgError === 'string' ? orgError : orgError.message);
			}
			if (userError) {
				throw new Error(typeof userError === 'string' ? userError : userError.message);
			}
			if (roleError) {
				throw new Error(typeof roleError === 'string' ? roleError : roleError.message);
			}

			orgInvites = Array.isArray(orgData) ? orgData : [];
			userInvites = Array.isArray(userData)
				? userData.filter((invite) => invite.status === 'pending')
				: [];
			activeMemberRole = roleData?.role ?? roleData ?? null;
			canInvite = activeMemberRole === 'owner' || activeMemberRole === 'admin';
		} catch (err) {
			orgInvites = [];
			userInvites = [];
			activeMemberRole = null;
			canInvite = false;
			const message = err instanceof Error ? err.message : 'Failed to load invitations';
			toast.error(message);
		} finally {
			loading = false;
		}
	}

	async function sendInvite() {
		if (!inviteEmail.trim()) {
			toast.error('Email is required.');
			return;
		}
		if (!canInvite) {
			toast.error('You do not have permission to invite members.');
			return;
		}

		sending = true;
		try {
			const { error } = await client.organization.inviteMember({
				email: inviteEmail.trim(),
				role: inviteRole
			});

			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}

			toast.success('Invitation sent.');
			inviteEmail = '';
			inviteRole = 'member';
			await loadInvites();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to send invitation';
			toast.error(message);
		} finally {
			sending = false;
		}
	}

	async function acceptInvite(inviteId: string) {
		try {
			const { error } = await client.organization.acceptInvitation({ invitationId: inviteId });
			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}
			toast.success('Invitation accepted.');
			await loadInvites();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to accept invitation';
			toast.error(message);
		}
	}

	async function rejectInvite(inviteId: string) {
		try {
			const { error } = await client.organization.rejectInvitation({ invitationId: inviteId });
			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}
			toast.success('Invitation rejected.');
			await loadInvites();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to reject invitation';
			toast.error(message);
		}
	}

	async function cancelInvite(inviteId: string) {
		try {
			const { error } = await client.organization.cancelInvitation({ invitationId: inviteId });
			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}
			toast.success('Invitation canceled.');
			await loadInvites();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to cancel invitation';
			toast.error(message);
		}
	}

	onMount(() => {
		loadInvites();
	});
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Invitations</h1>
			<p class="text-sm text-muted-foreground">Invite teammates or accept incoming invites.</p>
		</div>
		<Button variant="outline" onclick={loadInvites} disabled={loading}>
			<RefreshCw class="h-4 w-4" />
			Refresh
		</Button>
	</div>

	<div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
		<Card.Root>
			<Card.Header class="space-y-1">
				<Card.Title class="flex items-center gap-2">
					<Mail class="h-4 w-4" />
					Send invite
				</Card.Title>
				<Card.Description>Invite someone to your active organization.</Card.Description>
			</Card.Header>

			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Input placeholder="Email address" bind:value={inviteEmail} />
					<select
						class="h-9 w-full rounded-md border bg-background px-2 text-sm"
						bind:value={inviteRole}
						disabled={!canInvite}
					>
						{#each inviteRoleOptions() as option}
							<option value={option}>{option[0].toUpperCase() + option.slice(1)}</option>
						{/each}
					</select>
					<Button class="w-full sm:w-auto" onclick={sendInvite} disabled={sending}>
						<Send class="h-4 w-4" />
						{sending ? 'Sending...' : 'Send invite'}
					</Button>
				</div>

				<Separator.Root />

				<div class="space-y-2">
					<div class="text-sm font-medium">Pending invites</div>
					{#if loading}
						<div class="h-4 w-48 rounded bg-muted"></div>
					{:else if orgInvites.length === 0}
						<div class="rounded border p-3 text-xs text-muted-foreground">
							No pending invitations.
						</div>
					{:else}
						<div class="space-y-2">
							{#each orgInvites as invite (invite.id)}
								<div
									class="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
								>
									<div>
										<div class="font-medium">{invite.email}</div>
										<div class="text-xs text-muted-foreground">{invite.role}</div>
									</div>
									<Button variant="ghost" size="sm" onclick={() => cancelInvite(invite.id)}>
										Cancel
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="space-y-1">
				<Card.Title class="flex items-center gap-2">
					<Inbox class="h-4 w-4" />
					Your invitations
				</Card.Title>
				<Card.Description>Accept or decline invites sent to you.</Card.Description>
			</Card.Header>

			<Card.Content class="space-y-4">
				{#if loading}
					<div class="h-4 w-48 rounded bg-muted"></div>
				{:else if userInvites.length === 0}
					<div class="rounded border p-3 text-xs text-muted-foreground">
						No invitations right now.
					</div>
				{:else}
					<div class="space-y-2">
						{#each userInvites as invite (invite.id)}
							<div class="rounded-md border p-3 text-sm">
								<div class="font-medium">{invite.organizationName ?? 'Organization'}</div>
								<div class="text-xs text-muted-foreground">{invite.role}</div>
								<div class="mt-2 flex items-center gap-2">
									<Button size="sm" onclick={() => acceptInvite(invite.id)}>Accept</Button>
									<Button variant="outline" size="sm" onclick={() => rejectInvite(invite.id)}>
										Decline
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
