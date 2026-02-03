<script lang="ts">
	import { FileManager } from '$lib/components/file-manager';
	import type {
		FileEntry,
		FileManagerActions,
		FileManagerActionEvent
	} from '$lib/components/file-manager/types.js';
	import type { CreatePayload } from '$lib/components/file-manager/FileManager.svelte';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { enhance, deserialize } from '$app/forms';
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import axios from 'axios';
	import { fly, fade } from 'svelte/transition';

	type FileManagerPageData = {
		entries: FileEntry[];
		entriesError: string | null;
		path: string;
		siteId: string;
	};

	const { data }: { data: FileManagerPageData } = $props();

	let entries = $state<FileEntry[]>(data.entries);
	let entriesError = $state<string | null>(data.entriesError);
	let currentPath = $state<string>(data.path ?? '');
	let isRefreshing = $state(false);

	let refreshForm: HTMLFormElement | null = null;
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

	const handleReadContent = async (event: FileManagerActionEvent) => {
		if (!browser) return;

		const target = event.entry ?? event.selection[0];
		if (!target || target.kind !== 'file') return;

		const fd = new FormData();
		fd.set('path', target.id);

		const action = (await axios.post('?/read', fd, { withCredentials: true })).data;

		if (action.type !== 'success') throw new Error('Read failed');

		const decoded = JSON.parse(action.data) as string[];

		const content = decoded[0];

		//console.log(content);
		return content;
	};

	type DownloadPayload = { entries?: FileEntry[] };

	const handleDownload = async (event: CustomEvent<DownloadPayload>) => {
		if (!browser) return;

		const payload = event.detail.payload as DownloadPayload | undefined;

		const entries =
			(event.detail.selection?.length ? event.detail.selection : undefined) ??
			(payload?.entries?.length ? payload.entries : undefined) ??
			[];

		const files = entries.filter((e) => e.kind === 'file');
		if (!files.length) return;

		const siteId = data.siteId;

		if (files.length === 1) {
			const f = files[0];
			const url =
				`/site/${encodeURIComponent(siteId)}/filemanager/download` +
				`?path=${encodeURIComponent(f.id)}` +
				`&filename=${encodeURIComponent(f.name)}`;

			window.location.href = url;
			return;
		}

		const form = document.createElement('form');
		form.method = 'POST';
		form.action = `/site/${encodeURIComponent(siteId)}/filemanager/download-zip`;

		for (const f of files) {
			const input = document.createElement('input');
			input.type = 'hidden';
			input.name = 'paths';
			input.value = f.id;
			form.appendChild(input);
		}

		const zipName = document.createElement('input');
		zipName.type = 'hidden';
		zipName.name = 'name';
		zipName.value = `files-${new Date().toISOString().slice(0, 10)}.zip`;
		form.appendChild(zipName);

		document.body.appendChild(form);
		form.submit();
		form.remove();
	};

	type CreateFileDetail = {
		selection: FileEntry[];
		payload: CreatePayload;
	};

	async function handleCreateFile(event: CustomEvent<CreateFileDetail>) {
		const { selection, payload } = event.detail;
		const { name, parentId } = payload;

		if (!name || !parentId) return;

		const fd = new FormData();
		fd.set('name', String(name));
		fd.set('parentId', String(parentId));

		const { data } = await axios.post('?/createFile', fd, {
			withCredentials: true
		});

		if (data.type !== 'success') throw new Error('Create failed');

		currentPath = parentId ?? '';
		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();

		return true;
	}

	async function handleDelete(event: CustomEvent) {
		const { selection } = event.detail as { selection?: Array<{ id: string }> };
		if (!selection?.length) return;

		const fd = new FormData();
		for (const item of selection) fd.append('files', item.id);

		const res = await fetch('?/delete', {
			method: 'POST',
			body: fd,
			credentials: 'include'
		});

		const result = deserialize(await res.text());

		if (result.type === 'failure') {
			const data = result.data as any;
			const msg = data?.deleteError ?? 'Delete failed';

			const failed = data?.failed;
			if (Array.isArray(failed) && failed.length) {
				throw new Error(`${msg}: ${failed.map((f: any) => f.path).join(', ')}`);
			}

			throw new Error(String(msg));
		}

		if (result.type !== 'success') {
			throw new Error('Delete failed');
		}

		currentPath = currentPath ?? '';
		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();

		return true;
	}

	type MovePayload = { ids: string[]; destinationId: string };
	type CopyPayload = { ids: string[]; destinationId: string };

	async function handleMove(event: CustomEvent) {
		const detail = event.detail as { payload?: MovePayload };
		const payload = detail?.payload;
		if (!payload?.ids?.length) return;

		const fd = new FormData();
		fd.set('destinationId', payload.destinationId ?? '');
		for (const id of payload.ids) fd.append('ids', id);

		const res = await fetch('?/move', {
			method: 'POST',
			body: fd,
			credentials: 'include'
		});

		const result = deserialize(await res.text());

		if (result.type === 'failure') {
			const data = result.data as any;
			const msg = data?.moveError ?? 'Move failed';

			const failed = data?.failed;
			if (Array.isArray(failed) && failed.length) {
				throw new Error(`${msg}: ${failed.map((f: any) => f.from).join(', ')}`);
			}

			throw new Error(String(msg));
		}

		if (result.type !== 'success') {
			throw new Error('Move failed');
		}
		currentPath = currentPath ?? '';
		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();

		return true;
	}

	async function handleCopy(event: CustomEvent) {
		const detail = event.detail as { payload?: CopyPayload };
		const payload = detail?.payload;
		if (!payload?.ids?.length) return;

		const fd = new FormData();
		fd.set('destinationId', payload.destinationId ?? '');
		for (const id of payload.ids) fd.append('ids', id);

		const res = await fetch('?/copy', {
			method: 'POST',
			body: fd,
			credentials: 'include'
		});

		const result = deserialize(await res.text());

		if (result.type === 'failure') {
			const data = result.data as any;
			const msg = data?.copyError ?? 'Copy failed';

			const failed = data?.failed;
			if (Array.isArray(failed) && failed.length) {
				throw new Error(`${msg}: ${failed.map((f: any) => f.source).join(', ')}`);
			}

			throw new Error(String(msg));
		}

		if (result.type !== 'success') {
			throw new Error('Copy failed');
		}
		currentPath = currentPath ?? '';
		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();

		return true;
	}

	async function handleCreateFolder(event: CustomEvent<CreateFileDetail>) {
		const { selection, payload } = event.detail;
		const { name, parentId } = payload;

		if (!name || !parentId) return;

		const fd = new FormData();
		fd.set('name', String(name));
		fd.set('parentId', String(parentId));

		const { data } = await axios.post('?/createFolder', fd, {
			withCredentials: true
		});

		if (data.type !== 'success') throw new Error('Create failed');

		currentPath = parentId ?? '';
		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();

		return true;
	}

	type RenamePayload = { id: string; name: string };

	async function handleRename(event: CustomEvent) {
		const detail = event.detail as { payload?: RenamePayload };
		const payload = detail?.payload;
		if (!payload?.id || !payload?.name) return;

		const fd = new FormData();
		fd.set('id', payload.id);
		fd.set('name', payload.name);

		const res = await fetch('?/rename', {
			method: 'POST',
			body: fd,
			credentials: 'include'
		});

		const result = deserialize(await res.text());

		if (result.type === 'failure') {
			const data = result.data as any;
			const msg = data?.renameError ?? 'Rename failed';
			throw new Error(String(msg));
		}

		if (result.type !== 'success') {
			throw new Error('Rename failed');
		}

		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();

		return true;
	}

	async function handleSave(e: CustomEvent) {
		//console.log(e.detail);

		const { id, content } = e.detail.payload;
		if (!id || content == null) {
			throw new Error('Invalid file ID or content');
		}
		const fd = new FormData();
		fd.set('path', id);
		fd.set('content', String(content));

		const { data } = await axios.post('?/writeFile', fd, {
			withCredentials: true
		});

		if (data.type !== 'success') throw new Error('Write failed');

		const parent = id.substring(0, id.lastIndexOf('/'));

		currentPath = parent;
		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();

		return true;
	}

	async function handleArchive(e: CustomEvent) {
		isRefreshing = true;
		const { selection, payload } = e.detail;
		if (!selection || !payload) {
			throw new Error('Invalid selection or payload');
		}
		const fd = new FormData();

		payload.ids.forEach((id) => fd.append('ids', id));
		fd.set('parentId', payload.parentId ?? '');

		const { data } = await axios.post('?/archiveFiles', fd, {
			withCredentials: true
		});

		if (data.type !== 'success') throw new Error('Archive failed');

		currentPath = payload.parentId;
		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();

		return true;
	}

	const actions: FileManagerActions = {
		refresh: {
			label: 'Refresh',
			icon: RefreshCwIcon,
			shortcut: ['Mod+R'],
			group: 'system',
			primary: true,
			handler: () => {
				if (!browser) return;
				isRefreshing = true;
				refreshForm?.requestSubmit();
			}
		}
	};

	const onRefreshResult = ({ result }: { result: any }) => {
		isRefreshing = false;

		if (result.type === 'success') {
			entries = result.data.entries ?? [];
			entriesError = result.data.entriesError ?? null;
			currentPath = result.data.path ?? currentPath;
		} else {
			entries = [];
			entriesError = 'Refresh failed';
		}
	};

	const handleCwdChange = async (event: CustomEvent<{ cwdId: string | null }>) => {
		if (!browser) return;
		currentPath = event.detail.cwdId ?? '';
		isRefreshing = true;
		await tick();
		refreshForm?.requestSubmit();
	};

	$effect(() => {
		entries = data.entries;
		entriesError = data.entriesError;
		currentPath = data.path ?? '';
	});

	$effect(() => {
		if (!browser) return;
		const url = new URL(window.location.href);
		if (currentPath) {
			url.searchParams.set('path', currentPath);
		} else {
			url.searchParams.delete('path');
		}
		window.history.replaceState({}, '', url.toString());
	});
</script>

<form
	bind:this={refreshForm}
	method="POST"
	action="?/list"
	class="hidden"
	use:enhance={() => {
		isRefreshing = true;
		return onRefreshResult;
	}}
>
	<input type="hidden" name="path" value={currentPath} />
	<button type="submit">Refresh</button>
</form>

{#if entriesError}
	<div
		class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
		in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
	>
		{entriesError}
	</div>
{:else if isRefreshing}
	<div
		class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
		in:fade={{ duration: prefersReducedMotion ? 0 : 160, easing: easeStandard }}
	>
		Refreshing files...
	</div>
{:else}
	<div
		in:fly={{
			y: prefersReducedMotion ? 0 : 10,
			duration: prefersReducedMotion ? 0 : 200,
			easing: easeStandard
		}}
	>
		<FileManager
			{entries}
			cwdId={currentPath ? currentPath : null}
			{actions}
			readContent={handleReadContent}
			on:createFile={handleCreateFile}
			on:createFolder={handleCreateFolder}
			on:rename={handleRename}
			on:delete={handleDelete}
			on:move={handleMove}
			on:copy={handleCopy}
			on:save={handleSave}
			on:download={handleDownload}
			on:archive={handleArchive}
			on:cwdChange={handleCwdChange}
		/>
	</div>
{/if}

<style>
	@media (prefers-reduced-motion: reduce) {
		* {
			transition: none !important;
		}
	}
</style>
