<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import type { ManagedItemBase } from '$lib/types/managed-items';

	type ItemCardProps = {
		item: ManagedItemBase;
		statusText: string;
		statusVariant: string;
		updateText?: string | null;
		showUpdateBadge?: boolean;
		versionLabel?: string;
		bulkFormId?: string;
		excludes?: string[];
		showExclude?: boolean;
		thumbnailUrl?: string | null;
		thumbnailAlt?: string;
	};

	let {
		item,
		statusText,
		statusVariant,
		updateText = null,
		showUpdateBadge = false,
		versionLabel,
		bulkFormId,
		excludes = $bindable([]),
		showExclude = true,
		thumbnailUrl = null,
		thumbnailAlt = ''
	}: ItemCardProps = $props();

	let imageErrored = $state(false);
	let imageLoaded = $state(false);

	const handleImageError = () => {
		imageErrored = true;
	};

	const handleImageLoad = () => {
		imageLoaded = true;
	};
</script>

<div class="border-b mb-1">
	{#if thumbnailUrl && !imageErrored}
		<div class="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted/30">
			{#if !imageLoaded}
				<Skeleton class="h-full w-full" />
			{/if}
			<img
				src={thumbnailUrl}
				alt={thumbnailAlt}
				loading="lazy"
				decoding="async"
				class={`h-full w-full object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
				on:error={handleImageError}
				on:load={handleImageLoad}
			/>
		</div>
	{:else if thumbnailUrl}
		<div
			class="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border bg-muted/30"
			aria-hidden="true"
		>
			<Skeleton class="h-8 w-14" />
		</div>
	{/if}

	<div class="flex flex-1 flex-col gap-2">
		<div class="flex flex-wrap items-center gap-2">
			<div class="text-base font-semibold">{item.name}</div>
			<Badge variant={statusVariant}>{statusText}</Badge>
			{#if showUpdateBadge}
				<Badge variant="destructive">{updateText}</Badge>
			{/if}
		</div>
		<div class="text-xs text-muted-foreground">{versionLabel}</div>
		{#if showExclude}
			<div class="flex flex-wrap items-center gap-3 my-2">
				<Label class="flex items-center gap-2 text-xs text-muted-foreground">
					<Checkbox
						type="checkbox"
						name="exclude"
						value={item.name}
						bind:group={excludes}
						form={bulkFormId}
					/>
					Exclude from bulk update
				</Label>
			</div>
		{/if}
	</div>
</div>
<div class="flex flex-wrap items-center gap-2">
	<slot name="actions" />
</div>
