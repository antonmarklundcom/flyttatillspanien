"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The two pieces of the bulk table that need a browser: the header
 * "select all" box and the live count of what's selected.
 *
 * Everything else — the checkboxes, the action <select>, the submit — is plain
 * HTML inside one <form>, so the feature degrades to "tick rows by hand and
 * submit" with JS off. This component only reads and writes the DOM checkboxes
 * that the server already rendered; it never owns the selection state, which is
 * why a page navigation can't leave the two out of sync.
 */
export function BulkSelectAll({ formId }: { formId: string }) {
  const ref = useRef<HTMLInputElement>(null);

  function toggle(checked: boolean) {
    const form = document.getElementById(formId);
    if (!form) return;
    form
      .querySelectorAll<HTMLInputElement>('input[name="ids"]')
      .forEach((box) => {
        box.checked = checked;
        // Notify the counter: .checked set from script fires no event.
        box.dispatchEvent(new Event("change", { bubbles: true }));
      });
  }

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Seleccionar todas"
      onChange={(e) => toggle(e.currentTarget.checked)}
    />
  );
}

export function BulkCount({ formId }: { formId: string }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const recount = () =>
      setN(
        form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked')
          .length,
      );
    form.addEventListener("change", recount);
    recount();
    return () => form.removeEventListener("change", recount);
  }, [formId]);

  return (
    <span className="panel-bulk__count">
      {n === 0
        ? "Ninguna seleccionada"
        : n === 1
          ? "1 propiedad seleccionada"
          : `${n} propiedades seleccionadas`}
    </span>
  );
}
