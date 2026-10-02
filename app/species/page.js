"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useData, api, formData, Msg, Chip } from "@/components/util";

const STATUSES = ["CR", "EN", "VU", "NT", "LC", "EW", "EX"];
const CATS = ["MAMMAL", "BIRD", "REPTILE", "AMPHIBIAN", "FISH", "INVERTEBRATE"];

export default function Species() {
  const { data: s } = useSession();
  const admin = s?.user?.role === "ADMIN";
  const [filters, setFilters] = useState({ search: "", status: "", category: "" });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const [rows, reload] = useData("/api/species?" + qs);
  const [m, setM] = useState(null);

  async function add(e) {
    e.preventDefault();
    try { await api("/api/species", "POST", formData(e)); e.target.reset(); setM({ type: "ok", text: "Species added." }); reload(); }
    catch (x) { setM({ type: "err", text: x.message }); }
  }
  async function setStatus(id, status) {
    try { await api("/api/species", "PATCH", { species_id: id, conservation_status: status }); setM({ type: "ok", text: "Status updated and written to the audit log." }); reload(); }
    catch (x) { setM({ type: "err", text: x.message }); }
  }

  return (<>
    <h1>Species</h1>
    <p className="sub">Search uses a MySQL full-text index on name and description.</p>
    <div className="panel row">
      <input placeholder="Search species, e.g. tiger" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
      <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Any status</option>{STATUSES.map(x => <option key={x}>{x}</option>)}</select>
      <select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}><option value="">Any category</option>{CATS.map(x => <option key={x}>{x}</option>)}</select>
    </div>
    <Msg m={m} />
    <div className="tablewrap"><table>
      <thead><tr><th>Common name</th><th>Scientific name</th><th>Category</th><th>Status</th><th>Est. population</th><th>In protected areas</th></tr></thead>
      <tbody>{rows?.map(r => <tr key={r.species_id}>
        <td>{r.common_name}</td><td><i>{r.scientific_name}</i></td><td>{r.category.toLowerCase()}</td>
        <td>{admin ? <select value={r.conservation_status} onChange={e => setStatus(r.species_id, e.target.value)}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select> : <Chip s={r.conservation_status} />}</td>
        <td>{r.estimated_population ?? "—"}</td><td>{r.total_population} in {r.areas_present} area(s)</td></tr>)}
        {rows?.length === 0 && <tr><td colSpan={6} className="muted">No species match. Clear a filter to see more.</td></tr>}</tbody>
    </table></div>

    {admin && <><h2>Add species</h2>
      <form className="f panel" onSubmit={add}>
        <label>Common name<input name="common_name" required /></label>
        <label>Scientific name<input name="scientific_name" required /></label>
        <label>Category<select name="category">{CATS.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>IUCN status<select name="conservation_status">{STATUSES.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Habitat<input name="habitat_type" /></label>
        <label>Estimated population<input name="estimated_population" type="number" /></label>
        <label className="wide">Description<textarea name="description" /></label>
        <button>Add species</button>
      </form></>}
  </>);
}
