<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import UrixianNoSites from '$lib/components/svg/urixian-no-sites-yet.svelte';
	import * as Card from '$lib/components/ui/card';
	import { signOut } from '$lib/auth-client';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import type { PageData } from './$types';

	export let data: PageData;

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
</script>

<div
	class="space-y-6 p-6"
	in:fly={{
		y: prefersReducedMotion ? 0 : 10,
		duration: prefersReducedMotion ? 0 : 200,
		easing: easeStandard
	}}
>
	<Card.Root class="motion-card">
		<Card.Header>
			<Card.Title>Welcome back, {data.session.user?.name}</Card.Title>
			<Card.Description>
				Showing sites for the organization selected in the sidebar. You may have access to
				additional sites in other organizations.
			</Card.Description>
		</Card.Header>

		<Card.Content>
			<div class="">
				{#if !data.activeOrganizationId}
					<div class="text-sm text-muted-foreground">Select an active organization first.</div>
				{:else if data.sites.length === 0}
					<UrixianNoSites />
				{:else}
					<ul class="grid grid-cols-1 gap-4">
						{#each data.sites as site, index (site.id)}
							<li
								class="border-t border-muted-foreground/30 px-4 py-3 first:border-t-0"
								in:fly={{
									y: prefersReducedMotion ? 0 : 8,
									duration: prefersReducedMotion ? 0 : 180,
									delay: prefersReducedMotion ? 0 : index * 30,
									easing: easeStandard
								}}
								animate:flip={{ duration: prefersReducedMotion ? 0 : 150, easing: easeStandard }}
							>
								<div
									class="motion-item group flex items-start justify-between gap-4 rounded-lg p-3 transition
           hover:bg-muted/30"
								>
									<!-- Main clickable area -->
									<a href={'/site/' + site.id} class="min-w-0 flex-1">
										<div class="min-w-0">
											<div class="flex items-center gap-2">
												<Card.Title class="truncate">{site.name}</Card.Title>

												{#if site.status}
													<span
														class="shrink-0 rounded-full bg-muted px-2 py-0.5
                     text-[11px] text-muted-foreground"
													>
														{site.status}
													</span>
												{/if}
											</div>

											<div
												class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
											>
												<span class="truncate">{site.domain}</span>
												<span class="opacity-60">•</span>
												<span>{site.diskLimitMb} MB</span>

												{#if site.phpVersion}
													<span class="opacity-60">•</span>
													<span>PHP {site.phpVersion}</span>
												{/if}
											</div>

											{#if site.connectorFqdn}
												<div
													class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80"
												>
													<span class="truncate font-mono">{site.connectorFqdn}</span>

													{#if site.locationName}
														<span class="opacity-60">•</span>
														<span>
															{site.locationName}{site.locationCountry
																? ` (${site.locationCountry})`
																: ''}
														</span>
													{/if}
												</div>
											{/if}
										</div>
									</a>

									<!-- Right-side actions (not part of link) -->
									<div class="flex shrink-0 items-center gap-2">
										<a
											href={'/site/' + site.id}
											class="motion-action rounded-md px-2 py-1 text-xs text-muted-foreground
               hover:bg-muted/40 hover:text-foreground"
										>
											Manage
										</a>

										{#if site.connectorFqdn}
											<a
												href={site.connectorFqdn.startsWith('http')
													? site.connectorFqdn
													: `https://${site.connectorFqdn}`}
												target="_blank"
												rel="noreferrer"
												class="motion-action rounded-md px-2 py-1 text-xs text-muted-foreground
                 hover:bg-muted/40 hover:text-foreground"
											>
												Open
											</a>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
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
