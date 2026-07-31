"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { AnnotatedPart } from "@/lib/contracts";

export function QuizRunner({ figureId, title, parts }: { figureId: string; title: string; parts: AnnotatedPart[] }) {
  const questions = useMemo(() => parts.filter((part) => part.visible).slice(0, 7).map((part, index, available) => {
    const distractors = available.filter((candidate) => candidate.id !== part.id).sort((a, b) => ((a.id.charCodeAt(0) + index) % 7) - ((b.id.charCodeAt(0) + index) % 7)).slice(0, 3);
    return { part, options: [part, ...distractors].sort((a, b) => ((a.id.length + index) % 5) - ((b.id.length + index) % 5)) };
  }), [parts]);
  const [current, setCurrent] = useState(0); const [selected, setSelected] = useState<string | null>(null); const [answers, setAnswers] = useState<{ partId: string; answer: string; correct: boolean }[]>([]); const [complete, setComplete] = useState(false);
  const question = questions[current]; const score = answers.filter((answer) => answer.correct).length;
  async function next() {
    if (!selected || !question) return;
    const answer = { partId: question.part.id, answer: selected, correct: selected === question.part.id };
    const nextAnswers = [...answers, answer]; setAnswers(nextAnswers);
    if (current === questions.length - 1) {
      setComplete(true);
      await fetch("/api/quiz-attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ figureId, score: nextAnswers.filter((item) => item.correct).length, total: questions.length, answers: nextAnswers }) });
    } else { setCurrent((value) => value + 1); setSelected(null); }
  }
  function reset() { setCurrent(0); setSelected(null); setAnswers([]); setComplete(false); }
  if (!question) return <div className="empty-state"><h2>Not enough visible components</h2><p>This figure cannot generate a quiz yet.</p></div>;
  if (complete) return <section className="quiz-complete"><span>{score === questions.length ? "✦" : "✓"}</span><p>QUIZ COMPLETE</p><h2>{score}/{questions.length}</h2><h3>{score === questions.length ? "Perfect visual recall." : score >= questions.length * .7 ? "You’re seeing the system." : "One more look will make it stick."}</h3><div><i style={{ width: `${score / questions.length * 100}%` }} /></div><button onClick={reset}><RotateCcw size={16} />Try again</button></section>;
  return <section className="quiz-runner"><header><div><p>VISUAL RECALL</p><h2>{title}</h2></div><span>{String(current + 1).padStart(2, "0")} <i>/</i> {String(questions.length).padStart(2, "0")}</span></header><div className="quiz-progress"><i style={{ width: `${current / questions.length * 100}%` }} /></div><div className="quiz-stage"><div className="quiz-image"><img src={`/api/figures/${figureId}/image`} alt="" /><span>Look closely</span></div><div className="quiz-question"><p>WHICH COMPONENT IS THIS?</p><h3>{question.part.description}</h3><div className="quiz-options">{question.options.map((option, index) => <button key={option.id} type="button" disabled={selected !== null} data-selected={selected === option.id} data-correct={selected !== null && option.id === question.part.id} onClick={() => setSelected(option.id)}><span>{String.fromCharCode(65 + index)}</span>{option.name}{selected !== null && option.id === question.part.id && <Check />}{selected === option.id && option.id !== question.part.id && <X />}</button>)}</div><button className="quiz-next" disabled={!selected} onClick={() => void next()}>{current === questions.length - 1 ? "See results" : "Next question"}<ArrowRight size={17} /></button></div></div></section>;
}
