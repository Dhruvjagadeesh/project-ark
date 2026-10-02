"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useData, api, formData, Msg } from "@/components/util";

export default function Sightings() {
  const { data: s } = useSession();
  const role = s?.user?.role;
  const [meta] = useData("/api/meta");
  const [f, setF] = useState({ area: "", species: "", verified: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const [rows, reload] = useData("/api/sightings?" + qs);
  const [m, setM] = useState(null);
  const run = async (fn, ok) => { try { await fn(); setM({ type: "ok", text: ok }); reload(); } catch (x) { setM({ type: "err", text: x.message }); } };

  return (<>
    <h1>Wildlife sightings</h1>
    <p className="sub">Each sighting is a MySQL row; its notes, tags and photo details are a linked MongoDB field report.</p>
    <div className="panel row">
      <select value={f.area} onChange={e => setF({ ...f, area: e.target.value })}><option value="">All areas</option>{meta?.areas.map(a => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}</select>
      <select value={f.species} onChange={e => setF({ ...f, species: e.target.value })}><option value="">All species</option>{meta?.species.map(a => <option key={a.species_id} value={a.species_id}>{a.common_name}</option>)}</select>
      <select value={f.verified} onChange={e => setF({ ...f, verified: e.target.value })}><option value="">Verified and unverified</option><option value="1">Verified</option><option value="0">Unverified</option></select>
    </div>
    <Msg m={m} />
    <div className="tablewrap"><table>
      <thead><tr><th>When</th><th>Species</th><th>Area</th><th>Count</th><th>Coordinates</th><th>Reported by</th><th>Verified</th><th></th></tr></thead>
      <tbody>{rows?.map(r => <tr key={r.sighting_id}>
        <td>{r.sighted_at}</td><td>{r.common_name}</td><td>{r.area}</td><td>{r.count_seen}</td>
        <td>{r.latitude}, {r.longitude}</td><td>{r.reporter}</td><td>{r.is_verified ? "Yes" : "No"}</td>
        <td className="row">
          {!r.is_verified && ["ADMIN", "FOREST_OFFICER"].includes(role) && <button className="ghost" onClick={() => run(() => api("/api/sightings", "PATCH", { sighting_id: r.sighting_id }), "Sighting verified.")}>Verify</button>}
          {!r.is_verified && role === "ADMIN" && <button className="danger" onClick={() => run(() => api("/api/sightings?id=" + r.sighting_id, "DELETE"), "Sighting deleted.")}>Delete</button>}
        </td></tr>)}</tbody>
    </table></div>

    {role !== "VET_OFFICER" && <><h2>Report a sighting</h2>
      <form className="f panel" onSubmit={e => { e.preventDefault(); const b = formData(e); run(() => api("/api/sightings", "POST", b).then(() => e.target.reset()), "Sighting reported. It is waiting for verification."); }}>
        <label>Species<select name="species_id" required>{meta?.species.map(a => <option key={a.species_id} value={a.species_id}>{a.common_name}</option>)}</select></label>
        <label>Protected area<select name="area_id" required>{meta?.areas.map(a => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}</select></label>
        <label>Date and time<input name="sighted_at" type="datetime-local" required /></label>
        <label>Number seen<input name="count_seen" type="number" min="1" defaultValue="1" /></label>
        <label>Latitude<input name="latitude" type="number" step="0.000001" required /></label>
        <label>Longitude<input name="longitude" type="number" step="0.000001" required /></label>
        <label>Weather<input name="weather" /></label>
        <label>Photo file name<input name="photo" placeholder="IMG_0231.jpg" /></label>
        <label className="wide">Field notes<textarea name="notes" placeholder="Behaviour, condition, surroundings" /></label>
        <label className="wide">Tags (comma separated)<input name="tags" placeholder="herd, waterhole" /></label>
        <button>Report sighting</button>
      </form></>}
  </>);
}
