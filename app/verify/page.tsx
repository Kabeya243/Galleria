import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyPage from "@/components/verify-page";

export const metadata: Metadata = {
  title: "Verify a certificate: Lakisa",
  description:
    "Check a Lakisa certificate of authenticity online: enter its ID or scan its QR code and see whether it is registered.",
};

export default function Verify() {
  return (
    <Suspense>
      <VerifyPage />
    </Suspense>
  );
}
