<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { enhance } from '$app/forms';
	import { Save, Settings } from 'lucide-svelte';

	export let data: {
		meta: {
			title: string;
			description: string;
			favicon: string;
		};
	};

	let title = data.meta.title ?? '';
	let description = data.meta.description ?? '';

	let faviconPreview: string | null = null;

	let status: 'idle' | 'saving' | 'success' | 'error' = 'idle';
	let message = '';
	let updated: Record<string, unknown> = {};

	function onFaviconChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (faviconPreview) URL.revokeObjectURL(faviconPreview);
		faviconPreview = URL.createObjectURL(file);
	}

	function enhanceSave() {
		return enhance(() => {
			status = 'saving';
			message = 'Saving…';
			updated = {};

			return async ({ result, form }) => {
				if (result.type === 'success') {
					const r: any = result.data;

					status = 'success';
					updated = r.updated ?? {};

					const keys = Object.keys(updated);
					message = keys.length ? `Updated: ${keys.join(', ')}` : 'No changes detected';

					if (r.meta) {
						title = r.meta.title ?? title;
						description = r.meta.description ?? description;
						data.meta.favicon = r.meta.favicon ?? data.meta.favicon;
					}

					faviconPreview = null;

					const fileInput = form.querySelector<HTMLInputElement>(
						'input[type="file"][name="favicon"]'
					);
					if (fileInput) fileInput.value = '';
				} else if (result.type === 'failure') {
					status = 'error';
					message = (result.data as any)?.error ?? 'Validation failed';
				} else {
					status = 'error';
					message = 'Unexpected error';
				}
			};
		});
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Settings class="size-4" />
			Settings
		</Card.Title>
		<Card.Description>Manage your account settings</Card.Description>
	</Card.Header>

	<Card.Content>
		<form method="POST" enctype="multipart/form-data" action="?/save" use:enhance>
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<Label for="title">Title</Label>
					<Input id="title" name="title" type="text" bind:value={title} />
				</div>

				<div class="flex flex-col gap-2">
					<Label for="description">Description</Label>
					<Input id="description" name="description" type="text" bind:value={description} />
				</div>

				<div class="flex flex-col gap-2">
					<Label for="favicon">Logo</Label>
					<Input
						id="favicon"
						name="favicon"
						type="file"
						accept=".png,.jpg,.jpeg,.svg"
						onchange={onFaviconChange}
					/>

					{#if faviconPreview}
						<img
							src={faviconPreview}
							alt="New logo preview"
							class="h-16 w-16 rounded border bg-muted object-contain"
						/>
					{:else if data.meta.favicon}
						<img
							src={data.meta.favicon}
							alt="Current logo"
							class="h-16 w-16 rounded border bg-muted object-contain"
						/>
					{/if}
				</div>

				<Button type="submit" disabled={status === 'saving'}>
					<Save class="size-4" />
					{status === 'saving' ? 'Saving…' : 'Save'}
				</Button>

				{#if status !== 'idle'}
					<div
						class={`rounded border p-3 text-sm ${
							status === 'saving'
								? 'border-border bg-muted'
								: status === 'success'
									? 'border-green-500/30 bg-green-500/10'
									: 'border-red-500/30 bg-red-500/10'
						}`}
					>
						<div class="font-medium">
							{status === 'saving' && 'Working…'}
							{status === 'success' && 'Done'}
							{status === 'error' && 'Error'}
						</div>

						<div class="opacity-80">{message}</div>

						{#if status === 'success' && Object.keys(updated).length}
							<ul class="mt-2 list-disc pl-5 opacity-90">
								{#each Object.keys(updated) as key}
									<li><span class="font-medium">{key}</span> updated</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>
		</form>
	</Card.Content>
</Card.Root>
