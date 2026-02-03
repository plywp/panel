<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Separator from '$lib/components/ui/separator';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		Check,
		Copy,
		KeyRound,
		Pencil,
		Plus,
		RefreshCw,
		RotateCw,
		ShieldCheck,
		Trash2
	} from 'lucide-svelte';

	type OrgSite = { id: string; name: string; domain: string };

	type ApiKeyPermissions = Record<string, string[]>;

	type OrgApiKey = {
		id: string;
		name: string | null;
		prefix: string | null;
		start: string | null;
		enabled: boolean;
		permissions: ApiKeyPermissions | null;
		metadata: {
			orgId: string;
			allowedSiteIds: string[];
			label?: string;
			createdByUserId: string;
		};
		expiresAt: string | null;
		rateLimitEnabled: boolean | null;
		rateLimitMax: number | null;
		rateLimitTimeWindow: number | null;
		remaining: number | null;
		refillAmount: number | null;
		refillInterval: number | null;
		lastRefillAt: string | null;
		createdAt: string;
		updatedAt: string;
	};

	export let data: {
		org: { id: string; name: string; slug: string };
		sites: OrgSite[];
		role: string;
		keys: OrgApiKey[];
	};

	const permissionMatrix: Array<{ resource: string; actions: string[] }> = [
		{ resource: 'sites', actions: ['read', 'health', 'credentials'] },
		{
			resource: 'plugins',
			actions: ['read', 'install', 'activate', 'deactivate', 'delete', 'update']
		},
		{ resource: 'themes', actions: ['read', 'install', 'activate', 'enable', 'delete', 'update'] },
		{
			resource: 'users',
			actions: ['read', 'create', 'update', 'roles', 'resetPassword', 'delete']
		},
		{
			resource: 'filemanager',
			actions: [
				'read',
				'write',
				'upload',
				'delete',
				'rename',
				'move',
				'copy',
				'archive',
				'extract',
				'download'
			]
		}
	];

	let keys: OrgApiKey[] = data.keys ?? [];

	let createOpen = false;
	let editOpen = false;
	let revokeOpen = false;
	let actionLoading = false;

	let activeKey: OrgApiKey | null = null;
	let revokeKey: OrgApiKey | null = null;

	let createName = '';
	let createAllSites = true;
	let createSiteIds: string[] = [];
	let createPermissions: ApiKeyPermissions = { sites: ['read'] };
	let createExpiresInDays = '';
	let createRemaining = '';
	let createRefillAmount = '';
	let createRefillInterval = '';
	let createRateLimitEnabled = false;
	let createRateLimitMax = '';
	let createRateLimitWindow = '';

	let editName = '';
	let editAllSites = true;
	let editSiteIds: string[] = [];
	let editPermissions: ApiKeyPermissions = {};
	let editExpiresInDays = '';
	let editRemaining = '';
	let editRefillAmount = '';
	let editRefillInterval = '';
	let editRateLimitEnabled = false;
	let editRateLimitMax = '';
	let editRateLimitWindow = '';
	let editEnabled = true;

	let createdKeyValue: string | null = null;
	let createdKeyOpen = false;
	let copied = false;

	const formatDate = (value: string | null | undefined) => {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleString();
	};

	const formatScope = (key: OrgApiKey) => {
		const allowed = key.metadata?.allowedSiteIds ?? [];
		if (allowed.length === 1 && allowed[0] === '*') return 'All sites';
		return `${allowed.length} sites`;
	};

	const formatPermissions = (permissions: ApiKeyPermissions | null) => {
		if (!permissions) return '—';
		const chunks = Object.entries(permissions)
			.map(([resource, actions]) => `${resource}:${actions.join(', ')}`)
			.sort();
		return chunks.length ? chunks.join(' · ') : '—';
	};

	const formatRateLimit = (key: OrgApiKey) => {
		if (key.rateLimitEnabled === false) return 'Off';
		if (!key.rateLimitMax || !key.rateLimitTimeWindow) return '—';
		const seconds = Math.round(key.rateLimitTimeWindow / 1000);
		return `${key.rateLimitMax} / ${seconds}s`;
	};

	const formatRemaining = (key: OrgApiKey) => {
		if (key.remaining === null || key.remaining === undefined) return '—';
		return String(key.remaining);
	};

	const formatStart = (key: OrgApiKey) => {
		const prefix = key.prefix ?? '';
		const start = key.start ?? '';
		if (!start) return '—';
		if (prefix && start.startsWith(prefix)) return start.slice(prefix.length);
		return start;
	};

	const resetCreateForm = () => {
		createName = '';
		createAllSites = true;
		createSiteIds = [];
		createPermissions = { sites: ['read'] };
		createExpiresInDays = '';
		createRemaining = '';
		createRefillAmount = '';
		createRefillInterval = '';
		createRateLimitEnabled = false;
		createRateLimitMax = '';
		createRateLimitWindow = '';
	};

	const setEditForm = (key: OrgApiKey) => {
		editName = key.name ?? key.metadata?.label ?? '';
		const allowed = key.metadata?.allowedSiteIds ?? [];
		editAllSites = allowed.length === 1 && allowed[0] === '*';
		editSiteIds = editAllSites ? [] : [...allowed];
		editPermissions = key.permissions ? { ...key.permissions } : {};
		if (key.expiresAt) {
			const diffMs = new Date(key.expiresAt).getTime() - Date.now();
			editExpiresInDays = diffMs > 0 ? String(Math.ceil(diffMs / 86400000)) : '';
		} else {
			editExpiresInDays = '';
		}
		editRemaining =
			key.remaining !== null && key.remaining !== undefined ? String(key.remaining) : '';
		editRefillAmount = key.refillAmount ? String(key.refillAmount) : '';
		editRefillInterval = key.refillInterval ? String(key.refillInterval) : '';
		editRateLimitEnabled = key.rateLimitEnabled ?? false;
		editRateLimitMax = key.rateLimitMax ? String(key.rateLimitMax) : '';
		editRateLimitWindow = key.rateLimitTimeWindow ? String(key.rateLimitTimeWindow) : '';
		editEnabled = key.enabled;
	};

	const togglePermission = (
		permissions: ApiKeyPermissions,
		resource: string,
		action: string
	): ApiKeyPermissions => {
		const current = new Set(permissions[resource] ?? []);
		if (current.has(action)) {
			current.delete(action);
		} else {
			current.add(action);
		}
		const next = { ...permissions };
		if (current.size) next[resource] = Array.from(current);
		else delete next[resource];
		return next;
	};

	const setAllPermissions = (
		permissions: ApiKeyPermissions,
		resource: string,
		actions: string[]
	): ApiKeyPermissions => {
		const next = { ...permissions };
		next[resource] = [...actions];
		return next;
	};

	const toggleSite = (siteId: string, selected: boolean, allSites: boolean) => {
		if (allSites) return [];
		if (selected) return Array.from(new Set([...createSiteIds, siteId]));
		return createSiteIds.filter((id) => id !== siteId);
	};

	const toggleSiteEdit = (siteId: string, selected: boolean, allSites: boolean) => {
		if (allSites) return [];
		if (selected) return Array.from(new Set([...editSiteIds, siteId]));
		return editSiteIds.filter((id) => id !== siteId);
	};

	const permissionEntries = (permissions: ApiKeyPermissions) => {
		const entries: string[] = [];
		for (const [resource, actions] of Object.entries(permissions)) {
			for (const action of actions) entries.push(`${resource}:${action}`);
		}
		return entries;
	};

	type EnhanceResult = {
		type?: 'success' | 'failure' | 'error' | 'redirect';
		data?: Record<string, any>;
		error?: any;
		status?: number;
	};

	const enhanceHandler = (onSuccess?: (data: Record<string, any>) => void) => {
		return () => {
			return async ({
				update,
				result
			}: {
				update: (options?: any) => Promise<void>;
				result: EnhanceResult;
			}) => {
				actionLoading = true;
				try {
					await update({ reset: false, invalidateAll: true });

					if (result?.type === 'success') {
						const payload = result?.data ?? {};
						if (payload.keys && Array.isArray(payload.keys)) {
							keys = payload.keys as OrgApiKey[];
						}
						if (onSuccess) onSuccess(payload);
					} else if (result?.type === 'failure') {
						const message = result?.data?.error ?? 'Action failed';
						toast.error(String(message));
					} else if (result?.type === 'error') {
						const message = result?.error?.message ?? 'An unexpected error occurred';
						toast.error(String(message));
					}
				} catch (error) {
					console.error('Form enhancement error:', error);
					toast.error('An unexpected error occurred');
				} finally {
					actionLoading = false;
				}
			};
		};
	};

	const handleCreateSuccess = (res: Record<string, any>) => {
		createdKeyValue = res.fullKey ?? null;
		createdKeyOpen = Boolean(createdKeyValue);
		toast.success('API key created.');
		createOpen = false;
		resetCreateForm();
	};

	const handleUpdateSuccess = () => {
		editOpen = false;
		activeKey = null;
		toast.success('API key updated.');
	};

	const handleDeleteSuccess = () => {
		revokeOpen = false;
		revokeKey = null;
		toast.success('API key revoked.');
	};

	const handleRotateSuccess = (res: Record<string, any>) => {
		createdKeyValue = res.fullKey ?? null;
		createdKeyOpen = Boolean(createdKeyValue);
		toast.success('API key rotated.');
	};

	async function copyKey() {
		if (!createdKeyValue) return;
		try {
			await navigator.clipboard.writeText(createdKeyValue);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			toast.error('Failed to copy');
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div>
				<h1 class="flex items-center gap-2">
					<KeyRound class="h-4 w-4" />
					API Keys
				</h1>
				<p>Manage integration keys for {data.org.name}.</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Dialog.Root bind:open={createOpen}>
					<Dialog.Trigger>
						<Button class="motion-action">
							<Plus class="h-4 w-4" />
							Create API key
						</Button>
					</Dialog.Trigger>
					<Dialog.Content class="max-h-[80vh] max-w-3xl overflow-y-auto">
						<Dialog.Header>
							<Dialog.Title>Create API key</Dialog.Title>
							<Dialog.Description>
								Generate a key with scoped permissions and site access.
							</Dialog.Description>
						</Dialog.Header>

						<form method="POST" action="?/create" use:enhance={enhanceHandler(handleCreateSuccess)}>
							<input type="hidden" name="scopeAll" value={createAllSites ? 'true' : 'false'} />
							{#each createAllSites ? [] : createSiteIds as siteId}
								<input type="hidden" name="allowedSiteIds" value={siteId} />
							{/each}
							{#each permissionEntries(createPermissions) as perm}
								<input type="hidden" name="perm" value={perm} />
							{/each}
							<input
								type="hidden"
								name="rateLimitEnabled"
								value={createRateLimitEnabled ? 'true' : 'false'}
							/>

							<div class="space-y-5 py-2">
								<div class="space-y-2">
									<Label for="api-key-name">Name (optional)</Label>
									<Input
										id="api-key-name"
										name="name"
										placeholder="Internal label"
										bind:value={createName}
									/>
								</div>

								<div class="space-y-3">
									<div class="flex items-center justify-between">
										<div>
											<div class="text-sm font-medium">Site scope</div>
											<div class="text-xs text-muted-foreground">
												Limit this key to specific sites.
											</div>
										</div>
										<div class="flex items-center gap-2">
											<Switch bind:checked={createAllSites} />
											<span class="text-sm">All sites</span>
										</div>
									</div>

									{#if !createAllSites}
										<div class="grid gap-2 md:grid-cols-2">
											{#each data.sites as site}
												{@const isSelected = createSiteIds.includes(site.id)}
												<button
													type="button"
													class="flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm"
													on:click={() =>
														(createSiteIds = toggleSite(site.id, !isSelected, createAllSites))}
												>
													<Checkbox checked={isSelected} />
													<div>
														<div class="font-medium">{site.name}</div>
														<div class="text-xs text-muted-foreground">{site.domain}</div>
													</div>
												</button>
											{/each}
										</div>
									{/if}
								</div>

								<div class="space-y-3">
									<div>
										<div class="text-sm font-medium">Permissions</div>
										<div class="text-xs text-muted-foreground">
											Choose which resources the key can access.
										</div>
									</div>
									<div class="space-y-3">
										{#each permissionMatrix as row}
											<div class="rounded-md border p-3">
												<div class="flex items-center justify-between gap-2">
													<div class="text-sm font-medium capitalize">{row.resource}</div>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onclick={() =>
															(createPermissions = setAllPermissions(
																createPermissions,
																row.resource,
																row.actions
															))}
													>
														Select all
													</Button>
												</div>
												<div class="mt-2 flex flex-wrap gap-3">
													{#each row.actions as action}
														{@const enabled = (createPermissions[row.resource] ?? []).includes(
															action
														)}
														<button
															type="button"
															class="flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
															on:click={() =>
																(createPermissions = togglePermission(
																	createPermissions,
																	row.resource,
																	action
																))}
														>
															<Checkbox checked={enabled} />
															<span class="capitalize">{action}</span>
														</button>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								</div>

								<Separator.Root />

								<div class="grid gap-4 md:grid-cols-2">
									<div class="space-y-2">
										<Label for="api-key-expire">Expires in (days)</Label>
										<Input
											id="api-key-expire"
											name="expiresInDays"
											type="number"
											min="1"
											placeholder="Leave empty for no expiry"
											bind:value={createExpiresInDays}
										/>
									</div>
									<div class="space-y-2">
										<Label for="api-key-remaining">Remaining requests</Label>
										<Input
											id="api-key-remaining"
											name="remaining"
											type="number"
											min="0"
											placeholder="Optional"
											bind:value={createRemaining}
										/>
									</div>
									<div class="space-y-2">
										<Label for="api-key-refill-amount">Refill amount</Label>
										<Input
											id="api-key-refill-amount"
											name="refillAmount"
											type="number"
											min="0"
											placeholder="Optional"
											bind:value={createRefillAmount}
										/>
									</div>
									<div class="space-y-2">
										<Label for="api-key-refill-interval">Refill interval (ms)</Label>
										<Input
											id="api-key-refill-interval"
											name="refillInterval"
											type="number"
											min="0"
											placeholder="Optional"
											bind:value={createRefillInterval}
										/>
									</div>
								</div>

								<Separator.Root />

								<div class="space-y-3">
									<div class="flex items-center justify-between">
										<div>
											<div class="text-sm font-medium">Rate limit</div>
											<div class="text-xs text-muted-foreground">Optional per-key throttle.</div>
										</div>
										<div class="flex items-center gap-2">
											<Switch bind:checked={createRateLimitEnabled} />
											<span class="text-sm">Enable</span>
										</div>
									</div>

									<div class="grid gap-4 md:grid-cols-2">
										<div class="space-y-2">
											<Label for="api-key-rate-max">Max requests</Label>
											<Input
												id="api-key-rate-max"
												name="rateLimitMax"
												type="number"
												min="1"
												placeholder="Optional"
												bind:value={createRateLimitMax}
												disabled={!createRateLimitEnabled}
											/>
										</div>
										<div class="space-y-2">
											<Label for="api-key-rate-window">Window (ms)</Label>
											<Input
												id="api-key-rate-window"
												name="rateLimitTimeWindow"
												type="number"
												min="1"
												placeholder="Optional"
												bind:value={createRateLimitWindow}
												disabled={!createRateLimitEnabled}
											/>
										</div>
									</div>
								</div>
							</div>

							<Dialog.Footer>
								<Button
									class="motion-action"
									variant="outline"
									onclick={() => (createOpen = false)}
								>
									Cancel
								</Button>
								<Button class="motion-action" type="submit" disabled={actionLoading}>
									Create key
								</Button>
							</Dialog.Footer>
						</form>
					</Dialog.Content>
				</Dialog.Root>

				<form method="POST" action="?/refresh" use:enhance={enhanceHandler()}>
					<Button class="motion-action" variant="outline" type="submit" disabled={actionLoading}>
						<RefreshCw class="h-4 w-4" />
						Refresh
					</Button>
				</form>
			</div>
		</div>
	</Card.Header>

	<Card.Content class="space-y-4">
		{#if keys.length === 0}
			<div class="rounded border p-4 text-sm text-muted-foreground">
				No API keys yet. Create one to get started.
			</div>
		{:else}
			<ul class="space-y-2">
				{#each keys as key}
					<li class="rounded border p-3">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div class="space-y-1">
								<div class="font-medium">{key.name ?? 'Untitled key'}</div>
								<div class="text-xs text-muted-foreground">
									Start: {formatStart(key)} • Scope: {formatScope(key)}
								</div>
								<div class="text-xs text-muted-foreground">
									Permissions: {formatPermissions(key.permissions)}
								</div>
								<div class="text-xs text-muted-foreground">
									Status: {key.enabled ? 'Enabled' : 'Disabled'} • Expires: {formatDate(
										key.expiresAt
									)} • Rate limit: {formatRateLimit(key)} • Remaining: {formatRemaining(key)} • Updated:
									{formatDate(key.updatedAt)}
								</div>
							</div>

							<div class="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									on:click={() => {
										activeKey = key;
										setEditForm(key);
										editOpen = true;
									}}
								>
									<Pencil class="size-4" />
									Edit
								</Button>
								<form method="POST" action="?/toggle" use:enhance={enhanceHandler()}>
									<input type="hidden" name="keyId" value={key.id} />
									<input type="hidden" name="enabled" value={key.enabled ? 'false' : 'true'} />
									<Button variant="outline" size="sm" type="submit">
										<ShieldCheck class="size-4" />
										{key.enabled ? 'Disable' : 'Enable'}
									</Button>
								</form>
								<form
									method="POST"
									action="?/rotate"
									use:enhance={enhanceHandler(handleRotateSuccess)}
								>
									<input type="hidden" name="keyId" value={key.id} />
									<Button variant="outline" size="sm" type="submit" disabled={actionLoading}>
										<RotateCw class="size-4" />
										Rotate
									</Button>
								</form>
								<Button
									variant="destructive"
									size="sm"
									onclick={() => {
										revokeKey = key;
										revokeOpen = true;
									}}
								>
									<Trash2 class="size-4" />
									Revoke
								</Button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="max-h-[80vh] max-w-3xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit API key</Dialog.Title>
			<Dialog.Description>Adjust access, limits, or enablement.</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/update" use:enhance={enhanceHandler(handleUpdateSuccess)}>
			<input type="hidden" name="keyId" value={activeKey?.id ?? ''} />
			<input type="hidden" name="scopeAll" value={editAllSites ? 'true' : 'false'} />
			{#each editAllSites ? [] : editSiteIds as siteId}
				<input type="hidden" name="allowedSiteIds" value={siteId} />
			{/each}
			{#each permissionEntries(editPermissions) as perm}
				<input type="hidden" name="perm" value={perm} />
			{/each}
			<input
				type="hidden"
				name="rateLimitEnabled"
				value={editRateLimitEnabled ? 'true' : 'false'}
			/>
			<input type="hidden" name="enabled" value={editEnabled ? 'true' : 'false'} />

			<div class="space-y-5 py-2">
				<div class="space-y-2">
					<Label for="edit-key-name">Name</Label>
					<Input
						id="edit-key-name"
						name="name"
						placeholder="Internal label"
						bind:value={editName}
					/>
				</div>

				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<div>
							<div class="text-sm font-medium">Site scope</div>
							<div class="text-xs text-muted-foreground">
								Control which sites this key can access.
							</div>
						</div>
						<div class="flex items-center gap-2">
							<Switch bind:checked={editAllSites} />
							<span class="text-sm">All sites</span>
						</div>
					</div>

					{#if !editAllSites}
						<div class="grid gap-2 md:grid-cols-2">
							{#each data.sites as site}
								{@const isSelected = editSiteIds.includes(site.id)}
								<button
									type="button"
									class="flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm"
									on:click={() =>
										(editSiteIds = toggleSiteEdit(site.id, !isSelected, editAllSites))}
								>
									<Checkbox checked={isSelected} />
									<div>
										<div class="font-medium">{site.name}</div>
										<div class="text-xs text-muted-foreground">{site.domain}</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="space-y-3">
					<div>
						<div class="text-sm font-medium">Permissions</div>
						<div class="text-xs text-muted-foreground">Update the allowed actions.</div>
					</div>
					<div class="space-y-3">
						{#each permissionMatrix as row}
							<div class="rounded-md border p-3">
								<div class="flex items-center justify-between gap-2">
									<div class="text-sm font-medium capitalize">{row.resource}</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() =>
											(editPermissions = setAllPermissions(
												editPermissions,
												row.resource,
												row.actions
											))}
									>
										Select all
									</Button>
								</div>
								<div class="mt-2 flex flex-wrap gap-3">
									{#each row.actions as action}
										{@const enabled = (editPermissions[row.resource] ?? []).includes(action)}
										<button
											type="button"
											class="flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
											on:click={() =>
												(editPermissions = togglePermission(editPermissions, row.resource, action))}
										>
											<Checkbox checked={enabled} />
											<span class="capitalize">{action}</span>
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<Separator.Root />

				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="edit-key-expire">Expires in (days)</Label>
						<Input
							id="edit-key-expire"
							name="expiresInDays"
							type="number"
							min="1"
							placeholder="Leave empty to clear"
							bind:value={editExpiresInDays}
						/>
					</div>
					<div class="space-y-2">
						<Label for="edit-key-remaining">Remaining requests</Label>
						<Input
							id="edit-key-remaining"
							name="remaining"
							type="number"
							min="0"
							placeholder="Optional"
							bind:value={editRemaining}
						/>
					</div>
					<div class="space-y-2">
						<Label for="edit-key-refill">Refill amount</Label>
						<Input
							id="edit-key-refill"
							name="refillAmount"
							type="number"
							min="0"
							placeholder="Optional"
							bind:value={editRefillAmount}
						/>
					</div>
					<div class="space-y-2">
						<Label for="edit-key-refill-interval">Refill interval (ms)</Label>
						<Input
							id="edit-key-refill-interval"
							name="refillInterval"
							type="number"
							min="0"
							placeholder="Optional"
							bind:value={editRefillInterval}
						/>
					</div>
				</div>

				<Separator.Root />

				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<div>
							<div class="text-sm font-medium">Rate limit</div>
							<div class="text-xs text-muted-foreground">Adjust per-key throttling.</div>
						</div>
						<div class="flex items-center gap-2">
							<Switch bind:checked={editRateLimitEnabled} />
							<span class="text-sm">Enable</span>
						</div>
					</div>

					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="edit-key-rate-max">Max requests</Label>
							<Input
								id="edit-key-rate-max"
								name="rateLimitMax"
								type="number"
								min="1"
								placeholder="Optional"
								bind:value={editRateLimitMax}
								disabled={!editRateLimitEnabled}
							/>
						</div>
						<div class="space-y-2">
							<Label for="edit-key-rate-window">Window (ms)</Label>
							<Input
								id="edit-key-rate-window"
								name="rateLimitTimeWindow"
								type="number"
								min="1"
								placeholder="Optional"
								bind:value={editRateLimitWindow}
								disabled={!editRateLimitEnabled}
							/>
						</div>
					</div>
				</div>

				<Separator.Root />

				<div class="flex items-center justify-between rounded-md border p-3">
					<div>
						<div class="text-sm font-medium">Key status</div>
						<div class="text-xs text-muted-foreground">Enable or disable this key.</div>
					</div>
					<Switch bind:checked={editEnabled} />
				</div>
			</div>

			<Dialog.Footer>
				<Button class="motion-action" variant="outline" onclick={() => (editOpen = false)}>
					Cancel
				</Button>
				<Button class="motion-action" type="submit" disabled={actionLoading}>Save changes</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={revokeOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Revoke API key</Dialog.Title>
			<Dialog.Description>
				This key will be disabled immediately. This cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/delete" use:enhance={enhanceHandler(handleDeleteSuccess)}>
			<input type="hidden" name="keyId" value={revokeKey?.id ?? ''} />
			<Dialog.Footer>
				<Button class="motion-action" variant="outline" onclick={() => (revokeOpen = false)}>
					Cancel
				</Button>
				<Button class="motion-action" variant="destructive" type="submit" disabled={actionLoading}>
					Revoke
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={createdKeyOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>API key created</Dialog.Title>
			<Dialog.Description>Copy this key now. You won’t be able to see it again.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-3 py-2">
			<div class="rounded-md border bg-muted/30 p-3 text-xs break-all">
				{createdKeyValue}
			</div>
			<Button class="motion-action" variant="outline" onclick={copyKey}>
				{#if copied}
					<Check class="h-4 w-4" />
					Copied
				{:else}
					<Copy class="h-4 w-4" />
					Copy
				{/if}
			</Button>
		</div>
		<Dialog.Footer>
			<Button class="motion-action" onclick={() => (createdKeyOpen = false)}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

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
