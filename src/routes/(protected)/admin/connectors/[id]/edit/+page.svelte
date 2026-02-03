<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import CardHead from './../../CardHead.svelte';
	import { ArrowLeft, Save, X } from 'lucide-svelte';

	export let data: {
		locations: { id: number; name: string; country: string }[];
		conn: any;
	};

	let daemonSslEnabled = !!data.conn.daemonSslEnabled;
	let autoSsl = !!data.conn.autoSsl;
</script>

<div class="max-w-3xl space-y-6 p-6">
	<a class="flex items-center gap-1 text-sm hover:underline" href="/admin/connectors">
		<ArrowLeft class="size-4" />
		Back
	</a>

	<Card.Root>
		<CardHead {data} />

		<Card.Content>
			<form method="POST" action="?/save" class="grid gap-4">
				<div class="grid gap-2">
					<Label>Location</Label>
					<select name="locationId" class="rounded-md border px-3 py-2" required>
						{#each data.locations as loc}
							<option value={loc.id} selected={loc.id === data.conn.locationId}>
								{loc.name} — {loc.country}
							</option>
						{/each}
					</select>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="grid gap-2">
						<Label>Server IP</Label>
						<Input name="serverIp" value={data.conn.serverIp} required />
					</div>

					<div class="grid gap-2">
						<Label>FQDN</Label>
						<Input
							name="fqdn"
							value={data.conn.fqdn}
							placeholder="http://node.example.com:8080"
							required
						/>
					</div>

					<div class="grid gap-2">
						<Label>Web server</Label>
						<Input name="webServer" value={data.conn.webServer} required />
					</div>
				</div>

				<div class="grid gap-2">
					<Label>Data dir</Label>
					<Input name="dataDir" value={data.conn.dataDir} required />
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="grid gap-2">
						<Label>DNS address</Label>
						<Input name="dnsServerAddress" value={data.conn.dnsServerAddress} required />
					</div>
					<div class="grid gap-2">
						<Label>DNS port</Label>
						<Input name="dnsServerPort" type="number" value={data.conn.dnsServerPort} required />
					</div>
					<div class="grid gap-2">
						<Label>DNS proto</Label>
						<select name="dnsServerProto" class="rounded-md border px-3 py-2">
							<option value="tcp" selected={data.conn.dnsServerProto === 'tcp'}>tcp</option>
							<option value="udp" selected={data.conn.dnsServerProto === 'udp'}>udp</option>
							<option value="both" selected={data.conn.dnsServerProto === 'both'}>both</option>
						</select>
					</div>
				</div>

				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="grid gap-0.5">
						<div class="text-sm font-medium">Auto SSL</div>
					</div>
					<Switch bind:checked={autoSsl} />
					<input type="hidden" name="autoSsl" value={autoSsl ? 'true' : 'false'} />
				</div>

				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="grid gap-0.5">
						<div class="text-sm font-medium">Daemon SSL</div>
					</div>
					<Switch bind:checked={daemonSslEnabled} />
					<input
						type="hidden"
						name="daemonSslEnabled"
						value={daemonSslEnabled ? 'true' : 'false'}
					/>
				</div>

				{#if daemonSslEnabled}
					<div class="grid gap-4 rounded-md border p-4">
						<div class="grid gap-2">
							<Label>Daemon SSL cert path</Label>
							<Input name="daemonSslCrt" value={data.conn.daemonSslCrt ?? ''} required />
						</div>

						<div class="grid gap-2">
							<Label>Daemon SSL key path</Label>
							<Input name="daemonSslKey" value={data.conn.daemonSslKey ?? ''} required />
						</div>
					</div>
				{/if}

				<div class="flex justify-end gap-2">
					<a href="/admin/connectors">
						<Button type="button" variant="outline">
							<X class="size-4" />
							Cancel
						</Button>
					</a>
					<Button type="submit">
						<Save class="size-4" />
						Save
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
