<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Separator from '$lib/components/ui/separator';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Building2, Users, RefreshCw, Plus, Mail } from 'lucide-svelte';
	import { client } from '$lib/auth-client';
	import { easeStandard, prefersReducedMotion as prefersReducedMotionSetting } from '$lib/motion';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';

	type Organization = {
		id: string;
		name: string;
		slug: string;
		logo?: string | null;
		metadata?: Record<string, unknown> | string | null;
		createdAt?: string | Date;
	};

	type Member = {
		id: string;
		role: string;
		user: {
			id: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	};

	type Invitation = {
		id: string;
		email: string;
		role: string;
		status: string;
		createdAt?: string | Date;
	};

	type ActiveOrganization = Organization & {
		members?: Member[];
		invitations?: Invitation[];
	};

	let organizations: Organization[] = [];
	let activeOrganization: ActiveOrganization | null = null;

	let listLoading = false;
	let activeLoading = false;
	let creating = false;
	let switchingId: string | null = null;
	let createOpen = false;
	let inviteOpen = false;
	let inviteEmail = '';
	let inviteRole = 'member';
	let sendingInvite = false;
	let activeMemberRole: string | null = null;
	let transferOpen = false;
	let transferTarget: Member | null = null;
	let transferring = false;
	let canManageKeys = false;

	const prefersReducedMotion = prefersReducedMotionSetting();

	const inviteRoleOptions = () => {
		if (activeMemberRole === 'owner') return ['member', 'admin', 'owner'];
		if (activeMemberRole === 'admin') return ['member', 'admin'];
		return ['member'];
	};

	let name = '';
	let slug = '';
	let slugTouched = false;

	const slugify = (value: string) =>
		value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)+/g, '');

	$: if (!slugTouched) slug = slugify(name);

	async function loadOrganizations() {
		listLoading = true;
		try {
			const { data, error } = await client.organization.list();
			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}
			organizations = Array.isArray(data) ? data : data ? [data] : [];
		} catch (err) {
			organizations = [];
			const message = err instanceof Error ? err.message : 'Failed to load organizations';
			toast.error(message);
		} finally {
			listLoading = false;
		}
	}

	async function loadActiveOrganization() {
		activeLoading = true;
		try {
			const [{ data: orgData, error: orgError }, { data: roleData, error: roleError }] =
				await Promise.all([
					client.organization.getFullOrganization(),
					client.organization.getActiveMemberRole()
				]);

			if (orgError) {
				throw new Error(typeof orgError === 'string' ? orgError : orgError.message);
			}
			if (roleError) {
				throw new Error(typeof roleError === 'string' ? roleError : roleError.message);
			}

			activeOrganization = orgData ?? null;
			activeMemberRole = roleData?.role ?? roleData ?? null;
			canManageKeys = activeMemberRole === 'owner' || activeMemberRole === 'admin';
		} catch (err) {
			activeOrganization = null;
			activeMemberRole = null;
			canManageKeys = false;
			const message = err instanceof Error ? err.message : 'Failed to load active organization';
			toast.error(message);
		} finally {
			activeLoading = false;
		}
	}

	async function refreshAll() {
		await Promise.all([loadOrganizations(), loadActiveOrganization()]);
	}

	async function createOrganization() {
		if (!name.trim() || !slug.trim()) {
			toast.error('Name and slug are required.');
			return;
		}

		creating = true;
		try {
			const { data, error } = await client.organization.create({
				name: name.trim(),
				slug: slug.trim(),
				keepCurrentActiveOrganization: false
			});

			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}

			toast.success(`Created ${data?.name ?? 'organization'}.`);
			name = '';
			slug = '';
			slugTouched = false;
			createOpen = false;
			await refreshAll();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create organization';
			toast.error(message);
		} finally {
			creating = false;
		}
	}

	async function setActiveOrganization(org: Organization) {
		switchingId = org.id;
		try {
			const { error } = await client.organization.setActive({ organizationId: org.id });
			if (error) {
				throw new Error(typeof error === 'string' ? error : error.message);
			}
			await loadActiveOrganization();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to switch organization';
			toast.error(message);
		} finally {
			switchingId = null;
		}
	}

	async function sendInvite() {
		if (!inviteEmail.trim()) {
			toast.error('Email is required.');
			return;
		}

		if (activeMemberRole !== 'owner' && activeMemberRole !== 'admin') {
			toast.error('You do not have permission to invite members.');
			return;
		}

		sendingInvite = true;
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
			inviteOpen = false;
			await loadActiveOrganization();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to send invitation';
			toast.error(message);
		} finally {
			sendingInvite = false;
		}
	}

	async function transferOwnership() {
		if (!transferTarget || activeMemberRole !== 'owner') return;
		transferring = true;
		try {
			const { error: promoteError } = await client.organization.updateMemberRole({
				memberId: transferTarget.id,
				role: 'owner'
			});
			if (promoteError) {
				throw new Error(typeof promoteError === 'string' ? promoteError : promoteError.message);
			}

			const currentOwner = activeOrganization?.members?.find((member) => member.role === 'owner');
			if (currentOwner && currentOwner.id !== transferTarget.id) {
				const { error: demoteError } = await client.organization.updateMemberRole({
					memberId: currentOwner.id,
					role: 'admin'
				});
				if (demoteError) {
					throw new Error(typeof demoteError === 'string' ? demoteError : demoteError.message);
				}
			}

			toast.success('Ownership transferred.');
			transferOpen = false;
			transferTarget = null;
			await loadActiveOrganization();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to transfer ownership';
			toast.error(message);
		} finally {
			transferring = false;
		}
	}

	onMount(() => {
		refreshAll();
	});
</script>

<Card.Root>
	<Card.Header>
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				<h1 class="flex items-center gap-2">
					<Building2 class="h-4 w-4" />
					Organization
				</h1>
				<p>Manage your organizations, members, and active context.</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Dialog.Root bind:open={createOpen}>
					<Dialog.Trigger>
						<Button class="motion-action">
							<Plus class="h-4 w-4" />
							Create organization
						</Button>
					</Dialog.Trigger>
					<Dialog.Content class="sm:max-w-md">
						<Dialog.Header>
							<Dialog.Title>Create organization</Dialog.Title>
							<Dialog.Description>Name your workspace and pick a unique slug.</Dialog.Description>
						</Dialog.Header>

						<div class="space-y-3 py-2">
							<Input placeholder="Organization name" bind:value={name} />
							<Input placeholder="slug" bind:value={slug} on:input={() => (slugTouched = true)} />
						</div>

						<Dialog.Footer>
							<Button class="motion-action" variant="outline" onclick={() => (createOpen = false)}>
								Cancel
							</Button>
							<Button class="motion-action" onclick={createOrganization} disabled={creating}>
								{creating ? 'Creating...' : 'Create'}
							</Button>
						</Dialog.Footer>
					</Dialog.Content>
				</Dialog.Root>

				<Dialog.Root bind:open={inviteOpen}>
					<Dialog.Trigger>
						<Button class="motion-action" variant="outline" disabled={!activeOrganization}>
							<Mail class="h-4 w-4" />
							Invite member
						</Button>
					</Dialog.Trigger>
					<Dialog.Content class="sm:max-w-md">
						<Dialog.Header>
							<Dialog.Title>Invite member</Dialog.Title>
							<Dialog.Description>Send an invitation to the active organization.</Dialog.Description
							>
						</Dialog.Header>

						<div class="space-y-3 py-2">
							<Input placeholder="Email address" bind:value={inviteEmail} />
							<select
								class="h-9 w-full rounded-md border bg-background px-2 text-sm"
								bind:value={inviteRole}
								disabled={activeMemberRole !== 'owner' && activeMemberRole !== 'admin'}
							>
								{#each inviteRoleOptions() as option}
									<option value={option}>{option[0].toUpperCase() + option.slice(1)}</option>
								{/each}
							</select>
						</div>

						<Dialog.Footer>
							<Button class="motion-action" variant="outline" onclick={() => (inviteOpen = false)}>
								Cancel
							</Button>
							<Button class="motion-action" onclick={sendInvite} disabled={sendingInvite}>
								{sendingInvite ? 'Sending...' : 'Send invite'}
							</Button>
						</Dialog.Footer>
					</Dialog.Content>
				</Dialog.Root>

				<Button
					class="motion-action"
					variant="outline"
					onclick={refreshAll}
					disabled={listLoading || activeLoading}
				>
					<RefreshCw class="h-4 w-4" />
					Refresh
				</Button>
			</div>
		</div>
	</Card.Header>

	<Card.Content class="space-y-6">
		<Dialog.Root bind:open={transferOpen}>
			<Dialog.Content class="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>Transfer ownership</Dialog.Title>
					<Dialog.Description>
						This will make {transferTarget?.user?.name ?? 'this member'} the new owner.
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Button
						class="motion-action"
						variant="outline"
						onclick={() => (transferOpen = false)}
						disabled={transferring}
					>
						Cancel
					</Button>
					<Button class="motion-action" onclick={transferOwnership} disabled={transferring}>
						{transferring ? 'Transferring...' : 'Confirm transfer'}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>

		<div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
			<Card.Root class="motion-card">
				<Card.Header class="space-y-1">
					<Card.Title class="flex items-center gap-2">
						<Building2 class="h-4 w-4" />
						Organizations
					</Card.Title>
					<Card.Description>Switch between orgs or set the active context.</Card.Description>
				</Card.Header>

				<Card.Content class="space-y-4">
					{#if listLoading}
						<div class="space-y-2">
							<div class="h-4 w-40 rounded bg-muted"></div>
							<div class="h-4 w-56 rounded bg-muted"></div>
							<div class="h-4 w-48 rounded bg-muted"></div>
						</div>
					{:else if organizations.length === 0}
						<div class="rounded border p-4 text-sm text-muted-foreground">
							No organizations yet. Create one to get started.
						</div>
					{:else}
						<div class="space-y-2">
							{#each organizations as org, index (org.id)}
								<div
									class="motion-item flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
									in:fly={{
										y: prefersReducedMotion ? 0 : 8,
										duration: prefersReducedMotion ? 0 : 180,
										delay: prefersReducedMotion ? 0 : index * 30,
										easing: easeStandard
									}}
									animate:flip={{ duration: prefersReducedMotion ? 0 : 150, easing: easeStandard }}
								>
									<div>
										<div class="font-medium">{org.name}</div>
										<div class="text-xs text-muted-foreground">@{org.slug}</div>
									</div>
									<div class="flex items-center gap-2">
										{#if activeOrganization?.id === org.id}
											<span class="text-xs font-semibold text-muted-foreground">Active</span>
										{:else}
											<Button
												class="motion-action"
												variant="outline"
												size="sm"
												disabled={switchingId === org.id}
												onclick={() => setActiveOrganization(org)}
											>
												{switchingId === org.id ? 'Switching...' : 'Set active'}
											</Button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="motion-card">
				<Card.Header class="space-y-1">
					<Card.Title class="flex items-center gap-2">
						<Users class="h-4 w-4" />
						Active organization
					</Card.Title>
					<Card.Description>Members and invitations for the active org.</Card.Description>
				</Card.Header>

				<Card.Content class="space-y-4">
					{#if activeLoading}
						<div class="space-y-2">
							<div class="h-4 w-40 rounded bg-muted"></div>
							<div class="h-4 w-56 rounded bg-muted"></div>
						</div>
					{:else if !activeOrganization}
						<div class="rounded border p-4 text-sm text-muted-foreground">
							No active organization selected.
						</div>
					{:else}
						<div class="space-y-2">
							<div class="text-base font-semibold">{activeOrganization.name}</div>
							<div class="text-xs text-muted-foreground">@{activeOrganization.slug}</div>
						</div>

						<Separator.Root />

						<div class="flex flex-wrap items-center justify-between gap-3">
							<div>
								<div class="text-sm font-medium">API keys</div>
								<div class="text-xs text-muted-foreground">
									Create and manage integration keys for this organization.
								</div>
							</div>
							<Button
								class="motion-action"
								size="sm"
								variant="outline"
								href={`/orgs/${activeOrganization.id}/settings/api-keys`}
								disabled={!canManageKeys}
							>
								Manage keys
							</Button>
						</div>

						<div class="space-y-3">
							<div class="text-sm font-medium">Members</div>
							{#if (activeOrganization.members ?? []).length === 0}
								<div class="rounded border p-3 text-xs text-muted-foreground">
									No members found.
								</div>
							{:else}
								<div class="space-y-2">
									{#each activeOrganization.members ?? [] as member, index (member.id)}
										<div
											class="motion-item flex items-center justify-between gap-3 rounded-md border p-2"
											in:fly={{
												y: prefersReducedMotion ? 0 : 8,
												duration: prefersReducedMotion ? 0 : 180,
												delay: prefersReducedMotion ? 0 : index * 30,
												easing: easeStandard
											}}
											animate:flip={{
												duration: prefersReducedMotion ? 0 : 150,
												easing: easeStandard
											}}
										>
											<div class="flex items-center gap-2">
												<Avatar.Root class="h-8 w-8">
													<Avatar.Image src={member.user?.image ?? ''} />
													<Avatar.Fallback>
														{member.user?.name?.[0] ?? member.user?.email?.[0] ?? '?'}
													</Avatar.Fallback>
												</Avatar.Root>
												<div>
													<div class="text-sm font-medium">{member.user?.name ?? 'Unknown'}</div>
													<div class="text-xs text-muted-foreground">{member.user?.email}</div>
												</div>
											</div>
											<div class="flex items-center gap-2">
												<div class="text-xs font-semibold text-muted-foreground uppercase">
													{member.role}
												</div>
												{#if activeMemberRole === 'owner' && member.role !== 'owner'}
													<Button
														class="motion-action"
														size="sm"
														variant="outline"
														onclick={() => {
															transferTarget = member;
															transferOpen = true;
														}}
													>
														Transfer
													</Button>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<Separator.Root />

						<div class="space-y-3">
							<div class="text-sm font-medium">Invitations</div>
							{#if (activeOrganization.invitations ?? []).length === 0}
								<div class="rounded border p-3 text-xs text-muted-foreground">
									No pending invitations.
								</div>
							{:else}
								<div class="space-y-2">
									{#each activeOrganization.invitations ?? [] as invite, index (invite.id)}
										<div
											class="motion-item flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
											in:fly={{
												y: prefersReducedMotion ? 0 : 8,
												duration: prefersReducedMotion ? 0 : 180,
												delay: prefersReducedMotion ? 0 : index * 30,
												easing: easeStandard
											}}
											animate:flip={{
												duration: prefersReducedMotion ? 0 : 150,
												easing: easeStandard
											}}
										>
											<div>
												<div class="font-medium">{invite.email}</div>
												<div class="text-xs text-muted-foreground">{invite.role}</div>
											</div>
											<div class="text-xs font-semibold text-muted-foreground uppercase">
												{invite.status}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</Card.Content>
</Card.Root>

<style>
	.motion-card,
	.motion-item,
	.motion-action {
		transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
		will-change: transform;
	}

	.motion-card:where(:hover, :focus-within),
	.motion-item:where(:hover, :focus-within),
	.motion-action:where(:hover, :focus-visible) {
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.motion-card,
		.motion-item,
		.motion-action {
			transition: none;
			will-change: auto;
		}

		.motion-card:where(:hover, :focus-within),
		.motion-item:where(:hover, :focus-within),
		.motion-action:where(:hover, :focus-visible) {
			transform: none;
		}
	}
</style>
