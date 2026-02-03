<script lang="ts">
	import Header from '../Header.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { Toaster } from '$lib/components/ui/sonner';

	export let data: { session: any; meta: { title: string; description: string; favicon: string } };
</script>

<svelte:head>
	<title>{data.meta.title}</title>
	<meta name="description" content={data.meta.description} />
	<link rel="icon" href={data.meta.favicon} />
</svelte:head>

<Sidebar.Provider>
	<div class="shell">
		<AppSidebar user={data.session.user} {data} />

		<div class="main">
			<Header />
			<div class="toolbar">
				<Sidebar.Trigger />
			</div>

			<main class="content">
				<slot />
			</main>

			<Toaster />
		</div>
	</div>
</Sidebar.Provider>

<style>
	.shell {
		display: flex;
		min-height: 100vh;
		width: 100%;
	}
	.main {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}
	.toolbar {
		padding: 0.5rem 1rem;
	}
	.content {
		flex: 1;
		padding: 1rem;
		min-width: 0;
	}
</style>
