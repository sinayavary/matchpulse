"use client";
import { useState } from "react";
export default function ApiApplicationsPanel() { const [name, setName] = useState(""); return <section><h2>Applications</h2><input value={name} onChange={e=>setName(e.target.value)} placeholder="Application name"/><button onClick={()=>setName("")}>Create free application</button><p>Secrets are displayed once and are never retained by this page.</p></section>; }
