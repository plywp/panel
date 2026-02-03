<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { FileEntry, FileManagerAction } from './types.js';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatBytes } from './state.js';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FolderCodeIcon from '@lucide/svelte/icons/folder-code';
	import FolderCogIcon from '@lucide/svelte/icons/folder-cog';
	import ServerIcon from '@lucide/svelte/icons/server';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ImagesIcon from '@lucide/svelte/icons/images';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileArchiveIcon from '@lucide/svelte/icons/file-archive';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import { formatShortcut } from './shortcuts.js';
	import { cn } from '$lib/utils.js';
	import { browser } from '$app/environment';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';

	type ListProps = {
		entries?: FileEntry[];
		selection?: string[];
		actions?: FileManagerAction[];
		search?: string;
		focusActionId?: string | null;
		focusId?: string | null;
	};

	const {
		entries = [],
		selection = [],
		actions = [],
		search = '',
		focusActionId = null,
		focusId = null
	}: ListProps = $props();

	const dispatch = createEventDispatcher<{
		selectRequest: { id: string; metaKey: boolean; shiftKey: boolean };
		open: { entry: FileEntry };
		navigate: { entry: FileEntry };
		action: { actionId: string; entry: FileEntry };
		actionFocusExit: void;
	}>();

	let actionButtons: Record<string, HTMLButtonElement | null> = {};

	$effect(() => {
		if (!focusActionId) return;
		const button = actionButtons[focusActionId];
		button?.focus();
	});

	const matchesSearch = (entry: FileEntry) => {
		if (!search.trim()) return true;
		return entry.name.toLowerCase().includes(search.trim().toLowerCase());
	};

	const filteredEntries = $derived(entries.filter(matchesSearch));
	const prefersReducedMotion =
		browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
		const newtonIterations = 8;
		const newtonMinSlope = 0.001;
		const subdivisionPrecision = 0.0000001;
		const subdivisionMaxIterations = 10;

		const kSplineTableSize = 11;
		const kSampleStepSize = 1 / (kSplineTableSize - 1);

		const float32ArraySupported = typeof Float32Array === 'function';

		const sampleValues = float32ArraySupported
			? new Float32Array(kSplineTableSize)
			: new Array(kSplineTableSize);

		const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
		const b = (a1: number, a2: number) => 3 * a2 - 6 * a1;
		const c = (a1: number) => 3 * a1;

		const calcBezier = (t: number, a1: number, a2: number) =>
			((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;
		const getSlope = (t: number, a1: number, a2: number) =>
			3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1);

		for (let i = 0; i < kSplineTableSize; ++i) {
			sampleValues[i] = calcBezier(i * kSampleStepSize, x1, x2);
		}

		const binarySubdivide = (x: number, a1: number, a2: number) => {
			let currentX = 0;
			let currentT = 0;
			let i = 0;
			let t0 = 0;
			let t1 = 1;

			do {
				currentT = t0 + (t1 - t0) / 2;
				currentX = calcBezier(currentT, a1, a2) - x;
				if (currentX > 0) {
					t1 = currentT;
				} else {
					t0 = currentT;
				}
			} while (Math.abs(currentX) > subdivisionPrecision && ++i < subdivisionMaxIterations);

			return currentT;
		};

		const newtonRaphsonIterate = (x: number, guessT: number, a1: number, a2: number) => {
			for (let i = 0; i < newtonIterations; ++i) {
				const currentSlope = getSlope(guessT, a1, a2);
				if (currentSlope === 0) return guessT;
				const currentX = calcBezier(guessT, a1, a2) - x;
				guessT -= currentX / currentSlope;
			}
			return guessT;
		};

		const getTForX = (x: number) => {
			let intervalStart = 0;
			let currentSample = 1;
			const lastSample = kSplineTableSize - 1;

			for (; currentSample !== lastSample && sampleValues[currentSample] <= x; ++currentSample) {
				intervalStart += kSampleStepSize;
			}
			--currentSample;

			const dist =
				(x - sampleValues[currentSample]) /
				(sampleValues[currentSample + 1] - sampleValues[currentSample]);
			const guessForT = intervalStart + dist * kSampleStepSize;

			const initialSlope = getSlope(guessForT, x1, x2);
			if (initialSlope >= newtonMinSlope) {
				return newtonRaphsonIterate(x, guessForT, x1, x2);
			}
			if (initialSlope === 0) return guessForT;
			return binarySubdivide(x, x1, x2);
		};

		return (x: number) => {
			if (x === 0 || x === 1) return x;
			return calcBezier(getTForX(x), y1, y2);
		};
	};

	const easeStandard = cubicBezier(0.4, 0, 0.2, 1);

	const isEntrySelectable = (action: FileManagerAction, entry: FileEntry) => {
		if (action.allowFiles === false && entry.kind === 'file') return false;
		if (action.allowFolders === false && entry.kind === 'folder') return false;
		if (action.id === 'extract') {
			return entry.kind === 'file' && (entry.extension === 'zip' || entry.isArchive);
		}
		return true;
	};

	const folderAccent = (name: string) => {
		const key = name.toLowerCase();
		if (['src'].includes(key)) return { icon: FolderCodeIcon, className: 'text-sky-600' };
		if (['server', 'backend', 'api'].includes(key))
			return { icon: ServerIcon, className: 'text-emerald-600' };
		if (['frontend', 'client', 'web', 'ui'].includes(key))
			return { icon: LayoutGridIcon, className: 'text-amber-600' };
		if (['database', 'db', 'data'].includes(key))
			return { icon: DatabaseIcon, className: 'text-indigo-600' };
		if (['config', 'settings'].includes(key))
			return { icon: FolderCogIcon, className: 'text-rose-600' };
		if (['docs', 'doc', 'document', 'documents'].includes(key))
			return { icon: FileTextIcon, className: 'text-cyan-600' };
		if (['media', 'images', 'assets', 'static'].includes(key))
			return { icon: ImagesIcon, className: 'text-fuchsia-600' };
		return { icon: FolderIcon, className: 'text-muted-foreground' };
	};
</script>

<div class="min-h-[260px] rounded-lg border" role="list">
	<div
		class="hidden grid-cols-[44px_minmax(0,1fr)_110px_160px_40px] border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase md:grid"
	>
		<span class="text-center">Select</span>
		<span>Name</span>
		<span>Size</span>
		<span>Modified</span>
		<span class="text-right">Actions</span>
	</div>

	<div class="divide-y">
		{#if filteredEntries.length === 0}
			<div class="p-6 text-center text-sm text-muted-foreground">No files or folders found.</div>
		{:else}
			{#each filteredEntries as entry, index (entry.id)}
				<div
					in:fly={{
						y: prefersReducedMotion ? 0 : 8,
						duration: prefersReducedMotion ? 0 : 180,
						delay: prefersReducedMotion ? 0 : 80 + index * 30,
						easing: easeStandard
					}}
					animate:flip={{ duration: prefersReducedMotion ? 0 : 150, easing: easeStandard }}
				>
					<ContextMenu.Root>
						<ContextMenu.Trigger asChild>
							<div
								class={cn(
									'grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-3 px-3 py-2 text-sm md:grid-cols-[44px_minmax(0,1fr)_110px_160px_40px]',
									selection.includes(entry.id) ? 'bg-accent/60' : 'hover:bg-muted/50',
									focusId === entry.id ? 'bg-muted/60' : ''
								)}
								role="listitem"
								aria-selected={selection.includes(entry.id)}
								onclick={() => {
									if (entry.kind === 'folder') {
										dispatch('navigate', { entry });
									} else {
										dispatch('open', { entry });
									}
								}}
								oncontextmenu={(event) => {
									event.preventDefault();
									dispatch('selectRequest', { id: entry.id, metaKey: false, shiftKey: false });
								}}
							>
								<div class="flex items-center justify-center">
									<input
										type="checkbox"
										checked={selection.includes(entry.id)}
										onclick={(event) => {
											event.stopPropagation();
											const target = event.currentTarget as HTMLInputElement;
											dispatch('selectRequest', {
												id: entry.id,
												metaKey: true,
												shiftKey: false
											});
											target.blur();
										}}
										class="h-4 w-4 rounded border-muted-foreground text-primary"
									/>
								</div>
								<div class="flex min-w-0 items-center gap-3">
									{#if entry.kind === 'folder'}
										{@const Accent = folderAccent(entry.name)}
										<div class={`h-4 w-4 ${Accent.className}`}>
											<Accent.icon class="h-4 w-4" />
										</div>
									{:else if entry.extension === 'zip' || entry.isArchive}
										<div class="h-4 w-4 text-amber-600">
											<FileArchiveIcon class="h-4 w-4" />
										</div>
									{:else}
										<div class="h-4 w-4 text-muted-foreground">
											<FileIcon class="h-4 w-4" />
										</div>
									{/if}
									<div class="min-w-0">
										<div class="truncate font-medium">{entry.name}</div>
										<div class="text-xs text-muted-foreground md:hidden">
											{entry.kind === 'folder' ? 'Folder' : formatBytes(entry.size)}
											· {new Date(entry.modifiedAt).toLocaleDateString()}
										</div>
									</div>
								</div>
								<div class="hidden text-xs text-muted-foreground md:block">
									{entry.kind === 'folder' ? '—' : formatBytes(entry.size)}
								</div>
								<div class="hidden text-xs text-muted-foreground md:block">
									{new Date(entry.modifiedAt).toLocaleString()}
								</div>
								<div class="flex justify-end">
									<DropdownMenu.Root>
										<DropdownMenu.Trigger asChild>
											<button
												bind:this={actionButtons[entry.id]}
												onclick={(event) => event.stopPropagation()}
												onkeydown={(event) => {
													if (event.key === '<') {
														event.preventDefault();
														dispatch('actionFocusExit');
													}
												}}
												class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted"
												aria-label="Row actions"
											>
												<MoreHorizontalIcon class="h-4 w-4" />
											</button>
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" class="w-56">
											{#each actions.filter((action) => isEntrySelectable(action, entry)) as action}
												<DropdownMenu.Item
													onclick={() => dispatch('action', { actionId: action.id, entry })}
												>
													{#if action.icon}
														{@const ActionIcon = action.icon}
														<ActionIcon class="h-4 w-4" />
													{/if}
													<span>{action.label}</span>
													{#if action.shortcut?.[0]}
														<DropdownMenu.Shortcut>
															{formatShortcut(action.shortcut[0])}
														</DropdownMenu.Shortcut>
													{/if}
												</DropdownMenu.Item>
											{/each}
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							</div>
						</ContextMenu.Trigger>

						<ContextMenu.Content class="w-56">
							{#each actions.filter((action) => isEntrySelectable(action, entry)) as action}
								<ContextMenu.Item
									variant={action.variant === 'destructive' ? 'destructive' : 'default'}
									onclick={() => dispatch('action', { actionId: action.id, entry })}
								>
									{#if action.icon}
										{@const ActionIcon = action.icon}
										<ActionIcon class="h-4 w-4" />
									{/if}
									<span>{action.label}</span>
									{#if action.shortcut?.[0]}
										<ContextMenu.Shortcut>
											{formatShortcut(action.shortcut[0])}
										</ContextMenu.Shortcut>
									{/if}
								</ContextMenu.Item>
							{/each}
						</ContextMenu.Content>
					</ContextMenu.Root>
				</div>
			{/each}
		{/if}
	</div>
</div>
