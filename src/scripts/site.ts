/**
 * The only client JS: mobile drawer, reading-size toggle, and closing
 * info chips (native <details>) on outside click / Escape.
 */
const READING_SIZES = ['sm', 'lg'] as const;
type ReadingSize = (typeof READING_SIZES)[number];

const SIZE_LABELS: Record<ReadingSize, string> = { sm: 'pequeña', lg: 'grande' };
const STORAGE_KEY = 'erre-a-pe:reading-size';

const html = document.documentElement;
const mainColumn = document.querySelector<HTMLElement>('.main-column');
const sidebar = document.querySelector<HTMLElement>('.sidebar');
const backdrop = document.querySelector<HTMLElement>('.drawer-backdrop');
const menuButton = document.querySelector<HTMLButtonElement>('#menu-button');
const sizeButton = document.querySelector<HTMLButtonElement>('#size-button');
const main = document.querySelector<HTMLElement>('#main');

let drawerOpen = false;

/* ---------- Reading size ---------- */

function applyReadingSize(size: ReadingSize): void {
  html.dataset.readingSize = size;
  if (!sizeButton) return;
  sizeButton.dataset.size = size;
  sizeButton.setAttribute('aria-label', `Tamaño de letra: ${SIZE_LABELS[size]}`);
  sizeButton.title = `Tamaño de letra: ${SIZE_LABELS[size]}`;
}

function savedReadingSize(): ReadingSize {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (READING_SIZES as readonly string[]).includes(saved)) return saved as ReadingSize;
  } catch {
    /* storage may be unavailable */
  }
  return 'lg';
}

applyReadingSize(savedReadingSize());

sizeButton?.addEventListener('click', () => {
  const next = READING_SIZES[(READING_SIZES.indexOf(html.dataset.readingSize as ReadingSize) + 1) % READING_SIZES.length];
  applyReadingSize(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage may be unavailable */
  }
});

/* ---------- Mobile drawer ---------- */

const mobileQuery = window.matchMedia('(max-width: 899px)');

function setDrawer(open: boolean): void {
  drawerOpen = mobileQuery.matches ? open : false;
  const active = drawerOpen;

  sidebar?.classList.toggle('is-open', active);
  backdrop?.classList.toggle('is-open', active);
  backdrop?.setAttribute('aria-hidden', String(!active));
  menuButton?.setAttribute('aria-expanded', String(active));
  document.body.classList.toggle('drawer-open', active);
  if (mainColumn) mainColumn.inert = active;

  if (sidebar) {
    sidebar.inert = mobileQuery.matches && !active;
    if (mobileQuery.matches && !active) sidebar.setAttribute('aria-hidden', 'true');
    else sidebar.removeAttribute('aria-hidden');
  }

  if (active) {
    const target =
      sidebar?.querySelector<HTMLElement>('.track[aria-current="page"]') ??
      sidebar?.querySelector<HTMLElement>('.track');
    window.setTimeout(() => target?.focus({ preventScroll: true }), 90);
  }
}

function syncDrawerMode(): void {
  if (mobileQuery.matches) {
    if (!drawerOpen && sidebar) {
      sidebar.inert = true;
      sidebar.setAttribute('aria-hidden', 'true');
    }
    return;
  }
  drawerOpen = false;
  sidebar?.classList.remove('is-open');
  backdrop?.classList.remove('is-open');
  backdrop?.setAttribute('aria-hidden', 'true');
  menuButton?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('drawer-open');
  if (mainColumn) mainColumn.inert = false;
  if (sidebar) {
    sidebar.inert = false;
    sidebar.removeAttribute('aria-hidden');
  }
}

menuButton?.addEventListener('click', () => setDrawer(!drawerOpen));
backdrop?.addEventListener('click', () => setDrawer(false));

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const openEl = document.querySelector<HTMLDetailsElement>('details.chip[open], details.info-trigger[open]');
  if (openEl) {
    openEl.open = false;
    return;
  }
  if (drawerOpen) setDrawer(false);
});

mobileQuery.addEventListener('change', syncDrawerMode);
syncDrawerMode();

/* ---------- Info chips ---------- */

// Native <details> stays open on outside click; close it for app-like behavior.
document.addEventListener('pointerdown', (event) => {
  if (!(event.target instanceof Element)) return;
  for (const el of document.querySelectorAll<HTMLDetailsElement>('details.chip[open], details.info-trigger[open]')) {
    if (!el.contains(event.target)) el.open = false;
  }
});

// Artist triggers open on hover for mouse users; Escape/click still closes.
document.addEventListener('pointerover', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.pointerType && event.pointerType !== 'mouse') return;
  const trigger = event.target.closest<HTMLDetailsElement>('details.info-trigger');
  if (trigger && !trigger.open) trigger.open = true;
});

document.addEventListener('pointerout', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.pointerType && event.pointerType !== 'mouse') return;
  if (!(event.relatedTarget instanceof Element)) return;
  const trigger = event.target.closest<HTMLDetailsElement>('details.info-trigger');
  if (trigger && !trigger.contains(event.relatedTarget)) trigger.open = false;
});

/* Keep open popovers inside the viewport (toggle does not bubble -> capture). */
document.addEventListener(
  'toggle',
  (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open) return;
    const pop = details.querySelector<HTMLElement>('.chip-pop');
    if (!pop) return;

    pop.style.left = '0px';
    const rect = pop.getBoundingClientRect();
    const margin = 12;
    const viewport = document.documentElement.clientWidth;
    let offset = 0;
    if (rect.right > viewport - margin) offset = viewport - margin - rect.right;
    if (rect.left + offset < margin) offset = margin - rect.left;
    if (offset !== 0) pop.style.left = `${Math.round(offset)}px`;
  },
  true,
);

// Close the drawer when navigating from the sidebar on mobile.
document.querySelector('.song-list')?.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('a.track')) return;
  if (drawerOpen) setDrawer(false);
});

// Keep scroll anchored to the top of a freshly opened page.
main?.focus({ preventScroll: true });
