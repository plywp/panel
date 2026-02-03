<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { ArrowLeft, Check, Copy, Terminal } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import CardHead from './../../CardHead.svelte';

	export let data: {
		locations: { id: number; name: string; country: string }[];
		conn: any;
	};

	let open = false;
	let copied = false;

	$: origin = typeof window === 'undefined' ? '' : window.location.origin;
	$: configCommand = `plyorde configure --panel ${origin || 'http://panel.local'} --node ${data?.conn?.id ?? 'unknown'} --token ${data?.conn?.token ?? 'unknown'}`;

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			toast?.success?.('Copied to clipboard');
			setTimeout(() => (copied = false), 1200);
		} catch {
			toast?.error?.('Failed to copy');
		}
	}
	function tomlStringList(items: unknown): string {
		if (!Array.isArray(items) || items.length === 0) return '';
		const out = items
			.map((item) => String(item ?? '').trim())
			.filter(Boolean)
			.map((item) => `"${item.replace(/"/g, '\\"')}"`);
		return out.length ? out.join(', ') : '';
	}

	$: config = `[daemon]
secret = "${String(data?.conn?.token ?? '').replace(/"/g, '\\"')}"
allowed_origins = ["${String(origin ?? '').replace(/"/g, '\\"')}"]
upload_limit_mb = 100


[daemon_ssl]
enabled = ${Boolean(data?.conn?.daemonSslEnabled)}
certificate = "${String(data?.conn?.daemonSslCrt ?? '').replace(/"/g, '\\"')}"
key = "${String(data?.conn?.daemonSslKey ?? '').replace(/"/g, '\\"')}"

[mysql]
host = "localhost"
port = 3306
user = "plyorde"
password = "strong_password_here"
database = "plyorde"
data_dir = "/var/lib/mysql"

[storage]
data_dir = "${String(data?.conn?.dataDir ?? '/var/plyorde').replace(/"/g, '\\"')}"

[webserver]
template_dir = "/var/templates"
webserver = "${String(data?.conn?.webServer ?? 'nginx').replace(/"/g, '\\"')}"
control_socket = "${String(data?.conn?.controlSocket ?? data?.conn?.webServerControlSocket ?? '/run/plyserve/control.sock').replace(/"/g, '\\"')}"
auto_ssl = ${Boolean(data?.conn?.autoSsl)}

[ssl_issuer]
enabled = ${Boolean(data?.conn?.sslIssuerEnabled)}
mode = "${String(data?.conn?.sslIssuerMode ?? '').replace(/"/g, '\\"')}"
email = "${String(data?.conn?.sslIssuerEmail ?? '').replace(/"/g, '\\"')}"
ca_dir_url = "${String(data?.conn?.sslIssuerCaDirUrl ?? '').replace(/"/g, '\\"')}"
accept_tos = ${Boolean(data?.conn?.sslIssuerAcceptTos)}
key_type = "${String(data?.conn?.sslIssuerKeyType ?? '').replace(/"/g, '\\"')}"
account_dir = "${String(data?.conn?.sslIssuerAccountDir ?? '').replace(/"/g, '\\"')}"
include_www = "${String(data?.conn?.sslIssuerIncludeWww ?? '').replace(/"/g, '\\"')}"
renew_enabled = ${Boolean(data?.conn?.sslIssuerRenewEnabled)}
renew_interval_hours = ${Number(data?.conn?.sslIssuerRenewIntervalHours ?? 0)}
cert_path = "${String(data?.conn?.sslIssuerCertPath ?? '').replace(/"/g, '\\"')}"
key_path = "${String(data?.conn?.sslIssuerKeyPath ?? '').replace(/"/g, '\\"')}"
webroot_path = "${String(data?.conn?.sslIssuerWebrootPath ?? '').replace(/"/g, '\\"')}"
timeout_seconds = ${Number(data?.conn?.sslIssuerTimeoutSeconds ?? 0)}
expected_ips = [${tomlStringList(data?.conn?.sslIssuerExpectedIps)}]
verify_dns = ${data?.conn?.sslIssuerVerifyDns === undefined ? false : Boolean(data?.conn?.sslIssuerVerifyDns)}
verify_http = ${data?.conn?.sslIssuerVerifyHttp === undefined ? false : Boolean(data?.conn?.sslIssuerVerifyHttp)}

[dns]
listen_address = "${String(data?.conn?.dnsServerAddress ?? 'localhost').replace(/"/g, '\\"')}"
listen_port = ${Number(data?.conn?.dnsServerPort ?? 53)}
listen_protocol = "${String(data?.conn?.dnsServerProto ?? 'both').replace(/"/g, '\\"')}"
server_ip = "${String(data?.conn?.serverIp ?? '127.0.0.1').replace(/"/g, '\\"')}"`;
</script>

<div class="max-w-3xl space-y-6 p-6">
	<a class="flex items-center gap-1 text-sm hover:underline" href="/admin/connectors">
		<ArrowLeft class="size-4" />
		Back
	</a>

	<Card.Root>
		<CardHead {data} configure={true} />

		<Card.Content class="space-y-3">
			<Textarea id="config" placeholder="Enter a description" value={config} disabled />

			<Button class="w-full" onclick={() => (open = true)}>
				<Terminal class="size-4" />
				Generate Config Command
			</Button>
		</Card.Content>
	</Card.Root>

	<Dialog.Root bind:open>
		<Dialog.Content class="sm:max-w-xl">
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					<Terminal class="size-4" />
					Config command
				</Dialog.Title>
				<Dialog.Description>
					Copy this command and run it on the node where you want to configure the connector.
				</Dialog.Description>
			</Dialog.Header>

			<div class="mt-4 space-y-2">
				<div class="flex gap-2">
					<Input value={configCommand} disabled class="min-w-0 flex-1 font-mono" />

					<Button
						type="button"
						variant="secondary"
						class="shrink-0"
						onclick={() => copyToClipboard(configCommand)}
					>
						{#if copied}
							<Check class="mr-2 h-4 w-4" />
							Copied
						{:else}
							<Copy class="mr-2 h-4 w-4" />
							Copy
						{/if}
					</Button>
				</div>

				<!-- If you prefer textarea instead of input, use this:
				<Textarea value={configCommand} disabled class="font-mono" rows={3} />
				-->
			</div>

			<Dialog.Footer class="mt-4">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Close</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
