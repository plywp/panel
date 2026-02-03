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
	import { Content } from '$lib/components/ui/card';
	import { Plus, Trash2, ArrowUp, Power, RefreshCw, Loader2, MoreHorizontal } from 'lucide-svelte';
	import type { PageData } from './$types';
	import { easeStandard, prefersReducedMotion as getPrefersReducedMotion } from '$lib/motion';
	import type { ManagedItemBase, ThemeItem } from '$lib/types/managed-items';
	import ManagedMotionShell from '$lib/components/managed-items/ManagedMotionShell.svelte';
	import ManagedHeaderBar from '$lib/components/managed-items/ManagedHeaderBar.svelte';
	import ManagedFilterBar from '$lib/components/managed-items/ManagedFilterBar.svelte';
	import ManagedBulkActionsBar from '$lib/components/managed-items/ManagedBulkActionsBar.svelte';
	import ManagedItemCard from '$lib/components/managed-items/ManagedItemCard.svelte';
	import ManagedItemList from '$lib/components/managed-items/ManagedItemList.svelte';
	import { fly } from 'svelte/transition';

	type ActionResult = {
		type: 'success' | 'failure';
		message: string;
		data?: unknown;
	};

	const { data }: { data: PageData } = $props();

	const prefersReducedMotion = getPrefersReducedMotion();

	let themeSearch = $state('');
	let themeFilter = $state<'all' | 'active' | 'inactive' | 'updates'>('all');

	let themeExcludes = $state<string[]>([]);

	let installOpen = $state(false);
	let installSource = $state('');
	let installVersion = $state('');
	let installActivate = $state(true);
	let installForce = $state(false);

	let deleteOpen = $state(false);
	let deleteTarget = $state<string | null>(null);

	let enableOpen = $state(false);
	let enableTarget = $state<string | null>(null);
	let enableNetwork = $state(true);
	let enableActivate = $state(false);

	let pendingActions = $state<Record<string, boolean>>({});
	let pendingInstall = $state(false);
	let pendingBulkThemes = $state(false);
	let pendingEnable = $state(false);
	let isRefreshing = $state(false);

	let themeUpdateVersion = $state('');

	$effect(() => {
		if (!deleteOpen) deleteTarget = null;
	});

	$effect(() => {
		if (!enableOpen) {
			enableTarget = null;
			enableNetwork = true;
			enableActivate = false;
			pendingEnable = false;
		}
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
			pendingBulkThemes = true;
			return async ({ result }: { result: any }) => {
				pendingBulkThemes = false;
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
		const key = deleteTarget ? `theme:${deleteTarget}:delete` : 'delete';
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

	const enhanceEnable = () => {
		return () => {
			pendingEnable = true;
			return async ({ result }: { result: any }) => {
				pendingEnable = false;
				await handleActionResult(result, {
					success: 'Theme enabled',
					onSuccess: () => (enableOpen = false)
				});
			};
		};
	};

	const openDelete = (name: string) => {
		deleteTarget = name;
		deleteOpen = true;
	};

	const openEnable = (name: string) => {
		enableTarget = name;
		enableOpen = true;
	};

	const themes = $derived(Array.isArray(data.themes) ? (data.themes as ThemeItem[]) : []);

	const filteredThemes = $derived(
		themes.filter((theme) => {
			const match = theme.name.toLowerCase().includes(themeSearch.trim().toLowerCase());
			if (!match) return false;
			if (themeFilter === 'updates') return hasUpdate(theme);
			if (themeFilter === 'active') return isActiveStatus(theme.status);
			if (themeFilter === 'inactive') return isInactiveStatus(theme.status);
			return true;
		})
	);

	const themeCountText = $derived(`${filteredThemes.length} of ${themes.length} themes`);

	const siteUrl = $derived(
		(() => {
			const domain = data.site?.domain ?? '';
			if (!domain) return '';
			if (domain.startsWith('http://') || domain.startsWith('https://')) return domain;
			return `https://${domain}`;
		})()
	);

	const themeKey = (theme: ManagedItemBase) =>
		theme.stylesheet ?? theme.slug ?? theme.id ?? theme.name;

	const themeSlug = (theme: ManagedItemBase) => theme.stylesheet ?? theme.slug ?? theme.id ?? '';

	const themeScreenshotUrl = (theme: ManagedItemBase) => {
		const slug = themeSlug(theme);
		if (!slug || !siteUrl) return null;
		return `${siteUrl.replace(/\/$/, '')}/wp-content/themes/${slug}/screenshot.png`;
	};
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
			title="Themes"
			subtext={themeCountText}
			bind:search={themeSearch}
			bind:filter={themeFilter}
			searchPlaceholder="Search themes"
		>
			<svelte:fragment slot="actions">
				<Button class="motion-action" onclick={() => (installOpen = true)}>
					<Plus class="h-4 w-4" />
					Install theme
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
			{#if data.themesError}
				<div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
					{data.themesError}
				</div>
			{:else}
				<ManagedItemList
					items={filteredThemes}
					itemKey={themeKey}
					emptyMessage="No themes match your filters."
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
							bulkFormId="update-themes-form"
							bind:excludes={themeExcludes}
							thumbnailUrl={themeScreenshotUrl(item)}
							thumbnailAlt={`Theme screenshot for ${item.name}`}
						>
							<svelte:fragment slot="actions">
								{#if hasUpdate(item)}
									<form
										method="POST"
										action="?/updateThemes"
										use:enhance={enhanceItem(`theme:${item.name}:update`, {
											success: `Updating ${item.name}`
										})}
									>
										<input type="hidden" name="theme" value={item.name} />
										<Button
											class="motion-action"
											type="submit"
											disabled={isPending(`theme:${item.name}:update`)}
										>
											<ArrowUp class="h-4 w-4" />
											{isPending(`theme:${item.name}:update`) ? 'Updating…' : 'Update'}
										</Button>
									</form>
								{/if}

								{#if !isActiveStatus(item.status)}
									<form
										method="POST"
										action="?/activateTheme"
										use:enhance={enhanceItem(`theme:${item.name}:activate`, {
											success: `Activated ${item.name}`
										})}
									>
										<input type="hidden" name="theme" value={item.name} />
										<Button
											class="motion-action"
											type="submit"
											disabled={isPending(`theme:${item.name}:activate`)}
										>
											<Power class="h-4 w-4" />
											{isPending(`theme:${item.name}:activate`) ? 'Activating…' : 'Activate'}
										</Button>
									</form>
								{/if}

								{#if data.isMultisite}
									<Button
										class="motion-action"
										variant="outline"
										onclick={() => openEnable(item.name)}
										disabled={pendingEnable}
									>
										Network enable
									</Button>
								{/if}

								<DropdownMenu.Root>
									<DropdownMenu.Trigger asChild>
										<Button
											class="motion-action"
											variant="ghost"
											size="icon"
											aria-label={`More actions for ${item.name}`}
											disabled={isPending(`theme:${item.name}:delete`)}
										>
											<MoreHorizontal class="h-4 w-4" />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end" class="w-44">
										<DropdownMenu.Item
											variant="destructive"
											onclick={() => openDelete(item.name)}
											disabled={isPending(`theme:${item.name}:delete`)}
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
				title="Bulk update themes"
				subtitle={`Exclude ${themeExcludes.length} from update`}
				formId="update-themes-form"
				action="?/updateThemes"
				itemField="theme"
				bind:version={themeUpdateVersion}
				pending={pendingBulkThemes}
				updateLabel="Update all"
				exclusionsCount={themeExcludes.length}
				onClear={() => (themeExcludes = [])}
				enhance={enhanceBulk}
			/>
		</Content>	</div>
</ManagedMotionShell>

<Dialog.Root bind:open={installOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Install theme</Dialog.Title>
			<Dialog.Description>Provide a source slug, zip URL, or upload reference.</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/installTheme" use:enhance={enhanceInstall()} class="space-y-4">
			<div class="space-y-2">
				<Label for="install-source">Source</Label>
				<Input
					id="install-source"
					name="source"
					placeholder="theme-slug or https://example.com/theme.zip"
					bind:value={installSource}
					required
				/>
			</div>

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

<Dialog.Root bind:open={enableOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Enable theme on network</Dialog.Title>
			<Dialog.Description>{enableTarget ?? 'Select a theme to enable.'}</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/enableTheme" use:enhance={enhanceEnable()} class="space-y-4">
			<input type="hidden" name="theme" value={enableTarget ?? ''} />

			<div class="flex flex-col gap-2 text-sm">
				<label class="flex items-center gap-2">
					<input type="checkbox" name="network" bind:checked={enableNetwork} />
					Network enable
				</label>
				<label class="flex items-center gap-2">
					<input type="checkbox" name="activate" bind:checked={enableActivate} />
					Activate after enabling
				</label>
			</div>

			<Dialog.Footer class="gap-2">
				<Button
					class="motion-action"
					type="button"
					variant="outline"
					onclick={() => (enableOpen = false)}
					disabled={pendingEnable}
				>
					Cancel
				</Button>
				<Button class="motion-action" type="submit" disabled={pendingEnable}>
					{pendingEnable ? 'Enabling…' : 'Enable'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete theme</Dialog.Title>
			<Dialog.Description>This removes {deleteTarget ?? 'the selected theme'}.</Dialog.Description>
		</Dialog.Header>

		<form method="POST" action="?/deleteTheme" use:enhance={enhanceDelete()} class="space-y-4">
			<input type="hidden" name="theme" value={deleteTarget ?? ''} />

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
