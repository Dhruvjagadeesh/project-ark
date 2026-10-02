import "./globals.css";
import Providers from "./providers";
import Shell from "@/components/Shell";
export const metadata = { title: "Project Ark" };
export default function RootLayout({ children }) {
  return (<html lang="en"><body><Providers><Shell>{children}</Shell></Providers></body></html>);
}
