import type { Metadata } from "next";
import PrivacyPage from "@/components/privacy-page";

export const metadata: Metadata = {
  title: "Privacy Policy: Lakisa",
  description:
    "What data Lakisa collects, why, who else handles it, how long it is kept, and what you can do about it.",
};

export default function Privacy() {
  return <PrivacyPage />;
}
