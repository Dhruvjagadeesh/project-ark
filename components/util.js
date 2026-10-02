"use client";
import { useEffect, useState, useCallback } from "react";

export async function api(url, method = "GET", body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function useData(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(() => { api(url).then(setData).catch(e => setError(e.message)); }, [url]);
  useEffect(reload, [reload]);
  return [data, reload, error];
}

// Collect form fields into an object
export const formData = (e) => Object.fromEntries(new FormData(e.target).entries());

export function Msg({ m }) { return m ? <div className={"msg " + m.type}>{m.text}</div> : null; }
export const Chip = ({ s }) => <span className={"chip " + s} title="IUCN status">{s}</span>;
