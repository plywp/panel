<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { FileEntry } from './types.js';
	import { Button } from '$lib/components/ui/button';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	type BreadcrumbProps = {
		path?: FileEntry[];
	};

	const { path = [] }: BreadcrumbProps = $props();
	const dispatch = createEventDispatcher<{ navigate: { id: string | null } }>();

	const handleNavigate = (id: string | null) => {
		dispatch('navigate', { id });
	};
</script>

<nav class="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
	<Button variant="ghost" size="sm" onclick={() => handleNavigate(null)}>Home</Button>
	{#if path.length > 0}
		<ChevronRightIcon class="h-3 w-3 text-muted-foreground" />
		{#each path as crumb, index}
			<Button
				variant="ghost"
				size="sm"
				class="max-w-[140px] truncate"
				onclick={() => handleNavigate(crumb.id)}
			>
				{crumb.name}
			</Button>
			{#if index < path.length - 1}
				<ChevronRightIcon class="h-3 w-3 text-muted-foreground" />
			{/if}
		{/each}
	{/if}
</nav>
