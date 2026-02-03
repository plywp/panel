<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { ArrowUp } from 'lucide-svelte';

	type BulkActionsProps = {
		title: string;
		subtitle: string;
		formId: string;
		action: string;
		itemField: string;
		version?: string;
		pending?: boolean;
		updateLabel?: string;
		exclusionsCount?: number;
		onClear?: () => void;
		enhance?: () => any;
	};

	let {
		title,
		subtitle,
		formId,
		action,
		itemField,
		version = $bindable(''),
		pending = false,
		updateLabel = 'Update all',
		exclusionsCount = 0,
		onClear,
		enhance
	}: BulkActionsProps = $props();
</script>

<Card.Root class="motion-card">
	<Card.Content class="space-y-3">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div>
				<div class="text-sm font-medium">{title}</div>
				<div class="text-xs text-muted-foreground">{subtitle}</div>
			</div>
			<form
				id={formId}
				method="POST"
				{action}
				use:enhance={enhance?.()}
				class="flex flex-wrap items-center gap-2"
			>
				<input type="hidden" name={itemField} value="all" />
				<Input class="w-40" placeholder="Version (optional)" name="version" bind:value={version} />
				<Button class="motion-action" type="submit" disabled={pending}>
					<ArrowUp class="h-4 w-4" />
					{pending ? 'Updating…' : updateLabel}
				</Button>
				{#if exclusionsCount > 0}
					<Button type="button" variant="ghost" onclick={() => onClear?.()}>
						Clear exclusions
					</Button>
				{/if}
			</form>
		</div>
	</Card.Content>
</Card.Root>
