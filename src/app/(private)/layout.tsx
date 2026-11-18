import { MummaaShell } from "@/components/mumaa-shell";

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <MummaaShell>{children}</MummaaShell>;
}
