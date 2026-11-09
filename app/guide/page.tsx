import type { Metadata } from "next";
import GuidePage from "@/components/guide-page";

export const metadata: Metadata = {
  title: "User guide — Lakisa",
  description:
    "How to use Lakisa, step by step: create an account, build an exhibition, hang artworks, choose a room, share it, and visit one. In English and French.",
};

export default function Guide() {
  return <GuidePage />;
}
