<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-svelte';

	export let data: { locations: { id: number; name: string; country: string }[] };

	let showCreateForm = false;
	let showEditForm = false;

	let pendingCreate = false;
	let pendingEdit = false;
	let pendingDeleteId: number | null = null;

	let createName = '';
	let createCountry = '';

	let editId: number | null = null;
	let editName = '';
	let editCountry = '';

	function openEdit(loc: { id: number; name: string; country: string }) {
		showCreateForm = false;
		showEditForm = true;

		editId = loc.id;
		editName = loc.name;
		editCountry = loc.country;
	}

	function closeEdit() {
		showEditForm = false;
		editId = null;
		editName = '';
		editCountry = '';
	}

	const enhanceCreate = () => {
		return async ({ update, form }: { update: () => Promise<any>; form: HTMLFormElement }) => {
			pendingCreate = true;

			const res = await update();

			pendingCreate = false;

			if (res === 'success') {
				createName = '';
				createCountry = '';
				showCreateForm = false;

				form.reset();
				await invalidateAll();
			}
		};
	};

	const enhanceEdit = () => {
		return async ({ update }: { update: () => Promise<any> }) => {
			pendingEdit = true;

			const res = await update();

			pendingEdit = false;

			if (res === 'success') {
				closeEdit();
				await invalidateAll();
			}
		};
	};

	const enhanceDelete = (id: number) => {
		return async ({ update }: { update: () => Promise<any> }) => {
			pendingDeleteId = id;

			const res = await update();

			pendingDeleteId = null;

			if (res === 'success') {
				if (editId === id) closeEdit();
				await invalidateAll();
			}
		};
	};
</script>

<div class="space-y-6 p-6">
	<header class="flex items-center justify-between">
		<h1 class="flex items-center gap-2 text-2xl font-bold">
			<MapPin class="size-5" />
			Locations
		</h1>

		<Button
			type="button"
			onclick={() => {
				showEditForm = false;
				showCreateForm = !showCreateForm;
			}}
		>
			{#if showCreateForm}
				<X class="size-4" />
				Close
			{:else}
				<Plus class="size-4" />
				Create
			{/if}
		</Button>
	</header>

	{#if showCreateForm}
		<form
			method="POST"
			action="?/create"
			use:enhance={enhanceCreate}
			class="grid max-w-lg gap-3 rounded-lg border p-4"
		>
			<div class="grid gap-1">
				<label class="text-sm font-medium" for="c_name">Name</label>
				<input
					id="c_name"
					name="name"
					bind:value={createName}
					class="rounded-md border px-3 py-2"
					placeholder="Dhaka DC"
					required
				/>
			</div>

			<div class="grid gap-1">
				<label class="text-sm font-medium" for="c_country">Country</label>
				<input
					id="c_country"
					name="country"
					bind:value={createCountry}
					class="rounded-md border px-3 py-2"
					placeholder="Bangladesh"
					required
				/>
			</div>

			<button
				disabled={pendingCreate}
				class="rounded-md border px-3 py-2 transition hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
			>
				{pendingCreate ? 'Creating…' : 'Create'}
			</button>
		</form>
	{/if}

	{#if showEditForm}
		<form
			method="POST"
			action="?/edit"
			use:enhance={enhanceEdit}
			class="grid max-w-lg gap-3 rounded-lg border p-4"
		>
			<input type="hidden" name="id" value={editId ?? ''} />

			<div class="flex items-center justify-between">
				<h2 class="flex items-center gap-2 text-base font-semibold">
					<Pencil class="size-4" />
					Edit location
				</h2>
				<button type="button" class="text-sm underline" on:click={closeEdit}>Cancel</button>
			</div>

			<div class="grid gap-1">
				<label class="text-sm font-medium" for="e_name">Name</label>
				<input
					id="e_name"
					name="name"
					bind:value={editName}
					class="rounded-md border px-3 py-2"
					required
				/>
			</div>

			<div class="grid gap-1">
				<label class="text-sm font-medium" for="e_country">Country</label>
				<input
					id="e_country"
					name="country"
					bind:value={editCountry}
					class="rounded-md border px-3 py-2"
					required
				/>
			</div>

			<button
				disabled={pendingEdit || editId === null}
				class="rounded-md border px-3 py-2 transition hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
			>
				{pendingEdit ? 'Updating…' : 'Update'}
			</button>
		</form>
	{/if}

	{#if data.locations.length === 0}
		<p class="text-center text-muted">No locations found.</p>
	{/if}

	<div class="overflow-hidden rounded-lg border">
		<table class="w-full text-sm">
			<thead class="bg-muted/40">
				<tr>
					<th class="p-3 text-left">Name</th>
					<th class="p-3 text-left">Country</th>
					<th class="p-3 text-right">Actions</th>
				</tr>
			</thead>

			<tbody>
				{#each data.locations as loc}
					<tr class="border-t">
						<td class="p-3">{loc.name}</td>
						<td class="p-3">{loc.country}</td>
						<td class="p-3">
							<div class="flex justify-end gap-2">
								<button
									type="button"
									class="rounded-md border px-3 py-1.5 transition hover:bg-accent"
									on:click={() => openEdit(loc)}
								>
									<Pencil class="mr-1 inline size-4" />
									Edit
								</button>

								<form method="POST" action="?/delete" use:enhance={() => enhanceDelete(loc.id)}>
									<input type="hidden" name="id" value={loc.id} />
									<button
										disabled={pendingDeleteId === loc.id}
										class="rounded-md border px-3 py-1.5 transition hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-60"
									>
										{#if pendingDeleteId === loc.id}
											Deleting…
										{:else}
											<Trash2 class="mr-1 inline size-4" />
											Delete
										{/if}
									</button>
								</form>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
