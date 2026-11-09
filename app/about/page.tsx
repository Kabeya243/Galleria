import type { Metadata } from "next";
import AboutPage from "@/components/about-page";

export const metadata: Metadata = {
  title: "About — Lakisa",
  description:
    "What Lakisa does: virtual exhibition rooms where artists build, hang and share their work — free to visit, from anywhere.",
};

export default function About() {
  return <AboutPage />;
}
