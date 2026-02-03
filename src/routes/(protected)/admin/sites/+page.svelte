<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Globe, HardDrive, Plus, RefreshCw, Settings } from 'lucide-svelte';

	export let data: {
		activeOrganizationId: string | null;
		sites: {
			id: string;
			name: string;
			domain: string;
			diskLimitMb: number;
			phpVersion: string | null;
			status: string | null;
			connectorId: number | null;
			connectorFqdn: string | null;
			locationName: string | null;
			locationCountry: string | null;
		}[];
	};

	export let form:
		| {
				success?: boolean;
				message?: string;
				errors?: Record<string, string[]>;
				values?: Record<string, string>;
				siteId?: string;
		  }
		| undefined;

	const firstError = (key: string) => form?.errors?.[key]?.[0];

	const defaultUnitFor = (diskLimitMb: number) =>
		diskLimitMb >= 1024 && diskLimitMb % 1024 === 0 ? 'G' : 'M';

	const defaultSizeFor = (diskLimitMb: number) => {
		if (diskLimitMb >= 1024 && diskLimitMb % 1024 === 0) {
			return String(diskLimitMb / 1024);
		}
		return String(diskLimitMb);
	};
</script>

<Card.Root>
	<Card.Header class="flex items-center justify-between">
		<div>
			<Card.Title class="flex items-center gap-2">
				<Globe class="size-4" />
				Sites
			</Card.Title>
			<Card.Description>Manage your sites</Card.Description>
		</div>
		<div class="flex gap-2">
			<form method="POST" action="?/sync">
				<Button variant="secondary" type="submit">
					<RefreshCw class="size-4" />
					Sync
				</Button>
			</form>
			<Button href="/admin/sites/new">
				<Plus class="size-4" />
				Add Site
			</Button>
		</div>
	</Card.Header>
	<Card.Content>
		{#if form?.message}
			<div
				class={`mb-4 rounded-md border p-3 text-sm ${
					form.success
						? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
						: 'border-red-500/30 bg-red-500/10 text-red-600'
				}`}
			>
				{form.message}
			</div>
		{/if}
		{#if !data.activeOrganizationId}
			<div class="text-sm text-muted-foreground">Select an active organization first.</div>
		{:else if data.sites.length === 0}
			<div class="text-sm text-muted-foreground">No sites yet.</div>
		{:else}
			<ul class="grid grid-cols-1 gap-4">
				{#each data.sites as site}
					<li class="flex items-center justify-between" key={site.id}>
						<div key={site.id}>
							<Card.Title>{site.name}</Card.Title>
							<Card.Description>
								{site.domain} • {site.diskLimitMb} MB
								{#if site.phpVersion}
									• PHP {site.phpVersion}{/if}
								{#if site.status}
									• {site.status}{/if}
							</Card.Description>
							{#if site.connectorFqdn}
								<div class="text-xs text-muted-foreground">
									{site.connectorFqdn}
									{#if site.locationName}
										— {site.locationName}
										{site.locationCountry ? ` (${site.locationCountry})` : ''}
									{/if}
								</div>
							{/if}
						</div>
						<div class="flex flex-col items-end gap-2">
							{#if form?.values?.siteId === site.id}
								{#if firstError('newSize')}
									<p class="text-xs text-red-500">{firstError('newSize')}</p>
								{:else if firstError('unitType')}
									<p class="text-xs text-red-500">{firstError('unitType')}</p>
								{/if}
							{/if}
							<Button href={`/admin/sites/${site.id}/edit`}>
								<Settings class="size-4" />
								Edit
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
