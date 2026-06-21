import { useState } from "react";
import { X, Bot, CheckCircle, RotateCcw } from "lucide-react";

const C = {
  navy: "#0A1628",
  white: "#FFFFFF",
  offWhite: "#F8FAFC",
  gray: "#64748B",
  grayBorder: "#E2E8F0",
  red: "#DC2626",
  redLight: "#FEE2E2",
  green: "#059669",
  greenLight: "#D1FAE5",
  blue: "#2563EB",
  blueLight: "#DBEAFE",
};

export function SteeringWheelIcon({ size = 18, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 14.2 V21" />
      <path d="M10.1 10.8 4 7.5" />
      <path d="M13.9 10.8 20 7.5" />
    </svg>
  );
}

type Q = { q: string; opts: string[]; answer: number; explain: string };

const QUESTIONS: Q[] = [
  {
    q: "What's the safe following distance on a highway?",
    opts: ["1 second", "2 seconds", "3 seconds", "Half a second"],
    answer: 2,
    explain: "Keep at least a 3-second gap from the vehicle ahead — more in rain or fog.",
  },
  {
    q: "When should you use hazard lights?",
    opts: [
      "Driving in heavy rain",
      "Vehicle stopped/broken down on the road",
      "Reversing in a parking lot",
      "Whenever you feel unsafe",
    ],
    answer: 1,
    explain: "Hazards are for a stationary vehicle that's a hazard to others — not while driving.",
  },
  {
    q: "Helmet rule for two-wheeler riders in India?",
    opts: [
      "Only rider needs one",
      "Only on highways",
      "Rider and pillion both must wear ISI-certified helmets",
      "Not required under 40 km/h",
    ],
    answer: 2,
    explain: "Both rider and pillion must wear ISI-certified helmets at all times.",
  },
  {
    q: "What's the legal BAC limit for drivers in India?",
    opts: ["0.08%", "0.05%", "0.03%", "0.00%"],
    answer: 2,
    explain: "0.03% BAC. Anything above is punishable — best is zero before driving.",
  },
  {
    q: "If your brakes fail, you should first…",
    opts: [
      "Pull the handbrake hard",
      "Switch off the engine",
      "Downshift and pump the brake pedal",
      "Steer into oncoming traffic",
    ],
    answer: 2,
    explain: "Downshift to slow with the engine and pump the brakes — use handbrake gradually.",
  },
];

type Msg =
  | { role: "bot"; text: string }
  | { role: "user"; text: string }
  | { role: "question"; idx: number };

export default function SafetyQuizBot({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "bot", text: "Hi! I'm SarathiBot 🛞 Let's review 5 quick road-safety rules." },
    { role: "question", idx: 0 },
  ]);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const pick = (qIdx: number, optIdx: number) => {
    const q = QUESTIONS[qIdx];
    const correct = optIdx === q.answer;
    const next: Msg[] = [
      ...msgs,
      { role: "user", text: q.opts[optIdx] },
      {
        role: "bot",
        text: (correct ? "✅ Correct! " : `❌ Not quite. Answer: ${q.opts[q.answer]}. `) + q.explain,
      },
    ];
    const newScore = score + (correct ? 1 : 0);
    const nextStep = qIdx + 1;
    if (nextStep < QUESTIONS.length) {
      next.push({ role: "question", idx: nextStep });
      setMsgs(next);
      setStep(nextStep);
      setScore(newScore);
    } else {
      next.push({
        role: "bot",
        text: `That's all! You scored ${newScore}/${QUESTIONS.length}. ${
          newScore === QUESTIONS.length ? "Perfect — drive safe!" : "Keep these in mind on the road."
        }`,
      });
      setMsgs(next);
      setScore(newScore);
      setDone(true);
    }
  };

  const restart = () => {
    setMsgs([
      { role: "bot", text: "Restarting safety quiz — here we go again 🛞" },
      { role: "question", idx: 0 },
    ]);
    setStep(0);
    setScore(0);
    setDone(false);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 800,
        background: "rgba(10,22,40,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          height: "82%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${C.grayBorder}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: C.offWhite,
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: C.navy, display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <SteeringWheelIcon size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Test Drive · Safety Quiz</div>
            <div style={{ fontSize: 11, color: C.gray, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: C.green }} />
              SarathiBot · {done ? "Done" : `Question ${Math.min(step + 1, QUESTIONS.length)}/${QUESTIONS.length}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: C.white, border: `1px solid ${C.grayBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} color={C.navy} />
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1, overflowY: "auto",
            padding: 16, display: "flex",
            flexDirection: "column", gap: 10,
            background: C.offWhite,
          }}
        >
          {msgs.map((m, i) => {
            if (m.role === "bot") {
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: 10,
                      background: C.navy, display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <Bot size={14} color="#fff" />
                  </div>
                  <div
                    style={{
                      background: C.white, padding: "10px 12px",
                      borderRadius: 14, borderTopLeftRadius: 4,
                      fontSize: 13, color: C.navy, maxWidth: "82%",
                      border: `1px solid ${C.grayBorder}`, lineHeight: 1.45,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            }
            if (m.role === "user") {
              return (
                <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      background: C.navy, color: "#fff",
                      padding: "10px 12px", borderRadius: 14,
                      borderTopRightRadius: 4, fontSize: 13, maxWidth: "82%",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            }
            // question
            const q = QUESTIONS[m.idx];
            const isCurrent = !done && m.idx === step;
            return (
              <div key={i} style={{ marginLeft: 36, marginTop: 2 }}>
                <div
                  style={{
                    background: C.white, padding: 12, borderRadius: 14,
                    border: `1px solid ${C.grayBorder}`, marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 12, color: C.blue, fontWeight: 700, marginBottom: 4 }}>
                    Q{m.idx + 1}
                  </div>
                  <div style={{ fontSize: 13, color: C.navy, fontWeight: 600, marginBottom: 10 }}>
                    {q.q}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {q.opts.map((o, oi) => (
                      <button
                        key={oi}
                        disabled={!isCurrent}
                        onClick={() => pick(m.idx, oi)}
                        style={{
                          textAlign: "left", padding: "9px 12px",
                          borderRadius: 10, fontSize: 12.5, fontWeight: 500,
                          background: isCurrent ? C.offWhite : "#F1F5F9",
                          color: isCurrent ? C.navy : C.gray,
                          border: `1px solid ${C.grayBorder}`,
                          cursor: isCurrent ? "pointer" : "default",
                        }}
                      >
                        {String.fromCharCode(65 + oi)}. {o}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 12, borderTop: `1px solid ${C.grayBorder}`,
            background: C.white, display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <div
            style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: 12, background: C.offWhite,
              border: `1px solid ${C.grayBorder}`,
            }}
          >
            <CheckCircle size={14} color={C.green} />
            <span style={{ fontSize: 12, color: C.gray }}>
              Score: <b style={{ color: C.navy }}>{score}</b> / {QUESTIONS.length}
            </span>
          </div>
          {done && (
            <button
              onClick={restart}
              style={{
                padding: "10px 14px", borderRadius: 12,
                background: C.navy, color: "#fff", border: "none",
                fontSize: 12.5, fontWeight: 600, display: "flex",
                alignItems: "center", gap: 6, cursor: "pointer",
              }}
            >
              <RotateCcw size={13} /> Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
