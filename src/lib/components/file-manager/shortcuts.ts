import type { ShortcutMap } from './types.js';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export const defaultShortcutMap: ShortcutMap = {
	'create-file': ['Mod+N'],
	'create-folder': ['Mod+Shift+N'],
	upload: ['Mod+U'],
	download: ['Mod+D'],
	rename: ['F2'],
	move: ['Mod+M'],
	delete: ['Delete', 'Backspace'],
	archive: ['Mod+Shift+Z'],
	extract: ['Mod+Shift+E'],
	open: ['Enter'],
	edit: ['Mod+E'],
	'select-all': ['Mod+A']
};

export const mergeShortcutMap = (base: ShortcutMap, overrides?: ShortcutMap) => {
	return { ...base, ...(overrides ?? {}) };
};

const normalizeKey = (value: string) => {
	const lower = value.toLowerCase();
	if (lower === 'esc') return 'escape';
	if (lower === 'del') return 'delete';
	if (lower === 'cmd') return 'meta';
	if (lower === 'command') return 'meta';
	if (lower === 'option') return 'alt';
	return lower;
};

export const matchesShortcut = (event: KeyboardEvent, shortcut: string) => {
	const parts = shortcut.split('+').map((part) => normalizeKey(part.trim()));
	const mainKey = normalizeKey(parts.pop() ?? '');
	const requireMeta = parts.includes('meta') || parts.includes('cmd');
	const requireCtrl = parts.includes('ctrl');
	const requireAlt = parts.includes('alt');
	const requireShift = parts.includes('shift');
	const requireMod = parts.includes('mod');

	const metaOk = requireMod
		? isMac
			? event.metaKey
			: event.ctrlKey
		: !requireMeta || event.metaKey;
	const ctrlOk = requireMod ? true : !requireCtrl || event.ctrlKey;

	if (!metaOk || !ctrlOk) return false;
	if (requireAlt && !event.altKey) return false;
	if (requireShift && !event.shiftKey) return false;

	const key = normalizeKey(event.key);
	return key === mainKey;
};

export const formatShortcut = (shortcut: string) => {
	const parts = shortcut.split('+').map((part) => part.trim());
	return parts
		.map((part) => {
			const lower = part.toLowerCase();
			if (lower === 'mod') return isMac ? 'Cmd' : 'Ctrl';
			if (lower === 'meta') return 'Cmd';
			if (lower === 'ctrl') return 'Ctrl';
			if (lower === 'alt') return isMac ? 'Option' : 'Alt';
			if (lower === 'shift') return 'Shift';
			if (lower === 'escape') return 'Esc';
			return part.length === 1 ? part.toUpperCase() : part;
		})
		.join('+');
};

export const isTypingTarget = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName.toLowerCase();
	if (['input', 'textarea', 'select'].includes(tag)) return true;
	return target.isContentEditable;
};
