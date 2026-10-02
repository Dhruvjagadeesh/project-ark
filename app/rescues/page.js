"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useData, api, formData, Msg } from "@/components/util";

export default function Rescues() {
  const { data: s } = useSession();
  const role = s?.user?.role;
  const [meta, reloadMeta] = useData("/api/meta");
  const [rows, reload] = useData("/api/rescues");
  const [open, setOpen] = useState(null);
  const [hist, setHist] = useState(null);
  const [m, setM] = useState(null);
  const officer = ["ADMIN", "FOREST_OFFICER"].includes(role);

  async function act(body, ok) {
    try { await api("/api/rescues", "PATCH", body); setM({ type: "ok", text: ok }); reload(); reloadMeta(); if (open === body.rescue_id) show(open); }
    catch (x) { setM({ type: "err", text: x.message }); }
  }
  async function show(id) { setOpen(id); setHist(await api("/api/rescues?id=" + id)); }

  return (<>
    <h1>Rescue operations</h1>
    <p className="sub">Reported → approved → assigned → in progress → completed. Status changes are logged by a trigger; team assignment and closing run as transactions.</p>
    <Msg m={m} />
    <div className="tablewrap"><table>
      <thead><tr><th>#</th><th>Priority</th><th>Species</th><th>Area</th><th>Status</th><th>Team</th><th>Reported</th><th>Actions</th></tr></thead>
      <tbody>{rows?.map(r => <tr key={r.rescue_id}>
        <td>{r.rescue_id}</td><td><b style={{ color: r.priority === "CRITICAL" ? "var(--cr)" : r.priority === "HIGH" ? "var(--en)" : "inherit" }}>{r.priority.toLowerCase()}</b></td>
        <td>{r.common_name}{r.tag_code && <div className="muted">{r.tag_code}</div>}</td><td>{r.area}</td><td>{r.status.replace("_", " ").toLowerCase()}</td>
        <td>{r.team_name || "—"}</td><td>{r.reported_at}</td>
        <td><div className="row">
          <button className="ghost" onClick={() => show(r.rescue_id)}>History</button>
          {r.status === "REPORTED" && role === "ADMIN" && <button onClick={() => act({ action: "approve", rescue_id: r.rescue_id }, "Rescue approved.")}>Approve</button>}
          {r.status === "APPROVED" && officer && <form className="row" onSubmit={e => { e.preventDefault(); act({ action: "assign", rescue_id: r.rescue_id, team_id: formData(e).team_id }, "Team assigned."); }}>
            <select name="team_id">{meta?.teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}{t.is_available ? "" : " (busy)"}</option>)}</select><button>Assign team</button></form>}
          {r.status === "ASSIGNED" && officer && <button onClick={() => act({ action: "progress", rescue_id: r.rescue_id }, "Rescue marked in progress.")}>Start</button>}
          {r.status === "IN_PROGRESS" && officer && <form className="row" onSubmit={e => { e.preventDefault(); act({ action: "close", rescue_id: r.rescue_id, center_id: formData(e).center_id }, "Rescue closed."); }}>
            <select name="center_id"><option value="">No admission</option>{meta?.centers.map(c => <option key={c.center_id} value={c.center_id}>{c.name}</option>)}</select><button>Close rescue</button></form>}
        </div></td></tr>)}</tbody>
    </table></div>

    {hist && <div className="panel" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>Rescue #{open} history</h2><button className="ghost" onClick={() => setHist(null)}>Close</button></div>
      <h3>Status log (MySQL trigger)</h3>
      <ul>{hist.log.map(l => <li key={l.log_id}>{l.changed_at}: {l.old_status} → {l.new_status}</li>)}{!hist.log.length && <li className="muted">No status changes yet.</li>}</ul>
      <h3>Field documentation (MongoDB)</h3>
      <ul>{hist.entries.map((e, i) => <li key={i}>{new Date(e.at).toLocaleString()}: {e.text}</li>)}</ul>
      <form className="row" onSubmit={e => { e.preventDefault(); act({ action: "note", rescue_id: open, text: formData(e).text }, "Note added."); e.target.reset(); }}>
        <input name="text" placeholder="Add a field note" required style={{ flex: 1 }} /><button>Add note</button></form>
    </div>}

    {officer && <><h2>Report a rescue</h2>
      <form className="f panel" onSubmit={async e => { e.preventDefault(); const b = formData(e);
        try { await api("/api/rescues", "POST", b); e.target.reset(); setM({ type: "ok", text: "Rescue reported. An administrator must approve it." }); reload(); } catch (x) { setM({ type: "err", text: x.message }); } }}>
        <label>Species<select name="species_id">{meta?.species.map(a => <option key={a.species_id} value={a.species_id}>{a.common_name}</option>)}</select></label>
        <label>Protected area<select name="area_id">{meta?.areas.map(a => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}</select></label>
        <label>Priority<select name="priority" defaultValue="HIGH">{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Animal ID (if tagged)<input name="animal_id" type="number" /></label>
        <label className="wide">What happened<textarea name="description" required maxLength={500} /></label>
        <button>Report rescue</button>
      </form></>}
  </>);
}
