<script>
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import { Activity, Plug, Settings, Wrench } from 'lucide-svelte';
	let { data, configure = false } = $props();
</script>

<Card.Header>
	<Card.Title class="flex items-center gap-2">
		<Plug class="size-4" />
		Connector {data.conn.id}
	</Card.Title>
	<Card.Description
		>In this place you can update your connector settings and location assignment or configure it.</Card.Description
	>
	<div class="flex flex-col items-center gap-8">
		<ButtonGroup.Root>
			<Button
				size="lg"
				class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
				href="/admin/connectors/{data.conn.id}/stats"
			>
				<Activity class="size-4" />
				Stats
			</Button>
			<Button
				size="lg"
				class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
				href="/admin/connectors/{data.conn.id}/edit"
			>
				<Settings class="size-4" />
				Settings
			</Button>
			<Button
				size="lg"
				href="/admin/connectors/{data.conn.id}/configure"
				class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
			>
				<Wrench class="size-4" />
				Configure
			</Button>
		</ButtonGroup.Root>
	</div>
</Card.Header>
