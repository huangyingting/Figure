import { ArrowRight, BookOpenCheck, FolderHeart, MousePointer2, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { AppHeader } from "@/components/app-header";
import { headerUser } from "@/components/product-shell";
import { Button } from "@/components/ui";

export default async function Home() {
  const user = await headerUser();
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_79%_23%,rgb(101_87_232/13%),transparent_29rem),radial-gradient(circle_at_71%_16%,rgb(217_255_112/14%),transparent_18rem),#f8f7f2]">
      <AppHeader user={user} />
      <main className="min-h-screen overflow-hidden">
        <section className="frame grid items-center gap-12 pt-12 pb-16 min-[1100px]:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">
              <Sparkles size={14} /> The visual learning studio
            </p>
            <h1 className="m-0 mt-4 mb-5 font-display text-[clamp(52px,5.4vw,80px)] font-[480] leading-[0.93] tracking-[-0.075em]">
              Don’t just read it.
              <br />
              <em className="relative whitespace-nowrap not-italic text-violet after:absolute after:-z-10 after:-inset-x-[7px] after:bottom-[5px] after:h-4 after:-rotate-1 after:bg-acid after:content-['']">
                See how it works.
              </em>
            </h1>
            <span className="block max-w-[600px] text-[16px] leading-[1.65] text-muted">
              Generate rich annotated figures, organize what you discover, and turn every component into a quiz you can
              master.
            </span>
            <div className="mt-[29px] flex gap-[10px]">
              <Button asChild size="lg" className="shadow-[0_14px_32px_rgb(23_24_29/17%)]">
                <Link href="/studio">
                  Create your first figure <ArrowRight size={17} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white/55">
                <Link href="/discover">Explore the gallery</Link>
              </Button>
            </div>
            <small className="mt-[13px] block text-micro text-muted-2">
              12 free generation credits · No card required
            </small>
          </div>

          <div className="relative grid min-h-[520px] place-items-center">
            <div className="absolute h-[420px] w-[620px] -rotate-[11deg] rounded-full border border-dashed border-[rgb(101_87_232/25%)]" />
            <div className="absolute h-[570px] w-[470px] rotate-[26deg] rounded-full border border-dashed border-[rgb(101_87_232/25%)]" />
            <div className="relative z-[2] w-[min(650px,88%)] rotate-[1.5deg] overflow-hidden rounded-[20px] border border-line-dark bg-white p-[13px] shadow-[0_40px_100px_rgb(39_32_91/18%)]">
              <Image
                className="block w-full rounded-[12px] bg-[#edf3f2]"
                src="/demo-pump.svg"
                alt="Annotated centrifugal pump cutaway"
                width={1440}
                height={960}
                priority
              />
              <span className="absolute left-[36%] top-[37%] grid h-7 w-7 place-items-center rounded-full border-4 border-white bg-violet text-micro font-extrabold text-white shadow-[0_5px_16px_rgb(30_25_84/35%)]">
                1
              </span>
              <span className="absolute left-[43%] top-[59%] grid h-7 w-7 place-items-center rounded-full border-4 border-white bg-violet text-micro font-extrabold text-white shadow-[0_5px_16px_rgb(30_25_84/35%)]">
                2
              </span>
              <span className="absolute right-[24%] top-[55%] grid h-7 w-7 place-items-center rounded-full border-4 border-white bg-violet text-micro font-extrabold text-white shadow-[0_5px_16px_rgb(30_25_84/35%)]">
                3
              </span>
            </div>
            <div className="absolute -left-1 bottom-[85px] z-[4] flex items-center gap-[10px] rounded-[11px] border border-line bg-white/90 px-[14px] py-[11px] shadow-[0_14px_35px_rgb(23_24_29/13%)] backdrop-blur-md">
              <i className="grid h-7 w-7 place-items-center rounded-[8px] bg-violet text-[9px] font-extrabold not-italic text-white">
                02
              </i>
              <span className="grid">
                <strong className="text-meta">Impeller</strong>
                <small className="text-micro text-muted">Turns motion into fluid pressure</small>
              </span>
            </div>
            <div className="absolute -right-[3px] top-[83px] z-[4] flex items-center gap-[10px] rounded-[11px] border border-line bg-white/90 px-[14px] py-[11px] shadow-[0_14px_35px_rgb(23_24_29/13%)] backdrop-blur-md">
              <i className="grid h-7 w-7 place-items-center rounded-[8px] bg-acid text-[9px] font-extrabold not-italic text-ink">
                ✓
              </i>
              <span className="grid">
                <strong className="text-meta">Mastered</strong>
                <small className="text-micro text-muted">7 of 7 components</small>
              </span>
            </div>
          </div>
        </section>

        <section className="bg-ink py-[60px] text-white [padding-inline:max(32px,calc((100vw-1360px)/2))]">
          <p className="mb-6 text-micro font-[750] uppercase tracking-[0.14em] text-[#92949c]">
            One figure. Three ways to learn.
          </p>
          <div className="grid gap-px bg-[#393a40] min-[1100px]:grid-cols-3">
            <article className="bg-ink p-[30px]">
              <span className="mb-6 grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-[#27282e] text-acid">
                <MousePointer2 />
              </span>
              <p className="text-micro font-extrabold tracking-[0.13em]">01 / CREATE</p>
              <h2 className="mt-2 mb-3 font-display text-[26px] font-[520] tracking-[-0.04em]">
                Ideas become interactive.
              </h2>
              <small className="text-ui leading-[1.7] text-[#aaaab1]">
                Figure separates beautiful imagery from editable, pixel-grounded knowledge.
              </small>
            </article>
            <article className="bg-ink p-[30px]">
              <span className="mb-6 grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-[#27282e] text-acid">
                <FolderHeart />
              </span>
              <p className="text-micro font-extrabold tracking-[0.13em]">02 / COLLECT</p>
              <h2 className="mt-2 mb-3 font-display text-[26px] font-[520] tracking-[-0.04em]">
                Your curiosity, organized.
              </h2>
              <small className="text-ui leading-[1.7] text-[#aaaab1]">
                Build focused collections and return to every visual you create or discover.
              </small>
            </article>
            <article className="bg-ink p-[30px]">
              <span className="mb-6 grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-[#27282e] text-acid">
                <BookOpenCheck />
              </span>
              <p className="text-micro font-extrabold tracking-[0.13em]">03 / MASTER</p>
              <h2 className="mt-2 mb-3 font-display text-[26px] font-[520] tracking-[-0.04em]">
                Turn looking into knowing.
              </h2>
              <small className="text-ui leading-[1.7] text-[#aaaab1]">
                Component-level quizzes make every figure an active learning experience.
              </small>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
