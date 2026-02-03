<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { ArrowLeft, Eye, EyeOff, Globe, Plus, X } from 'lucide-svelte';

	let passShowable = false;
	let autoSsl = false;

	export let data: {
		connectors: {
			id: number;
			fqdn: string;
			locationName: string | null;
			locationCountry: string | null;
		}[];
		organizations: {
			id: string;
			name: string;
			slug: string;
		}[];
		defaultOrganizationId: string | null;
	};

	export let form:
		| {
				message?: string;
				errors?: Record<string, string[]>;
				values?: Record<string, string>;
		  }
		| undefined;

	$: selectedOrg =
		form?.values?.organizationId ?? data.defaultOrganizationId ?? data.organizations[0]?.id ?? '';

	$: selectedConnector =
		form?.values?.connectorId ?? (data.connectors[0]?.id ? String(data.connectors[0].id) : '');

	const firstError = (key: string) => form?.errors?.[key]?.[0];
</script>

<div class="max-w-3xl space-y-6 p-6">
	<a class="flex items-center gap-1 text-sm hover:underline" href="/admin/sites">
		<ArrowLeft class="size-4" />
		Back
	</a>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Globe class="size-4" />
				New site
			</Card.Title>
			<Card.Description>Create a WordPress site on a connector.</Card.Description>
		</Card.Header>

		<Card.Content>
			{#if form?.message}
				<div class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
					{form.message}
				</div>
			{/if}

			<form method="POST" action="?/create" class="grid gap-4">
				<div class="grid gap-2">
					<Label>Organization</Label>
					<select name="organizationId" class="rounded-md border px-3 py-2" required>
						{#each data.organizations as org}
							<option value={org.id} selected={org.id === selectedOrg}>
								{org.name} ({org.slug})
							</option>
						{/each}
					</select>
					{#if firstError('organizationId')}
						<p class="text-xs text-red-500">{firstError('organizationId')}</p>
					{/if}
				</div>

				<div class="grid gap-2">
					<Label>Connector</Label>
					<select name="connectorId" class="rounded-md border px-3 py-2" required>
						{#each data.connectors as c}
							<option value={c.id} selected={String(c.id) === selectedConnector}>
								{c.fqdn}
								{#if c.locationName}
									- {c.locationName}{c.locationCountry ? ` (${c.locationCountry})` : ''}
								{/if}
							</option>
						{/each}
					</select>
					{#if firstError('connectorId')}
						<p class="text-xs text-red-500">{firstError('connectorId')}</p>
					{/if}
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="grid gap-2">
						<Label>Site name</Label>
						<Input name="name" placeholder="My Site" value={form?.values?.name ?? ''} required />
						{#if firstError('name')}
							<p class="text-xs text-red-500">{firstError('name')}</p>
						{/if}
					</div>
					<div class="grid gap-2">
						<Label>Domain</Label>
						<Input
							name="domain"
							placeholder="example.com"
							value={form?.values?.domain ?? ''}
							required
						/>
						{#if firstError('domain')}
							<p class="text-xs text-red-500">{firstError('domain')}</p>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="grid gap-2">
						<Label>Disk limit (MB)</Label>
						<Input
							name="diskLimitMb"
							type="number"
							min="40"
							value={form?.values?.diskLimitMb ?? '1024'}
							required
						/>
						{#if firstError('diskLimitMb')}
							<p class="text-xs text-red-500">{firstError('diskLimitMb')}</p>
						{/if}
					</div>
					<div class="grid gap-2">
						<Label>PHP version (optional)</Label>
						<Input name="phpVersion" placeholder="8.4" value={form?.values?.phpVersion ?? ''} />
					</div>
				</div>

				<div class="grid gap-2">
					<Label>Description (optional)</Label>
					<Textarea name="description" rows={3} value={form?.values?.description ?? ''} />
				</div>

				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="grid gap-0.5">
						<div class="text-sm font-medium">Auto SSL</div>
						<div class="text-xs text-muted-foreground">
							Issue a certificate automatically after provisioning.
						</div>
					</div>
					<Switch bind:checked={autoSsl} />
					<input type="hidden" name="autoSsl" value={autoSsl ? 'true' : 'false'} />
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="grid gap-2">
						<Label>Admin user</Label>
						<Input
							name="adminUser"
							placeholder="admin"
							value={form?.values?.adminUser ?? ''}
							required
						/>
						{#if firstError('adminUser')}
							<p class="text-xs text-red-500">{firstError('adminUser')}</p>
						{/if}
					</div>
					<div class="grid gap-2">
						<Label>Admin password</Label>
						<div class="flex items-center">
							<Input name="adminPass" type={passShowable ? 'text' : 'password'} required />
							{#if passShowable}
								<Button type="button" onclick={() => (passShowable = !passShowable)}
									><EyeOff /></Button
								>
							{:else}
								<Button type="button" onclick={() => (passShowable = !passShowable)}><Eye /></Button
								>
							{/if}
						</div>
						{#if firstError('adminPass')}
							<p class="text-xs text-red-500">{firstError('adminPass')}</p>
						{/if}
					</div>
					<div class="grid gap-2">
						<Label>Admin email</Label>
						<Input
							name="adminEmail"
							type="email"
							placeholder="admin@example.com"
							value={form?.values?.adminEmail ?? ''}
							required
						/>
						{#if firstError('adminEmail')}
							<p class="text-xs text-red-500">{firstError('adminEmail')}</p>
						{/if}
					</div>
				</div>

				<div class="flex justify-end gap-2">
					<a href="/admin/sites">
						<Button type="button" variant="outline">
							<X class="size-4" />
							Cancel
						</Button>
					</a>
					<Button type="submit">
						<Plus class="size-4" />
						Create
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
