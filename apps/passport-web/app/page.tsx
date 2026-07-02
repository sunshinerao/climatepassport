import { HomeScreen } from "@/components/platform-screens";
import { rootHomePageMetadata } from "@/lib/seo";

export const metadata = rootHomePageMetadata();

export default function HomePage() {
  return <HomeScreen locale="en" />;
}
