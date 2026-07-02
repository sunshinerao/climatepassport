import { HomeScreen } from "@/components/platform-screens";
import { homePageMetadata } from "@/lib/seo";

export const metadata = homePageMetadata("en");

export default function HomePage() {
  return <HomeScreen locale="en" />;
}
