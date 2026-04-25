<script lang="ts">
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';

    // Get the breadcrumbs from the URL path
    $: pathSegments = $page.url.pathname
        .split('/')
        .filter(Boolean)
        .map((segment, index, array) => {
            const path = '/' + array.slice(0, index + 1).join('/');
            return {
                name: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
                path
            };
        });
</script>

<header class="header">
    <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol class="breadcrumb-list">
            <li class="breadcrumb-item">
                <a href="/" class="breadcrumb-link">Home</a>
            </li>
            {#each pathSegments as segment, i}
                <li class="breadcrumb-item">
                    <ChevronRight class="separator-icon" />
                    {#if i === pathSegments.length - 1}
                        <span class="breadcrumb-current" aria-current="page">{segment.name}</span>
                    {:else}
                        <a href={segment.path} class="breadcrumb-link">{segment.name}</a>
                    {/if}
                </li>
            {/each}
        </ol>
    </nav>
</header>

<style>
    .header {
        height: 4rem;
        display: flex;
        align-items: center;
        padding: 0 1.5rem;
        border-bottom: 1px solid var(--border, #e2e8f0);
        background-color: var(--background, #ffffff);
        position: sticky;
        top: 0;
        z-index: 10;
    }

    .breadcrumb-list {
        display: flex;
        align-items: center;
        list-style: none;
        margin: 0;
        padding: 0;
        gap: 0.5rem;
        font-size: 0.875rem;
    }

    .breadcrumb-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--muted-foreground, #64748b);
    }

    .breadcrumb-link {
        color: var(--muted-foreground, #64748b);
        text-decoration: none;
        transition: color 0.2s;
    }

    .breadcrumb-link:hover {
        color: var(--foreground, #0f172a);
    }

    .breadcrumb-current {
        color: var(--foreground, #0f172a);
        font-weight: 500;
    }

    :global(.separator-icon) {
        width: 1rem;
        height: 1rem;
        opacity: 0.5;
    }

    :global(.dark) .header {
        background-color: var(--background, #020817);
        border-bottom-color: var(--border, #1e293b);
    }
    
    :global(.dark) .breadcrumb-link {
        color: #94a3b8;
    }
    
    :global(.dark) .breadcrumb-link:hover {
        color: #f1f5f9;
    }
    
    :global(.dark) .breadcrumb-current {
        color: #f1f5f9;
    }
</style>
