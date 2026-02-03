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
	import { onDestroy } from 'svelte';
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

	type ApiKeyPermissions = Record<string, string[]>;

	type AdminApiKey = {
		id: string;
		name: string | null;
		prefix: string | null;
		start: string | null;
		enabled: boolean;
		permissions: ApiKeyPermissions | null;
		metadata: {
			kind: 'admin';
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

	let { data }: { data: { keys: AdminApiKey[] } } = $props();

	const permissionMatrix: Array<{ resource: string; actions: string[] }> = [
		{
			resource: 'sites',
			actions: ['read', 'create', 'update', 'delete', 'sync', 'resize', 'credentials', 'stats']
		},
		{
			resource: 'connectors',
			actions: ['read', 'create', 'update', 'delete', 'configure', 'stats']
		},
		{
			resource: 'locations',
			actions: ['read', 'create', 'update', 'delete']
		},
		{
			resource: 'settings',
			actions: ['read', 'update']
		},
		{
			resource: 'users',
			actions: ['read', 'create', 'update', 'delete', 'ban', 'unban', 'resetPassword']
		}
	];

	let keys = $state<AdminApiKey[]>(data.keys ?? []);

	$effect(() => {
		keys = data.keys ?? [];
	});

	let createOpen = $state(false);
	let editOpen = $state(false);
	let revokeOpen = $state(false);
	let toggleOpen = $state(false);
	let actionLoading = $state(false);

	let activeKey = $state<AdminApiKey | null>(null);
	let revokeKey = $state<AdminApiKey | null>(null);
	let toggleKey = $state<AdminApiKey | null>(null);

	let createName = $state('');
	let createPermissions = $state<ApiKeyPermissions>({ sites: ['read'] });
	let createExpiresInDays = $state('');
	let createRemaining = $state('');
	let createRefillAmount = $state('');
	let createRefillInterval = $state('');
	let createRateLimitEnabled = $state(false);
	let createRateLimitMax = $state('');
	let createRateLimitWindow = $state('');

	let editName = $state('');
	let editPermissions = $state<ApiKeyPermissions>({});
	let editExpiresInDays = $state('');
	let editRemaining = $state('');
	let editRefillAmount = $state('');
	let editRefillInterval = $state('');
	let editRateLimitEnabled = $state(false);
	let editRateLimitMax = $state('');
	let editRateLimitWindow = $state('');
	let editEnabled = $state(true);

	let createdKeyValue = $state<string | null>(null);
	let createdKeyOpen = $state(false);
	let copied = $state(false);
	let copiedTimeout = $state<number | null>(null);

	onDestroy(() => {
		if (copiedTimeout !== null) {
			clearTimeout(copiedTimeout);
		}
	});

	const formatDate = (value: string | null | undefined) => {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleString();
	};

	const formatPermissions = (permissions: ApiKeyPermissions | null) => {
		if (!permissions) return '—';
		const chunks = Object.entries(permissions)
			.map(([resource, actions]) => `${resource}:${actions.join(', ')}`)
			.sort();
		return chunks.length ? chunks.join(' · ') : '—';
	};

	const formatRateLimit = (key: AdminApiKey) => {
		if (key.rateLimitEnabled === false) return 'Off';
		if (!key.rateLimitMax || !key.rateLimitTimeWindow) return '—';
		const seconds = Math.round(key.rateLimitTimeWindow / 1000);
		return `${key.rateLimitMax} / ${seconds}s`;
	};

	const formatRemaining = (key: AdminApiKey) => {
		if (key.remaining === null || key.remaining === undefined) return '—';
		return String(key.remaining);
	};

	const formatStart = (key: AdminApiKey) => {
		const prefix = key.prefix ?? '';
		const start = key.start ?? '';
		if (!start) return '—';
		if (prefix && start.startsWith(prefix)) return start.slice(prefix.length);
		return start;
	};

	const resetCreateForm = () => {
		createName = '';
		createPermissions = { sites: ['read'] };
		createExpiresInDays = '';
		createRemaining = '';
		createRefillAmount = '';
		createRefillInterval = '';
		createRateLimitEnabled = false;
		createRateLimitMax = '';
		createRateLimitWindow = '';
	};

	const setEditForm = (key: AdminApiKey) => {
		editName = key.name ?? key.metadata?.label ?? '';
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

	const permissionEntries = (permissions: ApiKeyPermissions) => {
		const entries: string[] = [];
		for (const [resource, actions] of Object.entries(permissions)) {
			for (const action of actions) entries.push(`${resource}:${action}`);
		}
		return entries;
	};

	const hasPermissions = (permissions: ApiKeyPermissions): boolean => {
		return (
			Object.keys(permissions).length > 0 &&
			Object.values(permissions).some((actions) => actions.length > 0)
		);
	};

	const validateCreateForm = (): string | null => {
		if (!hasPermissions(createPermissions)) {
			return 'At least one permission must be selected';
		}
		if (createRateLimitEnabled && (!createRateLimitMax || !createRateLimitWindow)) {
			return 'Rate limit requires both max requests and window values';
		}
		return null;
	};

	const validateEditForm = (): string | null => {
		if (!hasPermissions(editPermissions)) {
			return 'At least one permission must be selected';
		}
		if (editRateLimitEnabled && (!editRateLimitMax || !editRateLimitWindow)) {
			return 'Rate limit requires both max requests and window values';
		}
		return null;
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
							keys = payload.keys as AdminApiKey[];
						}

						if (onSuccess) {
							onSuccess(payload);
						}
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

	const handleRefreshSuccess = () => {
		toast.success('Keys refreshed.');
	};

	const handleToggleSuccess = () => {
		toggleOpen = false;
		const wasEnabled = toggleKey?.enabled ?? false;
		toggleKey = null;
		toast.success(wasEnabled ? 'API key disabled.' : 'API key enabled.');
	};

	const handleRotateSuccess = (res: Record<string, any>) => {
		createdKeyValue = res.fullKey ?? null;
		createdKeyOpen = Boolean(createdKeyValue);
		toast.success('API key rotated.');
	};

	const handleCreatedKeyClose = () => {
		createdKeyOpen = false;
		createdKeyValue = null;
		copied = false;
		if (copiedTimeout !== null) {
			clearTimeout(copiedTimeout);
			copiedTimeout = null;
		}
	};

	async function copyKey() {
		if (!createdKeyValue) return;
		try {
			await navigator.clipboard.writeText(createdKeyValue);
			copied = true;
			if (copiedTimeout !== null) {
				clearTimeout(copiedTimeout);
			}
			copiedTimeout = window.setTimeout(() => {
				copied = false;
				copiedTimeout = null;
			}, 1500);
		} catch {
			toast.error('Failed to copy');
		}
	}

	function handleCreateSubmit() {
		const error = validateCreateForm();
		if (error) {
			toast.error(error);
			return false;
		}
		return true;
	}

	function handleEditSubmit() {
		const error = validateEditForm();
		if (error) {
			toast.error(error);
			return false;
		}
		return true;
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div>
				<h1 class="flex items-center gap-2">
					<KeyRound class="h-4 w-4" />
					Application API Keys
				</h1>
				<p>Create admin-scoped keys for the application API.</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Button onclick={() => (createOpen = true)}>
					<Plus class="h-4 w-4" />
					Create API key
				</Button>
				<Dialog.Root open={createOpen} onOpenChange={(open) => (createOpen = open)}>
					<Dialog.Content class="max-h-[80vh] max-w-3xl overflow-y-auto">
						<Dialog.Header>
							<Dialog.Title>Create API key</Dialog.Title>
							<Dialog.Description>Generate a key with scoped admin permissions.</Dialog.Description>
						</Dialog.Header>

						<form
							method="POST"
							action="?/create"
							use:enhance={enhanceHandler(handleCreateSuccess)}
							onsubmit={(e) => {
								if (!handleCreateSubmit()) {
									e.preventDefault();
								}
							}}
						>
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
									<div>
										<div class="text-sm font-medium">Permissions</div>
										<div class="text-xs text-muted-foreground">
											Choose which resources the key can access.
										</div>
									</div>
									<div class="space-y-3">
										{#each permissionMatrix as row (row.resource)}
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
													{#each row.actions as action (action)}
														<label
															class="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted/50"
														>
															<Checkbox
																checked={(createPermissions[row.resource] ?? []).includes(action)}
																onCheckedChange={() =>
																	(createPermissions = togglePermission(
																		createPermissions,
																		row.resource,
																		action
																	))}
															/>
															<span class="capitalize">{action}</span>
														</label>
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
											step="1"
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
											step="1"
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
											step="1"
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
											step="1"
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
												step="1"
												placeholder="Required if enabled"
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
												step="1"
												placeholder="Required if enabled"
												bind:value={createRateLimitWindow}
												disabled={!createRateLimitEnabled}
											/>
										</div>
									</div>
								</div>
							</div>

							<Dialog.Footer>
								<Button variant="outline" type="button" onclick={() => (createOpen = false)}>
									Cancel
								</Button>
								<Button type="submit" disabled={actionLoading}>
									{actionLoading ? 'Creating...' : 'Create key'}
								</Button>
							</Dialog.Footer>
						</form>
					</Dialog.Content>
				</Dialog.Root>

				<form method="POST" action="?/refresh" use:enhance={enhanceHandler(handleRefreshSuccess)}>
					<Button variant="outline" type="submit" disabled={actionLoading}>
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
				{#each keys as key (key.id)}
					<li class="rounded border p-3">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div class="space-y-1">
								<div class="font-medium">{key.name ?? 'Untitled key'}</div>
								<div class="text-xs text-muted-foreground">
									ID: {key.id.slice(0, 8)}... • Start: {formatStart(key)}
								</div>
								<div class="text-xs text-muted-foreground">
									Permissions: {formatPermissions(key.permissions)}
								</div>
								<div class="text-xs text-muted-foreground">
									Status:
									<span class={key.enabled ? 'text-green-600' : 'text-muted-foreground'}>
										{key.enabled ? 'Enabled' : 'Disabled'}
									</span>
									• Expires: {formatDate(key.expiresAt)} • Rate limit: {formatRateLimit(key)} • Remaining:
									{formatRemaining(key)} • Updated: {formatDate(key.updatedAt)}
								</div>
							</div>

							<div class="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										activeKey = key;
										setEditForm(key);
										editOpen = true;
									}}
								>
									<Pencil class="size-4" />
									Edit
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										toggleKey = key;
										toggleOpen = true;
									}}
								>
									<ShieldCheck class="size-4" />
									{key.enabled ? 'Disable' : 'Enable'}
								</Button>
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

<Dialog.Root open={editOpen} onOpenChange={(open) => (editOpen = open)}>
	<Dialog.Content class="max-h-[80vh] max-w-3xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit API key</Dialog.Title>
			<Dialog.Description>Adjust access, limits, or enablement.</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/update"
			use:enhance={enhanceHandler(handleUpdateSuccess)}
			onsubmit={(e) => {
				if (!handleEditSubmit()) {
					e.preventDefault();
				}
			}}
		>
			<input type="hidden" name="keyId" value={activeKey?.id ?? ''} />
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
					<div>
						<div class="text-sm font-medium">Permissions</div>
						<div class="text-xs text-muted-foreground">Update the allowed actions.</div>
					</div>
					<div class="space-y-3">
						{#each permissionMatrix as row (row.resource)}
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
									{#each row.actions as action (action)}
										<label
											class="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted/50"
										>
											<Checkbox
												checked={(editPermissions[row.resource] ?? []).includes(action)}
												onCheckedChange={() =>
													(editPermissions = togglePermission(
														editPermissions,
														row.resource,
														action
													))}
											/>
											<span class="capitalize">{action}</span>
										</label>
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
							step="1"
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
							step="1"
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
							step="1"
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
							step="1"
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
								step="1"
								placeholder="Required if enabled"
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
								step="1"
								placeholder="Required if enabled"
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
				<Button variant="outline" type="button" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={actionLoading}>
					{actionLoading ? 'Saving...' : 'Save changes'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={toggleOpen} onOpenChange={(open) => (toggleOpen = open)}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{toggleKey?.enabled ? 'Disable' : 'Enable'} API key</Dialog.Title>
			<Dialog.Description>
				{#if toggleKey?.enabled}
					This key will be disabled and cannot be used until re-enabled.
				{:else}
					This key will be enabled and can be used immediately.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/toggle" use:enhance={enhanceHandler(handleToggleSuccess)}>
			<input type="hidden" name="keyId" value={toggleKey?.id ?? ''} />
			<input type="hidden" name="enabled" value={toggleKey?.enabled ? 'false' : 'true'} />
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (toggleOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={actionLoading}>
					{actionLoading ? 'Processing...' : 'Confirm'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={revokeOpen} onOpenChange={(open) => (revokeOpen = open)}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Revoke API key</Dialog.Title>
			<Dialog.Description>
				This key will be permanently deleted. This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/delete" use:enhance={enhanceHandler(handleDeleteSuccess)}>
			<input type="hidden" name="keyId" value={revokeKey?.id ?? ''} />
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (revokeOpen = false)}>Cancel</Button>
				<Button variant="destructive" type="submit" disabled={actionLoading}>
					{actionLoading ? 'Revoking...' : 'Revoke'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={createdKeyOpen} onOpenChange={(open) => !open && handleCreatedKeyClose()}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>API key created</Dialog.Title>
			<Dialog.Description>Copy this key now. You won't be able to see it again.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-3 py-2">
			<div class="rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
				{createdKeyValue}
			</div>
			<Button class="w-full" variant="outline" onclick={copyKey}>
				{#if copied}
					<Check class="h-4 w-4" />
					Copied!
				{:else}
					<Copy class="h-4 w-4" />
					Copy to clipboard
				{/if}
			</Button>
		</div>
		<Dialog.Footer>
			<Button onclick={handleCreatedKeyClose}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
