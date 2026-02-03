<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { ArrowLeft, Plug, Plus, X } from 'lucide-svelte';

	export let data: { locations: { id: number; name: string; country: string }[] };

	let daemonSslEnabled = false;
	let autoSsl = false;
	let sslIssuerEnabled = false;
	let sslIssuerRenewEnabled = false;
	let sslIssuerAcceptTos = false;
	let sslIssuerVerifyDns = true;
	let sslIssuerVerifyHttp = true;
</script>

<div class="max-w-3xl space-y-6 p-6">
	<a class="flex items-center gap-1 text-sm hover:underline" href="/admin/connectors">
		<ArrowLeft class="size-4" />
		Back
	</a>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Plug class="size-4" />
				New connector
			</Card.Title>
			<Card.Description>Create a connector and assign it to a location.</Card.Description>
		</Card.Header>

		<Card.Content>
			<form method="POST" action="?/create" class="grid gap-4">
				<div class="grid gap-2">
					<Label>Location</Label>
					<select name="locationId" class="rounded-md border px-3 py-2" required>
						{#each data.locations as loc}
							<option value={loc.id}>{loc.name} — {loc.country}</option>
						{/each}
					</select>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="grid gap-2">
						<Label>Server IP</Label>
						<Input name="serverIp" placeholder="1.2.3.4" required />
					</div>

					<div class="grid gap-2">
						<Label>FQDN</Label>
						<Input name="fqdn" placeholder="http://node.example.com:8080" required />
					</div>

					<div class="grid gap-2">
						<Label>Web server</Label>
						<Input name="webServer" value="nginx" required />
					</div>
				</div>

				<div class="grid gap-2">
					<Label>Data dir</Label>
					<Input name="dataDir" value="/var/lib/plywp" required />
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="grid gap-2">
						<Label>DNS address</Label>
						<Input name="dnsServerAddress" value="127.0.0.1" required />
					</div>
					<div class="grid gap-2">
						<Label>DNS port</Label>
						<Input name="dnsServerPort" type="number" value="53" required />
					</div>
					<div class="grid gap-2">
						<Label>DNS proto</Label>
						<select name="dnsServerProto" class="rounded-md border px-3 py-2">
							<option value="tcp">tcp</option>
							<option value="udp">udp</option>
							<option value="both">both</option>
						</select>
					</div>
				</div>

				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="grid gap-0.5">
						<div class="text-sm font-medium">Auto SSL</div>
						<div class="text-xs text-muted-foreground">
							Let the system manage SSL automatically.
						</div>
					</div>
					<Switch bind:checked={autoSsl} />
					<input type="hidden" name="autoSsl" value={autoSsl ? 'true' : 'false'} />
				</div>

				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="grid gap-0.5">
						<div class="text-sm font-medium">SSL issuer</div>
						<div class="text-xs text-muted-foreground">
							Enable certificate issuance/renewal settings.
						</div>
					</div>
					<Switch bind:checked={sslIssuerEnabled} />
					<input
						type="hidden"
						name="sslIssuerEnabled"
						value={sslIssuerEnabled ? 'true' : 'false'}
					/>
				</div>

				{#if sslIssuerEnabled}
					<div class="grid gap-4 rounded-md border p-4">
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="grid gap-2">
								<Label>Issuer mode</Label>
								<Input name="sslIssuerMode" value="lego" />
							</div>
							<div class="grid gap-2">
								<Label>Email</Label>
								<Input name="sslIssuerEmail" placeholder="admin@example.com" required />
							</div>
						</div>

						<div class="grid gap-2">
							<Label>CA directory URL (optional)</Label>
							<Input
								name="sslIssuerCaDirUrl"
								placeholder="https://acme-v02.api.letsencrypt.org/directory"
							/>
						</div>

						<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
							<div class="grid gap-2">
								<Label>Key type</Label>
								<Input name="sslIssuerKeyType" value="rsa2048" />
							</div>
							<div class="grid gap-2">
								<Label>Account dir</Label>
								<Input name="sslIssuerAccountDir" value="/var/lib/plyorde/lego" />
							</div>
							<div class="grid gap-2">
								<Label>Include www</Label>
								<Input name="sslIssuerIncludeWww" value="auto" />
							</div>
						</div>

						<div class="flex items-center justify-between rounded-md border p-3">
							<div class="grid gap-0.5">
								<div class="text-sm font-medium">Accept ToS</div>
								<div class="text-xs text-muted-foreground">
									Required by the CA to issue certificates.
								</div>
							</div>
							<Switch bind:checked={sslIssuerAcceptTos} />
							<input
								type="hidden"
								name="sslIssuerAcceptTos"
								value={sslIssuerAcceptTos ? 'true' : 'false'}
							/>
						</div>

						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="grid gap-2">
								<Label>Cert path</Label>
								<Input
									name="sslIssuerCertPath"
									value={'/etc/ssl/plyorde/{domain}/fullchain.pem'}
									required
								/>
							</div>
							<div class="grid gap-2">
								<Label>Key path</Label>
								<Input
									name="sslIssuerKeyPath"
									value={'/etc/ssl/plyorde/{domain}/privkey.pem'}
									required
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="grid gap-2">
								<Label>Webroot path</Label>
								<Input name="sslIssuerWebrootPath" value={'{site_root}'} />
							</div>
							<div class="grid gap-2">
								<Label>Timeout seconds</Label>
								<Input name="sslIssuerTimeoutSeconds" type="number" value="120" />
							</div>
						</div>

						<div class="grid gap-2">
							<Label>Expected IPs</Label>
							<Input name="sslIssuerExpectedIps" placeholder="1.2.3.4, 1.2.3.5" />
						</div>

						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="flex items-center justify-between rounded-md border p-3">
								<div class="grid gap-0.5">
									<div class="text-sm font-medium">Verify DNS</div>
									<div class="text-xs text-muted-foreground">Check DNS before issuing.</div>
								</div>
								<Switch bind:checked={sslIssuerVerifyDns} />
								<input
									type="hidden"
									name="sslIssuerVerifyDns"
									value={sslIssuerVerifyDns ? 'true' : 'false'}
								/>
							</div>
							<div class="flex items-center justify-between rounded-md border p-3">
								<div class="grid gap-0.5">
									<div class="text-sm font-medium">Verify HTTP</div>
									<div class="text-xs text-muted-foreground">Check HTTP reachability.</div>
								</div>
								<Switch bind:checked={sslIssuerVerifyHttp} />
								<input
									type="hidden"
									name="sslIssuerVerifyHttp"
									value={sslIssuerVerifyHttp ? 'true' : 'false'}
								/>
							</div>
						</div>

						<div class="flex items-center justify-between rounded-md border p-3">
							<div class="grid gap-0.5">
								<div class="text-sm font-medium">Auto renew</div>
								<div class="text-xs text-muted-foreground">Schedule periodic renewal.</div>
							</div>
							<Switch bind:checked={sslIssuerRenewEnabled} />
							<input
								type="hidden"
								name="sslIssuerRenewEnabled"
								value={sslIssuerRenewEnabled ? 'true' : 'false'}
							/>
						</div>

						{#if sslIssuerRenewEnabled}
							<div class="grid gap-2">
								<Label>Renew interval (hours)</Label>
								<Input name="sslIssuerRenewIntervalHours" type="number" value="24" />
							</div>
						{/if}
					</div>
				{/if}

				<div class="flex items-center justify-between rounded-md border p-3">
					<div class="grid gap-0.5">
						<div class="text-sm font-medium">Daemon SSL</div>
						<div class="text-xs text-muted-foreground">Require daemon SSL cert + key paths.</div>
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
							<Input name="daemonSslCrt" placeholder="/etc/ssl/certs/daemon.crt" required />
						</div>

						<div class="grid gap-2">
							<Label>Daemon SSL key path</Label>
							<Input name="daemonSslKey" placeholder="/etc/ssl/private/daemon.key" required />
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
						<Plus class="size-4" />
						Create
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
