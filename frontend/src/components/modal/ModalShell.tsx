import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { LAYERS } from "../../constants/layers";

interface ModalShellProps {
  isOpen: boolean;
  children: ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  overlayClassName?: string;
  panelClassName?: string;
  zIndex?: number;
}

const joinClassNames = (...classNames: Array<string | undefined | false>) =>
  classNames.filter(Boolean).join(" ");

const escapeStack: symbol[] = [];

export default function ModalShell({
  isOpen,
  children,
  onClose,
  closeOnBackdrop = false,
  closeOnEscape = true,
  overlayClassName,
  panelClassName,
  zIndex = LAYERS.modal,
}: ModalShellProps) {
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen || !onClose || !closeOnEscape) return;

    const token = Symbol("modal-escape");
    escapeStack.push(token);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      const topToken = escapeStack[escapeStack.length - 1];
      if (topToken === token) {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      const tokenIndex = escapeStack.lastIndexOf(token);
      if (tokenIndex !== -1) {
        escapeStack.splice(tokenIndex, 1);
      }
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={joinClassNames(
        "fixed inset-0 flex items-center justify-center p-4 bg-black/50 overflow-y-auto overscroll-contain",
        overlayClassName
      )}
      style={{ zIndex }}
      onMouseDown={() => {
        if (closeOnBackdrop) {
          onClose?.();
        }
      }}
    >
      <div
        className={joinClassNames(
          "w-full max-h-[calc(100dvh-2rem)] overflow-y-auto",
          panelClassName
        )}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
