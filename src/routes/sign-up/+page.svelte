<script lang="ts">
	import { goto } from '$app/navigation';
	import { client, signUp } from '$lib/auth-client';
	import { writable, get } from 'svelte/store';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';

	import User from 'lucide-svelte/icons/user';
	import Mail from 'lucide-svelte/icons/mail';
	import Lock from 'lucide-svelte/icons/lock';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import Eye from 'lucide-svelte/icons/eye';
	import EyeOff from 'lucide-svelte/icons/eye-off';
	import LogIn from 'lucide-svelte/icons/log-in';
	import LanguageSwitcher from '$lib/components/lang-switcher.svelte';

	const firstName = writable('');
	const lastName = writable('');
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

	const slugify = (value: string) =>
		value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)+/g, '');

	const createDefaultOrganization = async (fullName: string, emailValue: string) => {
		const name = `${fullName}'s Workspace`;
		const baseSlug = slugify(fullName) || slugify(emailValue.split('@')[0]) || 'workspace';
		const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

		const { error: orgError } = await client.organization.create({
			name,
			slug,
			keepCurrentActiveOrganization: false
		});

		if (orgError) {
			throw new Error(typeof orgError === 'string' ? orgError : orgError.message);
		}
	};

	const handleSignUp = async () => {
		const fn = get(firstName);
		const ln = get(lastName);
		const e = get(email);
		const p = get(password);

		if (!fn || !ln || !e || !p) {
			toast.error($_('auth.signUp.errors.missingFields'));
			return;
		}

		error = null;

		try {
			const res = await signUp.email({
				email: e,
				password: p,
				name: `${fn} ${ln}`,
				callbackURL: '/'
			});

			if (res?.error) {
				error = res.error.message ?? $_('auth.signUp.errors.failed');
				return;
			}

			try {
				await createDefaultOrganization(`${fn} ${ln}`, e);
			} catch (orgErr) {
				const message = orgErr instanceof Error ? orgErr.message : 'Failed to create default org';
				toast.error(message);
			}

			toast.success($_('auth.signUp.success'));
			goto('/');
		} catch {
			error = $_('auth.signUp.errors.generic');
		}
	};
</script>

<svelte:head>
	<title>PlyWP - Sign Up</title>
</svelte:head>

<div
	in:fly={{
		y: prefersReducedMotion ? 0 : 10,
		duration: prefersReducedMotion ? 0 : 200,
		easing: easeStandard
	}}
>
	<Card.Root class="motion-card mx-auto mt-20 max-w-sm rounded-lg border">
		<Card.Header class="space-y-1">
			<Card.Title class="text-xl font-medium">
				{$_('auth.signUp.title')}
			</Card.Title>

			<Card.Description class="text-sm text-muted-foreground">
				{$_('auth.signUp.description')}
			</Card.Description>

			{#if error}
				<p class="text-sm text-red-500">{error}</p>
			{/if}
		</Card.Header>

		<Card.Content>
			<form class="space-y-4" on:submit|preventDefault={handleSignUp}>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1.5">
						<Label for="first-name" class="flex items-center gap-2">
							<User class="h-4 w-4" />
							{$_('auth.signUp.firstName')}
						</Label>

						<Input
							id="first-name"
							placeholder={$_('auth.signUp.firstNamePlaceholder')}
							bind:value={$firstName}
						/>
					</div>

					<div class="space-y-1.5">
						<Label for="last-name" class="flex items-center gap-2">
							<User class="h-4 w-4" />
							{$_('auth.signUp.lastName')}
						</Label>

						<Input
							id="last-name"
							placeholder={$_('auth.signUp.lastNamePlaceholder')}
							bind:value={$lastName}
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<Label for="email">{$_('auth.signUp.email')}</Label>

					<div class="relative">
						<Mail class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="email"
							type="email"
							autocomplete="email"
							placeholder={$_('auth.signUp.emailPlaceholder')}
							class="pl-9"
							bind:value={$email}
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<Label for="password">{$_('auth.signUp.password')}</Label>

					<div class="relative">
						<Lock class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

						<Input
							id="password"
							type={$showPassword ? 'text' : 'password'}
							autocomplete="new-password"
							class="pr-9 pl-9"
							bind:value={$password}
						/>

						<button
							type="button"
							class="motion-action absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							on:click={() => showPassword.update((v) => !v)}
							aria-label={$_('auth.signUp.togglePassword')}
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
					disabled={!$firstName || !$lastName || !$email || !$password}
				>
					{$_('auth.signUp.button')}
					<ArrowRight class="h-4 w-4" />
				</Button>

				<p class="text-center text-xs text-muted-foreground">
					{$_('auth.signUp.haveAccount')}{' '}
					<a href="/sign-in" class="motion-action ml-1 inline-flex items-center gap-1 underline">
						{$_('auth.signUp.signIn')}
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
