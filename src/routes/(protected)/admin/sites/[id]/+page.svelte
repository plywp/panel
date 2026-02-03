<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { onDestroy } from 'svelte';
	import { Copy, Eye, EyeOff, KeyRound, Settings } from 'lucide-svelte';

	export let data: {
		site: {
			id: string;
			name: string;
			domain: string;
			status: string | null;
			docroot: string;
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

	const clearRevealTimer = () => {
		if (clearTimer) {
			clearTimeout(clearTimer);
			clearTimer = null;
		}
	};

	const scheduleAutoClear = () => {
		clearRevealTimer();
		clearTimer = setTimeout(() => {
			adminPassword = null;
			isRevealed = false;
		}, 30_000);
	};

	$: if (form?.success && form.adminPassword) {
		adminPassword = form.adminPassword;
		errorMessage = null;
		isRevealed = false;
		clearRevealTimer();
	}

	$: if (form && !form.success && form.message) {
		errorMessage = form.message;
	}

	const toggleReveal = () => {
		if (!adminPassword) return;
		isRevealed = !isRevealed;
		if (isRevealed) {
			scheduleAutoClear();
		} else {
			clearRevealTimer();
		}
	};

	const copyPassword = async () => {
		if (!adminPassword) return;
		try {
			await navigator.clipboard.writeText(adminPassword);
		} catch {
			// Ignore clipboard errors to avoid leaking password via logs.
		}
	};

	onDestroy(() => {
		clearRevealTimer();
	});
</script>

<Card.Root>
	<Card.Header class="flex items-start justify-between gap-4">
		<div>
			<Card.Title>{site.name}</Card.Title>
			<Card.Description>{site.domain}</Card.Description>
		</div>
		<Button href={`/admin/sites/${site.id}/edit`}>
			<Settings class="size-4" />
			Edit
		</Button>
	</Card.Header>
	<Card.Content class="grid gap-6">
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<div class="text-xs text-muted-foreground">Domain</div>
				<div class="text-sm font-medium">{site.domain}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground">Status</div>
				<div class="text-sm font-medium">{site.status ?? '—'}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground">Docroot</div>
				<div class="text-sm font-medium">{site.docroot}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground">PHP Version</div>
				<div class="text-sm font-medium">{site.phpVersion ?? 'Default'}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground">DB Name</div>
				<div class="text-sm font-medium">{site.dbName}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground">DB User</div>
				<div class="text-sm font-medium">{site.dbUser}</div>
			</div>
			<div>
				<div class="text-xs text-muted-foreground">Connector ID</div>
				<div class="text-sm font-medium">{site.connectorId ?? '—'}</div>
			</div>
		</div>

		<div class="grid gap-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<div class="text-sm font-medium">Admin password</div>
					<div class="text-xs text-muted-foreground">
						Revealed passwords auto-clear after 30 seconds.
					</div>
				</div>
				<form method="POST" action="?/showPassword">
					<Button variant="secondary" type="submit">
						<KeyRound class="size-4" />
						Show admin password
					</Button>
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
						<Button type="button" variant="secondary" on:click={toggleReveal}>
							{#if isRevealed}
								<EyeOff class="size-4" />
								Hide
							{:else}
								<Eye class="size-4" />
								Reveal
							{/if}
						</Button>
						<Button type="button" on:click={copyPassword}>
							<Copy class="size-4" />
							Copy
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
