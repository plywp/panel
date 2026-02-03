<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { deserialize } from '$app/forms';
	import { cn } from '$lib/utils.js';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Separator from '$lib/components/ui/separator';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import { toast } from 'svelte-sonner';
	import FileManagerToolbar from './file-manager-toolbar.svelte';
	import FileManagerBreadcrumbs from './file-manager-breadcrumbs.svelte';
	import FileManagerList from './file-manager-list.svelte';
	import FileManagerEditor from './file-manager-editor.svelte';
	import FileManagerActionBar from './file-manager-action-bar.svelte';
	import { resolveActions } from './actions.js';
	import {
		applySelectionRequest,
		clearSelection,
		createArchive,
		createFile,
		createFolder,
		deleteEntries,
		getAvailableName,
		getEntryById,
		getPath,
		moveEntries,
		renameEntry,
		updateFileContent
	} from './state.js';
	import {
		defaultShortcutMap,
		isTypingTarget,
		matchesShortcut,
		mergeShortcutMap
	} from './shortcuts.js';
	import type {
		FileEntry,
		FileManagerAction,
		FileManagerActionInput,
		FileManagerActionEvent,
		FileManagerActionHandler,
		FileManagerActionPayload,
		FileManagerActions,
		FileManagerEntriesEvent,
		FileManagerSelectionEvent,
		ShortcutMap
	} from './types.js';

	type FileManagerProps = {
		entries?: FileEntry[];
		cwdId?: string | null;
		actions?: FileManagerActions;
		readContent?: FileManagerActionHandler;
		keymap?: ShortcutMap;
		class?: string;
	};

	let {
		entries = [],
		cwdId = null,
		actions,
		readContent,
		keymap,
		class: className
	}: FileManagerProps = $props();

	// Combined event types
	export type CreatePayload = { name: string; parentId: string };
	export type RenamePayload = { id: string; name: string };
	export type MovePayload = { ids: string[]; destinationId: string };
	export type CopyPayload = { ids: string[]; destinationId: string };

	let uploadForm: HTMLFormElement | null = null;

	type FileManagerAllEvents = {
		action: FileManagerActionEvent;
		selectionChange: FileManagerSelectionEvent;
		entriesChange: FileManagerEntriesEvent;
		cwdChange: { cwdId: string | null };
		createFile: { selection: FileEntry[]; payload: CreatePayload };
		createFolder: { selection: FileEntry[]; payload: CreatePayload };
		rename: { selection: FileEntry[]; target?: FileEntry; payload: RenamePayload };
		move: { selection: FileEntry[]; payload: MovePayload };
		copy: { selection: FileEntry[]; payload: CopyPayload };
		delete: { selection: FileEntry[]; payload: any };
		save: { selection: FileEntry[]; payload: any };
		download: { selection: FileEntry[]; payload: any };
		archive: { selection: FileEntry[]; payload: any };
		extract: { selection: FileEntry[]; payload: any };
	};

	const dispatch = createEventDispatcher<FileManagerAllEvents>();

	const normalizeActions = (value?: FileManagerActions) => {
		if (!value) {
			return {
				list: [] as FileManagerActionInput[],
				handlers: {} as Record<string, FileManagerActionHandler>
			};
		}
		if (Array.isArray(value)) {
			return {
				list: value,
				handlers: {} as Record<string, FileManagerActionHandler>
			};
		}

		const handlers: Record<string, FileManagerActionHandler> = {};
		const list: FileManagerActionInput[] = [];
		for (const [id, action] of Object.entries(value)) {
			if (typeof action === 'function') {
				handlers[id] = action;
				list.push({ id });
				continue;
			}
			const { handler, ...rest } = action;
			if (handler) handlers[id] = handler;
			list.push({ ...rest, id });
		}

		return { list, handlers };
	};

	const buildPathEntries = (cwdId: string | null): FileEntry[] => {
		if (!cwdId) return [];
		const parts = cwdId
			.split('/')
			.map((part) => part.trim())
			.filter(Boolean);
		let current = '';
		return parts.map((part) => {
			current = current ? `${current}/${part}` : part;
			return {
				id: current,
				name: part,
				kind: 'folder',
				parentId: null,
				size: 0,
				modifiedAt: new Date(0).toISOString()
			};
		});
	};

	let localEntries = $state<FileEntry[]>([]);
	let currentCwdId = $state<string | null>(null);
	let lastCwdId = $state<string | null>(null);
	let lastEntriesProp = $state<FileEntry[] | null>(null);
	let selection = $state<string[]>([]);
	let lastSelectedId = $state<string | null>(null);
	let search = $state('');
	let editorEntryId = $state<string | null>(null);
	let editorContent = $state('');
	let editorDirty = $state(false);
	let isEditorSheetOpen = $state(false);
	let dialogMode = $state<
		'create-file' | 'create-folder' | 'rename' | 'move' | 'copy' | 'extract' | null
	>(null);
	let dialogName = $state('');
	let dialogTargetId = $state<string | null>(null);
	let dialogTargetIds = $state<string[]>([]);
	let moveTargetId = $state<string>('');
	let moveTargetInput = $state('');
	let moveTargetError = $state<string | null>(null);
	let isExtracting = $state(false);
	let lastEditorId = $state<string | null>(null);
	let lastEditorContent = $state<string | null>(null);
	let isFocused = $state(false);
	let uploadInput: HTMLInputElement | null = null;
	let dialogOpen = $state(false);
	let didInit = $state(false);
	let focusActionId = $state<string | null>(null);
	let focusZone = $state<'list' | 'row-actions' | 'toolbar'>('list');
	let rootEl: HTMLDivElement | null = null;
	let searchInput: HTMLInputElement | null = null;
	let focusId = $state<string | null>(null);

	const normalizedActions = $derived(normalizeActions(actions));
	const allActions = $derived(resolveActions(normalizedActions.list));
	const actionHandlers = $derived(normalizedActions.handlers);
	const effectiveKeymap = $derived(mergeShortcutMap(defaultShortcutMap, keymap));
	const visibleEntries = $derived(localEntries);
	const path = $derived(buildPathEntries(currentCwdId));
	const selectionEntries = $derived(
		selection.map((id) => getEntryById(localEntries, id)).filter(Boolean) as FileEntry[]
	);
	const folders = $derived(localEntries.filter((entry) => entry.kind === 'folder'));
	const editorEntry = $derived(getEntryById(localEntries, editorEntryId ?? ''));
	const rootId = $derived('');

	const primaryActions = $derived(
		allActions.filter((action) => action.primary && !action.requiresSelection)
	);
	const overflowActions = $derived(
		allActions.filter((action) => !action.primary && !action.requiresSelection)
	);
	const selectionActions = $derived(allActions.filter((action) => action.requiresSelection));

	const isArchiveEntry = (entry: FileEntry) => {
		if (entry.isArchive) return true;
		const name = entry.name.toLowerCase();
		const archiveExts = ['.zip', '.tar', '.tgz', '.tar.gz', '.tar.bz2', '.tbz2', '.tar.xz', '.txz'];
		return archiveExts.some((ext) => name.endsWith(ext));
	};

	const isActionAllowed = (action: FileManagerAction, targetEntries: FileEntry[]) => {
		if (action.requiresSelection && targetEntries.length === 0) return false;
		if (action.single && targetEntries.length !== 1) return false;
		const hasFiles = targetEntries.some((entry) => entry.kind === 'file');
		const hasFolders = targetEntries.some((entry) => entry.kind === 'folder');
		if (action.allowFiles === false && hasFiles) return false;
		if (action.allowFolders === false && hasFolders) return false;
		if (action.id === 'extract') {
			const entry = targetEntries[0];
			if (!entry || entry.kind !== 'file' || !isArchiveEntry(entry)) return false;
		}
		return true;
	};

	const allowedSelectionActions = $derived(
		selectionActions.filter((action) => isActionAllowed(action, selectionEntries))
	);

	const resolveTargetEntries = (entry?: FileEntry) => {
		if (!entry) return selectionEntries;
		if (selectionEntries.length === 0) return [entry];
		if (!selectionEntries.some((item) => item.id === entry.id)) return [entry];
		return selectionEntries;
	};

	const buildActionEvent = (
		actionId: string,
		targetEntries: FileEntry[],
		entry?: FileEntry,
		payload?: FileManagerActionPayload
	): FileManagerActionEvent => ({
		actionId,
		selection: targetEntries,
		cwdId: currentCwdId,
		entry,
		payload
	});

	const triggerAction = (event: FileManagerActionEvent) => {
		const handler = actionHandlers[event.actionId];
		let result: unknown;
		if (handler) {
			try {
				result = handler(event);
				if (result && typeof (result as Promise<void>).then === 'function') {
					(result as Promise<void>).catch((err) =>
						console.error('[file-manager] action failed', err)
					);
				}
			} catch (err) {
				console.error('[file-manager] action failed', err);
			}
		}

		dispatch('action', event);
		return { handled: Boolean(handler), result };
	};

	$effect(() => {
		if (!editorEntry?.id) return;
		const nextContent = editorEntry.content ?? '';
		if (editorEntry.id !== lastEditorId) {
			editorContent = nextContent;
			editorDirty = false;
			lastEditorId = editorEntry.id;
			lastEditorContent = nextContent;
			return;
		}
		if (!editorDirty && nextContent !== lastEditorContent) {
			editorContent = nextContent;
			lastEditorContent = nextContent;
		}
	});

	const editorDisplayContent = $derived(
		editorDirty ? editorContent : (editorEntry?.content ?? editorContent)
	);

	$effect(() => {
		if (didInit) return;
		localEntries = entries;
		currentCwdId = cwdId ?? null;
		lastCwdId = currentCwdId;
		moveTargetId = currentCwdId ?? rootId;
		didInit = true;
	});

	$effect(() => {
		if (!didInit) return;
		if (entries === lastEntriesProp) return;
		localEntries = entries;
		lastEntriesProp = entries;
		currentCwdId = cwdId ?? currentCwdId ?? null;
		moveTargetId = currentCwdId ?? rootId;
	});

	$effect(() => {
		if (!didInit) return;
		if (currentCwdId === lastCwdId) return;
		lastCwdId = currentCwdId;
		dispatch('cwdChange', { cwdId: currentCwdId });
	});

	$effect(() => {
		dialogOpen = dialogMode !== null;
	});

	$effect(() => {
		if (!dialogOpen) {
			dialogMode = null;
			dialogTargetId = null;
			dialogTargetIds = [];
			moveTargetInput = '';
			moveTargetError = null;
			isExtracting = false;
		}
	});

	$effect(() => {
		dispatch('selectionChange', { selection: selectionEntries, ids: selection });
	});

	const updateEntries = (next: FileEntry[]) => {
		localEntries = next;
		dispatch('entriesChange', { entries: next });
	};

	const applyEditorValue = (targetId: string, value: unknown) => {
		let content: string | null = null;
		if (typeof value === 'string') {
			content = value;
		} else if (value && typeof value === 'object' && 'content' in value) {
			content = String((value as { content?: string }).content ?? '');
		}
		if (content === null) return;
		updateEntries(updateFileContent(localEntries, targetId, content));
		if (editorEntryId === targetId) {
			editorContent = content;
			editorDirty = false;
			lastEditorContent = content;
		}
	};

	const resolveActionResult = async (
		event: FileManagerActionEvent,
		override?: FileManagerActionHandler
	) => {
		let overrideResult: unknown = undefined;
		if (override) {
			try {
				overrideResult = override(event);
			} catch (err) {
				console.error('[file-manager] action failed', err);
			}
		}
		const { result } = triggerAction(event);
		const value = overrideResult !== undefined ? overrideResult : result;
		if (value && typeof (value as Promise<unknown>).then === 'function') {
			return await (value as Promise<unknown>);
		}
		return value;
	};

	const openEditor = (entry: FileEntry) => {
		if (entry.kind === 'folder') {
			currentCwdId = entry.id;
			return;
		}
		editorEntryId = entry.id;
		isEditorSheetOpen = true;
	};

	const handleSelectionRequest = (
		event: CustomEvent<{ id: string; metaKey: boolean; shiftKey: boolean }>
	) => {
		const { id, metaKey, shiftKey } = event.detail;
		const result = applySelectionRequest({
			id,
			orderedIds: visibleEntries.map((entry) => entry.id),
			metaKey,
			shiftKey,
			lastSelectedId,
			currentSelection: selection
		});
		selection = result.selection;
		lastSelectedId = result.lastSelectedId;
		focusId = id;
	};

	const handleAction = async (actionId: string, entry?: FileEntry) => {
		const action = allActions.find((item) => item.id === actionId);
		const targetEntries = action?.single && entry ? [entry] : resolveTargetEntries(entry);
		if (action && !isActionAllowed(action, targetEntries)) {
			return;
		}

		switch (actionId) {
			case 'create-file':
				dialogMode = 'create-file';
				dialogName = 'untitled.txt';
				dialogTargetId = null;
				dialogTargetIds = [];
				break;
			case 'create-folder':
				dialogMode = 'create-folder';
				dialogName = 'New folder';
				dialogTargetId = null;
				dialogTargetIds = [];
				break;
			case 'rename': {
				const target = entry ?? targetEntries[0];
				if (!target) return;
				dialogMode = 'rename';
				dialogName = target.name;
				dialogTargetId = target.id;
				dialogTargetIds = [target.id];
				break;
			}
			case 'move': {
				if (targetEntries.length === 0) return;
				const target = entry ?? targetEntries[0];
				dialogMode = 'move';
				moveTargetId = target?.parentId ?? rootId;
				moveTargetInput = '';
				moveTargetError = null;
				dialogTargetId = null;
				dialogTargetIds = targetEntries.map((item) => item.id);
				break;
			}
			case 'copy': {
				if (targetEntries.length === 0) return;
				const target = entry ?? targetEntries[0];
				dialogMode = 'copy';
				moveTargetId = target?.parentId ?? rootId;
				moveTargetInput = '';
				moveTargetError = null;
				dialogTargetId = null;
				dialogTargetIds = targetEntries.map((item) => item.id);
				break;
			}
			case 'delete': {
				const payload = { ids: targetEntries.map((item) => item.id) };
				dispatch('delete', {
					selection: targetEntries,
					payload
				});
				break;
			}
			case 'open': {
				const target = entry ?? targetEntries[0];
				if (!target) return;
				openEditor(target);
				try {
					const value = await resolveActionResult(
						buildActionEvent(actionId, targetEntries, target),
						readContent
					);
					applyEditorValue(target.id, value);
				} catch (err) {
					console.error('[file-manager] action failed', err);
				}
				break;
			}
			case 'edit': {
				const target = entry ?? targetEntries[0];
				if (!target) return;
				openEditor(target);
				try {
					const value = await resolveActionResult(
						buildActionEvent(actionId, targetEntries, target),
						readContent
					);
					applyEditorValue(target.id, value);
				} catch (err) {
					console.error('[file-manager] action failed', err);
				}
				break;
			}
			case 'archive': {
				const payload = { ids: targetEntries.map((item) => item.id), parentId: currentCwdId };
				dispatch('archive', { selection: targetEntries, payload });
				break;
			}
			case 'extract': {
				const archive = entry ?? targetEntries[0];
				if (!archive) return;
				dialogMode = 'extract';
				dialogTargetId = archive.id;
				dialogTargetIds = [archive.id];
				moveTargetId = currentCwdId ?? rootId;
				moveTargetInput = '';
				moveTargetError = null;
				break;
			}
			case 'download': {
				const payload = { entries: targetEntries };
				console.log(payload);
				dispatch('download', {
					selection: targetEntries,
					payload
				});
				break;
			}
			case 'upload':
				uploadInput?.click();
				break;
			case 'select-all': {
				const ids = visibleEntries.map((item) => item.id);
				selection = ids;
				lastSelectedId = ids.at(-1) ?? null;
				const selectedEntries = visibleEntries;
				triggerAction(buildActionEvent(actionId, selectedEntries, entry, { ids }));
				break;
			}
			default:
				triggerAction(buildActionEvent(actionId, targetEntries, entry));
				break;
		}
	};

	const resolveMoveDestination = (input: string, base: string | null) => {
		const raw = input.trim();
		const isAbsolute = raw.startsWith('/');
		const stack = isAbsolute ? [] : (base ?? '').split('/').filter(Boolean);
		const parts = raw.replace(/^\/+/, '').split('/').filter(Boolean);

		for (const part of parts) {
			if (part === '.' || part === '') continue;
			if (part === '..') {
				if (stack.length === 0) return null;
				stack.pop();
				continue;
			}
			stack.push(part);
		}

		return stack.join('/');
	};

	const submitExtract = async (sourceId: string, targetId: string) => {
		if (!browser) return false;
		isExtracting = true;
		try {
			const fd = new FormData();
			fd.append('sources', sourceId);
			fd.set('target', targetId);

			const res = await fetch('?/extract', {
				method: 'POST',
				body: fd,
				credentials: 'include'
			});

			const result = deserialize(await res.text());

			if (result.type === 'failure') {
				const data = result.data as Record<string, unknown> | undefined;
				const message =
					(typeof data?.message === 'string' && data.message) ||
					(typeof data?.detail === 'string' && data.detail) ||
					'Extract failed';
				toast.error(message);
				return false;
			}

			if (result.type !== 'success') {
				toast.error('Extract failed');
				return false;
			}

			toast.success('Archive extracted');
			triggerAction(buildActionEvent('refresh', []));
			return true;
		} catch (err) {
			const message =
				err instanceof Error ? err.message : typeof err === 'string' ? err : 'Extract failed';
			toast.error(message);
			return false;
		} finally {
			isExtracting = false;
		}
	};

	const handleDialogConfirm = async () => {
		if (!dialogMode) return;
		const trimmed = dialogName.trim();
		if (!trimmed && dialogMode !== 'move' && dialogMode !== 'extract') return;

		switch (dialogMode) {
			case 'create-file': {
				const payload = { name: trimmed, parentId: currentCwdId ?? '' };
				console.log(payload);
				dispatch('createFile', { selection: selectionEntries, payload });
				//updateEntries(createFile(localEntries, currentCwdId, trimmed));

				break;
			}

			case 'create-folder': {
				const payload = { name: trimmed, parentId: currentCwdId ?? '' };
				dispatch('createFolder', { selection: selectionEntries, payload });
				// Always apply fallback for now
				updateEntries(createFolder(localEntries, currentCwdId, trimmed));
				break;
			}

			case 'rename': {
				const targetId = dialogTargetId ?? selectionEntries[0]?.id;
				if (!targetId) break;

				const target = getEntryById(localEntries, targetId) ?? undefined;
				const targetEntries = target ? [target] : selectionEntries;

				const payload = { id: targetId, name: trimmed };
				dispatch('rename', { selection: targetEntries, target, payload });
				// Always apply fallback for now
				updateEntries(renameEntry(localEntries, targetId, trimmed));
				break;
			}

			case 'move': {
				const ids = dialogTargetIds.length ? dialogTargetIds : [...selection];
				if (!ids.length) break;

				const destinationId = resolveMoveDestination(moveTargetInput, currentCwdId);
				if (destinationId === null) {
					moveTargetError = 'Destination cannot go above the WordPress root.';
					return;
				}
				moveTargetError = null;
				moveTargetId = destinationId;
				const payload = { ids, destinationId };
				dispatch('move', { selection: selectionEntries, payload });
				// Always apply fallback for now
				const currentId = currentCwdId ?? '';
				const nextEntries =
					destinationId !== currentId
						? localEntries.filter((entry) => !ids.includes(entry.id))
						: moveEntries(localEntries, ids, destinationId);
				updateEntries(nextEntries);
				break;
			}
			case 'copy': {
				const ids = dialogTargetIds.length ? dialogTargetIds : [...selection];
				if (!ids.length) break;

				const destinationId = resolveMoveDestination(moveTargetInput, currentCwdId);
				if (destinationId === null) {
					moveTargetError = 'Destination cannot go above the WordPress root.';
					return;
				}
				moveTargetError = null;
				moveTargetId = destinationId;
				const payload = { ids, destinationId };
				dispatch('copy', { selection: selectionEntries, payload });
				break;
			}
			case 'extract': {
				const sourceId = dialogTargetId ?? selectionEntries[0]?.id;
				if (!sourceId) break;
				const destinationId = resolveMoveDestination(moveTargetInput, currentCwdId);
				if (destinationId === null) {
					moveTargetError = 'Destination cannot go above the WordPress root.';
					return;
				}
				moveTargetError = null;
				const payload = { sources: [sourceId], target: destinationId };
				dispatch('extract', { selection: selectionEntries, payload });
				const ok = await submitExtract(sourceId, destinationId);
				if (!ok) return;
				break;
			}
			default: {
				break;
			}
		}

		dialogMode = null;
		dialogName = '';
		dialogTargetId = null;
		dialogTargetIds = [];
	};

	const handleEditorSave = (content: string) => {
		if (!editorEntryId) return;
		const target = getEntryById(localEntries, editorEntryId);
		const targetEntries = target ? [target] : [];
		const payload = { id: editorEntryId, content };
		dispatch('save', { selection: targetEntries, payload });
		updateEntries(updateFileContent(localEntries, editorEntryId, content));
		editorDirty = false;
	};

	const handleUpload = async (files: FileList | null) => {
		if (!files?.length) return;
		const fileList = Array.from(files);
		const { handled } = triggerAction(
			buildActionEvent('upload', selectionEntries, undefined, {
				files: fileList,
				parentId: currentCwdId
			})
		);
		if (handled) {
			if (uploadInput) uploadInput.value = '';
			return;
		}
		const now = new Date().toISOString();
		let nextEntries = [...localEntries];
		const readAsText = (file: File) =>
			new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result ?? ''));
				reader.onerror = () => reject(reader.error);
				reader.readAsText(file);
			});
		const readAsDataUrl = (file: File) =>
			new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result ?? ''));
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(file);
			});
		const isMedia = (name: string) => {
			const ext = name.split('.').pop()?.toLowerCase() ?? '';
			return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'ogg'].includes(ext);
		};
		for (const file of fileList) {
			const content = isMedia(file.name) ? await readAsDataUrl(file) : await readAsText(file);
			const safeName = getAvailableName(nextEntries, currentCwdId, file.name);
			nextEntries.push({
				id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
				name: safeName,
				kind: 'file',
				parentId: currentCwdId,
				size: file.size,
				modifiedAt: now,
				extension: safeName.split('.').pop(),
				content
			});
		}
		updateEntries(nextEntries);
		if (uploadInput) uploadInput.value = '';
	};

	const handleDownload = (targets: FileEntry[]) => {
		const files = targets.filter((entry) => entry.kind === 'file');
		if (!files.length) return;
		const blobData =
			files.length === 1
				? (files[0].content ?? '')
				: JSON.stringify(
						files.map((file) => ({ name: file.name, content: file.content ?? '' })),
						null,
						2
					);
		const name = files.length === 1 ? files[0].name : 'selection.json';
		const blob = new Blob([blobData], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = name;
		link.click();
		URL.revokeObjectURL(url);
	};

	const handleFocusOut = (event: FocusEvent) => {
		const current = event.currentTarget as HTMLElement;
		if (current && !current.contains(event.relatedTarget as Node)) {
			isFocused = false;
		}
	};

	$effect(() => {
		if (typeof window === 'undefined') return;

		const handler = (event: KeyboardEvent) => {
			if (!isFocused || isTypingTarget(event.target)) return;
			const currentIndex = visibleEntries.findIndex(
				(entry) => entry.id === (focusId ?? lastSelectedId ?? selection.at(-1))
			);
			const hasEntries = visibleEntries.length > 0;

			if (
				event.key === '>' ||
				(event.key === '.' && event.shiftKey) ||
				(event.code === 'Period' && event.shiftKey)
			) {
				const target = focusId ?? selection.at(-1) ?? visibleEntries[0]?.id;
				if (target) {
					event.preventDefault();
					focusActionId = target;
					focusZone = 'row-actions';
				}
				return;
			}

			if (
				event.key === '<' ||
				(event.key === ',' && event.shiftKey) ||
				(event.code === 'Comma' && event.shiftKey)
			) {
				if (focusZone === 'row-actions') {
					event.preventDefault();
					focusActionId = null;
					focusZone = 'list';
					rootEl?.focus();
				}
				return;
			}

			if (focusZone === 'row-actions') return;

			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				if (!hasEntries) return;
				event.preventDefault();
				const delta = event.key === 'ArrowDown' ? 1 : -1;
				const nextIndex =
					currentIndex === -1
						? 0
						: Math.max(0, Math.min(visibleEntries.length - 1, currentIndex + delta));
				if (event.key === 'ArrowUp' && currentIndex <= 0) {
					searchInput?.focus();
					focusZone = 'toolbar';
					return;
				}
				const nextId = visibleEntries[nextIndex]?.id;
				if (nextId) {
					focusId = nextId;
					focusZone = 'list';
				}
				return;
			}

			if (event.key === ' ' || event.key === 'Spacebar') {
				if (!hasEntries) return;
				event.preventDefault();
				const currentId =
					currentIndex === -1 ? visibleEntries[0]?.id : visibleEntries[currentIndex]?.id;
				if (!currentId) return;
				if (selection.includes(currentId)) {
					selection = selection.filter((id) => id !== currentId);
				} else {
					selection = Array.from(new Set([...selection, currentId]));
					lastSelectedId = currentId;
				}
				focusId = currentId;
				return;
			}

			if (event.key === 'Enter') {
				const entry =
					visibleEntries[currentIndex] ??
					getEntryById(localEntries, focusId ?? '') ??
					selectionEntries[0];
				if (entry) {
					event.preventDefault();
					handleAction('open', entry);
				}
				return;
			}

			for (const action of allActions) {
				const shortcuts = effectiveKeymap[action.id] ?? action.shortcut ?? [];
				if (shortcuts.some((shortcut) => matchesShortcut(event, shortcut))) {
					event.preventDefault();
					handleAction(action.id);
					return;
				}
			}
		};

		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});
</script>

<div
	bind:this={rootEl}
	class={cn(
		'flex h-full flex-col gap-4 outline-none focus:outline-none focus-visible:outline-none',
		className
	)}
	onfocusin={() => (isFocused = true)}
	onfocusout={handleFocusOut}
	role="region"
	aria-label="File manager"
	tabindex={0}
>
	<Card.Root class="gap-4 p-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-col gap-1">
				<h2 class="text-lg font-semibold">File Manager</h2>
				<FileManagerBreadcrumbs {path} on:navigate={(event) => (currentCwdId = event.detail.id)} />
			</div>
			<div class="flex items-center gap-2 text-xs text-muted-foreground">
				<span>{visibleEntries.length} items</span>
			</div>
		</div>

		{#if selection.length > 0}
			<div class="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
				<div class="text-sm font-medium">{selection.length} selected</div>
				<Separator.Root orientation="vertical" class="h-6" />
				<div class="flex items-center gap-2">
					<Button size="sm" variant="ghost" onclick={() => handleAction('select-all')}>
						Select all
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onclick={() => {
							const cleared = clearSelection();
							selection = cleared.selection;
							lastSelectedId = cleared.lastSelectedId;
						}}
					>
						Clear
					</Button>
				</div>
				<div class="flex flex-1 items-center justify-end gap-2">
					{#each allowedSelectionActions.slice(0, 4) as action}
						<Button
							size="sm"
							variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
							onclick={() => handleAction(action.id)}
						>
							{#if action.icon}
								{@const ActionIcon = action.icon}
								<ActionIcon class="h-4 w-4" />
							{/if}
							<span class="hidden sm:inline">{action.label}</span>
						</Button>
					{/each}
					{#if allowedSelectionActions.length > 4}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger asChild>
								<Button size="icon-sm" variant="outline" aria-label="More actions">
									<MoreHorizontalIcon class="h-4 w-4" />
								</Button>
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-56">
								{#each allowedSelectionActions.slice(4) as action}
									<DropdownMenu.Item onclick={() => handleAction(action.id)}>
										{#if action.icon}
											{@const ActionIcon = action.icon}
											<ActionIcon class="h-4 w-4" />
										{/if}
										<span>{action.label}</span>
									</DropdownMenu.Item>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					{/if}
				</div>
			</div>
		{/if}

		<FileManagerToolbar
			actions={primaryActions}
			{overflowActions}
			{search}
			selectionCount={selection.length}
			bind:searchRef={searchInput}
			on:action={(event) => handleAction(event.detail.actionId)}
			on:search={(event) => (search = event.detail.value)}
			on:navigateDown={() => {
				if (!visibleEntries.length) return;
				focusId = focusId ?? visibleEntries[0]?.id ?? null;
				focusZone = 'list';
				rootEl?.focus();
			}}
		/>

		<div class="grid gap-4">
			<FileManagerList
				entries={visibleEntries}
				{selection}
				actions={selectionActions}
				{search}
				{focusId}
				{focusActionId}
				on:selectRequest={handleSelectionRequest}
				on:open={(event) => handleAction('open', event.detail.entry)}
				on:navigate={(event) => handleAction('open', event.detail.entry)}
				on:action={(event) => handleAction(event.detail.actionId, event.detail.entry)}
				on:actionFocusExit={() => {
					focusActionId = null;
					focusZone = 'list';
					rootEl?.focus();
				}}
			/>
		</div>
	</Card.Root>

	<!--<FileManagerActionBar
		actions={allowedSelectionActions.slice(0, 3)}
		overflowActions={allowedSelectionActions.slice(3)}
		selectionCount={selection.length}
		on:action={(event) => handleAction(event.detail.actionId)}
	/>-->

	<Sheet.Root bind:open={isEditorSheetOpen}>
		<Sheet.Content side="bottom" class="h-screen">
			<Sheet.Header>
				<Sheet.Title>Editor</Sheet.Title>
				<Sheet.Description>Preview and edit text-based files.</Sheet.Description>
			</Sheet.Header>
			<div class="mt-1 h-screen">
				<FileManagerEditor
					entry={editorEntry}
					content={editorDisplayContent}
					dirty={editorDirty}
					showClose
					on:change={(event) => {
						editorContent = event.detail.content;
						editorDirty = true;
					}}
					on:save={(event) => handleEditorSave(event.detail.content)}
					on:close={() => (isEditorSheetOpen = false)}
				/>
			</div>
		</Sheet.Content>
	</Sheet.Root>

	<Dialog.Root bind:open={dialogOpen}>
		<Dialog.Content class="sm:max-w-[420px]">
			<Dialog.Header>
				<Dialog.Title>
					{#if dialogMode === 'create-file'}
						Create file
					{:else if dialogMode === 'create-folder'}
						Create folder
					{:else if dialogMode === 'rename'}
						Rename item
					{:else if dialogMode === 'move'}
						Move items
					{:else if dialogMode === 'copy'}
						Copy items
					{:else if dialogMode === 'extract'}
						Extract archive
					{:else}
						Action
					{/if}
				</Dialog.Title>
				<Dialog.Description>
					{#if dialogMode === 'move' || dialogMode === 'copy'}
						Enter a destination path (relative to the current folder).
					{:else if dialogMode === 'extract'}
						Choose where to extract the archive (relative to the current folder).
					{:else}
						Provide a name.
					{/if}
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-4">
				{#if dialogMode === 'move' || dialogMode === 'copy' || dialogMode === 'extract'}
					<div class="space-y-2">
						<Input
							placeholder="e.g. ../ or /"
							value={moveTargetInput}
							oninput={(event) =>
								(moveTargetInput = (event.currentTarget as HTMLInputElement).value)}
						/>
						<p class="text-xs text-muted-foreground">
							Use <code>..</code> to go up. Use <code>/</code> for the WordPress root.
						</p>
						{#if moveTargetError}
							<p class="text-xs text-destructive">{moveTargetError}</p>
						{/if}
					</div>
				{:else}
					<Input
						value={dialogName}
						oninput={(event) => (dialogName = (event.currentTarget as HTMLInputElement).value)}
					/>
				{/if}
			</div>

			<Dialog.Footer>
				<Button variant="ghost" onclick={() => (dialogMode = null)}>Cancel</Button>
				<Button onclick={handleDialogConfirm} disabled={dialogMode === 'extract' && isExtracting}>
					{#if dialogMode === 'extract'}
						{isExtracting ? 'Extracting...' : 'Extract'}
					{:else}
						Confirm
					{/if}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<form
		bind:this={uploadForm}
		action="?/upload"
		method="POST"
		enctype="multipart/form-data"
		class="hidden"
	>
		<input type="hidden" name="path" value={currentCwdId ?? ''} />
		<input
			type="file"
			name="file"
			multiple
			bind:this={uploadInput}
			onchange={() => uploadForm?.requestSubmit()}
		/>
	</form>
</div>
