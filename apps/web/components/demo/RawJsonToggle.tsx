"use client";

import { useState } from "react";

interface RawJsonToggleProps {
  data: unknown;
}

export default function RawJsonToggle({ data }: RawJsonToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="demo-raw-json">
      <button className="button demo-toggle-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide raw JSON" : "Show raw JSON"}
      </button>
      {open && (
        <pre className="demo-json-block">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}
