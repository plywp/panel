<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import * as NativeSelect from '$lib/components/ui/native-select';

	type FilterOption = {
		value: string;
		label: string;
	};

	type FilterProps = {
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
		search = $bindable(''),
		filter = $bindable('all'),
		searchPlaceholder = 'Search',
		filterOptions = defaultOptions
	}: FilterProps = $props();
</script>

<div>
	<div>
		<Input
			class="w-full md:w-72"
			placeholder={searchPlaceholder}
			bind:value={search}
			aria-label={searchPlaceholder}
		/>
	</div>
	<slot name="meta" />
</div>

<NativeSelect.Root bind:value={filter} aria-label="Filter status">
	{#each filterOptions as option (option.value)}
		<NativeSelect.Option value={option.value}>{option.label}</NativeSelect.Option>
	{/each}
</NativeSelect.Root>
