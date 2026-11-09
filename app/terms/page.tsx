import type { Metadata } from "next";
import TermsPage from "@/components/terms-page";

export const metadata: Metadata = {
  title: "Terms of Use — Lakisa",
  description:
    "The rules that govern using Lakisa: accounts, your content and your rights in it, public and private exhibitions, and liability.",
};

export default function Terms() {
  return <TermsPage />;
}
