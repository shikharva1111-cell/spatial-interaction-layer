import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, AlertTriangle, X } from "lucide-react";

type Props = {
  onTrigger: () => void;
  triggerWords?: string[];
  countdownSeconds?: number;
};

// Web Speech API types (loose)
type SR = any;

export default function VoiceSOSListener({
  onTrigger,
  triggerWords = ["help", "sos", "save me", "emergency", "bachao", "danger"],
  countdownSeconds = 5,
}: Props) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const recRef = useRef<SR | null>(null);
  const countdownRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<number | null>(null);

  const playBeep = (freq = 880, duration = 0.18) => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      /* noop */
    }
  };

  const startAlarm = () => {
    if (beepIntervalRef.current !== null) return;
    playBeep(880, 0.2);
    beepIntervalRef.current = window.setInterval(() => {
      playBeep(880, 0.18);
      setTimeout(() => playBeep(1175, 0.18), 220);
    }, 800);
  };

  const stopAlarm = () => {
    if (beepIntervalRef.current !== null) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  };

  const triggerFinalAlarm = () => {
    // longer wailing tone on activation
    playBeep(1320, 0.6);
    setTimeout(() => playBeep(1760, 0.6), 250);
    if (navigator.vibrate) navigator.vibrate([400, 120, 400, 120, 800]);
  };

  // Start countdown when trigger word is heard
  const startCountdown = () => {
    if (countdownRef.current !== null) return; // already counting
    cancelledRef.current = false;
    setCountdown(countdownSeconds);
    startAlarm();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    let n = countdownSeconds;
    countdownRef.current = window.setInterval(() => {
      n -= 1;
      if (cancelledRef.current) return;
      if (n <= 0) {
        clearCountdown();
        stopAlarm();
        if (!cancelledRef.current) {
          triggerFinalAlarm();
          onTrigger();
        }
      } else {
        setCountdown(n);
      }
    }, 1000);
  };

  const clearCountdown = () => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  };

  const cancelCountdown = () => {
    cancelledRef.current = true;
    clearCountdown();
    stopAlarm();
  };


  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const rec: SR = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      // auto-restart unless intentionally stopped
      try {
        rec.start();
      } catch {
        /* noop */
      }
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setSupported(false);
      }
    };
    rec.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      const trimmed = text.trim();
      setTranscript(trimmed.slice(-80));
      const lower = trimmed.toLowerCase();
      if (triggerWords.some((w) => lower.includes(w))) {
        startCountdown();
      }
    };

    recRef.current = rec;
    // user gesture may be needed; try anyway
    try {
      rec.start();
    } catch {
      /* noop */
    }

    return () => {
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        /* noop */
      }
      clearCountdown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual permission/start fallback
  const startManually = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setSupported(true);
      recRef.current?.start?.();
    } catch {
      setSupported(false);
    }
  };

  return (
    <>
      {/* Tiny live caption pill */}
      <div
        style={{
          position: "absolute",
          top: 44,
          left: 12,
          right: 12,
          zIndex: 900,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          onClick={!supported ? startManually : undefined}
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            maxWidth: "92%",
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(10,22,40,0.82)",
            color: "#fff",
            fontSize: 11,
            fontFamily: "Inter, system-ui, sans-serif",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            cursor: !supported ? "pointer" : "default",
          }}
        >
          {supported ? (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: listening ? "#22c55e" : "#f59e0b",
                  boxShadow: listening ? "0 0 8px #22c55e" : "none",
                  animation: listening ? "voicePulse 1.2s ease-in-out infinite" : "none",
                }}
              />
              <Mic size={11} strokeWidth={2.5} />
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 240,
                  opacity: 0.95,
                }}
              >
                {transcript || (listening ? "Listening…" : "Starting mic…")}
              </span>
            </>
          ) : (
            <>
              <MicOff size={11} strokeWidth={2.5} />
              <span>Tap to enable voice SOS</span>
            </>
          )}
        </div>
      </div>

      {/* SOS countdown overlay */}
      {countdown !== null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1000,
            background: "rgba(220,38,38,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: "Inter, system-ui, sans-serif",
            padding: 24,
            textAlign: "center",
          }}
        >
          <AlertTriangle size={48} strokeWidth={2.5} />
          <div style={{ fontSize: 14, marginTop: 12, opacity: 0.9, letterSpacing: 1 }}>
            SAFE WORD DETECTED
          </div>
          <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1, marginTop: 8 }}>
            {countdown}
          </div>
          <div style={{ fontSize: 13, marginTop: 8, opacity: 0.95, maxWidth: 280 }}>
            Activating SOS in {countdown}s. Hold cancel if you're safe.
          </div>
          <button
            onPointerDown={() => {
              const t = window.setTimeout(() => cancelCountdown(), 1200);
              (window as any).__sosHoldTimer = t;
            }}
            onPointerUp={() => {
              const t = (window as any).__sosHoldTimer;
              if (t) { clearTimeout(t); (window as any).__sosHoldTimer = null; }
            }}
            onPointerLeave={() => {
              const t = (window as any).__sosHoldTimer;
              if (t) { clearTimeout(t); (window as any).__sosHoldTimer = null; }
            }}
            style={{
              marginTop: 24,
              padding: "14px 28px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              border: "2px solid rgba(255,255,255,0.6)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <X size={16} strokeWidth={3} /> Hold to Cancel
          </button>

        </div>
      )}

      <style>{`
        @keyframes voicePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.6; }
        }
      `}</style>
    </>
  );
}
