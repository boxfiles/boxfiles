import '../app.css';
import { AboveTheFold } from '../components/AboveTheFold';
import { CtaHero } from '../components/CtaHero';
import { HeroAction } from '../components/HeroAction';
import { HeroActions } from '../components/HeroActions';
import { PlanPreview } from '../components/PlanPreview';
import { Site } from '../components/Site';

export default function Page() {
  return (
    <Site>
      <AboveTheFold />

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8 lg:pb-24">
        <CtaHero
          tagline="Ansible-lite for workstations"
          title="Provision machines without ceremony."
          subtitle="Boxfiles turns manifests, modules, facts, and providers into a typed plan you can inspect before it touches a workstation."
        >
          <HeroActions>
            <HeroAction primary href="/quickstart">Start quickstart</HeroAction>
            <HeroAction href="/plugins/authoring">Author a provider</HeroAction>
          </HeroActions>
        </CtaHero>
        <PlanPreview />
      </section>
    </Site>
  );
}
