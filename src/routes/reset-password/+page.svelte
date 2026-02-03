<script lang="ts">
	import { client } from '$lib/auth-client';
	import { page } from '$app/stores';
	import { writable, get } from 'svelte/store';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';

	import Lock from 'lucide-svelte/icons/lock';
	import Eye from 'lucide-svelte/icons/eye';
	import EyeOff from 'lucide-svelte/icons/eye-off';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';

	const password = writable('');
	const confirmPassword = writable('');
	const showPassword = writable(false);

	let error: string | null = null;
	let success = false;

	const getToken = () => $page.url.searchParams.get('token') ?? '';

	const handleReset = async () => {
		const token = getToken();
		const p = get(password);
		const c = get(confirmPassword);

		if (!token) {
			error = 'Reset token is missing or invalid.';
			return;
		}

		if (!p || !c) {
			toast.error('Password is required');
			return;
		}

		if (p !== c) {
			toast.error('Passwords do not match');
			return;
		}

		error = null;
		success = false;

		try {
			const res = await client.resetPassword({
				token,
				newPassword: p
			});

			if (res?.error) {
				error = res.error.message ?? 'Unable to reset password';
				return;
			}

			success = true;
			toast.success('Password updated. You can sign in now.');
			setTimeout(() => {
				location.href = '/sign-in';
			}, 1200);
		} catch {
			error = 'Something went wrong';
		}
	};
</script>

<svelte:head>
	<title>PlyWP - Reset Password</title>
</svelte:head>

<Card.Root class="mx-auto mt-20 max-w-sm rounded-lg border">
	<Card.Header class="space-y-1">
		<Card.Title class="text-xl font-medium">Reset your password</Card.Title>
		<Card.Description class="text-sm text-muted-foreground">
			Enter a new password for your account.
		</Card.Description>

		{#if $page.url.searchParams.get('error') === 'INVALID_TOKEN'}
			<p class="text-sm text-red-500">This reset link is invalid or expired.</p>
		{/if}

		{#if error}
			<p class="text-sm text-red-500">{error}</p>
		{/if}

		{#if success}
			<p class="text-sm text-green-600">Password updated successfully.</p>
		{/if}
	</Card.Header>

	<Card.Content>
		<form class="space-y-4" on:submit|preventDefault={handleReset}>
			<div class="space-y-1.5">
				<Label for="password">New password</Label>

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
						class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

			<div class="space-y-1.5">
				<Label for="confirm-password">Confirm password</Label>
				<Input
					id="confirm-password"
					type={$showPassword ? 'text' : 'password'}
					autocomplete="new-password"
					bind:value={$confirmPassword}
				/>
			</div>

			<Button
				type="submit"
				class="flex w-full items-center justify-center gap-2"
				disabled={!$password || !$confirmPassword}
			>
				Update password
				<ArrowRight class="h-4 w-4" />
			</Button>
		</form>
	</Card.Content>
</Card.Root>
