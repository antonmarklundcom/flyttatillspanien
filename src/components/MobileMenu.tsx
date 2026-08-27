"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HEADER_NAV, FOOTER_COMPANY } from "@/config/site-nav";

/**
 * Phone navigation. Below 900px the desktop nav is hidden (globals.css) and
 * this drawer carries every menu entry — previously the header simply dropped
 * its links on mobile, which on a portal where most traffic is a phone meant
 * the whole site was one CTA wide.
 *
 * Client component because it holds open/closed state; the links themselves
 * come from the same config the server-rendered desktop nav uses.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Route change closes the drawer — otherwise it stays over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock the page behind the drawer so scrolling moves the menu, not the page.
  useEffect(() => {
    if (!open) return;
    // The drawer starts just below the header, whose height depends on the
    // viewport — measure it rather than hard-coding a value that drifts.
    const header = buttonRef.current?.closest("header");
    setTop(header ? Math.round(header.getBoundingClientRect().bottom) : 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="site-header__burger"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
      </button>

      {/* Portalled to <body>: the header sets `backdrop-filter`, which makes it
          a containing block for fixed-position descendants — a drawer rendered
          inside it would be clipped to the header's own 60-odd pixels. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="mobile-menu"
            role="dialog"
            aria-label="Menú principal"
            style={{ top }}
          >
            <div className="mobile-menu__inner">
            {HEADER_NAV.map((group) => (
              <div key={group.label} className="mobile-menu__group">
                <Link className="mobile-menu__group-title" href={group.href}>
                  {group.label}
                </Link>
                {/* A group with no children is a destination, not a section:
                    its title above is already the link. */}
                {group.links.length > 0 && (
                  <ul className="mobile-menu__list">
                    {group.links.map((l) => (
                      <li key={l.href + l.label}>
                        <Link className="mobile-menu__link" href={l.href}>
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            <div className="mobile-menu__group">
              <span className="mobile-menu__group-title">
                {"Sobre nosotros"}
              </span>
              <ul className="mobile-menu__list">
                {FOOTER_COMPANY.map((l) => (
                  <li key={l.href}>
                    <Link className="mobile-menu__link" href={l.href}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <Link className="mobile-menu__cta" href="/publicar">
              Publicar propiedad
            </Link>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
