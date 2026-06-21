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
  countdownSeconds = 2,
}: Props) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const recRef = useRef<SR | null>(null);
  const countdownRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  // Start countdown when trigger word is heard
  const startCountdown = () => {
    if (countdownRef.current !== null) return; // already counting
    cancelledRef.current = false;
    setCountdown(countdownSeconds);
    let n = countdownSeconds;
    countdownRef.current = window.setInterval(() => {
      n -= 1;
      if (cancelledRef.current) return;
      if (n <= 0) {
        clearCountdown();
        if (!cancelledRef.current) onTrigger();
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
            Activating SOS in {countdown}s. Tap cancel if you're safe.
          </div>
          <button
            onClick={cancelCountdown}
            style={{
              marginTop: 24,
              padding: "14px 28px",
              borderRadius: 999,
              background: "#fff",
              color: "#DC2626",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              cursor: "pointer",
            }}
          >
            <X size={18} strokeWidth={3} /> Cancel
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
