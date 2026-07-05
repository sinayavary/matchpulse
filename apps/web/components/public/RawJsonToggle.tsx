"use client";

import { useState } from "react";

export default function RawJsonToggle({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="demo-raw-json">
      <button
        className="button demo-toggle-btn"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? "Hide raw JSON" : "Show raw JSON"}
      </button>
      {open ? (
        <pre className="demo-json-block">{JSON.stringify(data, null, 2)}</pre>
      ) : null}
    </div>
  );
}
