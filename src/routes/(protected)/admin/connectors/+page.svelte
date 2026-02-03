<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { connectorHealthUrl } from '$lib/connector-url';
	import axios from 'axios';
	import { Plug, Plus, Trash2 } from 'lucide-svelte';

	export let data: {
		connectors: {
			id: number;
			serverIp: string;
			token: string;
			fqdn: string;
			webServer: string;
			dataDir: string;
			autoSsl: boolean;
			daemonSslEnabled: boolean;
			locationName: string | null;
			locationCountry: string | null;
		}[];
	};

	type ConnStatus = 'checking' | 'online' | 'offline';

	let statusMap: Record<number, ConnStatus> = {};

	async function checkOne(c: (typeof data.connectors)[number]): Promise<ConnStatus> {
		const url = connectorHealthUrl(c);
		if (!url) return 'offline';
		try {
			const res = await axios.get(url, {
				headers: {
					Authorization: `Bearer ${c.token}`
				}
			});
			//console.log(data);
			return res.data.status == 'ok' ? 'online' : 'offline';
		} catch {
			return 'offline';
		}
	}

	async function refreshStatuses() {
		for (const c of data.connectors) statusMap[c.id] = statusMap[c.id] ?? 'checking';

		const results = await Promise.allSettled(
			data.connectors.map(async (c) => [c.id, await checkOne(c)] as const)
		);

		const next: Record<number, ConnStatus> = { ...statusMap };
		for (const r of results) {
			if (r.status === 'fulfilled') {
				const [id, st] = r.value;
				next[id] = st;
			}
		}
		statusMap = next;
	}

	let timer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		refreshStatuses();
		timer = setInterval(refreshStatuses, 5000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<div class="space-y-6 p-6">
	<div class="flex items-center justify-between">
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<Plug class="size-5" />
			Connectors
		</h1>
		<a href="/admin/connectors/new">
			<Button>
				<Plus class="size-4" />
				New connector
			</Button>
		</a>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>All connectors</Card.Title>
			<Card.Description>Manage daemon connectors and their assigned locations.</Card.Description>
		</Card.Header>

		<Card.Content class="p-0">
			<div class="overflow-hidden rounded-lg border">
				<table class="w-full text-sm">
					<thead class="bg-muted/40">
						<tr>
							<th class="p-3 text-left">Status</th>
							<th class="p-3 text-left">Server</th>
							<th class="p-3 text-left">Location</th>
							<th class="p-3 text-left">Flags</th>
							<th class="p-3 text-right">Actions</th>
						</tr>
					</thead>

					<tbody>
						{#each data.connectors as c}
							<tr class="border-t" on:click={() => goto(`/admin/connectors/${c.id}/edit`)}>
								<td class="p-3">
									<div class="flex items-center gap-2 font-medium">
										{#if statusMap[c.id] === 'online'}
											<span
												class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
											>
												<span class="mr-1 h-2 w-2 rounded-full bg-green-500"></span>
												Online
											</span>
										{:else if statusMap[c.id] === 'offline'}
											<span
												class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
											>
												<span class="mr-1 h-2 w-2 rounded-full bg-red-500"></span>
												Offline
											</span>
										{:else}
											<span
												class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
											>
												<span class="mr-1 h-2 w-2 rounded-full bg-yellow-500"></span>
												Checking
											</span>
										{/if}
									</div>
								</td>

								<td class="p-3">
									<div class="font-medium">{c.serverIp}</div>
									<div class="text-xs text-muted-foreground">{c.webServer} • {c.dataDir}</div>
								</td>

								<td class="p-3">
									<div class="font-medium">
										{c.locationName ?? '—'}{c.locationCountry ? ` (${c.locationCountry})` : ''}
									</div>
								</td>

								<td class="p-3 text-xs">
									<div class="flex flex-wrap gap-2">
										{#if c.autoSsl}<span class="rounded border px-2 py-0.5">autoSSL</span>{/if}
										{#if c.daemonSslEnabled}<span class="rounded border px-2 py-0.5">daemonSSL</span
											>{/if}
									</div>
								</td>

								<td class="p-3">
									<div class="flex justify-end gap-2">
										<form
											method="POST"
											action="?/delete"
											on:click|stopPropagation
											use:enhance={() =>
												async ({ update }) => {
													const res = await update();
													if (res.type === 'success') await invalidateAll();
												}}
										>
											<input type="hidden" name="id" value={c.id} />
											<Button variant="destructive" size="sm" type="submit">
												<Trash2 class="size-4" />
												Delete
											</Button>
										</form>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card.Content>
	</Card.Root>
</div>
