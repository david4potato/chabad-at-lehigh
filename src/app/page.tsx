import { getViewer } from "@/lib/auth";

export default async function HomePage() {
  const viewer = await getViewer();
  return <p data-testid="home-placeholder">Home placeholder {viewer ? `signed in as ${viewer.email}` : "(signed out)"}</p>;
}
