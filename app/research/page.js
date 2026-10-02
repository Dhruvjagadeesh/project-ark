"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useData, api, formData, Msg } from "@/components/util";

export default function Research() {
  const { data: s } = useSession();
  const role = s?.user?.role;
  const [meta] = useData("/api/meta");
  const [search, setSearch] = useState(""); const [kind, setKind] = useState("");
  const qs = new URLSearchParams(Object.entries({ search, kind }).filter(([, v]) => v)).toString();
  const [notes, reload] = useData("/api/research?" + qs);
  const [traps, reloadTraps] = useData("/api/camera-traps");
  const [m, setM] = useState(null);
  const names = Object.fromEntries((meta?.species || []).map(x => [x.species_id, x.common_name]));
  const run = async (fn, ok, after) => { try { await fn(); setM({ type: "ok", text: ok }); after(); } catch (x) { setM({ type: "err", text: x.message }); } };

  return (<>
    <h1>Research and field data</h1>
    <p className="sub">Stored in MongoDB. Search is ranked by a weighted text index on title, tags and body.</p>
    <div className="panel row">
      <input placeholder="Search notes, e.g. invasive lantana" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
      <select value={kind} onChange={e => setKind(e.target.value)}><option value="">All kinds</option><option value="JOURNAL">Journal</option><option value="HABITAT_SURVEY">Habitat survey</option><option value="BEHAVIOUR_LOG">Behaviour log</option></select>
    </div>
    <Msg m={m} />
    {notes?.map(n => <div className="panel" key={n._id}>
      <div className="row" style={{ justifyContent: "space-between" }}><b>{n.title}</b><span className="muted">{n.kind.replace("_", " ").toLowerCase()} · {new Date(n.created_at).toLocaleDateString()}{n.score && ` · relevance ${n.score.toFixed(2)}`}</span></div>
      <p>{n.body}</p>
      {n.survey && <table><tbody>{Object.entries(n.survey).map(([k, v]) => <tr key={k}><td className="muted">{k.replace(/_/g, " ")}</td><td>{Array.isArray(v) ? v.join(", ") : String(v)}</td></tr>)}</tbody></table>}
      <div>{n.species_ids?.map(id => <span className="tag" key={id}>{names[id] || id}</span>)}{n.tags?.map(t => <span className="tag" key={t}>#{t}</span>)}</div>
    </div>)}
    {notes?.length === 0 && <p className="muted">No notes match. Try fewer words.</p>}

    {["RESEARCHER", "ADMIN"].includes(role) && <><h2>Add a note or survey</h2>
      <form className="f panel" onSubmit={e => { e.preventDefault(); const f = new FormData(e.target); const b = { ...formData(e), species_ids: f.getAll("species_ids") };
        run(() => api("/api/research", "POST", b).then(() => e.target.reset()), "Note saved.", reload); }}>
        <label>Kind<select name="kind"><option value="JOURNAL">Journal</option><option value="HABITAT_SURVEY">Habitat survey</option><option value="BEHAVIOUR_LOG">Behaviour log</option></select></label>
        <label>Title<input name="title" required minLength={3} /></label>
        <label>Area<select name="area_id"><option value="">None</option>{meta?.areas.map(a => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}</select></label>
        <label>Species (hold Ctrl for several)<select name="species_ids" multiple>{meta?.species.map(a => <option key={a.species_id} value={a.species_id}>{a.common_name}</option>)}</select></label>
        <label className="wide">Body<textarea name="body" required minLength={10} /></label>
        <label className="wide">Survey metrics as JSON (optional)<input name="survey" placeholder='{"waterholes_checked": 10, "canopy_cover_pct": 40}' /></label>
        <label className="wide">Tags (comma separated)<input name="tags" /></label>
        <button>Save note</button>
      </form></>}

    <h2>Camera trap captures</h2>
    <div className="tablewrap"><table><thead><tr><th>Trap</th><th>Captured</th><th>Detections</th><th>Image details</th></tr></thead>
      <tbody>{traps?.map(t => <tr key={t._id}><td>{t.trap_code}</td><td>{new Date(t.captured_at).toLocaleString()}</td>
        <td>{t.detections.map((d, i) => <div key={i}>{names[d.species_id] || d.species_id} × {d.count} ({Math.round((d.confidence || 0) * 100)}%)</div>)}</td>
        <td className="muted">{Object.entries(t.image_meta || {}).map(([k, v]) => `${k}: ${v}`).join(", ")}</td></tr>)}</tbody></table></div>
    {role !== "VET_OFFICER" && <form className="f panel" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); const b = formData(e); b.infrared = !!b.infrared;
      run(() => api("/api/camera-traps", "POST", b).then(() => e.target.reset()), "Capture saved.", reloadTraps); }}>
      <label>Trap code<input name="trap_code" required /></label>
      <label>Area<select name="area_id">{meta?.areas.map(a => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}</select></label>
      <label>Captured at<input name="captured_at" type="datetime-local" required /></label>
      <label>Species<select name="species_id">{meta?.species.map(a => <option key={a.species_id} value={a.species_id}>{a.common_name}</option>)}</select></label>
      <label>Count<input name="count" type="number" min="1" defaultValue="1" /></label>
      <label>Confidence (0–1)<input name="confidence" type="number" step="0.01" min="0" max="1" defaultValue="0.9" /></label>
      <label>Latitude<input name="latitude" type="number" step="0.000001" required /></label>
      <label>Longitude<input name="longitude" type="number" step="0.000001" required /></label>
      <label style={{ flexDirection: "row", alignItems: "center" }}><input type="checkbox" name="infrared" /> Infrared</label>
      <button>Add capture</button>
    </form>}
  </>);
}
