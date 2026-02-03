<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { connectorHealthUrl } from '$lib/connector-url';
	import axios from 'axios';
	import CardHeader from '../../CardHead.svelte';
	import { ArrowLeft, RefreshCw } from 'lucide-svelte';

	export let data: {
		conn?: {
			id: number;
			fqdn: string;
			token: string;
			daemonSslEnabled: boolean;
		} | null;
	};

	console.log(data);

	type Status = 'checking' | 'online' | 'offline';

	type Health = {
		status: 'ok' | 'error';
		cpu: { percent: number };
		ram: { usedHuman: string; totalHuman: string; usedPct: number };
		swap?: { usedHuman: string; totalHuman: string; usedPct: number; totalBytes: number };
		disk: { path: string; usedHuman: string; totalHuman: string; usedPct: number };
	};

	let status: Status = 'checking';
	let health: Health | null = null;

	const POLL_MS = 5000;
	const TIMEOUT_MS = 25000;

	function makeUrl() {
		if (!data?.conn) return null;
		return connectorHealthUrl(data.conn);
	}

	async function refresh() {
		const url = makeUrl();
		if (!url) {
			status = 'offline';
			health = null;
			return;
		}

		status = 'checking';

		const controller = new AbortController();
		const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const res = await axios.get(url, {
				headers: {
					Authorization: `Bearer ${data.conn.token}`
				}
			});

			if (res.status !== 200) {
				status = 'offline';
				health = null;
				return;
			}

			// Validate response data structure
			if (
				res.data &&
				typeof res.data === 'object' &&
				res.data.cpu &&
				res.data.ram &&
				res.data.disk
			) {
				status = 'online';
				health = res.data;
			} else {
				status = 'offline';
				health = null;
			}
		} catch (err) {
			status = 'offline';
			health = null;
			// Optionally log error for debugging
			console.error('Health check failed:', err);
		} finally {
			clearTimeout(t);
		}
	}

	let timer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		refresh();
		timer = setInterval(refresh, POLL_MS);
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
	<a class="flex items-center gap-1 text-sm hover:underline" href="/admin/connectors">
		<ArrowLeft class="size-4" />
		Back
	</a>

	<Card.Root>
		<CardHeader {data} />
		<Card.Header>
			<Card.Description>
				{data?.conn?.fqdn ?? 'Connector not found'}
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			<div class="flex items-center justify-between gap-3">
				<span
					class={'inline-flex items-center rounded-full border px-2 py-0.5 text-xs ' +
						badgeClass(status)}
				>
					{badgeLabel(status)}
				</span>

				<Button variant="secondary" size="sm" onclick={refresh}>
					<RefreshCw class="size-4" />
					Refresh
				</Button>
			</div>

			{#if !data?.conn?.fqdn}
				<div class="text-sm text-muted-foreground">No connector data.</div>
			{:else if status === 'offline'}
				<div class="text-sm text-muted-foreground">No health data.</div>
			{:else if !health}
				<div class="text-sm text-muted-foreground">Fetching…</div>
			{:else}
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">CPU</div>
						<div class="text-lg font-semibold">{health.cpu.percent.toFixed(1)}%</div>
					</div>

					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">RAM</div>
						<div class="text-base font-semibold">
							{health.ram.usedHuman} / {health.ram.totalHuman}
						</div>
						<div class="text-xs text-muted-foreground">{health.ram.usedPct.toFixed(1)}%</div>
					</div>

					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">SWAP</div>
						{#if health.swap && health.swap.totalBytes > 0}
							<div class="text-base font-semibold">
								{health.swap.usedHuman} / {health.swap.totalHuman}
							</div>
							<div class="text-xs text-muted-foreground">{health.swap.usedPct.toFixed(1)}%</div>
						{:else}
							<div class="text-sm text-muted-foreground">0</div>
						{/if}
					</div>

					<div class="rounded-lg border p-3">
						<div class="text-xs text-muted-foreground">Disk ({health.disk.path})</div>
						<div class="text-base font-semibold">
							{health.disk.usedHuman} / {health.disk.totalHuman}
						</div>
						<div class="text-xs text-muted-foreground">{health.disk.usedPct.toFixed(1)}%</div>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
