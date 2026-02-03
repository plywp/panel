<!-- src/lib/components/detail-wp.svelte -->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';

	// Optional: if you have DOMPurify installed, uncomment these lines:
	// import DOMPurify from 'dompurify';

	type WPPlugin = {
		name: string;
		slug: string;
		version: string;

		author: string; // html string (anchor)
		author_profile?: string;

		requires?: string;
		tested?: string;
		requires_php?: string | false;
		requires_plugins?: string[];

		rating?: number; // 0-100
		ratings?: Record<string, number>;
		num_ratings?: number;

		support_threads?: number;
		support_threads_resolved?: number;

		active_installs?: number;
		downloaded?: number;

		last_updated?: string; // "YYYY-MM-DD h:mm(am/pm) GMT"
		added?: string; // "YYYY-MM-DD"
		homepage?: string;

		short_description?: string;
		description?: string; // html

		download_link?: string;

		tags?: Record<string, string>;

		donate_link?: string;

		icons?: {
			'1x'?: string;
			'2x'?: string;
			svg?: string;
		};
	};

	export let plugin: WPPlugin | null = null;

	// --- helpers ---
	function decodeHtml(input: string) {
		// decodes things like &#8211; and &amp;
		if (!input) return '';
		const el = document.createElement('textarea');
		el.innerHTML = input;
		return el.value;
	}

	function fmtInt(n?: number) {
		if (typeof n !== 'number') return '—';
		return new Intl.NumberFormat().format(n);
	}

	function fmtPctFrom100(n?: number) {
		if (typeof n !== 'number') return '—';
		return `${Math.round(n)}%`;
	}

	function ratingStars(rating100?: number) {
		if (typeof rating100 !== 'number') return { full: 0, half: false, empty: 5, text: '—' };

		const outOf5 = (rating100 / 100) * 5;
		const full = Math.floor(outOf5);
		const frac = outOf5 - full;
		const half = frac >= 0.25 && frac < 0.75;
		const empty = 5 - full - (half ? 1 : 0);

		return { full, half, empty, text: `${outOf5.toFixed(1)}/5` };
	}

	function fmtDateLoose(s?: string) {
		// The WP API often returns "2026-01-28 10:15pm GMT" (not strict ISO)
		if (!s) return '—';
		// Try a couple of basic normalizations
		const normalized = s
			.replace(' GMT', 'Z')
			.replace(/(\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})(am|pm)Z/i, (_, d, t, ap) => {
				// convert to "YYYY-MM-DDTHH:mmZ" in 24h
				let [hh, mm] = t.split(':').map(Number);
				const isPm = ap.toLowerCase() === 'pm';
				if (isPm && hh !== 12) hh += 12;
				if (!isPm && hh === 12) hh = 0;
				const hh2 = String(hh).padStart(2, '0');
				return `${d}T${hh2}:${mm.toString().padStart(2, '0')}Z`;
			});

		const d = new Date(normalized);
		if (Number.isNaN(d.getTime())) return s;
		return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
	}

	function safeHtml(html?: string) {
		if (!html) return '';
		// If you have DOMPurify, use it:
		// return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
		// Fallback (no sanitizer): still render, but you should really sanitize if this can be user-controlled.
		return html;
	}

	$: p = plugin;
	$: title = p ? decodeHtml(p.name) : '';
	$: icon =
		p?.icons?.svg || p?.icons?.['2x'] || p?.icons?.['1x'] || '';
	$: stars = ratingStars(p?.rating);
</script>

<Card.Root class="w-full">
	<Card.Header class="space-y-3">
		{#if p}
			<div class="flex items-start gap-4">
				{#if icon}
					<img
						src={icon}
						alt={`${title} icon`}
						class="h-12 w-12 shrink-0 rounded-lg border bg-background p-2"
						loading="lazy"
					/>
				{/if}

				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<Card.Title class="text-xl leading-tight">{title}</Card.Title>
						<Badge variant="secondary" class="font-mono">v{p.version}</Badge>
						<Badge variant="outline" class="font-mono">{p.slug}</Badge>
					</div>

					{#if p.short_description}
						<Card.Description class="mt-1">
							{p.short_description}
						</Card.Description>
					{/if}

					<div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						<span class="inline-flex items-center gap-2">
							<span class="font-medium text-foreground">{fmtPctFrom100(p.rating)}</span>
							<span class="inline-flex items-center gap-1">
								{#each Array(stars.full) as _}
									<span aria-hidden="true">★</span>
								{/each}
								{#if stars.half}
									<span aria-hidden="true">☆</span>
								{/if}
								{#each Array(stars.empty) as _}
									<span aria-hidden="true">✩</span>
								{/each}
							</span>
							<span class="tabular-nums">({fmtInt(p.num_ratings)} ratings)</span>
						</span>

						<span class="hidden sm:inline">•</span>
						<span class="tabular-nums">
							{fmtInt(p.active_installs)} active installs
						</span>

						<span class="hidden sm:inline">•</span>
						<span>Updated {fmtDateLoose(p.last_updated)}</span>
					</div>
				</div>

				<div class="flex shrink-0 flex-col gap-2">
					{#if p.homepage}
						<Button asChild>
							<a href={p.homepage} target="_blank" rel="noreferrer">Homepage</a>
						</Button>
					{/if}
					{#if p.download_link}
						<Button asChild variant="secondary">
							<a href={p.download_link} target="_blank" rel="noreferrer">Download</a>
						</Button>
					{/if}
					{#if p.donate_link}
						<Button asChild variant="outline">
							<a href={p.donate_link} target="_blank" rel="noreferrer">Donate</a>
						</Button>
					{/if}
				</div>
			</div>
		{:else}
			<Card.Title class="text-lg">Select a plugin to view details</Card.Title>
			<Card.Description>Pass a single plugin object into this component.</Card.Description>
		{/if}
	</Card.Header>

	{#if p}
		<Card.Content class="space-y-6">
			<Separator />

			<!-- Quick facts -->
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<div class="rounded-lg border p-3">
					<div class="text-xs text-muted-foreground">Requires WP</div>
					<div class="mt-1 font-medium">{p.requires ?? '—'}</div>
				</div>

				<div class="rounded-lg border p-3">
					<div class="text-xs text-muted-foreground">Tested up to</div>
					<div class="mt-1 font-medium">{p.tested ?? '—'}</div>
				</div>

				<div class="rounded-lg border p-3">
					<div class="text-xs text-muted-foreground">Requires PHP</div>
					<div class="mt-1 font-medium">
						{p.requires_php === false ? '—' : (p.requires_php ?? '—')}
					</div>
				</div>

				<div class="rounded-lg border p-3">
					<div class="text-xs text-muted-foreground">Support threads</div>
					<div class="mt-1 font-medium tabular-nums">
						{fmtInt(p.support_threads)}
						{#if typeof p.support_threads === 'number' && typeof p.support_threads_resolved === 'number'}
							<span class="text-muted-foreground">
								( {fmtInt(p.support_threads_resolved)} resolved )
							</span>
						{/if}
					</div>
				</div>

				<div class="rounded-lg border p-3">
					<div class="text-xs text-muted-foreground">Downloads</div>
					<div class="mt-1 font-medium tabular-nums">{fmtInt(p.downloaded)}</div>
				</div>

				<div class="rounded-lg border p-3">
					<div class="text-xs text-muted-foreground">Added</div>
					<div class="mt-1 font-medium">{fmtDateLoose(p.added)}</div>
				</div>
			</div>

			<!-- Tags -->
			{#if p.tags && Object.keys(p.tags).length}
				<div class="space-y-2">
					<div class="text-sm font-medium">Tags</div>
					<div class="flex flex-wrap gap-2">
						{#each Object.entries(p.tags) as [key, label]}
							<Badge variant="secondary" title={key}>{label}</Badge>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Required plugins -->
			{#if p.requires_plugins && p.requires_plugins.length}
				<div class="space-y-2">
					<div class="text-sm font-medium">Requires plugins</div>
					<div class="flex flex-wrap gap-2">
						{#each p.requires_plugins as s}
							<Badge variant="outline" class="font-mono">{s}</Badge>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Author -->
			<div class="space-y-2">
				<div class="text-sm font-medium">Author</div>
				<div class="rounded-lg border p-3 text-sm text-muted-foreground">
					<!-- author is HTML anchor in WP API -->
					{@html safeHtml(p.author)}
					{#if p.author_profile}
						<span class="ml-2">
							<a
								class="underline underline-offset-4"
								href={p.author_profile}
								target="_blank"
								rel="noreferrer"
							>
								Profile
							</a>
						</span>
					{/if}
				</div>
			</div>

			<!-- Description -->
			{#if p.description}
				<div class="space-y-2">
					<div class="text-sm font-medium">Description</div>
					<div class="prose prose-sm max-w-none rounded-lg border p-4 dark:prose-invert">
						{@html safeHtml(p.description)}
					</div>
					<p class="text-xs text-muted-foreground">
						Note: rendering HTML is safest with a sanitizer (DOMPurify).
					</p>
				</div>
			{/if}
		</Card.Content>
	{/if}
</Card.Root>
