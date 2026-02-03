<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { FileManagerAction } from './types.js';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import { formatShortcut } from './shortcuts.js';

	type ActionBarProps = {
		actions?: FileManagerAction[];
		overflowActions?: FileManagerAction[];
		selectionCount?: number;
	};

	const { actions = [], overflowActions = [], selectionCount = 0 }: ActionBarProps = $props();
	const dispatch = createEventDispatcher<{ action: { actionId: string } }>();
</script>

{#if selectionCount > 0}
	<div
		class="sticky bottom-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border bg-background/95 px-3 py-2 shadow-lg backdrop-blur md:hidden"
	>
		<div class="text-xs text-muted-foreground">{selectionCount} selected</div>
		<div class="flex items-center gap-1">
			{#each actions as action}
				<Button
					size="icon-sm"
					variant="outline"
					onclick={() => dispatch('action', { actionId: action.id })}
				>
					{#if action.icon}
						{@const ActionIcon = action.icon}
						<ActionIcon class="h-4 w-4" />
					{/if}
				</Button>
			{/each}

			{#if overflowActions.length > 0}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger asChild>
						<Button size="icon-sm" variant="outline" aria-label="More actions">
							<MoreHorizontalIcon class="h-4 w-4" />
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56">
						{#each overflowActions as action}
							<DropdownMenu.Item onclick={() => dispatch('action', { actionId: action.id })}>
								{#if action.icon}
									{@const ActionIcon = action.icon}
									<ActionIcon class="h-4 w-4" />
								{/if}
								<span>{action.label}</span>
								{#if action.shortcut?.[0]}
									<DropdownMenu.Shortcut>{formatShortcut(action.shortcut[0])}</DropdownMenu.Shortcut
									>
								{/if}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</div>
	</div>
{/if}
