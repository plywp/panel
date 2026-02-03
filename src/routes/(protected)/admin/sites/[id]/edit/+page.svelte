<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { connectorSiteStatusUrl } from '$lib/connector-url';
	import axios from 'axios';
	import {
		BarChart3,
		ChevronDown,
		ChevronUp,
		HardDrive,
		Minus,
		Plus,
		RefreshCw,
		Settings,
		Trash2
	} from 'lucide-svelte';

	export let data: {
		site: {
			id: string;
			internalId: string;
			name: string;
			description: string | null;
			domain: string;
			docroot: string;
			diskLimitMb: number;
			dbHost: string;
			dbName: string;
			dbUser: string;
			dbPassword: string;
			tablePrefix: string;
			phpVersion: string | null;
			status: string | null;
			connectorId: number | null;
			connectorFqdn: string | null;
			connectorToken: string | null;
			connectorDaemonSslEnabled: boolean | null;
			locationName: string | null;
			locationCountry: string | null;
		};
	};

	export let form:
		| {
				success?: boolean;
				message?: string;
				errors?: Record<string, string[]>;
				values?: Record<string, string>;
		  }
		| undefined;

	const firstError = (key: string) => form?.errors?.[key]?.[0];

	const defaultUnitFor = (diskLimitMb: number) =>
		diskLimitMb >= 1024 && diskLimitMb % 1024 === 0 ? 'G' : 'M';

	const defaultSizeFor = (diskLimitMb: number) => {
		if (diskLimitMb >= 1024 && diskLimitMb % 1024 === 0) {
			return String(diskLimitMb / 1024);
		}
		return String(diskLimitMb);
	};

	let showResize = false;
	let resizeSize = '';
	let resizeUnit = 'M';

	const MIN_RESIZE = 1;

	function adjustResize(delta: number) {
		const current = Number.parseInt(resizeSize, 10);
		const safeCurrent = Number.isFinite(current) ? current : MIN_RESIZE;
		const next = Math.max(MIN_RESIZE, safeCurrent + delta);
		resizeSize = String(next);
	}

	$: {
		const nextSize = form?.values?.newSize ?? defaultSizeFor(data.site.diskLimitMb);
		const nextUnit = form?.values?.unitType ?? defaultUnitFor(data.site.diskLimitMb);
		if (!showResize || form?.values?.newSize || form?.values?.unitType) {
			resizeSize = nextSize;
			resizeUnit = nextUnit;
		}
		if (form?.errors?.newSize || form?.errors?.unitType || form?.message) {
			showResize = true;
		}
	}

	type InstallStatus = {
		id: string;
		system_id?: string;
		domain: string;
		status: 'queued' | 'running' | 'failed' | 'completed';
		message?: string;
		started_at: string;
		finished_at?: string;
		site_url?: string;
		wp_path?: string;
		db_name?: string;
	};

	let installStatus: InstallStatus | null = null;
	let installError: string | null = null;
	let installStatusNotFound = false;

	const POLL_MS = 5000;
	const TIMEOUT_MS = 5000;

	function makeStatusUrl() {
		if (!data.site.connectorFqdn || !data.site.connectorToken) return null;
		return connectorSiteStatusUrl(
			{
				fqdn: data.site.connectorFqdn,
				daemonSslEnabled: data.site.connectorDaemonSslEnabled
			},
			data.site.id
		);
	}

	async function refreshInstallStatus() {
		if (installStatusNotFound) return;
		const url = makeStatusUrl();
		if (!url) {
			installStatus = null;
			installError = 'Missing connector information';
			return;
		}

		installError = null;

		const controller = new AbortController();
		const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const res = await axios.get(url, {
				signal: controller.signal,
				timeout: TIMEOUT_MS,
				headers: {
					Authorization: `Bearer ${data.site.connectorToken}`
				}
			});

			if (res.status !== 200) {
				installStatus = null;
				installError = 'Unexpected response status';
				return;
			}

			if (res.data && typeof res.data === 'object' && res.data.status) {
				installStatus = res.data;
			} else {
				installStatus = null;
				installError = 'Invalid install status response';
			}
		} catch (err) {
			if (axios.isAxiosError(err) && err.response?.status === 404) {
				installStatus = null;
				installError = null;
				installStatusNotFound = true;
				if (timer) {
					clearInterval(timer);
					timer = null;
				}
			} else {
				installStatus = null;
				installError = 'Failed to fetch install status';
				console.error('Site install status check failed:', err);
			}
		} finally {
			clearTimeout(t);
		}
	}

	let timer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		refreshInstallStatus();
		timer = setInterval(refreshInstallStatus, POLL_MS);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<Card.Root>
	<Card.Header class="flex items-center justify-between">
		<div>
			<Card.Title class="flex items-center gap-2">
				<Settings class="size-4" />
				Manage {data.site.name}
			</Card.Title>
			<Card.Description>{data.site.domain}</Card.Description>
		</div>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if form?.message}
			<div
				class={`rounded-md border p-3 text-sm ${
					form.success
						? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
						: 'border-red-500/30 bg-red-500/10 text-red-600'
				}`}
			>
				{form.message}
			</div>
		{/if}
		<div class="space-y-2 rounded-lg border p-3">
			<div class="flex items-center justify-between">
				<div class="text-sm font-medium">Provisioning status</div>
				<Button variant="secondary" size="sm" onclick={refreshInstallStatus}>
					<RefreshCw class="size-4" />
					Refresh
				</Button>
			</div>
			{#if installError}
				<div class="text-sm text-red-600">{installError}</div>
			{:else if installStatus}
				<div class="text-base font-semibold capitalize">{installStatus.status}</div>
				{#if installStatus.message}
					<div class="text-xs text-muted-foreground">{installStatus.message}</div>
				{/if}
				{#if installStatus.site_url}
					<div class="text-xs break-all text-muted-foreground">{installStatus.site_url}</div>
				{/if}
			{:else}
				<div class="text-sm text-muted-foreground">No install status data.</div>
			{/if}
		</div>

		<div class="grid gap-2 text-sm">
			<div><span class="font-medium">Status:</span> {data.site.status ?? 'unknown'}</div>
			<div><span class="font-medium">Disk limit:</span> {data.site.diskLimitMb} MB</div>
			{#if data.site.phpVersion}
				<div><span class="font-medium">PHP:</span> {data.site.phpVersion}</div>
			{/if}
			<div><span class="font-medium">Docroot:</span> {data.site.docroot}</div>
			<div><span class="font-medium">DB name:</span> {data.site.dbName}</div>
			<div><span class="font-medium">DB user:</span> {data.site.dbUser}</div>
			{#if data.site.connectorFqdn}
				<div>
					<span class="font-medium">Connector:</span>
					{data.site.connectorFqdn}
					{#if data.site.locationName}
						- {data.site.locationName}
						{data.site.locationCountry ? ` (${data.site.locationCountry})` : ''}
					{/if}
				</div>
			{/if}
		</div>

		<div class="rounded-lg border p-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2 text-sm font-medium">
					<HardDrive class="size-4" />
					Resize storage
				</div>
				<Button
					variant="secondary"
					size="sm"
					type="button"
					onclick={() => (showResize = !showResize)}
				>
					{#if showResize}
						<ChevronUp class="size-4" />
						Hide
					{:else}
						<ChevronDown class="size-4" />
						Resize
					{/if}
				</Button>
			</div>
			{#if showResize}
				<form method="POST" action="?/resize" class="mt-3 flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						size="icon-sm"
						type="button"
						aria-label="Decrease size"
						onclick={() => adjustResize(-1)}
					>
						<Minus />
					</Button>
					<Input
						name="newSize"
						type="number"
						min={MIN_RESIZE}
						class="w-24"
						bind:value={resizeSize}
						required
					/>
					<Button
						variant="outline"
						size="icon-sm"
						type="button"
						aria-label="Increase size"
						onclick={() => adjustResize(1)}
					>
						<Plus />
					</Button>
					<select
						name="unitType"
						class="rounded-md border px-2 py-1 text-sm"
						bind:value={resizeUnit}
						required
					>
						<option value="M">MB</option>
						<option value="G">GB</option>
						<option value="T">TB</option>
					</select>
					<Button variant="secondary" size="sm" type="submit">Apply</Button>
				</form>
				{#if firstError('newSize')}
					<p class="mt-1 text-xs text-red-500">{firstError('newSize')}</p>
				{:else if firstError('unitType')}
					<p class="mt-1 text-xs text-red-500">{firstError('unitType')}</p>
				{/if}
			{/if}
		</div>

		<div class="flex flex-wrap gap-2">
			<a href={`/admin/sites/${data.site.id}/stats`}>
				<Button type="button" variant="outline">
					<BarChart3 class="size-4" />
					Stats
				</Button>
			</a>
			<form method="POST" action="?/sync">
				<Button type="submit" variant="secondary">
					<RefreshCw class="size-4" />
					Sync
				</Button>
			</form>
			<form method="POST" action="?/delete">
				<Button type="submit" variant="destructive">
					<Trash2 class="size-4" />
					Delete
				</Button>
			</form>
		</div>
	</Card.Content>
</Card.Root>
