<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { connectorSiteHealthUrl, connectorSiteStatusUrl } from '$lib/connector-url';
	import axios from 'axios';
	import { Activity, ArrowLeft, RefreshCw } from 'lucide-svelte';

	export let data: {
		site: {
			id: string;
			name: string;
			domain: string;
			connectorId: number | null;
			connectorFqdn: string | null;
			connectorToken: string | null;
			connectorDaemonSslEnabled: boolean | null;
			locationName: string | null;
			locationCountry: string | null;
		};
	};

	type Status = 'checking' | 'online' | 'offline';

	type Health = {
		id: string;
		domain: string;
		path: string;
		usageBytes: number;
		usageHuman: string;
		diskTotalBytes: number;
		diskUsedBytes: number;
		diskFreeBytes: number;
		diskUsedPct: number;
		diskTotalHuman: string;
		diskUsedHuman: string;
		diskFreeHuman: string;
	};

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

	let healthStatus: Status = 'checking';
	let health: Health | null = null;
	let healthError: string | null = null;
	let installStatus: InstallStatus | null = null;
	let installError: string | null = null;
	let installStatusNotFound = false;

	const POLL_MS = 5000;
	const TIMEOUT_MS = 5000;

	function makeUrl() {
		if (!data.site.connectorFqdn || !data.site.connectorToken) return null;
		return connectorSiteHealthUrl(
			{
				fqdn: data.site.connectorFqdn,
				daemonSslEnabled: data.site.connectorDaemonSslEnabled
			},
			data.site.id
		);
	}

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

	async function refreshHealth() {
		const url = makeUrl();
		if (!url) {
			healthStatus = 'offline';
			health = null;
			healthError = 'Missing connector information';
			return;
		}

		healthStatus = 'checking';
		healthError = null;

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
				healthStatus = 'offline';
				health = null;
				healthError = 'Unexpected response status';
				return;
			}

			if (res.data && typeof res.data === 'object' && res.data.path) {
				healthStatus = 'online';
				health = res.data;
			} else {
				healthStatus = 'offline';
				health = null;
				healthError = 'Invalid health response';
			}
		} catch (err) {
			if (axios.isAxiosError(err) && err.response?.status === 404) {
				healthStatus = 'offline';
				health = null;
				healthError = 'Health data not found';
			} else {
				healthStatus = 'offline';
				health = null;
				healthError = 'Failed to fetch health';
				console.error('Site health check failed:', err);
			}
		} finally {
			clearTimeout(t);
		}
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
			} else {
				installStatus = null;
				installError = 'Failed to fetch install status';
				console.error('Site install status check failed:', err);
			}
		} finally {
			clearTimeout(t);
		}
	}

	async function refreshAll() {
		await Promise.all([refreshHealth(), refreshInstallStatus()]);
	}

	let timer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		refreshAll();
		timer = setInterval(refreshAll, POLL_MS);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	function badgeClass(s: Status) {
		if (s === 'online') return 'border-green-500/30 bg-green-500/10 text-green-600';
		if (s === 'offline') return 'border-red-500/30 bg-red-500/10 text-red-600';
		return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700';
	}

	function badgeLabel(s: Status) {
		if (s === 'online') return 'Online';
		if (s === 'offline') return 'Offline';
		return 'Checking';
	}
</script>

<div class="max-w-3xl space-y-6 p-6">
	<a
		class="flex items-center gap-1 text-sm hover:underline"
		href={`/admin/sites/${data.site.id}/edit`}
	>
		<ArrowLeft class="size-4" />
		Back
	</a>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Activity class="size-4" />
				Site health
			</Card.Title>
			<Card.Description>{data.site.domain}</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			<div class="flex items-center justify-between gap-3">
				<span
					class={'inline-flex items-center rounded-full border px-2 py-0.5 text-xs ' +
						badgeClass(healthStatus)}
				>
					{badgeLabel(healthStatus)}
				</span>

				<Button variant="secondary" size="sm" onclick={refreshAll}>
					<RefreshCw class="size-4" />
					Refresh
				</Button>
			</div>

			{#if installError}
				<div class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
					{installError}
				</div>
			{:else if installStatus}
				<div class="rounded-lg border p-3">
					<div class="text-xs text-muted-foreground">Install status</div>
					<div class="text-base font-semibold capitalize">{installStatus.status}</div>
					{#if installStatus.message}
						<div class="text-xs text-muted-foreground">{installStatus.message}</div>
					{/if}
					{#if installStatus.site_url}
						<div class="text-xs break-all text-muted-foreground">{installStatus.site_url}</div>
					{/if}
				</div>
			{:else}
				<div class="text-sm text-muted-foreground">No install status data.</div>
			{/if}

			{#if !data.site.connectorFqdn}
				<div class="text-sm text-muted-foreground">No connector assigned.</div>
			{:else if healthError}
				<div class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
					{healthError}
				</div>
			{:else if healthStatus === 'offline'}
				<div class="text-sm text-muted-foreground">No health data.</div>
			{:else if !health}
				<div class="text-sm text-muted-foreground">Fetching...</div>
			{:else}
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">Path</div>
						<div class="text-sm font-medium break-all">{health.path}</div>
					</div>

					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">Usage</div>
						<div class="text-lg font-semibold">{health.usageHuman}</div>
					</div>

					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">Disk total</div>
						<div class="text-base font-semibold">{health.diskTotalHuman}</div>
					</div>

					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">Disk used</div>
						<div class="text-base font-semibold">{health.diskUsedHuman}</div>
						<div class="text-xs text-muted-foreground">{health.diskUsedPct.toFixed(1)}%</div>
					</div>

					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">Disk free</div>
						<div class="text-base font-semibold">{health.diskFreeHuman}</div>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
