import type { Metadata } from "next";
import PricingPage from "@/components/pricing-page";

export const metadata: Metadata = {
  title: "Pricing: Lakisa",
  description:
    "Lakisa plans: Discovery is free, Creator and Studio unlock every tool. Everything is free to try for now, no card, no payment.",
};

export default function Pricing() {
  return <PricingPage />;
}
