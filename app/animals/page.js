"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useData, api, formData, Msg } from "@/components/util";

const CONDITIONS = ["CRITICAL", "POOR", "STABLE", "GOOD", "FIT_FOR_RELEASE"];

export default function Animals() {
  const { data: s } = useSession();
  const vet = ["VET_OFFICER", "ADMIN"].includes(s?.user?.role);
  const [meta] = useData("/api/meta");
  const [rows, reload] = useData("/api/animals");
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [m, setM] = useState(null);

  const open = async (a) => { setSel(a); setDetail(await api("/api/animals?id=" + a.animal_id)); };
  async function run(fn, ok) {
    try { await fn(); setM({ type: "ok", text: ok }); reload(); if (sel) open(sel); }
    catch (x) { setM({ type: "err", text: x.message }); }
  }

  return (<>
    <h1>Animal health and rehabilitation</h1>
    <p className="sub">Release is blocked by the database unless a vet approves it and the latest exam is fit for release.</p>
    <Msg m={m} />
    <div className="tablewrap"><table>
      <thead><tr><th>Tag</th><th>Species</th><th>Sex</th><th>Status</th><th>Center</th><th>Latest condition</th><th></th></tr></thead>
      <tbody>{rows?.map(a => <tr key={a.animal_id}><td>{a.tag_code}</td><td>{a.common_name}</td><td>{a.sex}</td>
        <td>{a.status.replace("_", " ").toLowerCase()}</td><td>{a.center || "—"}</td><td>{a.latest_condition || "No exam yet"}</td>
        <td><button className="ghost" onClick={() => open(a)}>Open record</button></td></tr>)}</tbody>
    </table></div>

    {sel && detail && <div className="panel" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>{sel.tag_code} · {sel.common_name}</h2><button className="ghost" onClick={() => setSel(null)}>Close</button></div>
      <h3>Examinations</h3>
      <div className="tablewrap"><table><thead><tr><th>Date</th><th>Vet</th><th>Diagnosis</th><th>Weight</th><th>Condition</th></tr></thead>
        <tbody>{detail.records.map(r => <tr key={r.record_id}><td>{r.exam_date}</td><td>{r.vet}</td><td>{r.diagnosis}</td><td>{r.weight_kg} kg</td><td>{r.condition_level}</td></tr>)}
          {!detail.records.length && <tr><td colSpan={5} className="muted">No examinations recorded yet.</td></tr>}</tbody></table></div>
      <h3>Treatments</h3>
      <ul>{detail.treatments.map(t => <li key={t.treatment_id}>{t.medication} {t.dosage} from {t.start_date}{t.end_date && ` to ${t.end_date}`}</li>)}{!detail.treatments.length && <li className="muted">None</li>}</ul>
      <h3>Vaccinations</h3>
      <ul>{detail.vaccinations.map(v => <li key={v.vaccination_id}>{v.vaccine_name} on {v.given_on}{v.next_due && `, next due ${v.next_due}`}</li>)}{!detail.vaccinations.length && <li className="muted">None</li>}</ul>

      {vet && <>
        <h3>Record an examination</h3>
        <form className="f" onSubmit={e => { e.preventDefault(); const b = { ...formData(e), animal_id: sel.animal_id }; run(() => api("/api/health", "POST", b).then(() => e.target.reset()), "Examination saved."); }}>
          <label>Exam date<input name="exam_date" type="date" required /></label>
          <label>Condition<select name="condition_level">{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Weight (kg)<input name="weight_kg" type="number" step="0.01" /></label>
          <label>Diagnosis<input name="diagnosis" /></label>
          <label>Medication<input name="medication" /></label>
          <label>Dosage<input name="dosage" /></label>
          <label>Treatment end<input name="end_date" type="date" /></label>
          <label>Vaccine given<input name="vaccine_name" /></label>
          <label>Vaccine next due<input name="next_due" type="date" /></label>
          <button>Save examination</button>
        </form>
        <h3>Change status</h3>
        <div className="row">
          <form className="row" onSubmit={e => { e.preventDefault(); run(() => api("/api/animals", "PATCH", { animal_id: sel.animal_id, status: "UNDER_TREATMENT", center_id: formData(e).center_id }), "Animal admitted."); }}>
            <select name="center_id">{meta?.centers.map(c => <option key={c.center_id} value={c.center_id}>{c.name}</option>)}</select><button className="ghost">Admit to center</button></form>
          <button className="ghost" onClick={() => run(() => api("/api/animals", "PATCH", { animal_id: sel.animal_id, status: "REHABILITATING" }), "Moved to rehabilitation.")}>Start rehabilitation</button>
          <button onClick={() => run(() => api("/api/animals", "PATCH", { animal_id: sel.animal_id, status: "RELEASED" }), "Animal released to the wild.")}>Approve release</button>
        </div>
      </>}
    </div>}
  </>);
}
