import { useLayoutEffect } from "react";

interface ScrollLockSnapshot {
  scrollY: number;
  bodyStyles: {
    overflow: string;
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    paddingRight: string;
  };
  htmlOverscrollBehavior: string;
}

let lockCount = 0;
let snapshot: ScrollLockSnapshot | null = null;

const lockBodyScroll = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  lockCount += 1;
  if (lockCount > 1) return;

  const body = document.body;
  const html = document.documentElement;
  const scrollY = window.scrollY;
  const scrollbarWidth = window.innerWidth - html.clientWidth;

  snapshot = {
    scrollY,
    bodyStyles: {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    },
    htmlOverscrollBehavior: html.style.overscrollBehavior,
  };

  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }

  html.style.overscrollBehavior = "none";
};

const unlockBodyScroll = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (lockCount === 0) return;

  lockCount -= 1;
  if (lockCount > 0) return;
  if (!snapshot) return;

  const body = document.body;
  const html = document.documentElement;

  body.style.overflow = snapshot.bodyStyles.overflow;
  body.style.position = snapshot.bodyStyles.position;
  body.style.top = snapshot.bodyStyles.top;
  body.style.left = snapshot.bodyStyles.left;
  body.style.right = snapshot.bodyStyles.right;
  body.style.width = snapshot.bodyStyles.width;
  body.style.paddingRight = snapshot.bodyStyles.paddingRight;
  html.style.overscrollBehavior = snapshot.htmlOverscrollBehavior;

  window.scrollTo(0, snapshot.scrollY);
  snapshot = null;
};

export function useBodyScrollLock(isLocked: boolean) {
  useLayoutEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}
