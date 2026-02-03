<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { FileManagerAction } from './types.js';
	import { Button } from '$lib/components/ui/button';
	import * as ButtonGroup from '$lib/components/ui/button-group';
	import { Input } from '$lib/components/ui/input';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import { formatShortcut } from './shortcuts.js';

	type ToolbarProps = {
		actions?: FileManagerAction[];
		overflowActions?: FileManagerAction[];
		search?: string;
		selectionCount?: number;
		searchRef?: HTMLInputElement | null;
	};

	const {
		actions = [],
		overflowActions = [],
		search = '',
		selectionCount = 0,
		searchRef = $bindable(null)
	}: ToolbarProps = $props();

	const dispatch = createEventDispatcher<{
		action: { actionId: string };
		search: { value: string };
		navigateDown: void;
	}>();

	const handleAction = (actionId: string) => {
		dispatch('action', { actionId });
	};
</script>

<div class="flex flex-wrap items-center gap-3">
	<div class="flex min-w-0 flex-1 items-center gap-2">
		<Input
			placeholder="Search files and folders in the current directory"
			value={search}
			ref={searchRef}
			onkeydown={(event) => {
				if (event.key === 'ArrowDown') {
					event.preventDefault();
					dispatch('navigateDown');
				}
			}}
			oninput={(event) =>
				dispatch('search', { value: (event.currentTarget as HTMLInputElement).value })}
			class="w-full md:max-w-sm"
		/>
		{#if selectionCount > 0}
			<span class="text-xs text-muted-foreground">{selectionCount} selected</span>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		<ButtonGroup.Root class="hidden sm:flex">
			{#each actions as action}
				<Button size="sm" variant="outline" onclick={() => handleAction(action.id)}>
					{#if action.icon}
						{@const ActionIcon = action.icon}
						<ActionIcon class="h-4 w-4" />
					{/if}
					<span class="hidden md:inline">{action.label}</span>
				</Button>
			{/each}
		</ButtonGroup.Root>

		{#if actions.length > 0}
			<div class="sm:hidden">
				{#each actions as action}
					<Button size="icon-sm" variant="outline" onclick={() => handleAction(action.id)}>
						{#if action.icon}
							{@const ActionIcon = action.icon}
							<ActionIcon class="h-4 w-4" />
						{/if}
					</Button>
				{/each}
			</div>
		{/if}

		{#if overflowActions.length > 0}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger asChild>
					<Button size="icon-sm" variant="outline" aria-label="More actions">
						<MoreHorizontalIcon class="h-4 w-4" />
					</Button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-56">
					{#each overflowActions as action}
						<DropdownMenu.Item onclick={() => handleAction(action.id)}>
							{#if action.icon}
								{@const ActionIcon = action.icon}
								<ActionIcon class="h-4 w-4" />
							{/if}
							<span>{action.label}</span>
							{#if action.shortcut?.[0]}
								<DropdownMenu.Shortcut>{formatShortcut(action.shortcut[0])}</DropdownMenu.Shortcut>
							{/if}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	</div>
</div>
