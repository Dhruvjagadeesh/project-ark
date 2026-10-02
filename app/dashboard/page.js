"use client";
import { useData, Chip } from "@/components/util";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Bars({ rows, label, value }) {
  const max = Math.max(1, ...rows.map(r => Number(r[value])));
  return (<table><tbody>{rows.map((r, i) => (
    <tr key={i}><td style={{ width: "35%" }}>{r[label]}</td>
      <td><div className="bar" style={{ width: `${(Number(r[value]) / max) * 100}%` }} /></td>
      <td style={{ width: 70, textAlign: "right" }}>{r[value]}</td></tr>))}</tbody></table>);
}

function Dash() {
  const [d, , err] = useData("/api/dashboard");
  const denied = useSearchParams().get("denied");
  if (err) return <div className="msg err">{err}</div>;
  if (!d) return <p>Loading…</p>;
  const c = d.counts;
  return (<>
    <h1>Conservation dashboard</h1>
    <p className="sub">Live figures from MySQL views and MongoDB aggregations.</p>
    {denied && <div className="msg err">Your role cannot open that page.</div>}
    <div className="grid">
      <div className="stat"><b>{c.species}</b><span>species tracked</span></div>
      <div className="stat" style={{ borderColor: "var(--cr)" }}><b>{c.threatened}</b><span>critically endangered or endangered</span></div>
      <div className="stat" style={{ borderColor: "var(--en)" }}><b>{c.open_rescues}</b><span>open rescues</span></div>
      <div className="stat"><b>{c.in_care}</b><span>animals in veterinary care</span></div>
      <div className="stat"><b>{c.pending_sightings}</b><span>sightings awaiting verification</span></div>
    </div>

    <h2>Species population</h2>
    <div className="tablewrap"><table><thead><tr><th>Species</th><th>Status</th><th>Population in protected areas</th><th>Areas</th></tr></thead>
      <tbody>{d.population.map(p => <tr key={p.species_id}><td>{p.common_name}</td><td><Chip s={p.conservation_status} /></td><td>{p.total_population}</td><td>{p.areas_present}</td></tr>)}</tbody></table></div>

    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
      <div><h2>Rescues by status</h2><div className="tablewrap"><Bars rows={d.rescueByStatus} label="status" value="total" /></div></div>
      <div><h2>Verified sightings per month</h2><div className="tablewrap"><Bars rows={d.monthly} label="month" value="individuals" /></div></div>
      <div><h2>Camera trap detections</h2><div className="tablewrap"><Bars rows={d.cameraAgg} label="name" value="individuals" /></div></div>
      <div><h2>Field reports by type</h2><div className="tablewrap"><Bars rows={d.reportAgg} label="_id" value="n" /></div></div>
    </div>

    <h2>Protected area report</h2>
    <div className="tablewrap"><table><thead><tr><th>Area</th><th>Type</th><th>Species</th><th>Population</th><th>Avg. rescue time (h)</th></tr></thead>
      <tbody>{d.areaReport.map(a => <tr key={a.name}><td>{a.name}</td><td>{a.area_type.replace(/_/g, " ").toLowerCase()}</td><td>{a.species_count}</td><td>{a.population}</td><td>{a.avg_rescue_hours}</td></tr>)}</tbody></table></div>

    <h2>Animals in care</h2>
    <div className="tablewrap"><table><thead><tr><th>Tag</th><th>Species</th><th>Center</th><th>Status</th><th>Latest condition</th></tr></thead>
      <tbody>{d.inCare.length ? d.inCare.map(a => <tr key={a.animal_id}><td>{a.tag_code}</td><td>{a.common_name}</td><td>{a.center}</td><td>{a.status}</td><td>{a.latest_condition || "No exam yet"}</td></tr>)
        : <tr><td colSpan={5} className="muted">No animals are in care right now.</td></tr>}</tbody></table></div>
  </>);
}
export default function Page() { return <Suspense><Dash /></Suspense>; }
