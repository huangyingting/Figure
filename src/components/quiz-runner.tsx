"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { cn, EmptyState } from "@/components/ui";
import type { AnnotatedPart } from "@/lib/contracts";
import { useI18n } from "@/components/i18n-provider";
import { mutationRequest } from "@/components/mutation-request";

function optionOrder(questionId: string, optionId: string): number {
  let hash = 2166136261;
  for (const character of `${questionId}:${optionId}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

export function QuizRunner({ figureId, title, parts, imageSrc, persist = true }: { figureId: string; title: string; parts: AnnotatedPart[]; imageSrc?: string; persist?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const questions = useMemo(() => parts.filter((part) => part.visible).slice(0, 7).map((part, index, available) => {
    const names = new Set([part.name.trim().toLowerCase()]);
    const distractors = available.filter((candidate) => {
      const name = candidate.name.trim().toLowerCase();
      if (names.has(name)) return false;
      names.add(name);
      return true;
    }).sort((a, b) => ((a.id.charCodeAt(0) + index) % 7) - ((b.id.charCodeAt(0) + index) % 7)).slice(0, 3);
    return { part, options: [part, ...distractors].sort((a, b) => optionOrder(part.id, a.id) - optionOrder(part.id, b.id)) };
  }), [parts]);
  const [current, setCurrent] = useState(0); const [selected, setSelected] = useState<string | null>(null); const [answers, setAnswers] = useState<{ partId: string; answer: string; correct: boolean }[]>([]); const [complete, setComplete] = useState(false); const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const advancing = useRef(false);
  const question = questions[current]; const score = answers.filter((answer) => answer.correct).length;
  async function saveAttempt(nextAnswers: typeof answers) {
    setSaving(true);
    setSaveFailed(false);
    const response = await mutationRequest("/api/quiz-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ figureId, answers: nextAnswers.map(({ partId, answer }) => ({ partId, answer })) }),
    });
    setSaving(false);
    setSaveFailed(!response.ok);
    if (response.ok) router.refresh();
  }
  async function next() {
    if (!selected || !question || advancing.current) return;
    advancing.current = true;
    const answer = { partId: question.part.id, answer: selected, correct: selected === question.part.id };
    const nextAnswers = [...answers, answer]; setAnswers(nextAnswers);
    if (current === questions.length - 1) {
      setComplete(true);
      if (persist) await saveAttempt(nextAnswers);
    } else { setCurrent((value) => value + 1); setSelected(null); }
    advancing.current = false;
  }
  function reset() { if (saving) return; setCurrent(0); setSelected(null); setAnswers([]); setComplete(false); setSaveFailed(false); advancing.current = false; }
  if (!question) return <EmptyState title={t("Not enough visible components")} description={t("This figure cannot generate a quiz yet.")} />;
  if (complete) return (
    <section className="grid min-h-[570px] place-items-center content-center rounded-[18px] border border-line bg-[radial-gradient(circle_at_50%_40%,rgb(255_201_77_/_28%),transparent_16rem),white] p-[50px] text-center">
      <span className="grid h-[52px] w-[52px] place-items-center rounded-[17px] bg-pine-pale text-[23px] text-pine">{score === questions.length ? "✦" : "✓"}</span>
      <p className="mt-[18px] mb-[3px] text-micro font-extrabold uppercase tracking-[0.13em] text-pine-dark">{t("QUIZ COMPLETE")}</p>
      <h2 className="m-0 font-display text-[76px] leading-none tracking-[-0.015em]">{score}/{questions.length}</h2>
      <h3 className="mt-2 mb-5 font-display text-[22px]">{score === questions.length ? t("Perfect visual recall.") : score >= questions.length * .7 ? t("You’re seeing the system.") : t("One more look will make it stick.")}</h3>
      <div className="h-[6px] w-[260px] overflow-hidden rounded-full bg-[#e7e0cc]"><i className="block h-full bg-[linear-gradient(90deg,var(--color-pine),var(--color-marigold))]" style={{ width: `${score / questions.length * 100}%` }} /></div>
      {saveFailed && <p className="mt-4 rounded-[9px] border border-[rgba(220,38,38,0.28)] bg-[rgba(220,38,38,0.06)] px-[13px] py-[9px] text-micro font-semibold text-[#dc2626]" role="alert">{t("We couldn’t save this attempt. Your mastery history may not update.")}</p>}
      {saving && <p role="status" className="mt-4 text-meta text-muted">{t("Saving attempt…")}</p>}
      {saveFailed && <button type="button" className="mt-3 min-h-[44px] rounded-lg border border-line-dark px-4 text-meta font-bold" onClick={() => void saveAttempt(answers)} disabled={saving}>{t("Try saving again")}</button>}
      <button type="button" disabled={saving} className="mt-[23px] flex min-h-[44px] items-center gap-[7px] rounded-lg bg-ink px-4 text-meta font-bold text-white cursor-pointer disabled:opacity-60" onClick={reset}><RotateCcw size={16} />{t("Try again")}</button>
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
          <h3 aria-live="polite" className="mt-[9px] mb-[22px] font-display text-[22px] font-[530] leading-[1.35] tracking-[-0.015em]">{question.part.description}</h3>
          <div className="grid gap-2">{question.options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              disabled={selected !== null}
              aria-pressed={selected === option.id}
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
          <p role="status" className="mt-4 min-h-[24px] text-ui font-bold text-pine-dark">
            {selected !== null && (selected === question.part.id
              ? t("Correct!")
              : `${t("Incorrect. Correct answer:")} ${question.part.name}`)}
          </p>
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
