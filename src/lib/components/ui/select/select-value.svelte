<script lang="ts">
	import { cn } from '$lib/utils.js';

	let {
		class: className,
		placeholder = '',
		children
	}: { class?: string; placeholder?: string } = $props();
</script>

<span data-slot="select-value" class={cn('truncate', className)}>
	{#if children}
		{@render children()}
	{:else}
		{placeholder}
	{/if}
</span>
