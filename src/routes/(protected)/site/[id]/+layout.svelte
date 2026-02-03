<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';
	import { ExternalLink } from 'lucide-svelte';

	const { children, data } = $props();

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
	<Menubar.Root class="menubar-motion mb-4 flex gap-2">
		<Menubar.Menu>
			<Menubar.Trigger asChild>
				<a class="motion-action" href={resolve('/site/[id]', { id: data.site.id })}>Info</a>
			</Menubar.Trigger>
		</Menubar.Menu>

		<Menubar.Menu>
			<Menubar.Trigger asChild>
				<a class="motion-action" href={resolve('/site/[id]/health', { id: data.site.id })}>Health</a
				>
			</Menubar.Trigger>
		</Menubar.Menu>

		<Menubar.Menu>
			<Menubar.Trigger asChild>
				<a class="motion-action" href={resolve('/site/[id]/filemanager', { id: data.site.id })}
					>Files</a
				>
			</Menubar.Trigger>
		</Menubar.Menu>
		<Menubar.Menu>
			<Menubar.Trigger asChild>
				<a class="motion-action" href={resolve('/site/[id]/users', { id: data.site.id })}>Users</a>
			</Menubar.Trigger>
		</Menubar.Menu>
		<Menubar.Menu>
			<Menubar.Trigger asChild>
				<a class="motion-action" href={resolve('/site/[id]/plugins', { id: data.site.id })}
					>Plugins</a
				>
			</Menubar.Trigger>
		</Menubar.Menu>
		<Menubar.Menu>
			<Menubar.Trigger asChild>
				<a class="motion-action" href={resolve('/site/[id]/themes', { id: data.site.id })}>Themes</a
				>
			</Menubar.Trigger>
		</Menubar.Menu>
		<Menubar.Menu>
			<Menubar.Trigger asChild>
				<a class="motion-action" href={"http://" + data.site.domain} target="_blank">
					<ExternalLink />
				</a>
			</Menubar.Trigger>
		</Menubar.Menu>
	</Menubar.Root>

	{@render children()}
</div>

<style>
	.menubar-motion,
	.motion-action {
		transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
		will-change: transform;
	}

	.menubar-motion:where(:hover, :focus-within),
	.motion-action:where(:hover, :focus-visible) {
		transform: translateY(-2px);
	}

	@media (prefers-reduced-motion: reduce) {
		.menubar-motion,
		.motion-action {
			transition: none;
			will-change: auto;
		}

		.menubar-motion:where(:hover, :focus-within),
		.motion-action:where(:hover, :focus-visible) {
			transform: none;
		}
	}
</style>
