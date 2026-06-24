import '../app.css';
import { AboveTheFold } from '../components/AboveTheFold';
import { CtaHero } from '../components/CtaHero';
import { HeroAction } from '../components/HeroAction';
import { HeroActions } from '../components/HeroActions';
import { PlanPreview } from '../components/PlanPreview';
import { Site } from '../components/Site';
import { Section } from '../components/Section';
import { Hero } from '../components/Hero';
import { CopyTextToClipboard } from '../components/CopyTextToClipboard';

export default function Page() {
  return (
    <Site>
      <Section>
        <Hero>
          <h1 className="text-2xl">.boxfiles</h1>
        </Hero>
      </Section>
      <Section>
        <CtaHero
          title="Provision machines without ceremony."
          subtitle="Boxfiles turns manifests of steps and facts into a idompotent plan you can inspect before it touches a workstation."
        >
          <HeroActions>
            <HeroAction asChild><CopyTextToClipboard text="npm install -g @boxfiles/cli" /></HeroAction>
            <HeroAction primary asChild><a href="/quickstart">Get started</a></HeroAction>
          </HeroActions>
        </CtaHero>
        <PlanPreview />
      </Section>
      <AboveTheFold />
    </Site>
  );
}


