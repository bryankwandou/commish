import type { Metadata } from "next";
import { RoleChooser } from "@/components/role-chooser";

export const metadata: Metadata = { title: "App" };

export default function Page() {
  return <RoleChooser />;
}
