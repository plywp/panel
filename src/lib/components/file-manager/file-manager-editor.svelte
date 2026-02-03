<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { FileEntry } from './types.js';
	import { Button } from '$lib/components/ui/button';
	import { formatBytes } from './state.js';
	import * as Select from '$lib/components/ui/select';
	import CodeIcon from '@lucide/svelte/icons/code';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import Volume2Icon from '@lucide/svelte/icons/volume-2';
	import VolumeXIcon from '@lucide/svelte/icons/volume-x';
	import MaximizeIcon from '@lucide/svelte/icons/maximize';
	import Moveable from 'svelte-moveable';

	import { Compartment } from '@codemirror/state';

	import { EditorState, type Extension } from '@codemirror/state';
	import {
		EditorView,
		keymap,
		highlightSpecialChars,
		drawSelection,
		highlightActiveLine,
		dropCursor,
		rectangularSelection,
		crosshairCursor,
		lineNumbers,
		highlightActiveLineGutter
	} from '@codemirror/view';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
	import {
		autocompletion,
		completionKeymap,
		closeBrackets,
		closeBracketsKeymap
	} from '@codemirror/autocomplete';

	import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';

	import { javascript } from '@codemirror/lang-javascript';
	import { css } from '@codemirror/lang-css';
	import { html } from '@codemirror/lang-html';
	import { php } from '@codemirror/lang-php';
	import { json } from '@codemirror/lang-json';
	import { markdown } from '@codemirror/lang-markdown';
	import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { lintKeymap } from '@codemirror/lint';
	import {
		amy,
		dracula,
		ayuLight,
		barf,
		bespin,
		birdsOfParadise,
		boysAndGirls,
		clouds,
		cobalt,
		coolGlow,
		espresso,
		noctisLilac,
		rosePineDawn,
		smoothy,
		solarizedLight,
		tomorrow
	} from 'thememirror';
	import { browser } from '$app/environment';

	type EditorProps = {
		entry?: FileEntry | null;
		content?: string;
		dirty?: boolean;
		showClose?: boolean;
	};

	const { entry = null, content = '', dirty = false, showClose = false }: EditorProps = $props();

	let target;
	let translate = [0, 0];

	function handleDrag({ detail: e }) {
		translate = e.beforeTranslate;
		e.target.style.transform = `translate3d(${translate[0]}px, ${translate[1]}px, 0)`;
	}
	const dispatch = createEventDispatcher<{
		save: { content: string };
		close: void;
		change: { content: string };
	}>();

	type ThemeKey = any;

	const THEMES: Record<ThemeKey, Extension> = {
		amy,
		dracula,
		ayuLight,
		barf,
		bespin,
		birdsOfParadise,
		boysAndGirls,
		clouds,
		cobalt,
		coolGlow,
		espresso,
		noctisLilac,
		rosePineDawn,
		smoothy,
		solarizedLight,
		tomorrow
	};
	const themes = Object.keys(THEMES) as ThemeKey[];

	type Lang = 'auto' | 'php' | 'javascript' | 'css' | 'html' | 'json' | 'markdown';
	let lang = $state<Lang>('auto');

	const isPreviewable = (name: string) => {
		const ext = name.split('.').pop()?.toLowerCase() ?? '';
		if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
		if (['mp4', 'webm', 'ogg'].includes(ext)) return 'video';
		return null;
	};

	let currentPath = 'filemanager';
	if (browser) currentPath = window?.location?.pathname ?? 'filemanager';

	const previewKind = $derived(entry ? isPreviewable(entry.name) : null);

	let host = $state<HTMLDivElement | null>(null);
	let view = $state<EditorView | null>(null);

	const detectLang = (name: string): Extension => {
		const ext = name.split('.').pop()?.toLowerCase() ?? '';
		if (ext === 'php' || ext === 'phtml' || ext === 'inc') return php();
		if (ext === 'css') return css();
		if (ext === 'html' || ext === 'htm' || ext === 'xhtml') return html();
		if (ext === 'json') return json();
		if (ext === 'md' || ext === 'markdown') return markdown();
		if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(ext))
			return javascript({ typescript: true, jsx: true });
		return php();
	};

	const langExtension = (l: Lang, filename: string): Extension => {
		if (l === 'php') return php();
		if (l === 'javascript') return javascript({ typescript: true, jsx: true });
		if (l === 'css') return css();
		if (l === 'html') return html();
		if (l === 'json') return json();
		if (l === 'markdown') return markdown();
		return detectLang(filename);
	};

	const THEME_STORAGE_KEY = 'editor.theme';

	let theme = $state<ThemeKey>('amy');

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null;
		if (saved && THEMES[saved]) theme = saved;
	});

	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	});

	const themeCompartment = new Compartment();
	const languageCompartment = new Compartment();

	const baseExtensions = (): Extension[] => [
		lineNumbers(),
		foldGutter(),
		highlightSpecialChars(),
		history(),
		drawSelection(),
		dropCursor(),
		EditorState.allowMultipleSelections.of(true),
		indentOnInput(),
		syntaxHighlighting(defaultHighlightStyle),
		bracketMatching(),
		closeBrackets(),
		autocompletion(),
		rectangularSelection(),
		crosshairCursor(),
		highlightActiveLine(),
		highlightActiveLineGutter(),
		highlightSelectionMatches(),
		keymap.of([
			...closeBracketsKeymap,
			...defaultKeymap,
			...searchKeymap,
			...historyKeymap,
			...foldKeymap,
			...completionKeymap,
			...lintKeymap,
			indentWithTab
		]),
		EditorView.lineWrapping,
		EditorView.theme({
			'&': { height: '100%' },
			'.cm-scroller': {
				height: '100%',
				overflow: 'auto',
				WebkitOverflowScrolling: 'touch',
				touchAction: 'pan-y'
			},
			'.cm-content': {
				fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
			},
			'.cm-cursor': {
				borderLeftColor: 'rgb(59, 130, 246)',
				borderLeftWidth: '3px',
				transition: 'transform 80ms linear, opacity 120ms linear'
			},
			'.cm-focused .cm-cursor': {
				borderLeftColor: 'rgb(96, 165, 250)',
				transition: 'transform 80ms linear, opacity 120ms linear'
			}
		})
	];

	const createState = (doc: string, filename: string) =>
		EditorState.create({
			doc,
			extensions: [
				...baseExtensions(),
				languageCompartment.of(langExtension(lang, filename)),
				themeCompartment.of(THEMES[theme]),
				EditorView.editable.of(true),
				EditorState.readOnly.of(false),
				EditorView.updateListener.of((u) => {
					if (!u.docChanged) return;
					dispatch('change', { content: u.state.doc.toString() });
				})
			]
		});

	const mountEditor = (doc: string, filename: string) => {
		if (!host) return;
		view?.destroy();
		view = new EditorView({
			parent: host,
			state: createState(doc, filename)
		});
	};

	const setEditorDoc = (next: string) => {
		if (!view) return;
		const current = view.state.doc.toString();
		if (current === next) return;
		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
	};

	const getCurrentContent = () => view?.state.doc.toString() ?? content ?? '';

	let lastMountedEntry = $state<string>('');

	$effect(() => {
		if (!entry || previewKind !== null || !host) {
			lastMountedEntry = '';
			return;
		}

		const entryId = entry.id;
		if (entryId !== lastMountedEntry) {
			mountEditor(content ?? '', entry.name);
			lastMountedEntry = entryId;
		}
	});

	$effect(() => {
		if (!entry || previewKind !== null || !view) return;
		if (lastMountedEntry !== entry.id) return;
		setEditorDoc(content ?? '');
	});

	$effect(() => {
		if (!view) return;
		view.dispatch({
			effects: themeCompartment.reconfigure(THEMES[theme])
		});
	});

	$effect(() => {
		if (!view || !entry) return;
		view.dispatch({
			effects: languageCompartment.reconfigure(langExtension(lang, entry.name))
		});
	});

	$effect(() => {
		const id = entry?.id ?? null;
		if (!id) return;
		lang = 'auto';
	});

	let time = $state(0);
	let duration = $state<number | undefined>(undefined);
	let paused = $state(true);

	let muted = $state(false);
	let volume = $state(1);

	let showControls = $state(true);
	let showControlsTimeout: ReturnType<typeof setTimeout> | undefined;
	let controlsInitialized = $state(false);

	let videoEl = $state<HTMLVideoElement | null>(null);
	let seekEl = $state<HTMLDivElement | null>(null);
	let seeking = $state(false);
	let downAt = 0;

	function clamp(n: number, min: number, max: number) {
		return Math.min(max, Math.max(min, n));
	}

	function ratio() {
		return duration ? clamp(time / duration, 0, 1) : 0;
	}

	function showControlsNow() {
		if (showControlsTimeout) clearTimeout(showControlsTimeout);
		showControls = true;
		controlsInitialized = true;
		showControlsTimeout = setTimeout(() => {
			if (!paused) showControls = false;
		}, 2500);
	}

	$effect(() => {
		if (videoEl && duration && !controlsInitialized) {
			showControlsNow();
		}
	});

	function format(seconds: number) {
		if (isNaN(seconds)) return '...';
		const minutes = Math.floor(seconds / 60);
		let s = Math.floor(seconds % 60);
		const ss = s < 10 ? `0${s}` : `${s}`;
		return `${minutes}:${ss}`;
	}

	function togglePlay() {
		if (!videoEl) return;
		if (videoEl.paused) videoEl.play();
		else videoEl.pause();
	}

	function toggleMute() {
		if (!videoEl) return;
		videoEl.muted = !videoEl.muted;
		muted = videoEl.muted;
	}

	function setVol(v: number) {
		if (!videoEl) return;
		const next = clamp(v, 0, 1);
		videoEl.volume = next;
		videoEl.muted = next === 0 ? true : muted;
		volume = next;
		muted = videoEl.muted;
	}

	async function toggleFullscreen() {
		const el = videoEl?.parentElement;
		if (!el) return;

		// @ts-expect-error vendor
		const isFs = document.fullscreenElement || (document as any).webkitFullscreenElement;
		if (!isFs) {
			// @ts-expect-error vendor
			await (el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.());
		} else {
			// @ts-expect-error vendor
			await (document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.());
		}
	}

	function seekFromClientX(clientX: number) {
		if (!duration || !seekEl || !videoEl) return;
		const rect = seekEl.getBoundingClientRect();
		const x = clamp(clientX - rect.left, 0, rect.width);
		const r = rect.width ? x / rect.width : 0;
		videoEl.currentTime = r * duration;
	}

	function onSeekPointerDown(e: PointerEvent) {
		if (!duration) return;
		showControlsNow();
		seeking = true;
		seekEl?.setPointerCapture(e.pointerId);
		seekFromClientX(e.clientX);
	}

	function onSeekPointerMove(e: PointerEvent) {
		if (!seeking) return;
		showControlsNow();
		seekFromClientX(e.clientX);
	}

	function onSeekPointerUp() {
		seeking = false;
	}

	function onVideoPointerDown() {
		downAt = Date.now();
		showControlsNow();
	}

	function onVideoPointerUp() {
		showControlsNow();
		if (Date.now() - downAt < 250 && !seeking) togglePlay();
	}

	function onLoadedMeta() {
		if (!videoEl) return;
		muted = videoEl.muted;
		volume = videoEl.volume;
	}

	onDestroy(() => {
		view?.destroy();
		view = null;
	});
</script>

{#if entry}
	<div
		class="flex h-dvh w-full flex-col overflow-hidden bg-white text-foreground dark:bg-background"
	>
		<div class="flex items-center gap-2 border-b px-3 py-2">
			<div class="min-w-0 flex-1">
				<div class="truncate text-sm font-semibold">{entry ? entry.name : 'No file selected'}</div>
				{#if entry}
					<div class="truncate text-xs text-muted-foreground">
						{entry.extension?.toUpperCase() ?? 'Text'} · {formatBytes(entry.size)} ·
						{new Date(entry.modifiedAt).toLocaleString()}
					</div>
				{/if}
			</div>

			{#if entry && previewKind === null}
				<Select.Root type="single" value={theme} onValueChange={(value) => (theme = value as any)}>
					<Select.Trigger class="h-8 w-[180px] bg-background text-xs">
						<div class="flex items-center gap-2">
							<PaletteIcon class="h-4 w-4 opacity-70" />
							<Select.Value>{theme || 'Theme'}</Select.Value>
						</div>
					</Select.Trigger>

					<Select.Content class="bg-background">
						{#each themes as themeOption}
							<Select.Item value={themeOption} label={themeOption}>{themeOption}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Select.Root type="single" value={lang} onValueChange={(value) => (lang = value as any)}>
					<Select.Trigger
						class="h-8 w-[160px] bg-white text-xs dark:bg-background"
						aria-label="Language"
					>
						<div class="flex items-center gap-2">
							<CodeIcon class="h-4 w-4 opacity-80" />
							<Select.Value>
								{lang === 'auto' ? 'Auto' : (lang?.toUpperCase?.() ?? 'Auto')}
							</Select.Value>
						</div>
					</Select.Trigger>

					<Select.Content class="bg-white dark:bg-background">
						<Select.Item value="auto" label="Auto">Auto</Select.Item>
						<Select.Item value="php" label="PHP">PHP</Select.Item>
						<Select.Item value="html" label="HTML">HTML</Select.Item>
						<Select.Item value="css" label="CSS">CSS</Select.Item>
						<Select.Item value="javascript" label="JavaScript">JavaScript</Select.Item>
						<Select.Item value="json" label="JSON">JSON</Select.Item>
						<Select.Item value="markdown" label="Markdown">Markdown</Select.Item>
					</Select.Content>
				</Select.Root>
			{/if}

			{#if entry}
				<Button
					size="sm"
					variant="outline"
					disabled={!dirty}
					onclick={() => dispatch('save', { content: getCurrentContent() })}
				>
					Save
				</Button>
			{/if}

			{#if showClose}
				<Button size="sm" variant="ghost" onclick={() => dispatch('close')}>Close</Button>
			{/if}
		</div>

		<div class="min-h-0 flex-1">
			{#if entry}
				{#if previewKind === 'image'}
					{#if content}
						<div class="flex h-full w-full items-center justify-center bg-muted/30">
							<img
								src={`${currentPath}/download/?path=${entry.id}`}
								alt={entry.name}
								class="max-h-full max-w-full object-contain"
							/>
						</div>
					{:else}
						<div
							class="flex h-full w-full items-center justify-center text-sm text-muted-foreground"
						>
							No preview available.
						</div>
					{/if}
				{:else if previewKind === 'video'}
					{#if content}
						<div class="static flex h-full w-full items-center justify-center bg-muted/30">
							<video
								bind:this={videoEl}
								src={`${currentPath}/download/?path=${entry.id}`}
								class="h-full w-full object-contain"
								on:pointermove={showControlsNow}
								on:pointerdown={onVideoPointerDown}
								on:pointerup={onVideoPointerUp}
								on:touchstart|preventDefault={showControlsNow}
								on:loadedmetadata={onLoadedMeta}
								bind:currentTime={time}
								bind:duration
								bind:paused
								bind:muted
								bind:volume
							>
								<track kind="captions" />
							</video>

							<!-- Floating controller -->
							<div
								class={'pointer-events-none absolute inset-x-0 bottom-4 flex animate-[smoothUp_5s_ease-in-out] justify-center transition-opacity duration-200' +
									target}
								style="opacity: {showControls || paused || seeking ? 1 : 0}"
								draggable="true"
							>
								<div
									class="pointer-events-auto w-[min(920px,calc(100%-1.5rem))] rounded-2xl border bg-background/75 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
								>
									<!-- Seek bar (top of controller) -->
									<div class="px-4 pt-4">
										<div
											bind:this={seekEl}
											role="slider"
											aria-label="Seek"
											aria-valuemin={0}
											aria-valuemax={duration || 0}
											aria-valuenow={time}
											tabindex="0"
											class="group relative h-2 w-full cursor-pointer rounded-full bg-muted ring-offset-background outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
											on:pointerdown={onSeekPointerDown}
											on:pointermove={onSeekPointerMove}
											on:pointerup={onSeekPointerUp}
											on:pointercancel={onSeekPointerUp}
											on:lostpointercapture={onSeekPointerUp}
										>
											<div
												class="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-75"
												style="width: {ratio() * 100}%"
											/>
											<div
												class="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow ring-2 ring-background transition-opacity
											duration-150 group-hover:opacity-100 {seeking ? 'opacity-100' : ''}"
												style="left: calc({ratio() * 100}% - 0.5rem);"
											/>
										</div>
									</div>

									<!-- Buttons row -->
									<div class="flex items-center gap-2 px-3 py-3">
										<Button
											size="icon"
											variant="ghost"
											class="h-9 w-9 rounded-xl"
											onclick={togglePlay}
										>
											{#if paused}
												<PlayIcon class="h-5 w-5" />
											{:else}
												<PauseIcon class="h-5 w-5" />
											{/if}
										</Button>

										<Button
											size="icon"
											variant="ghost"
											class="h-9 w-9 rounded-xl"
											onclick={toggleMute}
										>
											{#if muted || volume === 0}
												<VolumeXIcon class="h-5 w-5" />
											{:else}
												<Volume2Icon class="h-5 w-5" />
											{/if}
										</Button>

										<!-- Volume slider -->
										<div class="hidden items-center gap-2 sm:flex">
											<input
												class="h-2 w-28 cursor-pointer accent-primary"
												type="range"
												min="0"
												max="1"
												step="0.01"
												value={volume}
												on:input={(e) =>
													setVol(Number((e.currentTarget as HTMLInputElement).value))}
											/>
										</div>

										<!-- Time -->
										<div class="ml-1 text-xs text-muted-foreground tabular-nums">
											<span class="text-foreground/90">{format(time)}</span>
											<span class="mx-1">/</span>
											<span>{format(duration ?? NaN)}</span>
										</div>

										<div class="flex-1" />

										<Button
											size="icon"
											variant="ghost"
											class="h-9 w-9 rounded-xl"
											onclick={toggleFullscreen}
											aria-label="Fullscreen"
										>
											<MaximizeIcon class="h-5 w-5" />
										</Button>
									</div>
								</div>
							</div>
							<Moveable {target} draggable={true} on:drag={handleDrag} />
						</div>
					{:else}
						<div
							class="flex h-full w-full items-center justify-center text-sm text-muted-foreground"
						>
							No preview available.
						</div>
					{/if}
				{:else}
					<div bind:this={host} class="h-full w-full" />
				{/if}
			{:else}
				<div class="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
					Select a file to edit it.
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	@keyframes smoothUp {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(-10px);
		}
	}
</style>
