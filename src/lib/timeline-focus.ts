import type { ActivityView } from "@/server/task-queries";
import type { TaskFocusTarget } from "@/lib/notification-link";

const VIEW_PADDING_PX = 20;

export function focusElementIds(target: TaskFocusTarget, activities: ActivityView[]): string[] {
  const ids: string[] = [];
  if (target.kind === "message") {
    const activity = activities.find((a) => a.message?.id === target.id);
    if (activity) ids.push(`activity-${activity.id}`);
    ids.push(`message-${target.id}`);
  } else {
    ids.push(`activity-${target.id}`);
    const activity = activities.find((a) => a.id === target.id);
    if (activity?.message) ids.push(`message-${activity.message.id}`);
  }
  return ids;
}

function isScrollableContainer(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  const allowsScroll = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
  if (!allowsScroll) return false;
  return el.scrollHeight > el.clientHeight + 2;
}

function findScrollableAncestor(start: HTMLElement, stopAt?: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = start.parentElement;
  while (node) {
    if (stopAt && node === stopAt) break;
    if (isScrollableContainer(node)) return node;
    if (node.tagName === "MAIN") return node;
    node = node.parentElement;
  }
  return document.querySelector("main");
}

function defaultAppScrollRoot(): HTMLElement | null {
  return document.querySelector("main");
}

function scrollOffsets(el: HTMLElement, scrollRoot: HTMLElement): { top: number; height: number } {
  const rootRect = scrollRoot.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const top = elRect.top - rootRect.top + scrollRoot.scrollTop;
  return { top, height: elRect.height };
}

export function scrollElementIntoContainer(
  el: HTMLElement,
  scrollRoot: HTMLElement,
  behavior: ScrollBehavior = "smooth",
): void {
  const pad = VIEW_PADDING_PX;
  const viewH = scrollRoot.clientHeight;
  const maxScroll = Math.max(0, scrollRoot.scrollHeight - viewH);
  const { top, height } = scrollOffsets(el, scrollRoot);
  const bottom = top + height;

  let next = scrollRoot.scrollTop;
  const viewTop = scrollRoot.scrollTop;
  const viewBottom = viewTop + viewH;

  if (height > viewH - pad * 2) {
    next = top - pad;
  } else if (top < viewTop + pad) {
    next = top - pad;
  } else if (bottom > viewBottom - pad) {
    next = bottom - viewH + pad;
  } else {
    return;
  }

  next = Math.min(maxScroll, Math.max(0, next));
  scrollRoot.scrollTo({ top: next, behavior });
}

function isFullyVisibleInContainer(el: HTMLElement, scrollRoot: HTMLElement, pad = VIEW_PADDING_PX): boolean {
  const r = scrollRoot.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  return e.top >= r.top + pad && e.bottom <= r.bottom - pad;
}

function isFullyVisibleInWindow(el: HTMLElement, pad = VIEW_PADDING_PX): boolean {
  const e = el.getBoundingClientRect();
  return e.top >= pad && e.bottom <= window.innerHeight - pad;
}

function scrollElementInWindow(el: HTMLElement, behavior: ScrollBehavior = "smooth"): void {
  const pad = VIEW_PADDING_PX;
  const rect = el.getBoundingClientRect();
  const viewH = window.innerHeight;
  let delta = 0;
  if (rect.bottom > viewH - pad) {
    delta = rect.bottom - viewH + pad;
  } else if (rect.top < pad) {
    delta = rect.top - pad;
  }
  if (delta === 0) return;
  window.scrollBy({ top: delta, behavior });
}

export function scrollToFocusTarget(
  target: TaskFocusTarget,
  activities: ActivityView[],
  scrollRoot?: HTMLElement | null,
): boolean {
  for (const elId of focusElementIds(target, activities)) {
    const el = document.getElementById(elId);
    if (!el) continue;

    const preferred =
      scrollRoot && isScrollableContainer(scrollRoot)
        ? scrollRoot
        : findScrollableAncestor(el, scrollRoot) ?? defaultAppScrollRoot();
    if (preferred) {
      scrollElementIntoContainer(el, preferred, "smooth");
      if (!isFullyVisibleInContainer(el, preferred)) {
        scrollElementIntoContainer(el, preferred, "auto");
      }
    } else {
      scrollElementInWindow(el, "smooth");
      if (!isFullyVisibleInWindow(el)) {
        el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
      }
    }
    return true;
  }
  return false;
}
