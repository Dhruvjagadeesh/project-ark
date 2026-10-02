"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const links = [
  ["/dashboard", "Dashboard", null],
  ["/species", "Species", null],
  ["/sightings", "Sightings", null],
  ["/rescues", "Rescues", ["ADMIN", "FOREST_OFFICER", "VET_OFFICER"]],
  ["/animals", "Animal health", ["ADMIN", "FOREST_OFFICER", "VET_OFFICER"]],
  ["/research", "Research", null],
  ["/users", "Users", ["ADMIN"]],
];
const roleName = { ADMIN: "Administrator", FOREST_OFFICER: "Forest officer", RESEARCHER: "Researcher", VET_OFFICER: "Veterinary officer" };

export default function Shell({ children }) {
  const path = usePathname();
  const { data } = useSession();
  if (path === "/login") return children;
  const role = data?.user?.role;
  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">Project Ark<small>Conservation & rescue</small></div>
        {links.filter(l => !l[2] || l[2].includes(role)).map(([href, label]) =>
          <Link key={href} href={href} className={path.startsWith(href) ? "on" : ""}>{label}</Link>)}
        {data && <div className="who">{data.user.name}<br /><span style={{ opacity: .7 }}>{roleName[role]}</span><br />
          <button className="ghost" style={{ color: "#fff", borderColor: "#fff" }} onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button></div>}
      </nav>
      <main>{children}</main>
    </div>
  );
}
