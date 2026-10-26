import { Gate } from "@/components/Gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Gate>{children}</Gate>;
}
