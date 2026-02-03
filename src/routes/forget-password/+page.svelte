<script lang="ts">
	import { client } from '$lib/auth-client';
	import { writable, get } from 'svelte/store';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';

	import Mail from 'lucide-svelte/icons/mail';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';

	const email = writable('');

	let error: string | null = null;
	let sent = false;

	const handleRequest = async () => {
		const e = get(email).trim();

		if (!e) {
			toast.error('Email is required');
			return;
		}

		error = null;
		sent = false;

		try {
			const redirectTo = `${location.origin}/reset-password`;
			const res = await client.requestPasswordReset({
				email: e,
				redirectTo
			});

			if (res?.error) {
				error = res.error.message ?? 'Unable to send reset email';
				return;
			}

			sent = true;
			toast.success('If the email exists, a reset link has been sent.');
		} catch {
			error = 'Something went wrong';
		}
	};
</script>

<svelte:head>
	<title>PlyWP - Forgot Password</title>
</svelte:head>

<Card.Root class="mx-auto mt-20 max-w-sm rounded-lg border">
	<Card.Header class="space-y-1">
		<Card.Title class="text-xl font-medium">Forgot your password?</Card.Title>
		<Card.Description class="text-sm text-muted-foreground">
			Enter your email and we will send you a reset link.
		</Card.Description>

		{#if error}
			<p class="text-sm text-red-500">{error}</p>
		{/if}

		{#if sent}
			<p class="text-sm text-green-600">Check your inbox for the reset link.</p>
		{/if}
	</Card.Header>

	<Card.Content>
		<form class="space-y-4" on:submit|preventDefault={handleRequest}>
			<div class="space-y-1.5">
				<Label for="email">Email</Label>

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

			<Button
				type="submit"
				class="flex w-full items-center justify-center gap-2"
				disabled={!$email}
			>
				Send reset link
				<ArrowRight class="h-4 w-4" />
			</Button>

			<p class="text-center text-xs text-muted-foreground">
				<a href="/sign-in" class="underline">Back to sign in</a>
			</p>
		</form>
	</Card.Content>
</Card.Root>
