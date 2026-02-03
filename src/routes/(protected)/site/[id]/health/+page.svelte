<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { browser } from '$app/environment';
	import { fade, fly } from 'svelte/transition';

	export let data: {
		site: {
			id: string;
			name: string;
			domain: string;
			connectorId: string | null;
			connectorFqdn: string | null;
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

	const POLL_MS = 5000;

	const prefersReducedMotion =
		browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
		const newtonIterations = 8;
		const newtonMinSlope = 0.001;
		const subdivisionPrecision = 0.0000001;
		const subdivisionMaxIterations = 10;

		const kSplineTableSize = 11;
		const kSampleStepSize = 1 / (kSplineTableSize - 1);

		const float32ArraySupported = typeof Float32Array === 'function';

		const sampleValues = float32ArraySupported
			? new Float32Array(kSplineTableSize)
			: new Array(kSplineTableSize);

		const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
		const b = (a1: number, a2: number) => 3 * a2 - 6 * a1;
		const c = (a1: number) => 3 * a1;

		const calcBezier = (t: number, a1: number, a2: number) =>
			((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;
		const getSlope = (t: number, a1: number, a2: number) =>
			3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1);

		for (let i = 0; i < kSplineTableSize; ++i) {
			sampleValues[i] = calcBezier(i * kSampleStepSize, x1, x2);
		}

		const binarySubdivide = (x: number, a1: number, a2: number) => {
			let currentX = 0;
			let currentT = 0;
			let i = 0;
			let t0 = 0;
			let t1 = 1;

			do {
				currentT = t0 + (t1 - t0) / 2;
				currentX = calcBezier(currentT, a1, a2) - x;
				if (currentX > 0) {
					t1 = currentT;
				} else {
					t0 = currentT;
				}
			} while (Math.abs(currentX) > subdivisionPrecision && ++i < subdivisionMaxIterations);

			return currentT;
		};

		const newtonRaphsonIterate = (x: number, guessT: number, a1: number, a2: number) => {
			for (let i = 0; i < newtonIterations; ++i) {
				const currentSlope = getSlope(guessT, a1, a2);
				if (currentSlope === 0) return guessT;
				const currentX = calcBezier(guessT, a1, a2) - x;
				guessT -= currentX / currentSlope;
			}
			return guessT;
		};

		const getTForX = (x: number) => {
			let intervalStart = 0;
			let currentSample = 1;
			const lastSample = kSplineTableSize - 1;

			for (; currentSample !== lastSample && sampleValues[currentSample] <= x; ++currentSample) {
				intervalStart += kSampleStepSize;
			}
			--currentSample;

			const dist =
				(x - sampleValues[currentSample]) /
				(sampleValues[currentSample + 1] - sampleValues[currentSample]);
			const guessForT = intervalStart + dist * kSampleStepSize;

			const initialSlope = getSlope(guessForT, x1, x2);
			if (initialSlope >= newtonMinSlope) {
				return newtonRaphsonIterate(x, guessForT, x1, x2);
			}
			if (initialSlope === 0) return guessForT;
			return binarySubdivide(x, x1, x2);
		};

		return (x: number) => {
			if (x === 0 || x === 1) return x;
			return calcBezier(getTForX(x), y1, y2);
		};
	};

	const easeStandard = cubicBezier(0.4, 0, 0.2, 1);

	async function callAction<T>(name: string): Promise<T> {
		const fd = new FormData();
		fd.set('x', '1');

		const res = await fetch(`?/${name}`, {
			method: 'POST',
			body: fd
		});

		const result = deserialize(await res.text());

		if (result.type === 'success') return result.data as T;
		throw new Error(result.data?.message ?? result.error?.message ?? 'Request failed');
	}

	async function refreshHealth() {
		if (!data.site.connectorFqdn) {
			healthStatus = 'offline';
			health = null;
			healthError = null;
			return;
		}

		healthStatus = 'checking';
		healthError = null;

		try {
			const payload = await callAction<Health>('health');
			if (payload && payload.path) {
				healthStatus = 'online';
				health = payload;
				return;
			}
			healthStatus = 'offline';
			health = null;
			healthError = 'Invalid health response';
		} catch {
			healthStatus = 'offline';
			health = null;
			healthError = 'Failed to fetch health';
		}
	}

	async function refreshInstallStatus() {
		if (!data.site.connectorFqdn) {
			installStatus = null;
			installError = null;
			return;
		}

		installError = null;

		try {
			const payload = await callAction<InstallStatus | null>('installStatus');
			if (!payload) {
				installStatus = null;
				installError = null;
				return;
			}
			if (payload && payload.status) {
				installStatus = payload;
				return;
			}
			installStatus = null;
			installError = 'Invalid install status response';
		} catch {
			installStatus = null;
			installError = 'Failed to fetch install status';
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

	function extractIndicator() {
		if (!data.site.connectorFqdn) return 'Extract: unavailable (no connector)';
		if (healthStatus === 'offline') return 'Extract: unavailable (connector offline)';
		if (healthStatus === 'checking') return 'Extract: checking connector';
		return 'Extract: depends on connector version';
	}
</script>

<div
	class="max-w-3xl"
	in:fly={{
		y: prefersReducedMotion ? 0 : 10,
		duration: prefersReducedMotion ? 0 : 200,
		easing: easeStandard
	}}
>
	<Card.Root class="motion-card">
		<Card.Header>
			<Card.Title>Site health</Card.Title>
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

				<Button class="motion-action" variant="secondary" size="sm" on:click={refreshAll}>
					Refresh
				</Button>
			</div>

			<div class="text-xs text-muted-foreground">{extractIndicator()}</div>

			{#if !data.site.connectorFqdn}
				<div
					class="text-sm text-muted-foreground"
					in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
				>
					No connector assigned.
				</div>
			{/if}

			{#if installError}
				<div
					class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600"
					in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
				>
					{installError}
				</div>
			{:else if installStatus}
				<div
					class="rounded-lg border p-3"
					in:fly={{
						y: prefersReducedMotion ? 0 : 8,
						duration: prefersReducedMotion ? 0 : 180,
						easing: easeStandard
					}}
				>
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

			{#if data.site.connectorFqdn}
				{#if healthError}
					<div
						class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600"
						in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
					>
						{healthError}
					</div>
				{:else if healthStatus === 'offline'}
					<div
						class="text-sm text-muted-foreground"
						in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
					>
						No health data.
					</div>
				{:else if !health}
					<div
						class="text-sm text-muted-foreground"
						in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
					>
						Fetching...
					</div>
				{:else}
					<div
						class="grid grid-cols-1 gap-3 md:grid-cols-2"
						in:fly={{
							y: prefersReducedMotion ? 0 : 8,
							duration: prefersReducedMotion ? 0 : 180,
							easing: easeStandard
						}}
					>
						<div class="motion-item rounded-lg border p-3">
							<div class="text-xs text-muted-foreground">Path</div>
							<div class="text-sm font-medium break-all">{health.path}</div>
						</div>

						<div class="motion-item rounded-lg border p-3">
							<div class="text-xs text-muted-foreground">Usage</div>
							<div class="text-lg font-semibold">{health.usageHuman}</div>
						</div>

						<div class="motion-item rounded-lg border p-3">
							<div class="text-xs text-muted-foreground">Disk total</div>
							<div class="text-base font-semibold">{health.diskTotalHuman}</div>
						</div>

						<div class="motion-item rounded-lg border p-3">
							<div class="text-xs text-muted-foreground">Disk used</div>
							<div class="text-base font-semibold">{health.diskUsedHuman}</div>
							<div class="text-xs text-muted-foreground">{health.diskUsedPct.toFixed(1)}%</div>
						</div>

						<div class="motion-item rounded-lg border p-3">
							<div class="text-xs text-muted-foreground">Disk free</div>
							<div class="text-base font-semibold">{health.diskFreeHuman}</div>
						</div>
					</div>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>
</div>

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
