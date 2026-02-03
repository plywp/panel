<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import type { ManagedItemBase } from '$lib/types/managed-items';
	import { Root, Content } from '$lib/components/ui/card';

	type ListProps = {
		items?: ManagedItemBase[];
		emptyMessage?: string;
		prefersReducedMotion?: boolean;
		easeStandard: (value: number) => number;
		itemKey?: (item: ManagedItemBase) => string;
	};

	let {
		items = [],
		emptyMessage = 'No items found.',
		prefersReducedMotion = false,
		easeStandard,
		itemKey
	}: ListProps = $props();
</script>

<Root class="motion-safe:animate-fadeIn p-2 my-2">
	<Content>
		{#if items.length === 0}
			<div
				class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
				in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
			>
				{emptyMessage}
			</div>
		{:else}
			<div class="space-y-3">
				{#each items as item, index (itemKey ? itemKey(item) : String(index))}
					<div
						class="motion-item"
						in:fly={{
							y: prefersReducedMotion ? 0 : 8,
							duration: prefersReducedMotion ? 0 : 180,
							delay: prefersReducedMotion ? 0 : 80 + index * 30,
							easing: easeStandard
						}}
						animate:flip={{ duration: prefersReducedMotion ? 0 : 150, easing: easeStandard }}
					>
						<slot {item} {index} />
					</div>
				{/each}
			</div>
		{/if}
	</Content>
</Root>
