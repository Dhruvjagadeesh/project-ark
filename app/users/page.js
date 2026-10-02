"use client";
import { useState } from "react";
import { useData, api, formData, Msg } from "@/components/util";

export default function Users() {
  const [rows, reload] = useData("/api/users");
  const [m, setM] = useState(null);
  const run = async (fn, ok) => { try { await fn(); setM({ type: "ok", text: ok }); reload(); } catch (x) { setM({ type: "err", text: x.message }); } };
  return (<>
    <h1>Users</h1>
    <p className="sub">Passwords are stored as bcrypt hashes. Deactivated users cannot sign in.</p>
    <Msg m={m} />
    <div className="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead>
      <tbody>{rows?.map(u => <tr key={u.user_id}><td>{u.full_name}</td><td>{u.email}</td><td>{u.role.replace("_", " ").toLowerCase()}</td><td>{u.is_active ? "Yes" : "No"}</td>
        <td><button className="ghost" onClick={() => run(() => api("/api/users", "PATCH", { user_id: u.user_id, is_active: !u.is_active }), u.is_active ? "User deactivated." : "User activated.")}>{u.is_active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>
    <h2>Register a user</h2>
    <form className="f panel" onSubmit={e => { e.preventDefault(); const b = formData(e); run(() => api("/api/users", "POST", b).then(() => e.target.reset()), "User registered."); }}>
      <label>Full name<input name="full_name" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Role<select name="role"><option value="FOREST_OFFICER">Forest officer</option><option value="RESEARCHER">Researcher</option><option value="VET_OFFICER">Veterinary officer</option><option value="ADMIN">Administrator</option></select></label>
      <label>Phone<input name="phone" /></label>
      <label>Password<input name="password" type="password" minLength={8} required /></label>
      <button>Register user</button>
    </form>
  </>);
}
