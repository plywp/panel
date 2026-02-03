<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { client } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Bell } from 'lucide-svelte';

	type Organization = {
		id: string;
		name: string;
		slug: string;
	};

	type Invitation = {
		id: string;
		role: string;
		status?: string;
		organizationName?: string;
	};

	let organizations: Organization[] = [];
	let activeOrganizationId: string | null = null;
	let loading = false;
	let switching = false;
	let inviteDialogOpen = false;
	let inviteLoading = false;
	let userInvites: Invitation[] = [];
	$: activeOrganizationName = organizations.find((org) => org.id === activeOrganizationId)?.name;
	$: inviteCount = userInvites.length;

	async function loadOrganizations() {
		loading = true;
		try {
			const [
				{ data: listData, error: listError },
				{ data: activeData, error: activeError },
				{ data: inviteData, error: inviteError }
			] = await Promise.all([
				client.organization.list(),
				client.organization.getFullOrganization(),
				client.organization.listUserInvitations()
			]);

			if (listError) {
				throw new Error(typeof listError === 'string' ? listError : listError.message);
			}

			if (activeError) {
				throw new Error(typeof activeError === 'string' ? activeError : activeError.message);
			}

			if (inviteError) {
				throw new Error(typeof inviteError === 'string' ? inviteError : inviteError.message);
			}

			organizations = Array.isArray(listData) ? listData : listData ? [listData] : [];
			activeOrganizationId = activeData?.id ?? null;
			userInvites = Array.isArray(inviteData)
				? inviteData.filter((invite) => invite.status === 'pending')
				: [];
		} catch (err) {
			organizations = [];
			activeOrganizationId = null;
			userInvites = [];
			const message = err instanceof Error ? err.message : 'Failed to load organizations';
			toast.error(message);
		} finally {
			loading = false;
		}
	}

	async function setActiveOrganization(organizationId: string) {
		if (!organizationId || organizationId === activeOrganizationId) return;
		switching = true;
		try {
			const { error } = await client.organization.setActive({ organizationId });
			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}
			activeOrganizationId = organizationId;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to switch organization';
			toast.error(message);
		} finally {
			switching = false;
		}
	}

	async function acceptInvite(inviteId: string) {
		inviteLoading = true;
		try {
			const { error } = await client.organization.acceptInvitation({ invitationId: inviteId });
			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}
			userInvites = userInvites.filter((invite) => invite.id !== inviteId);
			await loadOrganizations();
			if (userInvites.length === 0) inviteDialogOpen = false;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to accept invitation';
			toast.error(message);
		} finally {
			inviteLoading = false;
		}
	}

	async function rejectInvite(inviteId: string) {
		inviteLoading = true;
		try {
			const { error } = await client.organization.rejectInvitation({ invitationId: inviteId });
			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}
			userInvites = userInvites.filter((invite) => invite.id !== inviteId);
			await loadOrganizations();
			if (userInvites.length === 0) inviteDialogOpen = false;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to decline invitation';
			toast.error(message);
		} finally {
			inviteLoading = false;
		}
	}

	onMount(() => {
		loadOrganizations();
	});
</script>

<div class="">
	<div class="">
		<div class="flex items-start justify-between gap-2">
			<div class="">
				<select
					class="h-9 w-full rounded-md px-2 text-sm"
					disabled={loading || switching || organizations.length === 0}
					on:change={(event) => setActiveOrganization(event.currentTarget.value)}
					value={activeOrganizationId ?? ''}
				>
					<option value="" disabled>
						{loading ? 'Loading...' : organizations.length === 0 ? 'No organizations' : 'Select'}
					</option>
					{#each organizations as org (org.id)}
						<option value={org.id}>{org.name}</option>
					{/each}
				</select>
			</div>
			<Dialog.Root bind:open={inviteDialogOpen}>
				<Dialog.Trigger>
					<Button variant="ghost" size="icon-sm" class="relative">
						<Bell class="h-4 w-4" />
						{#if inviteCount > 0}
							<span
								class="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full border bg-background px-1 text-[10px] font-semibold text-foreground"
							>
								{inviteCount}
							</span>
						{/if}
					</Button>
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-sm">
					<Dialog.Header>
						<Dialog.Title>Invitations</Dialog.Title>
						<Dialog.Description>Invites sent to your account.</Dialog.Description>
					</Dialog.Header>

					<div class="space-y-2 py-2">
						{#if inviteCount === 0}
							<div class="rounded border p-3 text-xs">No invitations right now.</div>
						{:else}
							{#each userInvites as invite (invite.id)}
								<div class="rounded-md border p-3 text-sm">
									<div class="font-medium">{invite.organizationName ?? 'Organization'}</div>
									<div class="text-xs">{invite.role}</div>
									<div class="mt-2 flex items-center gap-2">
										<Button
											size="sm"
											disabled={inviteLoading}
											onclick={() => acceptInvite(invite.id)}
										>
											Accept
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={inviteLoading}
											onclick={() => rejectInvite(invite.id)}
										>
											Decline
										</Button>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</Dialog.Content>
			</Dialog.Root>
		</div>
	</div>
</div>
