<script lang="ts">
	import { Header, Title, Description } from '$lib/components/ui/card';
	import ManagedFilterBar from '$lib/components/managed-items/ManagedFilterBar.svelte';

	export type FilterOption = {
		value: string;
		label: string;
	};

	export type HeaderProps = {
		title: string;
		subtext?: string;
		search?: string;
		filter?: string;
		searchPlaceholder?: string;
		filterOptions?: FilterOption[];
	};

	const defaultOptions: FilterOption[] = [
		{ value: 'all', label: 'All statuses' },
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'updates', label: 'Updates' }
	];
	let {
		title,
		subtext = '',
		search = $bindable(''),
		filter = $bindable('all'),
		searchPlaceholder = 'Search',
		filterOptions = defaultOptions
	}: HeaderProps = $props();
</script>

<Header>
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-0">
			<Title class="truncate">{title}</Title>
			{#if subtext}
				<Description class="truncate">{subtext}</Description>
			{/if}
		</div>

		<div class="flex items-center gap-3">
			<ManagedFilterBar bind:search bind:filter {searchPlaceholder} {filterOptions} />

			{#if $$slots.actions}
				<div class="shrink-0">
					<slot name="actions" />
				</div>
			{/if}
		</div>
	</div>
</Header>
