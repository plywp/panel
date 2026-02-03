<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';

	export type SiteCreateStatus = 'queued' | 'running' | 'failed' | 'completed';

	export type SiteCreateJob = {
		id: string;
		system_id?: string;
		domain: string;
		status: SiteCreateStatus;
		message?: string;
		started_at: string;
		finished_at?: string | null;
		site_url?: string;
		wp_path?: string;
		db_name?: string;
	};

	export let data: {
		site: {
			id: string;
			name: string;
			domain: string;
			status: SiteCreateJob | null;
			phpVersion: string | null;
			dbName: string;
			dbUser: string;
			connectorId: number | null;
		};
	};

	export let form:
		| {
				success?: boolean;
				adminPassword?: string;
				message?: string;
		  }
		| undefined;

	const { site } = data;

	let adminPassword: string | null = null;
	let errorMessage: string | null = null;

	let isRevealed = false;
	let clearTimer: ReturnType<typeof setTimeout> | null = null;

	let secondsLeft = 0;
	let tickTimer: ReturnType<typeof setInterval> | null = null;

	let copied = false;
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	let showAdvanced = false;

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

	const badgeVariant = (s: SiteCreateStatus) => {
		switch (s) {
			case 'queued':
				return 'outline';
			case 'running':
				return 'secondary';
			case 'failed':
				return 'destructive';
			case 'completed':
				return 'default';
		}
	};

	const clearRevealTimer = () => {
		if (clearTimer) clearTimeout(clearTimer);
		clearTimer = null;
	};

	const clearTickTimer = () => {
		if (tickTimer) clearInterval(tickTimer);
		tickTimer = null;
	};

	const stopCountdown = () => {
		secondsLeft = 0;
		clearTickTimer();
	};

	const autoClearNow = () => {
		adminPassword = null;
		isRevealed = false;
		stopCountdown();
		clearRevealTimer();
	};

	const scheduleAutoClear = (ms = 15_000) => {
		clearRevealTimer();
		clearTickTimer();

		secondsLeft = Math.max(1, Math.ceil(ms / 1000));

		tickTimer = setInterval(() => {
			secondsLeft = Math.max(0, secondsLeft - 1);
			if (secondsLeft === 0) clearTickTimer();
		}, 1000);

		clearTimer = setTimeout(() => {
			autoClearNow();
		}, ms);
	};

	$: if (form?.success && form.adminPassword) {
		adminPassword = form.adminPassword;
		errorMessage = null;
		isRevealed = false;
		stopCountdown();
		clearRevealTimer();
	}

	$: if (form && !form.success && form.message) {
		errorMessage = form.message;
	}

	const toggleReveal = () => {
		if (!adminPassword) return;
		isRevealed = !isRevealed;

		if (isRevealed) scheduleAutoClear(15_000);
		else {
			stopCountdown();
			clearRevealTimer();
		}
	};

	const clearCopied = () => {
		if (copiedTimer) clearTimeout(copiedTimer);
		copiedTimer = null;
		copied = false;
	};

	const copyPassword = async () => {
		if (!adminPassword) return;
		try {
			await navigator.clipboard.writeText(adminPassword);
			clearCopied();
			copied = true;
			copiedTimer = setTimeout(() => (copied = false), 900);
		} catch {
			// ignore
		}
	};

	const copyDomain = async () => {
		try {
			await navigator.clipboard.writeText(site.domain);
			clearCopied();
			copied = true;
			copiedTimer = setTimeout(() => (copied = false), 900);
		} catch {
			// ignore
		}
	};

	onDestroy(() => {
		clearRevealTimer();
		clearTickTimer();
		if (copiedTimer) clearTimeout(copiedTimer);
	});
</script>

<div
	in:fly={{
		y: prefersReducedMotion ? 0 : 10,
		duration: prefersReducedMotion ? 0 : 200,
		easing: easeStandard
	}}
>
	<Card.Root class="motion-card">
		<Card.Header class="space-y-2">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<Card.Title class="text-xl leading-tight">{site.name}</Card.Title>
					<Card.Description class="truncate">{site.domain}</Card.Description>
				</div>

				{#if site.status}
					<Badge variant={badgeVariant(site.status.status)} class="capitalize">
						{site.status.status}
					</Badge>
				{:else}
					<Badge variant="default" class="bg-green-500 text-green-50">Online</Badge>
				{/if}
			</div>

			{#if site.status?.message}
				<div
					class="rounded-md border px-3 py-2 text-sm
					{site.status.status === 'failed'
						? 'border-destructive text-destructive'
						: 'border-muted text-muted-foreground'}"
				>
					{site.status.message}
				</div>
			{/if}
		</Card.Header>

		<Card.Content class="grid gap-6">
			<div class="grid gap-2">
				<div class="text-xs text-muted-foreground">Primary domain</div>
				<div class="flex items-center justify-between gap-2">
					<div class="truncate font-mono text-sm font-medium" title={site.domain}>
						{site.domain}
					</div>
					<Button
						type="button"
						variant="ghost"
						class="motion-action h-8 shrink-0 px-2"
						onclick={copyDomain}
					>
						{copied ? 'Copied' : 'Copy'}
					</Button>
				</div>
			</div>

			<div class="grid gap-3">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<div class="space-y-0.5">
						<div class="text-sm font-medium">Admin access</div>
						<div class="text-xs text-muted-foreground">
							Password is hidden by default and auto-clears after 15 seconds when revealed.
						</div>
					</div>

					<form
						method="POST"
						action="?/showPassword"
						use:enhance={() => {
							errorMessage = null;
							return async ({ update }) => {
								await update();
							};
						}}
					>
						<Button class="motion-action" variant="secondary" type="submit">Fetch password</Button>
					</form>
				</div>

				{#if errorMessage}
					<div class="text-sm text-destructive">{errorMessage}</div>
				{/if}

				{#if adminPassword}
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
						<Input
							class="font-mono"
							type={isRevealed ? 'text' : 'password'}
							value={adminPassword}
							readonly
						/>
						<div class="flex gap-2">
							<Button
								class="motion-action"
								type="button"
								variant="secondary"
								onclick={toggleReveal}
							>
								{isRevealed ? 'Hide' : 'Reveal'}
								{#if isRevealed && secondsLeft > 0}
									<span class="ml-2 text-xs text-muted-foreground">({secondsLeft}s)</span>
								{/if}
							</Button>
							<Button class="motion-action" type="button" onclick={copyPassword}>
								{copied ? 'Copied' : 'Copy'}
							</Button>
							<Button class="motion-action" type="button" variant="ghost" onclick={autoClearNow}>
								Clear
							</Button>
						</div>
					</div>
				{/if}
			</div>

			<div class="grid gap-3">
				<Button
					type="button"
					variant="ghost"
					class="motion-action justify-between px-2"
					onclick={() => (showAdvanced = !showAdvanced)}
				>
					<span class="text-sm font-medium">Details</span>
					<span class="text-xs text-muted-foreground">{showAdvanced ? 'Hide' : 'Show'}</span>
				</Button>

				{#if showAdvanced}
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="grid gap-1">
							<div class="text-xs text-muted-foreground">PHP version</div>
							<div class="text-sm font-medium">{site.phpVersion ?? 'Default'}</div>
						</div>

						<div class="grid gap-1">
							<div class="text-xs text-muted-foreground">Connector ID</div>
							<div class="font-mono text-sm font-medium">{site.connectorId ?? '—'}</div>
						</div>

						<div class="grid gap-1 sm:col-span-2">
							<div class="text-xs text-muted-foreground">Database</div>
							<div
								class="truncate font-mono text-sm font-medium"
								title={`${site.dbUser} @ ${site.dbName}`}
							>
								{site.dbUser} @ {site.dbName}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
</div>

<style>
	.motion-card,
	.motion-action {
		transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
		will-change: transform;
	}

	.motion-card:where(:hover, :focus-within),
	.motion-action:where(:hover, :focus-visible) {
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.motion-card,
		.motion-action {
			transition: none;
			will-change: auto;
		}

		.motion-card:where(:hover, :focus-within),
		.motion-action:where(:hover, :focus-visible) {
			transform: none;
		}
	}
</style>
