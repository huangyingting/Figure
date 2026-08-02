"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

import { cn, EmptyState } from "@/components/ui";
import type { AnnotatedPart } from "@/lib/contracts";
import { useI18n } from "@/components/i18n-provider";

export function QuizRunner({ figureId, title, parts, imageSrc, persist = true }: { figureId: string; title: string; parts: AnnotatedPart[]; imageSrc?: string; persist?: boolean }) {
  const { t } = useI18n();
  const questions = useMemo(() => parts.filter((part) => part.visible).slice(0, 7).map((part, index, available) => {
    const distractors = available.filter((candidate) => candidate.id !== part.id).sort((a, b) => ((a.id.charCodeAt(0) + index) % 7) - ((b.id.charCodeAt(0) + index) % 7)).slice(0, 3);
    return { part, options: [part, ...distractors].sort((a, b) => ((a.id.length + index) % 5) - ((b.id.length + index) % 5)) };
  }), [parts]);
  const [current, setCurrent] = useState(0); const [selected, setSelected] = useState<string | null>(null); const [answers, setAnswers] = useState<{ partId: string; answer: string; correct: boolean }[]>([]); const [complete, setComplete] = useState(false); const [saveFailed, setSaveFailed] = useState(false);
  const question = questions[current]; const score = answers.filter((answer) => answer.correct).length;
  async function next() {
    if (!selected || !question) return;
    const answer = { partId: question.part.id, answer: selected, correct: selected === question.part.id };
    const nextAnswers = [...answers, answer]; setAnswers(nextAnswers);
    if (current === questions.length - 1) {
      setComplete(true);
      if (persist) {
        try {
          const response = await fetch("/api/quiz-attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ figureId, score: nextAnswers.filter((item) => item.correct).length, total: questions.length, answers: nextAnswers }) });
          setSaveFailed(!response.ok);
        } catch {
          setSaveFailed(true);
        }
      }
    } else { setCurrent((value) => value + 1); setSelected(null); }
  }
  function reset() { setCurrent(0); setSelected(null); setAnswers([]); setComplete(false); setSaveFailed(false); }
  if (!question) return <EmptyState title={t("Not enough visible components")} description={t("This figure cannot generate a quiz yet.")} />;
  if (complete) return (
    <section className="grid min-h-[570px] place-items-center content-center rounded-[18px] border border-line bg-[radial-gradient(circle_at_50%_40%,rgb(255_201_77_/_28%),transparent_16rem),white] p-[50px] text-center">
      <span className="grid h-[52px] w-[52px] place-items-center rounded-[17px] bg-pine-pale text-[23px] text-pine">{score === questions.length ? "✦" : "✓"}</span>
      <p className="mt-[18px] mb-[3px] text-micro font-extrabold uppercase tracking-[0.13em] text-pine-dark">{t("QUIZ COMPLETE")}</p>
      <h2 className="m-0 font-display text-[76px] leading-none tracking-[-0.015em]">{score}/{questions.length}</h2>
      <h3 className="mt-2 mb-5 font-display text-[22px]">{score === questions.length ? t("Perfect visual recall.") : score >= questions.length * .7 ? t("You’re seeing the system.") : t("One more look will make it stick.")}</h3>
      <div className="h-[6px] w-[260px] overflow-hidden rounded-full bg-[#e7e0cc]"><i className="block h-full bg-[linear-gradient(90deg,var(--color-pine),var(--color-marigold))]" style={{ width: `${score / questions.length * 100}%` }} /></div>
      {saveFailed && <p className="mt-4 rounded-[9px] border border-[rgba(220,38,38,0.28)] bg-[rgba(220,38,38,0.06)] px-[13px] py-[9px] text-micro font-semibold text-[#dc2626]" role="alert">{t("We couldn’t save this attempt. Your mastery history may not update.")}</p>}
      <button type="button" className="mt-[23px] flex min-h-[44px] items-center gap-[7px] rounded-lg bg-ink px-4 text-meta font-bold text-white cursor-pointer" onClick={reset}><RotateCcw size={16} />{t("Try again")}</button>
    </section>
  );
  return (
    <section className="overflow-hidden rounded-[18px] border border-line-dark bg-paper shadow-[0_25px_70px_rgb(35_33_27_/_8%)]">
      <header className="flex items-center justify-between border-b border-line px-[25px] py-[21px]">
        <div>
          <p className="m-0 text-micro font-extrabold uppercase tracking-[0.13em] text-pine-dark">{t("VISUAL RECALL")}</p>
          <h2 className="mt-[5px] mb-0 font-display text-[23px] font-[560] tracking-[-0.015em]">{title}</h2>
        </div>
        <span className="shrink-0 self-start whitespace-nowrap font-display text-[15px] font-bold">{String(current + 1).padStart(2, "0")} <i className="mx-1 not-italic text-muted-2">/</i> {String(questions.length).padStart(2, "0")}</span>
      </header>
      <div className="h-[3px] bg-[#efe8d6]"><i className="block h-full bg-pine transition-[width] duration-300" style={{ width: `${current / questions.length * 100}%` }} /></div>
      <div className="grid min-h-[510px] grid-cols-1 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="relative grid min-h-[310px] place-items-center bg-[radial-gradient(circle_at_50%_50%,white,transparent_45%),#ece6d5] p-[18px] xl:min-h-0 xl:p-[35px]">
          <img src={imageSrc ?? `/api/figures/${figureId}/image`} alt="" className="max-h-[440px] w-full rounded-[11px] object-contain saturate-[.72]" />
          <span className="absolute bottom-5 left-[22px] rounded-md bg-ink px-[9px] py-[6px] text-micro font-extrabold uppercase text-white">{t("Look closely")}</span>
        </div>
        <div className="p-[25px_19px] xl:p-[39px]">
          <p className="m-0 text-micro font-extrabold uppercase tracking-[0.13em] text-pine-dark">{t("WHICH COMPONENT IS THIS?")}</p>
          <h3 className="mt-[9px] mb-[22px] font-display text-[22px] font-[530] leading-[1.35] tracking-[-0.015em]">{question.part.description}</h3>
          <div className="grid gap-2">{question.options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              disabled={selected !== null}
              data-selected={selected === option.id}
              data-correct={selected !== null && option.id === question.part.id}
              onClick={() => setSelected(option.id)}
              className="grid min-h-[48px] grid-cols-[28px_1fr_auto] items-center gap-[10px] rounded-[9px] border border-line bg-[#fbf7ec] px-3 py-[5px] text-left text-body font-[650] text-ink-2 cursor-pointer disabled:cursor-default data-[selected=true]:border-pine data-[selected=true]:bg-pine-pale data-[selected=true]:text-pine-dark data-[correct=true]:border-green data-[correct=true]:bg-[#e7f8f1] data-[correct=true]:text-[#176d53] [&_svg]:w-4"
            >
              <span className={cn(
                "grid h-[27px] w-[27px] place-items-center rounded-[7px] bg-paper text-micro text-muted",
                selected === option.id && "bg-pine text-white",
                selected !== null && option.id === question.part.id && "bg-green text-white",
              )}>{String.fromCharCode(65 + index)}</span>
              {option.name}
              {selected !== null && option.id === question.part.id && <Check />}
              {selected === option.id && option.id !== question.part.id && <X />}
            </button>
          ))}</div>
          <button
            type="button"
            className="mt-5 flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-ink px-[17px] text-ui font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:bg-[#e7e0cc] disabled:text-muted-2"
            disabled={!selected}
            onClick={() => void next()}
          >{current === questions.length - 1 ? t("See results") : t("Next question")}<ArrowRight size={17} /></button>
        </div>
      </div>
    </section>
  );
}
