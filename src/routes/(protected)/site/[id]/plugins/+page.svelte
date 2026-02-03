<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Separator from '$lib/components/ui/separator';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, Trash2, ArrowUp, Power, RefreshCw, Loader2, MoreHorizontal } from 'lucide-svelte';
	import type { PageData } from './$types';
	import { easeStandard, prefersReducedMotion as getPrefersReducedMotion } from '$lib/motion';
	import type { ManagedItemBase, PluginItem } from '$lib/types/managed-items';
	import ManagedMotionShell from '$lib/components/managed-items/ManagedMotionShell.svelte';
	import ManagedHeaderBar from '$lib/components/managed-items/ManagedHeaderBar.svelte';
	import ManagedFilterBar from '$lib/components/managed-items/ManagedFilterBar.svelte';
	import ManagedBulkActionsBar from '$lib/components/managed-items/ManagedBulkActionsBar.svelte';
	import ManagedItemCard from '$lib/components/managed-items/ManagedItemCard.svelte';
	import ManagedItemList from '$lib/components/managed-items/ManagedItemList.svelte';
	import { fly } from 'svelte/transition';
	import { Content } from '$lib/components/ui/card';

	type WPOrgPlugin = {
		name: string;
		slug: string;
		version: string;
		author: string;
		author_profile?: string;
		requires?: string;
		tested?: string;
		requires_php?: string | false;
		requires_plugins?: string[];
		rating?: number;
		ratings?: Record<string, number>;
		num_ratings?: number;
		support_threads?: number;
		support_threads_resolved?: number;
		active_installs?: number;
		downloaded?: number;
		last_updated?: string;
		added?: string;
		homepage?: string;
		short_description?: string;
		description?: string;
		download_link?: string;
		tags?: Record<string, string>;
		donate_link?: string;
		icons?: { '1x'?: string; '2x'?: string; svg?: string };
	};

	let installLookup = $state<WPOrgPlugin | null>(null);
	let installLookupLoading = $state(false);
	let installLookupError = $state<string | null>(null);

	let lookupTimer: ReturnType<typeof setTimeout> | null = null;
	let lookupAbort: AbortController | null = null;

	const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s.trim());
	const looksLikeSlug = (s: string) => /^[a-z0-9][a-z0-9-]{1,80}$/i.test(s.trim());

	async function fetchWpOrgPlugin(slug: string) {
		lookupAbort?.abort();
		lookupAbort = new AbortController();

		installLookupLoading = true;
		installLookupError = null;

		try {
			const res = await fetch(`/api/wporg/plugin?slug=${encodeURIComponent(slug)}`, {
				signal: lookupAbort.signal
			});

			if (!res.ok) throw new Error(`WP.org lookup failed (${res.status})`);

			const json = (await res.json()) as any;

			if (!json || typeof json !== 'object' || json.error) {
				installLookup = null;
				installLookupError = json?.error || 'Plugin not found';
				return;
			}

			const mapped: WPOrgPlugin = {
				...json,
				description:
					json.description ?? json?.sections?.description ?? json?.sections?.changelog ?? ''
			};

			installLookup = mapped;
		} catch (e: any) {
			if (e?.name === 'AbortError') return;
			installLookup = null;
			installLookupError = e?.message || 'Lookup failed';
		} finally {
			installLookupLoading = false;
		}
	}

	$effect(() => {
		if (!installOpen) return;

		const raw = (installSource || '').trim();

		installLookupError = null;

		if (!raw || looksLikeUrl(raw) || !looksLikeSlug(raw)) {
			installLookup = null;
			installLookupLoading = false;
			lookupAbort?.abort();
			if (lookupTimer) clearTimeout(lookupTimer);
			lookupTimer = null;
			return;
		}

		if (lookupTimer) clearTimeout(lookupTimer);
		lookupTimer = setTimeout(() => {
			void fetchWpOrgPlugin(raw.toLowerCase());
		}, 250);
	});

	$effect(() => {
		if (!installOpen) {
			installLookup = null;
			installLookupError = null;
			installLookupLoading = false;
			lookupAbort?.abort();
			if (lookupTimer) clearTimeout(lookupTimer);
			lookupTimer = null;
		}
	});

	type ActionResult = {
		type: 'success' | 'failure';
		message: string;
		data?: unknown;
	};

	const { data }: { data: PageData } = $props();

	const prefersReducedMotion = getPrefersReducedMotion();

	let pluginSearch = $state('');
	let pluginFilter = $state<'all' | 'active' | 'inactive' | 'updates'>('all');

	let pluginExcludes = $state<string[]>([]);

	let installOpen = $state(false);
	let installSource = $state('');
	let installVersion = $state('');
	let installActivate = $state(true);
	let installForce = $state(false);

	let deleteOpen = $state(false);
	let deleteTarget = $state<string | null>(null);

	let pendingActions = $state<Record<string, boolean>>({});
	let pendingInstall = $state(false);
	let pendingBulkPlugins = $state(false);
	let isRefreshing = $state(false);

	let pluginUpdateVersion = $state('');

	$effect(() => {
		if (!deleteOpen) deleteTarget = null;
	});

	const setPending = (key: string, value: boolean) => {
		pendingActions = { ...pendingActions, [key]: value };
	};

	const isPending = (key: string) => !!pendingActions[key];

	const normalizeStatus = (status: string) => (status || '').toLowerCase();

	const isActiveStatus = (status: string) => {
		const s = normalizeStatus(status);
		if (s.includes('inactive') || s.includes('disabled')) return false;
		return s === 'active' || s === 'enabled' || s.includes('active');
	};

	const isInactiveStatus = (status: string) => {
		const s = normalizeStatus(status);
		return s.includes('inactive') || s.includes('disabled');
	};

	const hasUpdate = (item: { update?: string | null; version: string }) => {
		if (!item.update) return false;
		return item.update !== item.version;
	};

	const formatStatus = (status: string) => {
		const s = normalizeStatus(status);
		if (s === 'active' || s === 'enabled') return 'Active';
		if (s === 'inactive' || s === 'disabled') return 'Inactive';
		return status || 'Unknown';
	};

	const statusVariant = (status: string) => {
		return isActiveStatus(status) ? 'default' : isInactiveStatus(status) ? 'secondary' : 'outline';
	};

	const updateLabel = (value?: string | null) => {
		if (!value) return 'Update available';
		return `Update ${value}`;
	};

	const getMessage = (result: any, fallback: string) => {
		const data = (result?.data || {}) as ActionResult;
		return data?.message || result?.error?.message || fallback;
	};

	const refreshNow = async () => {
		isRefreshing = true;
		try {
			await invalidateAll();
		} finally {
			isRefreshing = false;
		}
	};

	const refreshSoon = () => {
		setTimeout(() => {
			void refreshNow();
		}, 300);
	};

	const handleActionResult = async (
		result: any,
		options?: { success?: string; invalidate?: boolean; onSuccess?: () => void }
	) => {
		if (result?.type === 'success') {
			const payload = result.data as ActionResult;
			if (payload?.type === 'success') {
				toast.success(payload.message || options?.success || 'Done');
				if (options?.onSuccess) options.onSuccess();
				if (options?.invalidate !== false) refreshSoon();
				return;
			}
		}

		const message = getMessage(result, 'Request failed');
		toast.error(message);
	};

	const enhanceItem = (key: string, options?: { success?: string; onSuccess?: () => void }) => {
		return () => {
			setPending(key, true);
			return async ({ result }: { result: any }) => {
				setPending(key, false);
				await handleActionResult(result, {
					success: options?.success,
					onSuccess: options?.onSuccess
				});
			};
		};
	};

	const enhanceBulk = () => {
		return () => {
			pendingBulkPlugins = true;
			return async ({ result }: { result: any }) => {
				pendingBulkPlugins = false;
				await handleActionResult(result, {
					success: 'Updates started'
				});
			};
		};
	};

	const enhanceInstall = () => {
		return () => {
			pendingInstall = true;
			return async ({ result }: { result: any }) => {
				pendingInstall = false;
				await handleActionResult(result, {
					success: 'Install started',
					onSuccess: () => {
						installOpen = false;
						installSource = '';
						installVersion = '';
						installActivate = true;
						installForce = false;
					}
				});
			};
		};
	};

	const enhanceDelete = () => {
		const key = deleteTarget ? `plugin:${deleteTarget}:delete` : 'delete';
		return () => {
			setPending(key, true);
			return async ({ result }: { result: any }) => {
				setPending(key, false);
				await handleActionResult(result, {
					success: 'Deleted',
					onSuccess: () => (deleteOpen = false)
				});
			};
		};
	};

	const openDelete = (name: string) => {
		deleteTarget = name;
		deleteOpen = true;
	};

	const plugins = $derived(Array.isArray(data.plugins) ? (data.plugins as PluginItem[]) : []);

	const filteredPlugins = $derived(
		plugins.filter((plugin) => {
			const match = plugin.name.toLowerCase().includes(pluginSearch.trim().toLowerCase());
			if (!match) return false;
			if (pluginFilter === 'updates') return hasUpdate(plugin);
			if (pluginFilter === 'active') return isActiveStatus(plugin.status);
			if (pluginFilter === 'inactive') return isInactiveStatus(plugin.status);
			return true;
		})
	);

	const pluginCountText = $derived(`${filteredPlugins.length} of ${plugins.length} plugins`);

	const pluginKey = (plugin: ManagedItemBase) => plugin.name;
</script>

<ManagedMotionShell>
	<div
		class="space-y-6"
		in:fly={{
			y: prefersReducedMotion ? 0 : 10,
			duration: prefersReducedMotion ? 0 : 200,
			easing: easeStandard
		}}
	>
		<ManagedHeaderBar
			title="Plugins"
			subtext={pluginCountText}
			bind:search={pluginSearch}
			bind:filter={pluginFilter}
			searchPlaceholder="Search plugins"
		>
			<svelte:fragment slot="actions">
				<Button class="motion-action" onclick={() => (installOpen = true)}>
					<Plus class="h-4 w-4" />
					Install plugin
				</Button>
				<Button
					class="motion-action"
					variant="outline"
					onclick={refreshNow}
					disabled={isRefreshing}
				>
					{#if isRefreshing}
						<Loader2 class="h-4 w-4 animate-spin" />
						Refreshing
					{:else}
						<RefreshCw class="h-4 w-4" />
						Refresh
					{/if}
				</Button>
			</svelte:fragment>
		</ManagedHeaderBar>

		<Content>
			<!--<ManagedFilterBar
			bind:search={pluginSearch}
			bind:filter={pluginFilter}
			searchPlaceholder="Search plugins"
		/>-->

			{#if data.pluginsError}
				<div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
					{data.pluginsError}
				</div>
			{:else}
				<ManagedItemList
					items={filteredPlugins}
					itemKey={pluginKey}
					emptyMessage="No plugins match your filters."
					{prefersReducedMotion}
					{easeStandard}
				>
					<svelte:fragment let:item>
						<ManagedItemCard
							{item}
							statusText={formatStatus(item.status)}
							statusVariant={statusVariant(item.status)}
							showUpdateBadge={hasUpdate(item)}
							updateText={updateLabel(item.update)}
							versionLabel={`Version ${item.version}`}
							bulkFormId="update-plugins-form"
							bind:excludes={pluginExcludes}
						>
							<svelte:fragment slot="actions">
								{#if hasUpdate(item)}
									<form
										method="POST"
										action="?/updatePlugins"
										use:enhance={enhanceItem(`plugin:${item.name}:update`, {
											success: `Updating ${item.name}`
										})}
									>
										<input type="hidden" name="plugin" value={item.name} />
										<Button
											class="motion-action"
											type="submit"
											disabled={isPending(`plugin:${item.name}:update`)}
										>
											<ArrowUp class="h-4 w-4" />
											{isPending(`plugin:${item.name}:update`) ? 'Updating…' : 'Update'}
										</Button>
									</form>
								{/if}

								{#if isActiveStatus(item.status)}
									<form
										method="POST"
										action="?/deactivatePlugin"
										use:enhance={enhanceItem(`plugin:${item.name}:deactivate`, {
											success: `Deactivated ${item.name}`
										})}
									>
										<input type="hidden" name="plugin" value={item.name} />
										<Button
											class="motion-action"
											variant="outline"
											type="submit"
											disabled={isPending(`plugin:${item.name}:deactivate`)}
										>
											{isPending(`plugin:${item.name}:deactivate`) ? 'Deactivating…' : 'Deactivate'}
										</Button>
									</form>
								{:else}
									<form
										method="POST"
										action="?/activatePlugin"
										use:enhance={enhanceItem(`plugin:${item.name}:activate`, {
											success: `Activated ${item.name}`
										})}
									>
										<input type="hidden" name="plugin" value={item.name} />
										<Button
											class="motion-action"
											type="submit"
											disabled={isPending(`plugin:${item.name}:activate`)}
										>
											<Power class="h-4 w-4" />
											{isPending(`plugin:${item.name}:activate`) ? 'Activating…' : 'Activate'}
										</Button>
									</form>
								{/if}

								<DropdownMenu.Root>
									<DropdownMenu.Trigger asChild>
										<Button
											class="motion-action"
											variant="ghost"
											size="icon"
											aria-label={`More actions for ${item.name}`}
											disabled={isPending(`plugin:${item.name}:delete`)}
										>
											<MoreHorizontal class="h-4 w-4" />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end" class="w-44">
										<DropdownMenu.Item
											variant="destructive"
											onclick={() => openDelete(item.name)}
											disabled={isPending(`plugin:${item.name}:delete`)}
										>
											<Trash2 class="h-4 w-4" />
											Delete
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</svelte:fragment>
						</ManagedItemCard>
					</svelte:fragment>
				</ManagedItemList>
			{/if}
			<ManagedBulkActionsBar
				title="Bulk update plugins"
				subtitle={`Exclude ${pluginExcludes.length} from update`}
				formId="update-plugins-form"
				action="?/updatePlugins"
				itemField="plugin"
				bind:version={pluginUpdateVersion}
				pending={pendingBulkPlugins}
				updateLabel="Update all"
				exclusionsCount={pluginExcludes.length}
				onClear={() => (pluginExcludes = [])}
				enhance={enhanceBulk}
			/>
		</Content>
	</div>
</ManagedMotionShell>

<Dialog.Root bind:open={installOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Install plugin</Dialog.Title>
			<Dialog.Description>Provide a source slug, zip URL, or upload reference.</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/installPlugin" use:enhance={enhanceInstall()} class="space-y-4">
			<div class="space-y-2">
				<Label for="install-source">Source</Label>
				<Input
					id="install-source"
					name="source"
					placeholder="plugin-slug or https://example.com/plugin.zip"
					bind:value={installSource}
					required
				/>
			</div>
			{#if installLookupLoading}
				<div class="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
					<Loader2 class="h-4 w-4 animate-spin" />
					Looking up plugin…
				</div>
			{:else if installLookupError}
				<div class="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
					{installLookupError}
				</div>
			{:else if installLookup}
				<div class="space-y-2">
					<DetailWp plugin={installLookup} />

					<div class="flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="secondary"
							class="motion-action"
							onclick={() => {
								installSource = installLookup?.slug ?? installSource;
								toast.success(`Selected ${installLookup?.name ?? 'plugin'}`);
							}}
						>
							Use this plugin
						</Button>
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="install-version">Version (optional)</Label>
				<Input
					id="install-version"
					name="version"
					placeholder="latest"
					bind:value={installVersion}
				/>
			</div>

			<div class="flex flex-col gap-2 text-sm">
				<label class="flex items-center gap-2">
					<input type="checkbox" name="activate" bind:checked={installActivate} />
					Activate after install
				</label>
				<label class="flex items-center gap-2">
					<input type="checkbox" name="force" bind:checked={installForce} />
					Force install
				</label>
			</div>

			<Dialog.Footer class="gap-2">
				<Button
					class="motion-action"
					type="button"
					variant="outline"
					onclick={() => (installOpen = false)}
					disabled={pendingInstall}
				>
					Cancel
				</Button>
				<Button class="motion-action" type="submit" disabled={pendingInstall}>
					{pendingInstall ? 'Installing…' : 'Install'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete plugin</Dialog.Title>
			<Dialog.Description>This removes {deleteTarget ?? 'the selected plugin'}.</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/deletePlugin" use:enhance={enhanceDelete()} class="space-y-4">
			<input type="hidden" name="plugin" value={deleteTarget ?? ''} />

			<Separator.Root />

			<Dialog.Footer class="gap-2">
				<Button
					class="motion-action"
					type="button"
					variant="outline"
					onclick={() => (deleteOpen = false)}
				>
					Cancel
				</Button>
				<Button class="motion-action" type="submit" variant="destructive">Delete</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
