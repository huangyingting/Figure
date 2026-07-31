import { ArrowRight, BookOpenCheck, FolderHeart, MousePointer2, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { AppHeader } from "@/components/app-header";

export default function Home() {
  return (
    <div className="fx-app marketing-shell">
      <AppHeader />
      <main className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <p><Sparkles size={14} /> THE VISUAL LEARNING STUDIO</p>
          <h1>Don’t just read it.<br /><em>See how it works.</em></h1>
          <span>Generate rich annotated figures, organize what you discover, and turn every component into a quiz you can master.</span>
          <div><Link className="hero-primary" href="/studio">Create your first figure <ArrowRight size={17} /></Link><Link className="hero-secondary" href="/discover">Explore the gallery</Link></div>
          <small>12 free generation credits · No card required</small>
        </div>
        <div className="marketing-visual">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="visual-card">
            <Image src="/demo-pump.svg" alt="Annotated centrifugal pump cutaway" width={1440} height={960} priority />
            <span className="visual-pin pin-one">1</span><span className="visual-pin pin-two">2</span><span className="visual-pin pin-three">3</span>
          </div>
          <div className="floating-note note-one"><i>02</i><span><strong>Impeller</strong><small>Turns motion into fluid pressure</small></span></div>
          <div className="floating-note note-two"><i>✓</i><span><strong>Mastered</strong><small>7 of 7 components</small></span></div>
        </div>
      </section>

      <section className="marketing-proof">
        <p>One figure. Three ways to learn.</p>
        <div>
          <article><span><MousePointer2 /></span><p>01 / CREATE</p><h2>Ideas become interactive.</h2><small>Figure separates beautiful imagery from editable, pixel-grounded knowledge.</small></article>
          <article><span><FolderHeart /></span><p>02 / COLLECT</p><h2>Your curiosity, organized.</h2><small>Build focused collections and return to every visual you create or discover.</small></article>
          <article><span><BookOpenCheck /></span><p>03 / MASTER</p><h2>Turn looking into knowing.</h2><small>Component-level quizzes make every figure an active learning experience.</small></article>
        </div>
      </section>
    </main>
    </div>
  );
}
