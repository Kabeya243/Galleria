import { redirect } from "next/navigation";

// The Admin is one single page now — the artworks table lives on /admin.
export default function AdminArtworksRedirect() {
  redirect("/admin#artworks");
}
