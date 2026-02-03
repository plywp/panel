<script lang="ts">
	import { signIn } from '$lib/auth-client';
	import { writable, get } from 'svelte/store';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';
	import { _ as __ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';

	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import Lock from 'lucide-svelte/icons/lock';
	import Mail from 'lucide-svelte/icons/mail';
	import Eye from 'lucide-svelte/icons/eye';
	import EyeOff from 'lucide-svelte/icons/eye-off';
	import LanguageSwitcher from '$lib/components/lang-switcher.svelte';

	const email = writable('');
	const password = writable('');
	const showPassword = writable(false);

	let error: string | null = null;

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

	const handleSignIn = async () => {
		const e = get(email).trim();
		const p = get(password);

		if (!e || !p) {
			toast.error('Missing credentials');
			return;
		}

		error = null;

		try {
			const res = await signIn.email({
				email: e,
				password: p,
				callbackURL: '/'
			});

			if (res?.error) {
				error = res.error.message ?? 'Invalid login';
				return;
			}

			location.href = '/';
		} catch {
			error = 'Something went wrong';
		}
	};
</script>

<svelte:head>
	<title>PlyWP - Sign In</title>
</svelte:head>

<div
	in:fly={{
		y: prefersReducedMotion ? 0 : 10,
		duration: prefersReducedMotion ? 0 : 200,
		easing: easeStandard
	}}
>
	<Card.Root class="motion-card mx-auto mt-20 max-w-sm rounded-lg border ">
		<Card.Header class="space-y-1">
			<Card.Title class="text-xl font-medium">
				{$__('auth.signIn.title')}
			</Card.Title>
			<Card.Description class="text-sm text-muted-foreground">
				{$__('auth.signIn.description')}
			</Card.Description>

			{#if error}
				<p class="text-sm text-red-500">{error}</p>
			{/if}
		</Card.Header>

		<Card.Content>
			<form class="space-y-4" on:submit|preventDefault={handleSignIn}>
				<div class="space-y-1.5">
					<Label for="email">{$__('auth.signIn.email')}</Label>

					<div class="relative">
						<Mail class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="email"
							type="email"
							autocomplete="email"
							placeholder="you@organization.com"
							class="pl-9"
							bind:value={$email}
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<div class="flex items-center justify-between">
						<Label for="password">{$__('auth.signIn.password')}</Label>
						<a href="/forget-password" class="text-xs text-muted-foreground hover:text-foreground">
							{$__('auth.signIn.ForgotPassword')}
						</a>
					</div>

					<div class="relative">
						<Lock class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

						<Input
							id="password"
							type={$showPassword ? 'text' : 'password'}
							autocomplete="current-password"
							class="pr-9 pl-9"
							bind:value={$password}
						/>

						<button
							type="button"
							class="motion-action absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							on:click={() => showPassword.update((v) => !v)}
							aria-label="Toggle password visibility"
						>
							{#if $showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
				</div>

				<Button
					type="submit"
					class="motion-action flex w-full items-center justify-center gap-2"
					disabled={!$email || !$password}
				>
					{$__('auth.signIn.button')}
					<ArrowRight class="h-4 w-4" />
				</Button>

				<p class="text-center text-xs text-muted-foreground">
					{$__('auth.signIn.noAccount')}{' '}
					<a href="/sign-up" class="motion-action ml-1 underline">
						{$__('auth.signIn.createAccount')}
					</a>
				</p>
			</form>
		</Card.Content>
		<LanguageSwitcher />
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
