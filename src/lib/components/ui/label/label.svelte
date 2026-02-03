<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		ref = null,
		className = '',
		...restProps
	}: {
		ref?: HTMLLabelElement | null;
		className?: string;
	} & Record<string, unknown> = $props();
</script>

<label
	bind:this={ref}
	data-slot="label"
	class={cn(
		'flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
		className
	)}
	{...restProps}
>
	<slot />
</label>
