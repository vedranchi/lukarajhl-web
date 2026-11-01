import { SiteNav } from "@/components/site/SiteNav";
import { Hero } from "@/components/site/Hero";
import { SectionCue } from "@/components/site/SectionCue";
import { IpodSection } from "@/components/site/IpodSection";
import { KitsSection } from "@/components/site/KitsSection";
import { InnerCircle } from "@/components/site/InnerCircle";
import { SpotifySection } from "@/components/site/SpotifySection";
import { ChannelsSection } from "@/components/site/ChannelsSection";
import { PlayerDock } from "@/components/site/PlayerDock";
import { beatstarsStore } from "@/data/content";
import type { Metadata } from "next";

// Page-level, not in the root layout, so routes that don't set their own
// canonical (the 404 page, any future page) don't inherit "/" as theirs.
export const metadata: Metadata = { alternates: { canonical: "/" } };

const YEAR = new Date().getFullYear(); // module scope: Date in render trips react-hooks/purity

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="top">
        <Hero />
        <SectionCue label="Explore" />
        <ChannelsSection />
        <IpodSection />
        <KitsSection />
        <InnerCircle />
        <SpotifySection />
        <footer className="footer shell">
          <span>© {YEAR} Luka Rajhl</span>
          <a href={beatstarsStore} target="_blank" rel="noopener noreferrer">
            Licensing on BeatStars ↗
          </a>
        </footer>
      </main>
      <PlayerDock />
    </>
  );
}
