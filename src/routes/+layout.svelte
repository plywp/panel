<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { ProgressBar } from '@prgm/sveltekit-progress-bar';
	import '$lib/i18n';
	import './layout.css';

	let { children, data } = $props();

	let dark = $state(false);

	onMount(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');

		const update = () => {
			dark = media.matches;
			document.body.classList.toggle('dark', dark);
			document.body.classList.toggle('light', !dark);
		};

		console.log('Media query matches:', media.matches);

		update();
		const el = document.getElementById('boot-loader');
		if (!el) return;
		el.classList.add('hidden');
		setTimeout(() => el.remove(), 250);
	});
</script>

<svelte:head>
	<title>{data?.meta?.title ?? 'PlyWP'}</title>
	<meta name="description" content={data?.meta?.description ?? ''} />
	<link rel="icon" href={data?.meta?.favicon ?? '/favicon.ico'} />
</svelte:head>

<ProgressBar class="text-blue-500" minimum="0" />
{@render children?.()}
<Toaster />
