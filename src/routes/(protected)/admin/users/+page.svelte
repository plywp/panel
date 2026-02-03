<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.ts';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button';
	import {
		UserRoundSearch,
		SlidersHorizontal,
		ChevronLeft,
		ChevronRight,
		Users
	} from 'lucide-svelte';
	import { client } from '$lib/auth-client';
	import { onMount } from 'svelte';

	type Query = {
		searchValue?: string;
		searchField?: 'email' | 'name';
		searchOperator?: 'contains' | 'starts_with' | 'ends_with';
		limit?: string | number;
		offset?: string | number;
		sortBy?: string;
		sortDirection?: 'asc' | 'desc';
		filterField?: string;
		filterValue?: string | number | boolean;
		filterOperator?: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
	};

	let showFilter = false;

	let query: Query = {
		searchValue: '',
		searchField: 'email',
		searchOperator: 'contains',
		limit: 25,
		offset: 0,
		sortBy: 'createdAt',
		sortDirection: 'desc',
		filterField: '',
		filterValue: '',
		filterOperator: 'eq'
	};

	let users: any[] = [];
	let total: number | null = null;
	let loading = false;
	let errorMsg: string | null = null;

	const skeletonRows = 6;

	$: limit = Number(query.limit ?? 25);
	$: offset = Number(query.offset ?? 0);
	$: page = Math.floor(offset / limit) + 1;
	$: canPrev = offset > 0;
	$: canNext = total == null ? users.length === limit : offset + limit < total;

	function buildQuery(): Query {
		const q: Query = {
			...query,
			limit: Number(query.limit ?? 25),
			offset: Number(query.offset ?? 0)
		};

		if (!q.searchValue) {
			delete q.searchValue;
			delete q.searchField;
			delete q.searchOperator;
		}

		if (!q.filterField || q.filterValue === '' || q.filterValue === undefined) {
			delete q.filterField;
			delete q.filterValue;
			delete q.filterOperator;
		}

		return q;
	}

	let lastKey = '';
	let debounce: ReturnType<typeof setTimeout> | null = null;
	let reqId = 0;

	function makeKey(q: Query) {
		const keyObj = {
			searchValue: q.searchValue ?? '',
			searchField: q.searchField ?? '',
			searchOperator: q.searchOperator ?? '',
			limit: Number(q.limit ?? 25),
			offset: Number(q.offset ?? 0),
			sortBy: q.sortBy ?? '',
			sortDirection: q.sortDirection ?? '',
			filterField: q.filterField ?? '',
			filterValue: q.filterValue ?? '',
			filterOperator: q.filterOperator ?? ''
		};
		return JSON.stringify(keyObj);
	}

	async function fetchUsers(q: Query) {
		const myReq = ++reqId;
		loading = true;
		errorMsg = null;

		try {
			const { data, error } = await client.admin.listUsers({ query: q });

			if (myReq !== reqId) return;

			if (error) {
				errorMsg = typeof error === 'string' ? error : (error.message ?? 'Failed to load users');
				users = [];
				total = null;
				return;
			}

			const list = (data?.users ?? data ?? []) as any[];
			users = list;
			total = typeof (data as any)?.total === 'number' ? (data as any).total : null;
		} catch (e) {
			if (myReq !== reqId) return;
			errorMsg = e instanceof Error ? e.message : 'Failed to load users';
			users = [];
			total = null;
		} finally {
			if (myReq === reqId) loading = false;
		}
	}

	function scheduleFetch(reason: 'search' | 'filters' | 'page') {
		const q = buildQuery();
		const key = makeKey(q);

		if (key === lastKey) return;
		lastKey = key;

		if (reason === 'search') {
			if (debounce) clearTimeout(debounce);
			debounce = setTimeout(() => fetchUsers(q), 300);
		} else {
			if (debounce) {
				clearTimeout(debounce);
				debounce = null;
			}
			fetchUsers(q);
		}
	}

	function updateOffset(next: number) {
		query = { ...query, offset: Math.max(0, next) };
	}

	function setLimit(v: number) {
		query = { ...query, limit: v, offset: 0 };
	}

	function resetToFirstPage() {
		query = { ...query, offset: 0 };
	}

	function prevPage() {
		updateOffset(offset - limit);
	}

	function nextPage() {
		updateOffset(offset + limit);
	}

	let lastNonPageKey = '';

	$: {
		const nonPageKey = JSON.stringify({
			searchField: query.searchField,
			searchOperator: query.searchOperator,
			limit: Number(query.limit ?? 25),
			sortBy: query.sortBy,
			sortDirection: query.sortDirection,
			filterField: query.filterField,
			filterValue: query.filterValue,
			filterOperator: query.filterOperator
		});

		if (nonPageKey !== lastNonPageKey) {
			lastNonPageKey = nonPageKey;
			resetToFirstPage();
			scheduleFetch('filters');
		}
	}

	$: {
		query.offset;
		scheduleFetch('page');
	}

	$: {
		query.searchValue;
		resetToFirstPage();
		scheduleFetch('search');
	}

	onMount(() => {
		scheduleFetch('filters');
	});
	const SkeletonRowCount = 6;
</script>

{#if false}{/if}

<Card.Root>
	<Card.Header>
		<h1 class="flex items-center gap-2">
			<Users class="size-4" />
			Users
		</h1>
		<p>Here you can manage your users</p>

		<div class="flex items-center gap-2 rounded">
			<UserRoundSearch />
			<Input
				type="search"
				placeholder="Search users"
				class="max-w-xs"
				bind:value={query.searchValue}
			/>

			<Button onclick={() => (showFilter = !showFilter)}>
				<SlidersHorizontal />
			</Button>
		</div>

		{#if showFilter}
			<Card.Content class="mt-4 grid grid-cols-2 gap-4">
				<Input placeholder="Filter field (e.g. role/email)" bind:value={query.filterField} />
				<Input placeholder="Filter value" bind:value={query.filterValue} />

				<select bind:value={query.filterOperator} class="rounded border px-2 py-1">
					<option value="eq">=</option>
					<option value="ne">≠</option>
					<option value="lt">&lt;</option>
					<option value="lte">≤</option>
					<option value="gt">&gt;</option>
					<option value="gte">≥</option>
				</select>

				<select bind:value={query.searchField} class="rounded border px-2 py-1">
					<option value="email">Email</option>
					<option value="name">Name</option>
				</select>

				<select bind:value={query.searchOperator} class="rounded border px-2 py-1">
					<option value="contains">Contains</option>
					<option value="starts_with">Starts with</option>
					<option value="ends_with">Ends with</option>
				</select>

				<select bind:value={query.sortDirection} class="rounded border px-2 py-1">
					<option value="asc">Asc</option>
					<option value="desc">Desc</option>
				</select>
			</Card.Content>
		{/if}
	</Card.Header>

	<Card.Content class="space-y-4">
		<div class="flex items-center justify-between gap-2">
			<div class="text-sm text-muted-foreground">
				{#if loading}
					Loading…
				{:else if errorMsg}
					<span class="text-red-500">{errorMsg}</span>
				{:else}
					Page {page}{#if total != null}
						• Total {total}{/if}
				{/if}
			</div>

			<div class="flex items-center gap-2">
				<select
					class="rounded border px-2 py-1 text-sm"
					on:change={(e) => setLimit(Number((e.currentTarget as HTMLSelectElement).value))}
					value={limit}
				>
					<option value="10">10</option>
					<option value="25">25</option>
					<option value="50">50</option>
					<option value="100">100</option>
				</select>

				<Button disabled={!canPrev || loading} onclick={prevPage}>
					<ChevronLeft />
				</Button>
				<Button disabled={!canNext || loading} onclick={nextPage}>
					<ChevronRight />
				</Button>
			</div>
		</div>

		{#if loading}
			<ul class="space-y-2">
				{#each Array(SkeletonRowCount) as _}
					<li class="animate-pulse rounded border p-3">
						<div class="h-4 w-40 rounded bg-muted"></div>
						<div class="mt-2 h-3 w-64 rounded bg-muted/70"></div>
					</li>
				{/each}
			</ul>
		{:else if errorMsg}
			<div class="rounded border p-4 text-sm text-red-500">{errorMsg}</div>
		{:else if users.length === 0}
			<div class="rounded border p-4 text-sm text-muted-foreground">No users found.</div>
		{:else}
			<ul class="space-y-2">
				{#each users as u (u.id)}
					<li class="rounded border">
						<a class="block p-3 transition hover:bg-muted/40" href={`/admin/users/${u.id}`}>
							<div class="font-medium">{u.name ?? '(no name)'}</div>
							<div class="text-sm text-muted-foreground">{u.email}</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
