<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import SidebarUser from '$lib/components/sidebar-user.svelte';
	import LangSwitcher from '$lib/components/lang-switcher.svelte';
	import OrgSwitcher from '$lib/components/org-switcher.svelte';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';

	import {
		LayoutDashboard,
		MapPin,
		Plug,
		Users,
		Settings,
		Building2,
		Server,
		KeyRound
	} from 'lucide-svelte';

	export let user: any = null;
	export let data: {
		meta: {
			title: string;
			description: string;
		};
	} = {
		meta: {
			title: 'PlyWP',
			description: 'A powerful and flexible WordPress Management Panel.'
		}
	};

	const isAdmin = user?.role === 'admin';

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
	in:fly={{
		y: prefersReducedMotion ? 0 : 10,
		duration: prefersReducedMotion ? 0 : 200,
		easing: easeStandard
	}}
>
	<Sidebar.Root>
		<Sidebar.Header class="motion-card">
			<div class="flex flex-col items-center justify-center px-3 py-2">
				<h1 class="">{data.meta.title}</h1>
				<p class="">{data?.meta?.description}</p>
			</div>
		</Sidebar.Header>

		<Sidebar.Content class="px-2">
			<div class="motion-item">
				<OrgSwitcher />
			</div>

			<Sidebar.Group>
				<Sidebar.GroupLabel
					class="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
				>
					Main
				</Sidebar.GroupLabel>

				<div class="mt-2 flex flex-col gap-1">
					<a
						href="/dashboard"
						class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
					>
						<LayoutDashboard class="h-4 w-4" />
						<span>Dashboard</span>
					</a>

					<a
						href="/organization"
						class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
					>
						<Building2 class="h-4 w-4" />
						<span>Organization</span>
					</a>
				</div>
			</Sidebar.Group>

			{#if isAdmin}
				<Sidebar.Group>
					<Sidebar.GroupLabel
						class="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
					>
						Admin
					</Sidebar.GroupLabel>

					<div class="mt-2 flex flex-col gap-1">
						<a
							href="/admin"
							class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
						>
							<LayoutDashboard class="h-4 w-4" />
							<span>Admin Overview</span>
						</a>

						<a
							href="/admin/locations"
							class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
						>
							<MapPin class="h-4 w-4" />
							<span>Locations</span>
						</a>

						<a
							href="/admin/connectors"
							class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
						>
							<Plug class="h-4 w-4" />
							<span>Connectors</span>
						</a>

						<a
							href="/admin/sites"
							class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
						>
							<Server class="h-4 w-4" />
							<span>Sites</span>
						</a>

						<a
							href="/admin/users"
							class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
						>
							<Users class="h-4 w-4" />
							<span>Users</span>
						</a>

						<a
							href="/admin/api-keys"
							class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
						>
							<KeyRound class="h-4 w-4" />
							<span>API Keys</span>
						</a>

						<a
							href="/admin/settings"
							class="motion-action flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
						>
							<Settings class="h-4 w-4" />
							<span>Settings</span>
						</a>
					</div>
				</Sidebar.Group>
			{/if}
		</Sidebar.Content>

		<Sidebar.Footer>
			<div class="space-y-3 p-3">
				<div class="motion-item">
					<LangSwitcher data={user} lang={user.lang} />
				</div>
				<div class="motion-item">
					<SidebarUser {user} />
				</div>
			</div>
		</Sidebar.Footer>
	</Sidebar.Root>
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
