import {
  ArrowRight,
  BookOpenCheck,
  Coins,
  FolderHeart,
  Shapes,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { FigureCard } from "@/components/figure-card";
import { Button, EmptyState } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const promptIdeas = [
  "Anatomy of a volcano",
  "Inside a mechanical watch",
  "How a wind turbine works",
];

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) {
    return (
      <DashboardHome
        userId={session.user.id}
        name={session.user.name}
        email={session.user.email}
        credits={session.user.credits}
      />
    );
  }
  return <MarketingHome />;
}

/* ------------------------------------------------------------------ *
 * Signed-in home: a workspace, not a pitch. The quick-create prompt is
 * the hero; stats and recent work support it.
 * ------------------------------------------------------------------ */

function StatTile({
  href,
  icon: Icon,
  label,
  value,
  hint,
  meter,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  meter?: number;
}) {
  return (
    <Link
      href={href}
      className="group grid content-start gap-[6px] rounded-2xl border border-line bg-paper p-[18px] no-underline shadow-card transition-[border-color,box-shadow] duration-150 hover:border-[#b5d0be] hover:shadow-lift"
    >
      <span className="flex items-center gap-2 text-micro font-extrabold uppercase tracking-[0.1em] text-muted">
        <Icon size={14} className="text-pine" />
        {label}
      </span>
      <strong className="font-display text-[38px] font-[560] leading-none tracking-[-0.015em] text-ink">{value}</strong>
      {typeof meter === "number" && (
        <span className="mt-1 block h-[5px] overflow-hidden rounded-full bg-[#eae4d2]">
          <i className="block h-full rounded-[inherit] bg-pine" style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
        </span>
      )}
      <small className="text-micro font-semibold text-muted-2 group-hover:text-pine-dark">{hint} →</small>
    </Link>
  );
}

async function DashboardHome({
  userId,
  name,
  email,
  credits,
}: {
  userId: string;
  name?: string | null;
  email?: string | null;
  credits: number;
}) {
  const [figureCount, collectionCount, recentFigures, attempts] = await Promise.all([
    prisma.figure.count({ where: { ownerId: userId } }),
    prisma.collection.count({ where: { ownerId: userId } }),
    prisma.figure.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, subject: true, summary: true, imageModel: true, viewCount: true, createdAt: true, owner: { select: { name: true, image: true } }, _count: { select: { collections: true, quizAttempts: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { score: true, total: true },
    }),
  ]);
  const mastery = attempts.length
    ? Math.round((attempts.reduce((sum, item) => sum + (item.total ? item.score / item.total : 0), 0) / attempts.length) * 100)
    : null;
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-screen bg-shell">
      <AppHeader user={{ name, email, credits }} />
      <main className="frame min-h-[60vh] pt-10 pb-16">
        <p className="eyebrow m-0 mb-[10px]">
          <Sparkles size={14} /> YOUR STUDIO
        </p>
        <h1 className="m-0 mb-7 font-display text-[clamp(32px,3.4vw,46px)] font-[560] leading-[1.08] tracking-[-0.015em]">
          Welcome back{firstName ? `, ${firstName}` : ""}.{" "}
          <em className="not-italic text-pine-dark">What will you explain today?</em>
        </h1>

        <form
          action="/studio"
          className="rounded-[20px] border border-line-dark bg-paper px-[18px] pb-[14px] pt-[18px] shadow-[0_24px_70px_rgb(96_82_46/10%),inset_0_-7px_var(--color-marigold)]"
        >
          <div className="grid min-h-[80px] grid-cols-[auto_1fr] items-center gap-[13px] rounded-2xl border border-line-dark bg-[#fbf7ec] py-[10px] pl-[18px] pr-[10px] transition-[border-color,box-shadow] duration-150 focus-within:border-pine focus-within:shadow-[0_0_0_4px_rgb(28_107_82/9%)] sm:grid-cols-[auto_1fr_auto]">
            <span className="text-[22px] text-pine" aria-hidden="true">✦</span>
            <input
              name="subject"
              maxLength={240}
              aria-label="Topic to explain"
              placeholder="e.g. Inside a mechanical watch"
              className="w-full border-0 bg-transparent font-display text-[clamp(18px,2.1vw,24px)] font-[520] tracking-[-0.01em] text-ink outline-none placeholder:text-muted-2"
            />
            <Button type="submit" size="lg" className="col-span-2 sm:col-span-1">
              Generate <ArrowRight size={17} />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-[7px] px-[5px] pt-3" aria-label="Example topics">
            <span className="mr-[3px] text-micro font-bold uppercase text-muted">Try</span>
            {promptIdeas.map((idea) => (
              <Link
                key={idea}
                href={`/studio?subject=${encodeURIComponent(idea)}`}
                className="min-h-[34px] content-center rounded-full border border-line bg-paper px-3 py-1 text-meta text-muted no-underline hover:border-pine hover:text-pine"
              >
                {idea}
              </Link>
            ))}
          </div>
        </form>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile href="/credits" icon={Coins} label="Credits left" value={String(credits)} hint="1 credit per figure" />
          <StatTile href="/library" icon={Shapes} label="Figures created" value={String(figureCount)} hint="Open library" />
          <StatTile href="/collections" icon={FolderHeart} label="Collections" value={String(collectionCount)} hint="Open collections" />
          <StatTile
            href="/quiz"
            icon={BookOpenCheck}
            label="Recent mastery"
            value={mastery === null ? "—" : `${mastery}%`}
            hint={mastery === null ? "Take a quiz" : "Open quiz lab"}
            meter={mastery === null ? undefined : mastery}
          />
        </div>

        <section className="mt-11">
          <header className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="m-0 font-display text-[26px] font-[560] tracking-[-0.015em]">Recent figures</h2>
            {figureCount > 0 && (
              <Link href="/library" className="text-meta font-bold text-pine-dark no-underline hover:underline">
                View all →
              </Link>
            )}
          </header>
          {recentFigures.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentFigures.map((figure, index) => (
                <FigureCard key={figure.id} figure={figure} tone={["pine", "blue", "coral", "marigold"][index % 4]} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="✦"
              title="Your first figure is one prompt away."
              description="Type a topic above — Figure plans the parts, renders the image, and grounds every callout to pixels."
            />
          )}
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Signed-out home: an editorial pitch with one job — explain the value
 * and funnel visitors to either the register page or the live demo.
 * ------------------------------------------------------------------ */

const steps = [
  {
    number: "01",
    title: "Ask in plain words.",
    copy: "Type any topic. Figure plans the essential components, renders a clean image, and pins every callout to visible pixels.",
  },
  {
    number: "02",
    title: "Explore and collect.",
    copy: "Every figure is interactive — click a marker, read the part, save what matters into collections you curate.",
  },
  {
    number: "03",
    title: "Quiz until it sticks.",
    copy: "Each annotated component becomes a visual recall question, so looking turns into knowing.",
  },
];

function MarketingHome() {
  return (
    <div className="min-h-screen bg-shell">
      <AppHeader user={null} />
      <main className="overflow-hidden">
        <section className="frame pt-16 pb-10 text-center">
          <p className="eyebrow justify-center">
            <Sparkles size={14} /> THE VISUAL LEARNING STUDIO
          </p>
          <h1 className="mx-auto mt-5 mb-6 max-w-[900px] font-display text-[clamp(52px,7.2vw,96px)] font-[560] leading-[1.02] tracking-[-0.02em]">
            Don’t just read it.
            <br />
            <em className="highlight-sweep">See how it works.</em>
          </h1>
          <p className="mx-auto m-0 max-w-[640px] text-[18px] leading-[1.65] text-muted">
            Figure turns any topic into a beautifully annotated diagram — then helps you
            collect, revisit, and quiz what you’ve seen.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="px-8 shadow-[0_14px_32px_rgb(18_74_56/25%)]">
              <Link href="/register">
                Start free with 12 credits <ArrowRight size={17} />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/studio">Watch the live demo</Link>
            </Button>
          </div>
          <small className="mt-4 block text-meta text-muted-2">
            No card required · Browse the <Link href="/discover" className="font-semibold text-pine-dark">gallery</Link> as a guest
          </small>
        </section>

        <section className="frame pb-16" aria-label="Annotated figure example">
          <div className="relative mx-auto w-[min(880px,100%)]">
            <div className="rotate-[0.8deg] overflow-hidden rounded-[24px] border border-line-dark bg-paper p-[14px] shadow-[0_40px_100px_rgb(96_82_46/16%)]">
              <Image
                className="block w-full rounded-[14px] bg-[#eef0e6]"
                src="/demo-pump.png"
                alt="Annotated centrifugal pump cutaway"
                width={1536}
                height={1024}
                priority
              />
              <span className="absolute left-[25%] top-[44%] grid h-8 w-8 place-items-center rounded-full border-4 border-paper bg-pine font-display text-[13px] font-bold text-white shadow-[0_5px_16px_rgb(18_74_56/35%)]">1</span>
              <span className="absolute left-[42%] top-[48%] grid h-8 w-8 place-items-center rounded-full border-4 border-paper bg-pine font-display text-[13px] font-bold text-white shadow-[0_5px_16px_rgb(18_74_56/35%)]">2</span>
              <span className="absolute left-[65%] top-[47%] grid h-8 w-8 place-items-center rounded-full border-4 border-paper bg-pine font-display text-[13px] font-bold text-white shadow-[0_5px_16px_rgb(18_74_56/35%)]">3</span>
            </div>
            <div className="absolute -left-2 bottom-[70px] z-[2] hidden items-center gap-[10px] rounded-2xl border border-line bg-paper/95 px-4 py-3 shadow-[0_14px_35px_rgb(60_52_30/14%)] backdrop-blur-md sm:flex">
              <i className="grid h-8 w-8 place-items-center rounded-[10px] bg-pine font-display text-micro font-bold text-white">02</i>
              <span className="grid">
                <strong className="text-ui">Impeller</strong>
                <small className="text-micro text-muted">Turns motion into fluid pressure</small>
              </span>
            </div>
            <div className="absolute -right-2 top-[64px] z-[2] hidden items-center gap-[10px] rounded-2xl border border-line bg-paper/95 px-4 py-3 shadow-[0_14px_35px_rgb(60_52_30/14%)] backdrop-blur-md sm:flex">
              <i className="grid h-8 w-8 place-items-center rounded-[10px] bg-marigold text-[13px] font-extrabold not-italic text-ink">✓</i>
              <span className="grid">
                <strong className="text-ui">Mastered</strong>
                <small className="text-micro text-muted">7 of 7 components</small>
              </span>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-paper py-16">
          <div className="frame">
            <p className="eyebrow m-0 mb-9">ONE FIGURE, THREE WAYS TO LEARN</p>
            <div className="grid gap-10 md:grid-cols-3 md:gap-8">
              {steps.map((step) => (
                <article key={step.number} className="border-t-2 border-ink pt-5">
                  <p className="m-0 font-display text-[44px] font-[560] leading-none text-pine-dark">
                    {step.number}
                    <span className="ml-1 inline-block h-[10px] w-[10px] rounded-full bg-marigold" aria-hidden="true" />
                  </p>
                  <h2 className="mt-4 mb-3 font-display text-[27px] font-[560] tracking-[-0.015em]">{step.title}</h2>
                  <p className="m-0 text-body leading-[1.7] text-muted">{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="frame py-16 text-center">
          <h2 className="mx-auto m-0 max-w-[620px] font-display text-[clamp(32px,3.6vw,46px)] font-[560] leading-[1.1] tracking-[-0.015em]">
            Start your <em className="highlight-sweep">visual atlas</em> today.
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="px-8">
              <Link href="/register">Create your free account</Link>
            </Button>
          </div>
          <small className="mt-4 block text-meta text-muted-2">
            Already have one? <Link href="/signin" className="font-semibold text-pine-dark">Sign in</Link>
          </small>
        </section>
      </main>
    </div>
  );
}
