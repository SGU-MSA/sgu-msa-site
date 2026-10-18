"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** A blank standards-mode page for the preview (no address: nothing is loaded). */
const blankPage =
  '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';

/** The site's styles, copied from this page into the preview's own page. */
const styleSelector = 'link[rel="stylesheet"], style';

/**
 * The preview's own page (review fixes P1, item 8): an iframe the given
 * width, into which `children` are drawn from this page (a React portal,
 * so they are the real public components with this page's state). Its own
 * page lets the site's phone and tablet layouts (media queries) apply at
 * the chosen width. The site's styles and the theme are copied in; styles
 * that arrive later are copied too. Nothing in it can be focused or
 * clicked (inert); the frame itself takes focus, so arrow keys and Page
 * Down scroll it from the keyboard.
 */
export function PreviewFrame({
  width,
  scale,
  height,
  title,
  children,
}: {
  /** CSS pixels the page is laid out at. */
  width: number;
  /** Shrinks the frame to fit the screen (1 = actual size). */
  scale: number;
  /** CSS pixels of the visible area, before scaling. */
  height: number;
  title: string;
  children: ReactNode;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  // The frame's own page holds the focus, so the frame never matches
  // `:focus`: its window's focus and blur mark it for the focus ring.
  const [focused, setFocused] = useState(false);

  // The blank page loads once; then the styles and theme go in.
  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc || doc.querySelector(".preview-frame-root")) return;
    const html = document.documentElement;
    for (const name of ["class", "data-theme", "lang", "style"]) {
      const value = html.getAttribute(name);
      if (value !== null) doc.documentElement.setAttribute(name, value);
    }
    for (const node of document.head.querySelectorAll(styleSelector))
      doc.head.append(node.cloneNode(true));
    doc.body.className = document.body.className;
    const root = doc.createElement("div");
    root.className = "preview-frame-root";
    root.inert = true;
    doc.body.append(root);
    doc.defaultView?.addEventListener("focus", () => setFocused(true));
    doc.defaultView?.addEventListener("blur", () => setFocused(false));
    setBody(root);
  };

  // Styles added to this page later (a lazily loaded part) are copied too.
  useEffect(() => {
    if (!body) return;
    const doc = body.ownerDocument;
    const observer = new MutationObserver((changes) => {
      for (const change of changes)
        for (const node of change.addedNodes)
          if (node instanceof Element && node.matches(styleSelector))
            doc.head.append(node.cloneNode(true));
    });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [body]);

  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={blankPage}
      onLoad={onLoad}
      tabIndex={0}
      data-focused={focused ? "" : undefined}
      style={{
        width,
        height: height / scale,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {body ? createPortal(children, body) : null}
    </iframe>
  );
}
