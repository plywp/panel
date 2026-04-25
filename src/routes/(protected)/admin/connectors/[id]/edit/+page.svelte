<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import CardHead from './../../CardHead.svelte';
	import { ArrowLeft, Save, X, Trash2 } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';

	export let data: {
		locations: { id: number; name: string; country: string }[];
		conn: any;
	};
	export let form: any;

	$: if (form?.message && !form?.success) {
		toast.error(form.message);
	}

	let daemonSslEnabled = !!data.conn.daemonSslEnabled;
	let autoSsl = !!data.conn.autoSsl;
	let sslIssuerEnabled = !!data.conn.sslIssuerEnabled;
	let sslIssuerAcceptTos = !!data.conn.sslIssuerAcceptTos;
	let sslIssuerRenewEnabled = !!data.conn.sslIssuerRenewEnabled;
	let sslIssuerVerifyDns = data.conn.sslIssuerVerifyDns ?? true;
	let sslIssuerVerifyHttp = data.conn.sslIssuerVerifyHttp ?? true;
</script>

<div class="max-w-3xl space-y-6 p-6">
	<a class="flex items-center gap-1 text-sm hover:underline" href="/admin/connectors">
		<ArrowLeft class="size-4" />
		Back
	</a>

	<Card.Root>
		<CardHead {data} />

		<Card.Content>
			<form
				method="POST"
				action="?/save"
				class="grid gap-4"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							toast.error(result.data?.message || 'Failed to save');
						} else if (result.type === 'redirect') {
							toast.success('Connector saved successfully');
						}
					};
				}}
			>
				<input type="hidden" name="token" value={data.conn.token} />
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

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="grid gap-2">
						<Label>Database Username</Label>
						<Input name="dataBaseUsername" value={data.conn.dataBaseUsername} required />
					</div>
					<div class="grid gap-2">
						<Label>Database Password</Label>
						<Input name="dataBasePassword" type="password" value={data.conn.dataBasePassword} required />
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
					<div class="grid gap-2">
						<Label>Database Host</Label>
						<Input name="dataBaseHost" value={data.conn.dataBaseHost} required />
					</div>
					<div class="grid gap-2">
						<Label>Database Port</Label>
						<Input name="dataBasePort" type="number" value={data.conn.dataBasePort} required />
					</div>
					<div class="grid gap-2">
						<Label>Database Name</Label>
						<Input name="dataBaseName" value={data.conn.dataBaseName} required />
					</div>
					<div class="grid gap-2">
						<Label>Database Dir</Label>
						<Input name="dataBaseDir" value={data.conn.dataBaseDir} required />
					</div>
				</div>

				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="grid gap-0.5">
						<div class="text-sm font-medium">Auto SSL</div>
					</div>
					<Switch bind:checked={autoSsl} />
					<input type="hidden" name="autoSsl" value={autoSsl ? 'true' : ''} />
				</div>

				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="grid gap-0.5">
						<div class="text-sm font-medium">Daemon SSL</div>
					</div>
					<Switch bind:checked={daemonSslEnabled} />
					<input
						type="hidden"
						name="daemonSslEnabled"
						value={daemonSslEnabled ? 'true' : ''}
					/>
				</div>

				{#if daemonSslEnabled}
					<div class="grid gap-4 rounded-md border p-4">
						<div class="grid gap-2">
							<Label>Daemon SSL cert path</Label>
							<Input name="daemonSslCrt" value={data.conn.daemonSslCrt ?? ''} required={daemonSslEnabled} />
						</div>

						<div class="grid gap-2">
							<Label>Daemon SSL key path</Label>
							<Input name="daemonSslKey" value={data.conn.daemonSslKey ?? ''} required={daemonSslEnabled} />
						</div>
					</div>
				{/if}

				<div class="space-y-4 rounded-md border p-4">
					<div class="flex items-center justify-between">
						<div class="text-sm font-medium">SSL Issuer (ACME/Lego)</div>
						<Switch bind:checked={sslIssuerEnabled} />
						<input type="hidden" name="sslIssuerEnabled" value={sslIssuerEnabled ? 'true' : ''} />
					</div>

					{#if sslIssuerEnabled}
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="grid gap-2">
								<Label>Mode</Label>
								<Input name="sslIssuerMode" value={data.conn.sslIssuerMode ?? 'lego'} />
							</div>
							<div class="grid gap-2">
								<Label>Email</Label>
								<Input name="sslIssuerEmail" type="email" value={data.conn.sslIssuerEmail ?? ''} />
							</div>
						</div>

						<div class="grid gap-2">
							<Label>CA Directory URL</Label>
							<Input name="sslIssuerCaDirUrl" value={data.conn.sslIssuerCaDirUrl ?? ''} />
						</div>

						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="flex items-center justify-between rounded-md border p-2">
								<Label>Accept TOS</Label>
								<Switch bind:checked={sslIssuerAcceptTos} />
								<input type="hidden" name="sslIssuerAcceptTos" value={sslIssuerAcceptTos ? 'true' : ''} />
							</div>
							<div class="grid gap-2">
								<Label>Key Type</Label>
								<Input name="sslIssuerKeyType" value={data.conn.sslIssuerKeyType ?? 'rsa2048'} />
							</div>
						</div>

						<div class="grid gap-2">
							<Label>Account Directory</Label>
							<Input name="sslIssuerAccountDir" value={data.conn.sslIssuerAccountDir ?? ''} />
						</div>

						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="grid gap-2">
								<Label>Include WWW</Label>
								<Input name="sslIssuerIncludeWww" value={data.conn.sslIssuerIncludeWww ?? 'auto'} />
							</div>
							<div class="flex items-center justify-between rounded-md border p-2">
								<Label>Renew Enabled</Label>
								<Switch bind:checked={sslIssuerRenewEnabled} />
								<input type="hidden" name="sslIssuerRenewEnabled" value={sslIssuerRenewEnabled ? 'true' : ''} />
							</div>
						</div>

						<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
							<div class="grid gap-2">
								<Label>Renew Interval (Hours)</Label>
								<Input name="sslIssuerRenewIntervalHours" type="number" value={data.conn.sslIssuerRenewIntervalHours ?? 24} />
							</div>
							<div class="grid gap-2">
								<Label>Timeout (Seconds)</Label>
								<Input name="sslIssuerTimeoutSeconds" type="number" value={data.conn.sslIssuerTimeoutSeconds ?? 120} />
							</div>
						</div>

						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="grid gap-2">
								<Label>Cert Path</Label>
								<Input name="sslIssuerCertPath" value={data.conn.sslIssuerCertPath ?? ''} />
							</div>
							<div class="grid gap-2">
								<Label>Key Path</Label>
								<Input name="sslIssuerKeyPath" value={data.conn.sslIssuerKeyPath ?? ''} />
							</div>
						</div>

						<div class="grid gap-2">
							<Label>Webroot Path</Label>
							<Input name="sslIssuerWebrootPath" value={data.conn.sslIssuerWebrootPath ?? ''} />
						</div>

						<div class="flex gap-4">
							<div class="flex items-center gap-2">
								<Switch bind:checked={sslIssuerVerifyDns} />
								<Label>Verify DNS</Label>
								<input type="hidden" name="sslIssuerVerifyDns" value={sslIssuerVerifyDns ? 'true' : ''} />
							</div>
							<div class="flex items-center gap-2">
								<Switch bind:checked={sslIssuerVerifyHttp} />
								<Label>Verify HTTP</Label>
								<input type="hidden" name="sslIssuerVerifyHttp" value={sslIssuerVerifyHttp ? 'true' : ''} />
							</div>
						</div>
					{/if}
				</div>

				<div class="flex items-center justify-between">
					<div>
						<Button type="submit" formaction="?/delete" variant="destructive">
							<Trash2 class="size-4" />
							Delete
						</Button>
					</div>
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
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
