import { useState, useContext, createContext, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Circle, Marker, useMap } from "react-leaflet";
import { GoogleMapView, type NearbyPlace } from "./GoogleMapView";
import VoiceSOSListener from "./VoiceSOSListener";
import SafetyQuizBot, { SteeringWheelIcon } from "./SafetyQuizBot";
import L from "leaflet";
import {
  Signal, Wifi, Battery, AlertCircle, FileText, Scale, Folder,
  Map, Mic, User, Shield, MapPin, ChevronRight, Bell, AlertTriangle,
  ArrowLeft, Send, Bot, CheckCircle, Phone, Navigation, Users,
  Camera, Video, Upload, Trash2, Eye, Plus, Clock, Download,
  Share2, BookOpen, HelpCircle, Activity, Settings, LogOut,
  Award, MicOff, Volume2, Layers, Filter, Star, ChevronDown,
  Mail, Lock, Fingerprint, Edit3, ChevronRight as ChevronRightIcon,
  Home as HomeIcon,
} from "lucide-react";

// ─── Leaflet setup ─────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Design System ─────────────────────────────────────────────────────────────
// DriveSafe AI — Futuristic dark HUD palette (Tesla / Iron Man inspired)
// Token roles are preserved so the existing layout/features render unchanged,
// only retuned for a dark neon theme with glow-based elevation.
const C = {
  navy: "#0284C7",          // primary brand — works as fill (white text AA) AND as ink on dark bg
  navyLight: "#38BDF8",     // neon sky accent
  white: "#070B16",         // deepest space — page background
  offWhite: "#0E1628",      // elevated surface / card
  gray: "#94A3B8",          // secondary text
  grayLight: "#475569",     // tertiary / inactive
  grayBorder: "rgba(148,163,184,0.18)",
  red: "#FF3D5A",           // danger / SOS
  redLight: "rgba(255,61,90,0.14)",
  green: "#10E098",         // safe / online
  greenLight: "rgba(16,224,152,0.14)",
  amber: "#FBBF24",         // caution
  amberLight: "rgba(251,191,36,0.14)",
  blue: "#38BDF8",          // info / data
  blueLight: "rgba(56,189,248,0.14)",
};

// Neon-tinted elevation — replaces black shadows with cyan glow for HUD depth
const elev = {
  xs: "0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.04)",
  sm: "0 2px 8px rgba(0,0,0,0.55), 0 0 0 1px rgba(56,189,248,0.06)",
  md: "0 6px 22px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.08), 0 0 24px rgba(56,189,248,0.04)",
  lg: "0 12px 36px rgba(0,0,0,0.65), 0 0 0 1px rgba(56,189,248,0.10), 0 0 40px rgba(56,189,248,0.06)",
  xl: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.12), 0 0 64px rgba(56,189,248,0.08)",
  insetHL: "inset 0 1px 0 rgba(255,255,255,0.06)",
};


// ─── Navigation Context ─────────────────────────────────────────────────────────
type Screen = "onboarding" | "login" | "home" | "sos" | "assistant" | "evidence" | "report" | "legal" | "roadwatch" | "documents" | "voice" | "profile";
const NavCtx = createContext<(path: string) => void>(() => {});
const useNav = () => useContext(NavCtx);

function pathToScreen(path: string): Screen {
  const map: Record<string, Screen> = {
    "/": "onboarding", "/login": "login", "/home": "home", "/emergency": "sos",
    "/ai-assistant": "assistant", "/evidence": "evidence", "/report": "report",
    "/legal": "legal", "/roadwatch": "roadwatch", "/documents": "documents",
    "/voice": "voice", "/profile": "profile",
  };
  return map[path] ?? "home";
}

// ─── Shared Components ─────────────────────────────────────────────────────────

function StatusBar({ light = false }: { light?: boolean }) {
  const c = light ? "#FFFFFF" : C.navy;
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-2" style={{ color: c }}>
      <span className="text-sm font-semibold" style={{ fontFamily: "Inter" }}>9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal size={13} strokeWidth={2.5} /><Wifi size={13} strokeWidth={2.5} /><Battery size={14} strokeWidth={2.5} />
      </div>
    </div>
  );
}

function NotchOverlay() {
  return (
    <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 120, height: 34, background: "#0A0A0A", borderRadius: "0 0 20px 20px", zIndex: 50 }} />
  );
}

// Back button header shared across detail screens
function ScreenHeader({ title, onBack, action }: { title: string; onBack: () => void; action?: React.ReactNode }) {
  return (
    <div className="px-5 pt-3 pb-4 flex items-center justify-between"
      style={{ background: C.white, borderBottom: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
      <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: C.offWhite }}>
        <ArrowLeft size={18} style={{ color: C.navy }} />
      </button>
      <h1 className="text-lg font-bold" style={{ color: C.navy, fontFamily: "Inter" }}>{title}</h1>
      <div className="w-9 flex justify-end">{action ?? <div />}</div>
    </div>
  );
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────
const NAV_SCREENS: Screen[] = ["home", "roadwatch", "documents", "legal", "profile"];

function BottomNav({ active, onNavigate }: { active: Screen; onNavigate: (s: Screen) => void }) {
  const tabs = [
    { screen: "home" as Screen, icon: HomeIcon, label: "Home" },
    { screen: "roadwatch" as Screen, icon: Map, label: "RoadWatch" },
    { screen: "sos" as Screen, icon: AlertCircle, label: "SOS", accent: true },
    { screen: "legal" as Screen, icon: Scale, label: "Laws" },
    { screen: "profile" as Screen, icon: User, label: "Profile" },
  ];
  return (
    <div className="flex items-center justify-around px-2 pt-1.5 pb-3"
      style={{ background: C.white, backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", borderTop: `1px solid ${C.grayBorder}`, boxShadow: `0 -4px 20px rgba(0,0,0,0.05), ${elev.insetHL}` }}>
      {tabs.map(({ screen, icon: Icon, label, accent }) => {
        const isActive = active === screen;
        if (accent) {
          return (
            <button key={screen} onClick={() => onNavigate(screen)}
              className="flex flex-col items-center gap-1 -mt-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: C.red, boxShadow: `0 6px 20px ${C.red}50, 0 0 0 3px ${C.white}` }}>
                <Icon size={22} color="white" strokeWidth={2} />
              </div>
              <span className="text-xs font-semibold" style={{ color: C.red, fontFamily: "Inter" }}>{label}</span>
            </button>
          );
        }
        return (
          <button key={screen} onClick={() => onNavigate(screen)} className="flex flex-col items-center gap-1" style={{ minWidth: 52 }}>
            <div className="w-10 h-8 rounded-xl flex items-center justify-center"
              style={{ background: isActive ? `${C.navy}10` : "transparent", transition: "background 0.2s" }}>
              <Icon size={20} color={isActive ? C.navy : C.grayLight} strokeWidth={isActive ? 2.2 : 1.8} />
            </div>
            <span className="text-xs" style={{ fontWeight: isActive ? 600 : 400, color: isActive ? C.navy : C.gray, fontFamily: "Inter" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Onboarding Screen ─────────────────────────────────────────────────────────
const OB_SLIDES = [
  { icon: AlertCircle, title: "Accidents Cause Panic", description: "Every year, thousands of Indian drivers face legal and financial trouble after accidents — due to missing evidence and improper reporting.", color: C.red },
  { icon: Shield, title: "Sarathi AI Protects You", description: "Your AI copilot guides you through emergencies, collects evidence, generates police and insurance reports, and provides legal guidance — all in one tap.", color: C.green },
  { icon: FileText, title: "Stay Safe. Stay Legal.", description: "From SOS activation to FIR filing, document management to real-time road risk alerts — Sarathi AI is your complete road safety companion.", color: C.navy },
];

function OnboardingScreen() {
  const navigate = useNav();
  const [step, setStep] = useState(0);
  const slide = OB_SLIDES[step];
  const Icon = slide.icon;

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ background: C.white }}>
      <NotchOverlay />
      {/* Depth orbs */}
      <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: `radial-gradient(circle, ${slide.color}14 0%, transparent 70%)`, pointerEvents: "none", transition: "background 0.6s", filter: "blur(20px)" }} />
      <div style={{ position: "absolute", bottom: -80, left: -60, width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, ${slide.color}0C 0%, transparent 70%)`, pointerEvents: "none", transition: "background 0.6s", filter: "blur(24px)" }} />
      <StatusBar />
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 py-3">
        {OB_SLIDES.map((_, i) => (
          <div key={i} style={{ width: i === step ? 32 : 8, height: 8, borderRadius: 99, background: i === step ? C.navy : C.grayBorder, transition: "all 0.3s" }} />
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-3xl" style={{ background: `${slide.color}18`, filter: "blur(28px)", transform: "scale(1.3)" }} />
          <div className="relative w-28 h-28 rounded-3xl flex items-center justify-center"
            style={{ background: slide.color, boxShadow: `0 16px 48px ${slide.color}40, inset 0 1px 0 rgba(255,255,255,0.2)` }}>
            <Icon size={52} color="white" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center mb-4" style={{ color: C.navy, letterSpacing: "-0.5px", lineHeight: 1.2, fontFamily: "Inter" }}>
          {slide.title}
        </h1>
        <p className="text-center leading-relaxed" style={{ color: C.gray, fontSize: 16, lineHeight: 1.65, fontFamily: "Inter" }}>
          {slide.description}
        </p>
      </div>
      {/* Brand mark */}
      <div className="flex items-center justify-center gap-2 pb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.navy }}>
          <Shield size={16} color="white" strokeWidth={2} />
        </div>
        <span className="text-base font-bold tracking-tight" style={{ color: C.navy, fontFamily: "Inter" }}>SARATHI AI</span>
      </div>
      {/* Actions */}
      <div className="px-6 pb-8">
        <button onClick={() => step < OB_SLIDES.length - 1 ? setStep(step + 1) : navigate("/login")}
          className="w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2"
          style={{ background: C.navy, color: "white", boxShadow: `0 8px 24px ${C.navy}35, inset 0 1px 0 rgba(255,255,255,0.1)`, fontFamily: "Inter" }}>
          {step < OB_SLIDES.length - 1 ? "Continue" : "Get Started"} <ChevronRight size={18} strokeWidth={2.5} />
        </button>
        {step < OB_SLIDES.length - 1 && (
          <button onClick={() => navigate("/login")} className="w-full text-center py-3 mt-1 text-sm" style={{ color: C.gray, fontFamily: "Inter" }}>Skip</button>
        )}
      </div>
    </div>
  );
}

// ─── Login Screen (Spatial UI) ─────────────────────────────────────────────────
function LoginScreen() {
  const navigate = useNav();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focus, setFocus] = useState<"email" | "password" | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -6, y: px * 8 });
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ background: `linear-gradient(165deg, ${C.offWhite} 0%, #EEF2F8 50%, #E6ECF5 100%)` }}>
      <NotchOverlay />
      {/* Spatial floating orbs */}
      <div style={{ position: "absolute", top: -60, right: -80, width: 280, height: 280, borderRadius: "50%", background: `radial-gradient(circle, ${C.navy}22 0%, transparent 70%)`, filter: "blur(30px)", animation: "floatA 9s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: 60, left: -90, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${C.red}28 0%, transparent 70%)`, filter: "blur(36px)", animation: "floatB 11s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "38%", left: "55%", width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue}22 0%, transparent 70%)`, filter: "blur(28px)", animation: "floatA 13s ease-in-out infinite reverse" }} />

      <StatusBar />

      <div className="px-7 pt-4 relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.navy, boxShadow: `0 6px 16px ${C.navy}40` }}>
            <Shield size={18} color="white" strokeWidth={2} />
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: C.navy, fontFamily: "Inter" }}>SARATHI AI</span>
        </div>
      </div>

      {/* Glass spatial card */}
      <div className="flex-1 flex flex-col justify-center px-6 relative z-10" onMouseMove={onMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
        <div
          className="rounded-3xl p-6"
          style={{
            background: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.8)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow: `0 24px 60px ${C.navy}22, 0 4px 14px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)`,
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: "transform 0.25s ease-out",
            transformStyle: "preserve-3d",
          }}
        >
          <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy, fontFamily: "Inter", letterSpacing: "-0.4px", transform: "translateZ(30px)" }}>Welcome back</h1>
          <p className="text-sm mb-6" style={{ color: C.gray, fontFamily: "Inter", transform: "translateZ(20px)" }}>Sign in to continue your safe journey</p>

          {/* Email */}
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: C.navy, letterSpacing: "0.04em", fontFamily: "Inter" }}>EMAIL</label>
          <div className="flex items-center gap-2 px-4 mb-4 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.85)",
              border: `1.5px solid ${focus === "email" ? C.navy : C.grayBorder}`,
              boxShadow: focus === "email" ? `0 0 0 4px ${C.navy}14, 0 4px 12px rgba(0,0,0,0.05)` : "0 1px 2px rgba(0,0,0,0.04)",
              transition: "all 0.2s",
              height: 50,
            }}>
            <Mail size={17} style={{ color: focus === "email" ? C.navy : C.gray }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocus("email")}
              onBlur={() => setFocus(null)}
              placeholder="arjun@example.com"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: C.navy, fontFamily: "Inter" }}
            />
          </div>

          {/* Password */}
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: C.navy, letterSpacing: "0.04em", fontFamily: "Inter" }}>PASSWORD</label>
          <div className="flex items-center gap-2 px-4 mb-2 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.85)",
              border: `1.5px solid ${focus === "password" ? C.navy : C.grayBorder}`,
              boxShadow: focus === "password" ? `0 0 0 4px ${C.navy}14, 0 4px 12px rgba(0,0,0,0.05)` : "0 1px 2px rgba(0,0,0,0.04)",
              transition: "all 0.2s",
              height: 50,
            }}>
            <Lock size={17} style={{ color: focus === "password" ? C.navy : C.gray }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocus("password")}
              onBlur={() => setFocus(null)}
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: C.navy, fontFamily: "Inter" }}
            />
          </div>

          <div className="flex justify-end mb-5">
            <button className="text-xs font-semibold" style={{ color: C.red, fontFamily: "Inter" }}>Forgot password?</button>
          </div>

          <button
            onClick={() => navigate("/home")}
            className="w-full py-3.5 rounded-2xl text-base font-semibold flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`,
              color: "white",
              boxShadow: `0 10px 28px ${C.navy}45, inset 0 1px 0 rgba(255,255,255,0.15)`,
              fontFamily: "Inter",
              transform: "translateZ(40px)",
            }}>
            Continue <ChevronRight size={18} strokeWidth={2.5} />
          </button>

          <button className="w-full mt-3 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "rgba(255,255,255,0.7)", color: C.navy, border: `1px solid ${C.grayBorder}`, fontFamily: "Inter" }}>
            <Fingerprint size={17} /> Sign in with Biometrics
          </button>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: C.gray, fontFamily: "Inter" }}>
          New to Sarathi? <span className="font-semibold" style={{ color: C.red }}>Create account</span>
        </p>
      </div>

      <style>{`
        @keyframes floatA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(12px,-18px)} }
        @keyframes floatB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-14px,16px)} }
      `}</style>
    </div>
  );
}

// ─── Home Screen ───────────────────────────────────────────────────────────────
function HomeScreen() {
  const navigate = useNav();
  const [quizOpen, setQuizOpen] = useState(false);
  const alerts = [
    { type: "high", location: "MG Road, Bangalore", message: "High accident zone — 5 incidents this week", distance: "1.2 km ahead" },
    { type: "medium", location: "ORR Junction", message: "Traffic congestion reported", distance: "3.5 km ahead" },
  ];
  const features = [
    { icon: Folder, label: "Evidence", route: "/evidence", color: C.green },
    { icon: Map, label: "RoadWatch", route: "/roadwatch", color: C.blue },
    { icon: Mic, label: "Voice", route: "/voice", color: "#8B5CF6" },
    { icon: User, label: "Profile", route: "/profile", color: C.navy },
  ];

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{ background: C.offWhite }}>
      <NotchOverlay />
      <StatusBar />
      {/* Header */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: C.gray, fontFamily: "Inter" }}>Welcome back</p>
            <h1 className="text-2xl font-bold" style={{ color: C.navy, letterSpacing: "-0.5px", fontFamily: "Inter" }}>Drive Safe Today</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuizOpen(true)}
              title="Test Drive — Safety Quiz"
              className="w-10 h-10 rounded-xl flex items-center justify-center relative"
              style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
              <SteeringWheelIcon size={18} color={C.navy} />
              <span style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: 999, background: C.blue, color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>Q</span>
            </button>
            <button className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
              <Bell size={18} style={{ color: C.navy }} />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: C.navy, color: "white", boxShadow: `0 4px 12px ${C.navy}30`, fontFamily: "Inter" }}>AK</div>
          </div>
        </div>
        {/* Safety status pill */}
        <div className="rounded-2xl p-3.5 flex items-center gap-3"
          style={{ background: C.greenLight, border: `1px solid ${C.green}30`, boxShadow: `0 2px 8px ${C.green}10` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.green, boxShadow: `0 4px 12px ${C.green}40` }}>
            <Shield size={20} color="white" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: C.green, fontFamily: "Inter" }}>All Systems Active</p>
            <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>Emergency contacts ready · Documents up to date</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {/* EMERGENCY SOS — hero button */}
        <div className="mb-3">
          <p className="text-xs font-bold mb-2.5 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>QUICK ACTIONS</p>
          <button onClick={() => navigate("/emergency")} className="w-full rounded-2xl p-5 flex items-center justify-between mb-3"
            style={{ background: C.redLight, border: `1.5px solid ${C.red}25`, boxShadow: `0 4px 20px ${C.red}12, ${elev.insetHL}` }}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: C.red, boxShadow: `0 8px 24px ${C.red}50, inset 0 1px 0 rgba(255,255,255,0.2)` }}>
                <AlertCircle size={32} color="white" strokeWidth={2} />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold mb-0.5" style={{ color: C.red, fontFamily: "Inter" }}>Emergency SOS</h3>
                <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>One-tap emergency activation</p>
              </div>
            </div>
            <ChevronRight size={22} style={{ color: C.red }} strokeWidth={2.5} />
          </button>

          {/* Secondary actions grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: FileText, title: "Report Accident", sub: "AI-guided reporting", color: C.amber, bg: C.amberLight, route: "/ai-assistant" },
              { icon: Scale, title: "Legal Help", sub: "Know your rights", color: C.blue, bg: C.blueLight, route: "/legal" },
            ].map(({ icon: Icon, title, sub, color, bg, route }) => (
              <button key={title} onClick={() => navigate(route)} className="rounded-2xl p-4 text-left"
                style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.sm }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
                  <Icon size={22} style={{ color }} strokeWidth={2} />
                </div>
                <h3 className="text-sm font-semibold mb-0.5" style={{ color: C.navy, fontFamily: "Inter" }}>{title}</h3>
                <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Road risk alerts */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <p className="text-xs font-bold" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>ROAD RISK ALERTS</p>
            <button onClick={() => navigate("/roadwatch")} className="text-xs font-semibold" style={{ color: C.navy, fontFamily: "Inter" }}>View Map</button>
          </div>
          <div className="flex flex-col gap-2">
            {alerts.map((a, i) => (
              <div key={i} className="rounded-xl p-3 flex items-start gap-3"
                style={{ background: C.white, border: `1px solid ${a.type === "high" ? C.red : C.amber}25`, boxShadow: elev.xs }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: a.type === "high" ? C.redLight : C.amberLight }}>
                  <AlertTriangle size={16} style={{ color: a.type === "high" ? C.red : C.amber }} strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-0.5">
                    <p className="text-sm font-semibold" style={{ color: C.navy, fontFamily: "Inter" }}>{a.location}</p>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: C.gray, fontFamily: "Inter" }}>{a.distance}</span>
                  </div>
                  <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* More features */}
        <div>
          <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>MORE FEATURES</p>
          <div className="grid grid-cols-4 gap-3">
            {features.map(({ icon: Icon, label, route, color }) => (
              <button key={label} onClick={() => navigate(route)} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
                  <Icon size={22} style={{ color }} strokeWidth={2} />
                </div>
                <span className="text-xs font-medium" style={{ color: C.navy, fontFamily: "Inter" }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {quizOpen && <SafetyQuizBot onClose={() => setQuizOpen(false)} />}
    </div>
  );
}

// ─── Emergency SOS Screen ──────────────────────────────────────────────────────
const EMERGENCY_CONTACTS = [
  { name: "Police", number: "100" },
  { name: "Ambulance", number: "108" },
  { name: "Mom", number: "+91 98765 43210" },
  { name: "Dad", number: "+91 98765 43211" },
];
const NEARBY_SERVICES = [
  { type: "Police Station", name: "Koramangala Police Station", distance: "1.2 km", eta: "4 min" },
  { type: "Hospital", name: "Apollo Hospital", distance: "2.5 km", eta: "8 min" },
  { type: "Hospital", name: "Manipal Hospital", distance: "3.1 km", eta: "10 min" },
];

function EmergencySOSScreen() {
  const navigate = useNav();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>("Locating…");
  const watchIdRef = useRef<number | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { setIsActive(true); setCountdown(null); return; }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Real-time location tracking while SOS is active
  useEffect(() => {
    if (!isActive) return;
    if (!("geolocation" in navigator)) { setGeoError("Geolocation not supported"); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      (err) => setGeoError(err.message || "Location unavailable"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    watchIdRef.current = id;
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; };
  }, [isActive]);

  // Reverse geocode (debounced via coords changes)
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=16`);
        const j = await r.json();
        if (!cancelled && j?.display_name) setAddress(j.display_name);
      } catch { /* ignore */ }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [coords?.lat, coords?.lng]);

  // Alarm sound on activation
  useEffect(() => {
    if (!isActive) return;
    try {
      const AC: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new AC();
      const gain = ctx.createGain();
      gain.gain.value = 0.18;
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.connect(gain);
      const start = ctx.currentTime;
      // Two-tone siren loop for 20s
      for (let i = 0; i < 20; i++) {
        osc.frequency.setValueAtTime(880, start + i);
        osc.frequency.setValueAtTime(620, start + i + 0.5);
      }
      osc.start();
      osc.stop(start + 20);
      const stop = () => { try { osc.stop(); } catch { /* noop */ } try { ctx.close(); } catch { /* noop */ } };
      audioRef.current = { ctx, stop };
    } catch { /* audio blocked */ }
    return () => { audioRef.current?.stop(); audioRef.current = null; };
  }, [isActive]);

  const handleCancel = () => {
    setCountdown(null);
    setIsActive(false);
    audioRef.current?.stop();
    audioRef.current = null;
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
  };


  return (
    <div className="flex flex-col h-full relative overflow-hidden"
      style={{ background: isActive ? C.red : C.offWhite, transition: "background 0.4s" }}>
      <NotchOverlay />
      <StatusBar light={isActive} />
      {/* Pulse background rings when active */}
      {isActive && <>
        <div style={{ position: "absolute", top: "28%", left: "50%", transform: "translate(-50%,-50%)", width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.08)", animation: "sosPulse 2.5s ease-out infinite" }} />
        <div style={{ position: "absolute", top: "28%", left: "50%", transform: "translate(-50%,-50%)", width: 380, height: 380, borderRadius: "50%", background: "rgba(255,255,255,0.05)", animation: "sosPulse 2.5s ease-out infinite 0.5s" }} />
      </>}
      {/* Header */}
      <div className="px-5 pt-2 pb-4 flex items-center justify-between relative z-10">
        <h1 className="text-xl font-bold" style={{ color: isActive ? "white" : C.navy, fontFamily: "Inter" }}>Emergency SOS</h1>
        <button onClick={() => navigate("/home")} className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: isActive ? "rgba(255,255,255,0.18)" : C.white, border: isActive ? "none" : `1px solid ${C.grayBorder}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isActive ? "white" : C.navy} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* SOS Button area */}
      <div className="flex flex-col items-center justify-center flex-1 relative z-10">
        <div className="relative mb-8">
          {(countdown !== null || isActive) && (
            <div className="absolute rounded-full animate-ping" style={{ inset: -20, background: isActive ? "rgba(255,255,255,0.2)" : `${C.red}35`, animationDuration: "1.5s" }} />
          )}
          <button onClick={() => !isActive && countdown === null && setCountdown(3)}
            disabled={countdown !== null || isActive}
            className="relative w-52 h-52 rounded-full flex items-center justify-center"
            style={{
              background: isActive ? "white" : C.red,
              boxShadow: isActive ? "0 20px 60px rgba(0,0,0,0.28)" : `0 20px 60px ${C.red}55, inset 0 2px 0 rgba(255,255,255,0.2)`,
              border: isActive ? "4px solid rgba(255,255,255,0.25)" : "none",
            }}>
            {countdown !== null
              ? <span className="text-8xl font-bold" style={{ color: "white" }}>{countdown}</span>
              : <div className="flex flex-col items-center gap-2">
                  <AlertCircle size={60} style={{ color: isActive ? C.red : "white" }} strokeWidth={1.8} />
                  <span className="text-2xl font-bold" style={{ color: isActive ? C.red : "white", fontFamily: "Inter" }}>{isActive ? "ACTIVE" : "SOS"}</span>
                  {!isActive && <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter" }}>Tap to activate</span>}
                </div>
            }
          </button>
        </div>

        <div className="text-center mb-6">
          {isActive
            ? <><h2 className="text-xl font-bold mb-1" style={{ color: "white", fontFamily: "Inter" }}>SOS Activated</h2><p className="text-sm" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Inter" }}>Location shared · Emergency contacts notified</p></>
            : countdown !== null
              ? <p className="text-sm" style={{ color: C.gray, fontFamily: "Inter" }}>Activating emergency mode…</p>
              : <><h2 className="text-xl font-bold mb-1" style={{ color: C.navy, fontFamily: "Inter" }}>Tap to Activate SOS</h2><p className="text-sm" style={{ color: C.gray, fontFamily: "Inter" }}>Your location will be shared with emergency contacts</p></>
          }
        </div>
        {(countdown !== null || isActive) && (
          <button onClick={handleCancel} className="px-8 py-3 rounded-xl text-sm font-semibold"
            style={{ background: isActive ? "rgba(255,255,255,0.18)" : C.grayBorder, color: isActive ? "white" : C.navy, border: isActive ? "1px solid rgba(255,255,255,0.25)" : "none", fontFamily: "Inter" }}>
            Cancel
          </button>
        )}
      </div>

      {/* Bottom panel */}
      <div className="px-5 pb-6 relative z-10">
        {isActive && (
          <a
            href={coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : "#"}
            target="_blank" rel="noreferrer"
            className="rounded-2xl p-4 flex items-center gap-3 mb-3"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
              <MapPin size={20} color="white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34D399", boxShadow: "0 0 8px #34D399", animation: "sosPulse 1.5s ease-out infinite" }} />
                <p className="text-sm font-semibold" style={{ color: "white", fontFamily: "Inter" }}>Live Location</p>
              </div>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Inter" }}>
                {geoError ? geoError : address}
              </p>
              {coords && (
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter" }}>
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} · ±{Math.round(coords.accuracy)}m
                </p>
              )}
            </div>
            <Navigation size={18} style={{ color: "white" }} />
          </a>
        )}

        {/* Emergency contacts */}
        <div className="rounded-2xl p-4"
          style={{ background: isActive ? "rgba(255,255,255,0.15)" : C.white, backdropFilter: isActive ? "blur(12px)" : "none", border: isActive ? "1px solid rgba(255,255,255,0.2)" : `1px solid ${C.grayBorder}`, boxShadow: isActive ? "none" : elev.sm }}>
          <p className="text-xs font-bold mb-3" style={{ color: isActive ? "rgba(255,255,255,0.75)" : C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>EMERGENCY CONTACTS</p>
          <div className="grid grid-cols-2 gap-2">
            {EMERGENCY_CONTACTS.map(({ name, number }) => (
              <button key={name} className="rounded-xl p-3 flex items-center gap-2"
                style={{ background: isActive ? "rgba(255,255,255,0.1)" : C.offWhite, border: isActive ? "1px solid rgba(255,255,255,0.12)" : "none" }}>
                <Phone size={14} style={{ color: isActive ? "white" : C.green }} />
                <div className="flex-1 text-left">
                  <p className="text-xs font-semibold" style={{ color: isActive ? "white" : C.navy, fontFamily: "Inter" }}>{name}</p>
                  <p className="text-xs" style={{ color: isActive ? "rgba(255,255,255,0.7)" : C.gray, fontFamily: "Inter" }}>{number}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        {/* Nearby services */}
        {isActive && (
          <div className="rounded-2xl p-4 mt-3"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.75)", letterSpacing: "0.08em", fontFamily: "Inter" }}>NEARBY SERVICES</p>
            {NEARBY_SERVICES.slice(0, 2).map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2"
                style={{ borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.12)" : "none" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "white", fontFamily: "Inter" }}>{s.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter" }}>{s.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold" style={{ color: "white", fontFamily: "Inter" }}>{s.distance}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter" }}>{s.eta}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Accident Assistant ─────────────────────────────────────────────────────
type AiMsg = { role: "ai" | "user"; text: string; options?: string[]; action?: { label: string; route: string } };
const INIT_MSGS: AiMsg[] = [
  { role: "ai", text: "I'm here to help you through this. Stay calm — I'll guide you step by step." },
  { role: "ai", text: "Are you or anyone else injured?", options: ["Yes, injured", "No injuries", "Unsure"] },
];

function AIAccidentAssistant() {
  const navigate = useNav();
  const [messages, setMessages] = useState<AiMsg[]>(INIT_MSGS);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);

  const handleOption = (opt: string) => {
    const msgs = [...messages, { role: "user" as const, text: opt }];
    if (step === 0) {
      if (opt === "Yes, injured") msgs.push({ role: "ai", text: "Call 108 (Ambulance) immediately if injuries are serious. Once everyone is safe, I'll help you with the next steps." });
      else msgs.push({ role: "ai", text: "Good. Let's proceed to document the incident properly." });
      msgs.push({ role: "ai", text: "Is another vehicle involved?", options: ["Yes, another vehicle", "Single vehicle accident", "Hit & Run"] });
      setStep(1);
    } else if (step === 1) {
      msgs.push({ role: "ai", text: "Have you taken photos of the accident scene and damage?", options: ["Yes, photos taken", "Not yet", "Unable to take photos"] });
      setStep(2);
    } else if (step === 2) {
      if (opt !== "Yes, photos taken") msgs.push({ role: "ai", text: "If safe, capture: vehicle damage, number plates, road conditions, and surroundings. This evidence is crucial for your insurance claim." });
      msgs.push({ role: "ai", text: "Do you need legal assistance or FIR guidance?", options: ["Yes, need legal help", "Need FIR guidance", "Just documenting"] });
      setStep(3);
    } else if (step === 3) {
      msgs.push({ role: "ai", text: "Based on your situation, here are your next steps:\n\n✓ Collect photo evidence\n✓ Generate official incident report\n✓ Contact your insurer within 24 hours\n✓ File FIR if required (injury / property damage)" });
      msgs.push({ role: "ai", text: "Ready to generate your incident report?", action: { label: "Generate Report →", route: "/report" } });
      setStep(4);
    }
    setMessages(msgs);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const msgs = [...messages, { role: "user" as const, text: input }];
    setMessages(msgs);
    setInput("");
    setTimeout(() => setMessages([...msgs, { role: "ai", text: "Thank you. Let me help you with that." }]), 600);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: C.offWhite }}>
      <NotchOverlay />
      <StatusBar />
      <ScreenHeader title="AI Accident Assistant" onBack={() => navigate("/home")}
        action={<div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${C.navy}10` }}><Bot size={20} style={{ color: C.navy }} /></div>} />
      {/* Step progress */}
      <div className="px-5 py-2 flex items-center gap-1.5" style={{ background: C.white, borderBottom: `1px solid ${C.grayBorder}` }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i <= step ? C.navy : C.grayBorder, transition: "background 0.3s" }} />
        ))}
        <span className="text-xs ml-2 font-medium" style={{ color: C.gray, fontFamily: "Inter" }}>Step {Math.min(step+1, 5)}/5</span>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: msg.role === "ai" ? C.navy : C.green }}>
              {msg.role === "ai" ? <Bot size={15} color="white" /> : <User size={15} color="white" />}
            </div>
            <div className={`flex-1 ${msg.role === "user" ? "flex justify-end" : ""}`}>
              <div className="rounded-2xl px-4 py-3 max-w-[86%]"
                style={{ background: msg.role === "ai" ? C.white : C.navy, color: msg.role === "ai" ? C.navy : "white", border: msg.role === "ai" ? `1px solid ${C.grayBorder}` : "none", boxShadow: msg.role === "ai" ? elev.sm : "none" }}>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ fontFamily: "Inter" }}>{msg.text}</p>
                {msg.options && (
                  <div className="flex flex-col gap-2 mt-3">
                    {msg.options.map((opt, j) => (
                      <button key={j} onClick={() => handleOption(opt)}
                        className="rounded-xl px-4 py-2.5 text-sm font-medium flex items-center justify-between"
                        style={{ background: C.offWhite, border: `1px solid ${C.grayBorder}` }}>
                        <span style={{ color: C.navy, fontFamily: "Inter" }}>{opt}</span>
                        <ChevronRight size={15} style={{ color: C.gray }} />
                      </button>
                    ))}
                  </div>
                )}
                {msg.action && (
                  <button onClick={() => navigate(msg.action!.route)}
                    className="rounded-xl px-5 py-3 mt-3 w-full text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ background: C.green, color: "white", boxShadow: `0 4px 14px ${C.green}40`, fontFamily: "Inter" }}>
                    <CheckCircle size={16} /> {msg.action.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Input */}
      <div className="px-5 py-4 flex items-center gap-3"
        style={{ background: C.white, borderTop: `1px solid ${C.grayBorder}`, boxShadow: "0 -2px 8px rgba(0,0,0,0.03)" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="Type your message…"
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: C.offWhite, border: `1px solid ${C.grayBorder}`, color: C.navy, fontFamily: "Inter" }} />
        <button onClick={handleSend} className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: input.trim() ? C.navy : C.grayBorder, boxShadow: input.trim() ? `0 4px 12px ${C.navy}30` : "none", transition: "all 0.2s" }}>
          <Send size={17} color="white" />
        </button>
      </div>
    </div>
  );
}

// ─── Evidence Vault ────────────────────────────────────────────────────────────
type Evidence = { id: string; type: "photo" | "video" | "document"; name: string; date: string; size: string };
const SAMPLE_EVIDENCE: Evidence[] = [
  { id: "1", type: "photo", name: "Front Damage", date: "Today, 3:45 PM", size: "2.4 MB" },
  { id: "2", type: "photo", name: "Rear Damage", date: "Today, 3:46 PM", size: "2.1 MB" },
  { id: "3", type: "photo", name: "License Plate", date: "Today, 3:47 PM", size: "1.8 MB" },
  { id: "4", type: "video", name: "Accident Scene", date: "Today, 3:48 PM", size: "12.5 MB" },
  { id: "5", type: "document", name: "Insurance Card", date: "Yesterday", size: "156 KB" },
];

function EvidenceVault() {
  const navigate = useNav();
  const evColors = { photo: C.green, video: "#8B5CF6", document: "#0284C7" };
  const getIcon = (t: Evidence["type"]) => t === "photo" ? Camera : t === "video" ? Video : FileText;

  return (
    <div className="flex flex-col h-full" style={{ background: C.offWhite }}>
      <NotchOverlay />
      <StatusBar />
      <ScreenHeader title="Evidence Vault" onBack={() => navigate("/home")} />
      {/* Stats strip */}
      <div className="px-5 py-4" style={{ background: C.white, borderBottom: `1px solid ${C.grayBorder}` }}>
        <div className="grid grid-cols-3 gap-3">
          {[{label:"Photos",count:"3",color:C.green},{label:"Videos",count:"1",color:"#8B5CF6"},{label:"Documents",count:"1",color:"#0284C7"}].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: `${s.color}10` }}>
              <p className="text-2xl font-bold mb-0.5" style={{ color: s.color, fontFamily: "Inter" }}>{s.count}</p>
              <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Upload buttons */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-xs font-bold mb-3" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>ADD EVIDENCE</p>
        <div className="grid grid-cols-3 gap-3">
          {[{icon:Camera,label:"Photo",c:C.green},{icon:Video,label:"Video",c:"#8B5CF6"},{icon:Upload,label:"Document",c:"#0284C7"}].map(({icon:Icon,label,c}) => (
            <button key={label} className="rounded-2xl p-4 flex flex-col items-center gap-2"
              style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${c}14` }}>
                <Icon size={22} style={{ color: c }} strokeWidth={2} />
              </div>
              <span className="text-sm font-medium" style={{ color: C.navy, fontFamily: "Inter" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Evidence list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <p className="text-xs font-bold mb-3" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>COLLECTED EVIDENCE</p>
        <div className="flex flex-col gap-2">
          {SAMPLE_EVIDENCE.map(item => {
            const Icon = getIcon(item.type);
            const color = evColors[item.type];
            return (
              <div key={item.id} className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}14` }}>
                  <Icon size={22} style={{ color }} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5 truncate" style={{ color: C.navy, fontFamily: "Inter" }}>{item.name}</p>
                  <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{item.date} · {item.size}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.offWhite }}><Eye size={15} style={{ color: C.navy }} /></button>
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.redLight }}><Trash2 size={15} style={{ color: C.red }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-5 pb-6">
        <button onClick={() => navigate("/report")} className="w-full py-4 rounded-2xl text-base font-semibold"
          style={{ background: C.navy, color: "white", boxShadow: `0 8px 24px ${C.navy}30, inset 0 1px 0 rgba(255,255,255,0.1)`, fontFamily: "Inter" }}>
          Generate Report
        </button>
      </div>
    </div>
  );
}

// ─── Incident Report Generator ─────────────────────────────────────────────────
function IncidentReportGenerator() {
  const navigate = useNav();
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setDone(true); }, 2800);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: C.offWhite }}>
      <NotchOverlay />
      <StatusBar />
      <ScreenHeader title="Incident Report" onBack={() => navigate("/home")} />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!done ? (
          <>
            {/* Hero card */}
            <div className="rounded-2xl p-5 mb-5"
              style={{ background: C.navy, boxShadow: `0 8px 28px ${C.navy}35, inset 0 1px 0 rgba(255,255,255,0.08)` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.12)" }}>
                <FileText size={28} color="white" strokeWidth={1.8} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "white", fontFamily: "Inter" }}>AI-Powered Report Generation</h2>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.78)", fontFamily: "Inter" }}>
                Sarathi AI analyzes your evidence and conversation to generate a legally structured accident report for police and insurance use.
              </p>
            </div>
            {/* Report includes */}
            <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>REPORT INCLUDES</p>
            <div className="flex flex-col gap-2.5">
              {[
                { icon: Clock, label: "Incident Timeline", desc: "Exact date, time, and sequence of events" },
                { icon: MapPin, label: "Location Details", desc: "GPS coordinates and address" },
                { icon: Users, label: "Parties Involved", desc: "Vehicle and driver information" },
                { icon: FileText, label: "Evidence Summary", desc: "Organized photos, videos, and documents" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${C.green}14` }}>
                    <Icon size={20} style={{ color: C.green }} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: C.navy, fontFamily: "Inter" }}>{label}</p>
                    <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: C.greenLight, boxShadow: `0 8px 24px ${C.green}25` }}>
                <CheckCircle size={40} style={{ color: C.green }} strokeWidth={2} />
              </div>
              <h2 className="text-2xl font-bold mb-1.5" style={{ color: C.navy, fontFamily: "Inter" }}>Report Generated</h2>
              <p className="text-sm" style={{ color: C.gray, fontFamily: "Inter" }}>Your incident report is ready for download and sharing</p>
            </div>
            {/* Report preview */}
            <div className="rounded-2xl p-5 mb-5"
              style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.md }}>
              <p className="text-xs font-bold mb-4" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>INCIDENT REPORT SUMMARY</p>
              {[
                { label: "Incident ID", value: "INC-2026-BLR-0421" },
                { label: "Date & Time", value: "June 21, 2026 at 3:45 PM" },
                { label: "Location", value: "Koramangala 5th Block, Bangalore" },
                { label: "Evidence Collected", value: "3 Photos · 1 Video · 1 Document" },
                { label: "Parties Involved", value: "2 vehicles · No injuries reported" },
              ].map(({ label, value }, i, arr) => (
                <div key={label} className={i < arr.length - 1 ? "mb-3 pb-3" : ""} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.grayBorder}` : "none" }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: C.gray, fontFamily: "Inter" }}>{label}</p>
                  <p className="text-sm font-medium" style={{ color: C.navy, fontFamily: "Inter" }}>{value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <button className="w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2"
                style={{ background: C.navy, color: "white", boxShadow: `0 8px 24px ${C.navy}30`, fontFamily: "Inter" }}>
                <Download size={18} /> Download PDF
              </button>
              <button className="w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2"
                style={{ background: C.white, color: C.navy, border: `1px solid ${C.grayBorder}`, fontFamily: "Inter" }}>
                <Share2 size={18} /> Share with Insurance
              </button>
            </div>
          </>
        )}
      </div>
      {!done && (
        <div className="px-5 pb-6">
          <button onClick={handleGenerate} disabled={generating}
            className="w-full py-4 rounded-2xl text-base font-semibold"
            style={{ background: generating ? C.grayBorder : C.green, color: "white", boxShadow: generating ? "none" : `0 8px 24px ${C.green}40`, fontFamily: "Inter", transition: "all 0.3s" }}>
            {generating ? "Generating Report…" : "Generate Report"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Legal Assistance ──────────────────────────────────────────────────────────
const STATE_TRAFFIC_LAWS: Record<string, { highlights: { title: string; desc: string }[]; fines: { offence: string; penalty: string }[] }> = {
  Karnataka: {
    highlights: [
      { title: "Helmet for rider & pillion", desc: "Mandatory under KMV Rules; non-compliance attracts ₹1,000 fine + 3-month licence suspension." },
      { title: "Bengaluru Traffic Police e-challan", desc: "Pay online at btp.karnataka.gov.in; 50% discount if paid within Lok Adalat window." },
      { title: "Drunk driving — zero tolerance", desc: "BAC > 30mg/100ml = ₹10,000 + 6 months jail (1st offence)." },
    ],
    fines: [
      { offence: "Riding without helmet", penalty: "₹1,000 + DL suspension 3 months" },
      { offence: "Using mobile while driving", penalty: "₹5,000 (subsequent: ₹10,000)" },
      { offence: "Overspeeding (LMV)", penalty: "₹1,000 – ₹2,000" },
      { offence: "Driving without licence", penalty: "₹5,000" },
      { offence: "No insurance", penalty: "₹2,000 / 3 months jail" },
    ],
  },
  Maharashtra: {
    highlights: [
      { title: "MV (Amendment) Act 2019 enforced", desc: "Mumbai/Pune use AI cameras; e-challans via Mahatrafficechallan portal." },
      { title: "High-security number plate (HSRP)", desc: "Mandatory for all vehicles registered before April 2019." },
      { title: "Pillion helmet rule", desc: "Enforced strictly across Mumbai, Pune, Nagpur — ₹500 fine." },
    ],
    fines: [
      { offence: "Signal jumping", penalty: "₹1,000 – ₹5,000" },
      { offence: "Drunk driving", penalty: "₹10,000 + 6 months jail" },
      { offence: "Rash driving", penalty: "₹1,000 (1st), ₹2,000 (repeat)" },
      { offence: "No seat belt", penalty: "₹1,000" },
      { offence: "Triple riding", penalty: "₹1,000" },
    ],
  },
  Delhi: {
    highlights: [
      { title: "Odd-Even scheme", desc: "May be invoked during high pollution; ₹20,000 fine for violation." },
      { title: "PUC certificate mandatory", desc: "Driving without valid PUC: ₹10,000 + 6 months jail." },
      { title: "BS-VI compliance", desc: "Diesel >10 yrs & petrol >15 yrs banned in NCR." },
    ],
    fines: [
      { offence: "No PUC certificate", penalty: "₹10,000" },
      { offence: "Overspeeding", penalty: "₹2,000 – ₹4,000" },
      { offence: "Red light jumping", penalty: "₹5,000" },
      { offence: "No helmet", penalty: "₹1,000 + DL suspension" },
      { offence: "Drunk driving", penalty: "₹10,000 + jail" },
    ],
  },
  "Tamil Nadu": {
    highlights: [
      { title: "Compulsory helmet for both riders", desc: "Strict enforcement in Chennai, Coimbatore." },
      { title: "e-challan via TN Traffic Police app", desc: "Cashless payment; 15-day window before court referral." },
      { title: "High-beam restriction", desc: "Prohibited inside city limits — ₹500 fine." },
    ],
    fines: [
      { offence: "No helmet", penalty: "₹1,000" },
      { offence: "Mobile use while driving", penalty: "₹5,000" },
      { offence: "Overloading two-wheeler", penalty: "₹1,000" },
      { offence: "Wrong-side driving", penalty: "₹1,000 – ₹2,000" },
      { offence: "Drunk driving", penalty: "₹10,000 + jail" },
    ],
  },
  Telangana: {
    highlights: [
      { title: "Hyderabad Traffic Police e-challan", desc: "Pay at echallan.tspolice.gov.in; defaulters face vehicle seizure." },
      { title: "Mandatory pillion helmet", desc: "Enforced since 2021 — ₹1,035 fine." },
      { title: "Cashless trauma care", desc: "Free first 48 hrs treatment at empanelled hospitals." },
    ],
    fines: [
      { offence: "Signal jumping", penalty: "₹1,035" },
      { offence: "Triple riding", penalty: "₹1,200" },
      { offence: "No helmet", penalty: "₹1,035" },
      { offence: "Drunk driving", penalty: "₹10,000 + 6 months jail" },
      { offence: "Wrong-side driving", penalty: "₹1,100" },
    ],
  },
};

function LegalAssistance() {
  const navigate = useNav();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedState, setSelectedState] = useState<string>("Karnataka");
  const [showLaws, setShowLaws] = useState(true);
  const states = Object.keys(STATE_TRAFFIC_LAWS);
  const stateData = STATE_TRAFFIC_LAWS[selectedState];
  const topics = [
    { icon: Shield, title: "Your Rights After Accident", desc: "Know your legal rights and responsibilities", color: C.green },
    { icon: FileText, title: "How to File an FIR", desc: "Step-by-step FIR filing guidance", color: "#0284C7" },
    { icon: Scale, title: "Insurance Claim Process", desc: "Navigate insurance claims smoothly", color: C.amber },
  ];
  const faqs = [
    { q: "What should I do immediately after an accident?", a: "Ensure safety, call emergency services if needed, take photos, exchange information with other parties, and do not admit fault at the scene." },
    { q: "Is filing an FIR mandatory for all accidents?", a: "No. FIR is mandatory only if there is injury, death, or significant property damage. For minor incidents, you can settle mutually with the other party." },
    { q: "What documents do I need for insurance claims?", a: "FIR copy (if filed), driving license, RC book, insurance policy, photographs of damage, and repair estimates from an authorised garage." },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: C.offWhite }}>
      <NotchOverlay />
      <StatusBar />
      <ScreenHeader title="Legal Assistance" onBack={() => navigate("/home")} />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* AI chat prompt */}
        <button className="w-full rounded-2xl p-4 flex items-center gap-3 mb-5"
          style={{ background: `${C.navy}07`, border: `1px solid ${C.navy}18` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.navy }}>
            <HelpCircle size={20} color="white" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold mb-0.5" style={{ color: C.navy, fontFamily: "Inter" }}>Ask Sarathi Legal AI</p>
            <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>Get instant answers to your legal questions</p>
          </div>
          <ChevronRight size={18} style={{ color: C.navy }} />
        </button>

        {/* State Traffic Laws */}
        <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>STATE TRAFFIC LAWS</p>
        <div className="rounded-2xl p-4 mb-5" style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${C.navy}14` }}>
              <BookOpen size={20} style={{ color: C.navy }} strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: C.navy, fontFamily: "Inter" }}>Traffic Laws by State</p>
              <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>Select your state to view rules & fines</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {states.map((s) => (
              <button key={s} onClick={() => { setSelectedState(s); setShowLaws(true); }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0"
                style={{
                  background: selectedState === s && showLaws ? C.navy : C.offWhite,
                  color: selectedState === s && showLaws ? "white" : C.navy,
                  border: `1px solid ${selectedState === s && showLaws ? C.navy : C.grayBorder}`,
                  fontFamily: "Inter",
                }}>
                {s}
              </button>
            ))}
          </div>
          {showLaws && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.grayBorder}` }}>
              <p className="text-xs font-bold mb-2" style={{ color: C.navy, letterSpacing: "0.05em", fontFamily: "Inter" }}>KEY HIGHLIGHTS</p>
              <div className="flex flex-col gap-2 mb-4">
                {stateData.highlights.map((h, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: C.offWhite }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: C.navy, fontFamily: "Inter" }}>{h.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: C.gray, fontFamily: "Inter" }}>{h.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold mb-2" style={{ color: C.navy, letterSpacing: "0.05em", fontFamily: "Inter" }}>COMMON FINES</p>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.grayBorder}` }}>
                {stateData.fines.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5"
                    style={{ background: i % 2 === 0 ? C.white : C.offWhite, borderTop: i === 0 ? "none" : `1px solid ${C.grayBorder}` }}>
                    <p className="text-xs flex-1 pr-2" style={{ color: C.navy, fontFamily: "Inter" }}>{f.offence}</p>
                    <p className="text-xs font-semibold whitespace-nowrap" style={{ color: C.red, fontFamily: "Inter" }}>{f.penalty}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-3 italic" style={{ color: C.grayLight, fontFamily: "Inter" }}>
                Source: Motor Vehicles (Amendment) Act 2019 & state notifications. Penalties may change — verify with local RTO.
              </p>
            </div>
          )}
        </div>

        {/* Topics */}
        <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>LEGAL TOPICS</p>
        <div className="flex flex-col gap-2.5 mb-5">
          {topics.map(({ icon: Icon, title, desc, color }) => (
            <button key={title} className="rounded-2xl p-4 flex items-center gap-3 text-left"
              style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}14` }}>
                <Icon size={22} style={{ color }} strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold mb-0.5" style={{ color: C.navy, fontFamily: "Inter" }}>{title}</p>
                <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{desc}</p>
              </div>
              <ChevronRight size={17} style={{ color: C.grayLight }} />
            </button>
          ))}
        </div>
        {/* FAQs */}
        <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>FREQUENTLY ASKED</p>
        <div className="flex flex-col gap-2 mb-5">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-2xl overflow-hidden"
              style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full px-4 py-4 flex items-start gap-3 text-left">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: C.offWhite }}>
                  <HelpCircle size={13} style={{ color: C.navy }} />
                </div>
                <p className="flex-1 text-sm font-semibold" style={{ color: C.navy, fontFamily: "Inter" }}>{faq.q}</p>
                <ChevronDown size={17} style={{ color: C.gray, transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4" style={{ borderTop: `1px solid ${C.grayBorder}` }}>
                  <p className="text-sm leading-relaxed pt-3 pl-9" style={{ color: C.gray, fontFamily: "Inter" }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* CTA */}
        <div className="rounded-2xl p-5" style={{ background: C.green, boxShadow: `0 8px 24px ${C.green}35` }}>
          <h3 className="text-lg font-bold mb-1.5" style={{ color: "white", fontFamily: "Inter" }}>Need Personal Legal Advice?</h3>
          <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.88)", fontFamily: "Inter" }}>Connect with verified traffic lawyers for personalised assistance.</p>
          <button className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: "white", color: C.green, fontFamily: "Inter" }}>Contact a Lawyer</button>
        </div>
      </div>
    </div>
  );
}

// ─── RoadWatch Screen ──────────────────────────────────────────────────────────
const HAZARD_ZONES: Array<{ position: { lat: number; lng: number }; severity: "high" | "medium" | "low"; incidents: number; name: string }> = [
  { position: { lat: 12.9352, lng: 77.6245 }, severity: "high", incidents: 12, name: "MG Road Junction" },
  { position: { lat: 12.9279, lng: 77.6271 }, severity: "medium", incidents: 7, name: "Koramangala Signal" },
  { position: { lat: 12.9395, lng: 77.6214 }, severity: "low", incidents: 3, name: "Richmond Circle" },
];

const NEARBY_CATEGORIES: Array<{ id: string; label: string; types: string[]; color: string }> = [
  { id: "all", label: "All", types: ["hospital", "police", "gas_station", "car_repair"], color: C.navy },
  { id: "hospital", label: "Hospitals", types: ["hospital"], color: C.red },
  { id: "police", label: "Police", types: ["police"], color: C.blue },
  { id: "gas_station", label: "Fuel", types: ["gas_station"], color: C.amber },
  { id: "car_repair", label: "Repair", types: ["car_repair"], color: C.green },
];

function RoadWatchScreen() {
  const navigate = useNav();
  const fallback = { lat: 12.9316, lng: 77.6245 };
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [catId, setCatId] = useState<string>("all");
  const cat = NEARBY_CATEGORIES.find((c) => c.id === catId)!;

  return (
    <div className="flex flex-col h-full relative">
      <NotchOverlay />
      <StatusBar />
      <div className="flex-1 relative">
        <GoogleMapView
          hazards={HAZARD_ZONES}
          fallbackCenter={fallback}
          nearbyFilter={cat.types}
          onNearbyChange={setPlaces}
        />
        <div className="absolute top-3 left-0 right-0 px-5 z-[1000] flex items-center justify-between pointer-events-none">
          <button onClick={() => navigate("/home")} className="w-11 h-11 rounded-xl flex items-center justify-center pointer-events-auto"
            style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.md }}>
            <ArrowLeft size={18} style={{ color: C.navy }} />
          </button>
          <div className="flex gap-2 pointer-events-auto">
            {[Layers, Filter].map((Icon, i) => (
              <button key={i} className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.md }}>
                <Icon size={18} style={{ color: C.navy }} />
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] rounded-t-3xl px-5 py-4"
        style={{ background: C.white, boxShadow: "0 -8px 32px rgba(0,0,0,0.1)", maxHeight: "48%" }}>
        <div className="flex justify-center mb-3"><div style={{ width: 40, height: 4, borderRadius: 99, background: C.grayBorder }} /></div>
        <h2 className="text-lg font-bold mb-1" style={{ color: C.navy, fontFamily: "Inter" }}>Nearby Around You</h2>
        <p className="text-xs mb-3" style={{ color: C.gray, fontFamily: "Inter" }}>Live results from Google Maps</p>
        {/* Category chips */}
        <div className="flex gap-2 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {NEARBY_CATEGORIES.map((c) => {
            const active = c.id === catId;
            return (
              <button key={c.id} onClick={() => setCatId(c.id)}
                className="px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap"
                style={{
                  background: active ? c.color : C.offWhite,
                  color: active ? "#fff" : C.navy,
                  border: `1px solid ${active ? c.color : C.grayBorder}`,
                  fontFamily: "Inter",
                }}>
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 200 }}>
          {places.length === 0 && (
            <p className="text-xs py-4 text-center" style={{ color: C.gray, fontFamily: "Inter" }}>
              Allow location to see nearby places…
            </p>
          )}
          {places.map((p) => {
            const color =
              p.primaryType === "hospital" ? C.red :
              p.primaryType === "police" ? C.blue :
              p.primaryType === "gas_station" ? C.amber :
              p.primaryType === "car_repair" ? C.green : C.gray;
            return (
              <div key={p.id} className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: C.offWhite, border: `1px solid ${C.grayBorder}` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}1A` }}>
                  <MapPin size={16} style={{ color }} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: C.navy, fontFamily: "Inter" }}>{p.name}</p>
                  <p className="text-xs truncate" style={{ color: C.gray, fontFamily: "Inter" }}>
                    {p.address || p.primaryType.replace("_", " ")}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold" style={{ color: C.navy, fontFamily: "Inter" }}>
                    {p.distanceKm != null ? `${p.distanceKm.toFixed(1)} km` : ""}
                  </p>
                  {p.rating != null && (
                    <p className="text-[10px]" style={{ color: C.gray, fontFamily: "Inter" }}>
                      ★ {p.rating.toFixed(1)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



// ─── Document Wallet ───────────────────────────────────────────────────────────
type Doc = { id: string; name: string; type: string; status: "valid" | "expiring" | "expired"; expiry: string; daysLeft: number };
const DOCS: Doc[] = [
  { id: "1", name: "Driving License", type: "DL", status: "valid", expiry: "Dec 15, 2028", daysLeft: 912 },
  { id: "2", name: "Vehicle RC", type: "RC", status: "valid", expiry: "Mar 22, 2027", daysLeft: 274 },
  { id: "3", name: "Insurance Policy", type: "Insurance", status: "expiring", expiry: "Jul 10, 2026", daysLeft: 19 },
  { id: "4", name: "PUC Certificate", type: "PUC", status: "expired", expiry: "May 20, 2026", daysLeft: -32 },
];

function DocumentWallet() {
  const navigate = useNav();
  const statusMap = { valid: { color: C.green, bg: C.greenLight, label: "Valid" }, expiring: { color: C.amber, bg: C.amberLight, label: "Expiring" }, expired: { color: C.red, bg: C.redLight, label: "Expired" } };
  const validCount = DOCS.filter(d => d.status === "valid").length;

  return (
    <div className="flex flex-col h-full" style={{ background: C.offWhite }}>
      <NotchOverlay />
      <StatusBar />
      <ScreenHeader title="Document Wallet" onBack={() => navigate("/home")}
        action={<button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.navy }}><Plus size={17} color="white" /></button>} />
      {/* Compliance banner */}
      <div className="px-5 py-4" style={{ background: C.white, borderBottom: `1px solid ${C.grayBorder}` }}>
        <div className="rounded-2xl p-4" style={{ background: `${C.green}0D`, border: `1px solid ${C.green}25` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: C.green, fontFamily: "Inter" }}>Document Compliance</p>
              <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{validCount} of {DOCS.length} documents valid</p>
            </div>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: C.green }}>
              <span className="text-lg font-bold" style={{ color: "white", fontFamily: "Inter" }}>{Math.round((validCount/DOCS.length)*100)}%</span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: "rgba(0,0,0,0.06)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(validCount/DOCS.length)*100}%`, background: C.green }} />
          </div>
        </div>
      </div>
      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>MY DOCUMENTS</p>
        <div className="flex flex-col gap-3">
          {DOCS.map(doc => {
            const s = statusMap[doc.status];
            return (
              <div key={doc.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                    <FileText size={22} style={{ color: s.color }} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1.5" style={{ color: C.navy, fontFamily: "Inter" }}>{doc.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: s.bg, color: s.color, fontFamily: "Inter" }}>{s.label}</span>
                      <span className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{doc.type}</span>
                    </div>
                  </div>
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.offWhite }}><Eye size={15} style={{ color: C.navy }} /></button>
                </div>
                <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: C.offWhite }}>
                  <div className="flex items-center gap-2">
                    <Clock size={13} style={{ color: C.gray }} />
                    <span className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>Expires: {doc.expiry}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: doc.daysLeft < 0 ? C.red : doc.daysLeft < 30 ? C.amber : C.green, fontFamily: "Inter" }}>
                    {doc.daysLeft < 0 ? `${Math.abs(doc.daysLeft)}d ago` : `${doc.daysLeft}d left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-5 pb-6">
        <div className="rounded-2xl p-4" style={{ background: C.navy, boxShadow: `0 8px 24px ${C.navy}30` }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "white", fontFamily: "Inter" }}>Enable expiry reminders</p>
          <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter" }}>Get alerts 30 days before your documents expire</p>
          <button className="px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "white", color: C.navy, fontFamily: "Inter" }}>Enable Notifications</button>
        </div>
      </div>
    </div>
  );
}

// ─── Voice Assistant ───────────────────────────────────────────────────────────
const WAVE_AMP = [28,55,80,42,90,32,68,52,78,38,72,48];
const VOICE_CMDS = ["Report an accident", "Find nearest hospital", "Call emergency contacts", "Check traffic violations", "Navigate to police station"];

function VoiceAssistant() {
  const navigate = useNav();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    if (!listening) return;
    const t = setTimeout(() => { setTranscript("Find the nearest police station"); setListening(false); }, 2200);
    return () => clearTimeout(t);
  }, [listening]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden"
      style={{ background: listening ? C.navy : C.offWhite, transition: "background 0.4s" }}>
      <NotchOverlay />
      <StatusBar light={listening} />
      {listening && <>
        <div style={{ position: "absolute", top: -80, left: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, right: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      </>}
      <div className="px-5 pt-2 pb-3 flex items-center justify-between">
        <button onClick={() => navigate("/home")} className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: listening ? "rgba(255,255,255,0.12)" : C.white, border: listening ? "none" : `1px solid ${C.grayBorder}` }}>
          <ArrowLeft size={18} style={{ color: listening ? "white" : C.navy }} />
        </button>
        <h1 className="text-lg font-bold" style={{ color: listening ? "white" : C.navy, fontFamily: "Inter" }}>Voice Assistant</h1>
        <div className="w-9" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative mb-8">
          {listening && <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(255,255,255,0.18)", animationDuration: "1.5s" }} />}
          <button onClick={() => setListening(!listening)} className="relative w-40 h-40 rounded-full flex items-center justify-center"
            style={{ background: listening ? "white" : C.navy, boxShadow: listening ? "0 20px 60px rgba(0,0,0,0.28)" : `0 20px 60px ${C.navy}40, inset 0 2px 0 rgba(255,255,255,0.1)` }}>
            {listening ? <MicOff size={52} style={{ color: C.navy }} strokeWidth={1.8} /> : <Mic size={52} color="white" strokeWidth={1.8} />}
          </button>
        </div>
        {listening && (
          <div className="flex items-center gap-1 mb-8" style={{ height: 60 }}>
            {WAVE_AMP.map((h, i) => (
              <div key={i} style={{ width: 4, height: h, borderRadius: 99, background: "white", animation: "wavebar 0.9s ease-in-out infinite alternate", animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        )}
        <div className="text-center mb-8">
          {listening
            ? <><h2 className="text-2xl font-bold mb-1.5" style={{ color: "white", fontFamily: "Inter" }}>Listening…</h2><p className="text-sm" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter" }}>Speak clearly into your device</p></>
            : transcript
              ? <><h2 className="text-lg font-bold mb-3" style={{ color: C.navy, fontFamily: "Inter" }}>You said:</h2>
                  <p className="text-base px-5 py-3 rounded-2xl" style={{ color: C.navy, background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.sm, fontFamily: "Inter" }}>"{transcript}"</p>
                  <button onClick={() => setTranscript("")} className="mt-3 text-sm font-semibold" style={{ color: C.navy, fontFamily: "Inter" }}>Clear</button></>
              : <><h2 className="text-2xl font-bold mb-1.5" style={{ color: C.navy, fontFamily: "Inter" }}>Tap to Speak</h2><p className="text-sm" style={{ color: C.gray, fontFamily: "Inter" }}>Hands-free control for safer driving</p></>
          }
        </div>
      </div>
      {!listening && !transcript && (
        <div className="px-5 pb-6">
          <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.sm }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${C.navy}0C` }}>
                <Volume2 size={20} style={{ color: C.navy }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: C.navy, fontFamily: "Inter" }}>Try saying…</p>
                <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>Quick voice commands</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {VOICE_CMDS.map((cmd, i) => (
                <button key={i} className="px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{ background: C.offWhite, color: C.navy, border: `1px solid ${C.grayBorder}`, fontFamily: "Inter" }}>"{cmd}"</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Screen ────────────────────────────────────────────────────────────
function ProfileScreen() {
  const navigate = useNav();
  const metrics = [
    { label: "Driving Score", value: 87, color: C.green },
    { label: "Compliance", value: 75, color: C.blue },
    { label: "Emergency Readiness", value: 100, color: C.navy },
  ];
  const menuItems = [
    { icon: User, label: "Personal Information" },
    { icon: Bell, label: "Notifications" },
    { icon: Shield, label: "Privacy & Security" },
    { icon: HelpCircle, label: "Help & Support" },
    { icon: Settings, label: "App Settings" },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: C.offWhite }}>
      <NotchOverlay />
      <StatusBar light />
      {/* Navy gradient header with spatial depth */}
      <div className="px-5 pt-2 pb-7 relative overflow-hidden" style={{ background: `linear-gradient(140deg, ${C.navy} 0%, ${C.navyLight} 60%, #243756 100%)` }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${C.red}40 0%, transparent 70%)`, filter: "blur(20px)" }} />
        <div style={{ position: "absolute", bottom: -50, left: -30, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue}38 0%, transparent 70%)`, filter: "blur(24px)" }} />
        <div className="flex items-center justify-between mb-6 relative z-10">
          <button onClick={() => navigate("/home")} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}>
            <ArrowLeft size={18} color="white" />
          </button>
          <h1 className="text-lg font-bold" style={{ color: "white", fontFamily: "Inter" }}>Profile</h1>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}>
            <Settings size={18} color="white" />
          </button>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
              style={{ background: C.white, color: C.navy, boxShadow: `0 10px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.9)`, fontFamily: "Inter" }}>AK</div>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: C.red, boxShadow: `0 4px 12px ${C.red}80, 0 0 0 2px ${C.navy}` }}>
              <Edit3 size={13} color="white" strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-0.5" style={{ color: "white", fontFamily: "Inter" }}>Arjun Kumar</h2>
            <p className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter" }}>arjun@example.com</p>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.35)" }}>
              <Award size={12} color={C.amber} />
              <span className="text-xs font-semibold" style={{ color: C.amber, fontFamily: "Inter" }}>Safe Driver · Premium</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Safety scores */}
        <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>SAFETY SCORES</p>
        <div className="rounded-2xl p-5 mb-5" style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.sm }}>
          {metrics.map((m, i) => (
            <div key={m.label} className={i < metrics.length - 1 ? "mb-4 pb-4" : ""} style={{ borderBottom: i < metrics.length - 1 ? `1px solid ${C.grayBorder}` : "none" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity size={15} style={{ color: m.color }} />
                  <span className="text-sm font-medium" style={{ color: C.navy, fontFamily: "Inter" }}>{m.label}</span>
                </div>
                <span className="text-lg font-bold" style={{ color: m.color, fontFamily: "Inter" }}>{m.value}<span className="text-sm font-normal" style={{ color: C.gray }}>/100</span></span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: C.grayBorder }}>
                <div className="h-full rounded-full" style={{ width: `${m.value}%`, background: m.color, transition: "width 0.4s ease" }} />
              </div>
            </div>
          ))}
        </div>
        {/* Activity stats */}
        <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>ACTIVITY</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[{label:"Trips",value:"142",icon:Activity},{label:"Safe Days",value:"89",icon:Shield},{label:"Reports",value:"2",icon:FileText}].map(({label,value,icon:Icon}) => (
            <div key={label} className="rounded-2xl p-4 text-center" style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: C.offWhite }}>
                <Icon size={18} style={{ color: C.navy }} />
              </div>
              <p className="text-xl font-bold mb-0.5" style={{ color: C.navy, fontFamily: "Inter" }}>{value}</p>
              <p className="text-xs" style={{ color: C.gray, fontFamily: "Inter" }}>{label}</p>
            </div>
          ))}
        </div>
        {/* Settings menu */}
        <p className="text-xs font-bold mb-3 px-1" style={{ color: C.gray, letterSpacing: "0.08em", fontFamily: "Inter" }}>SETTINGS</p>
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: elev.sm }}>
          {menuItems.map(({ icon: Icon, label }, i) => (
            <button key={label} className="w-full px-4 py-4 flex items-center gap-3"
              style={{ borderBottom: i < menuItems.length - 1 ? `1px solid ${C.grayBorder}` : "none" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.offWhite }}>
                <Icon size={18} style={{ color: C.navy }} />
              </div>
              <span className="flex-1 text-left text-sm font-medium" style={{ color: C.navy, fontFamily: "Inter" }}>{label}</span>
              <ChevronRight size={17} style={{ color: C.grayLight }} />
            </button>
          ))}
        </div>
        <button onClick={() => navigate("/login")} className="w-full rounded-2xl py-4 flex items-center justify-center gap-2"
          style={{ background: C.white, color: C.red, border: `1px solid ${C.grayBorder}`, boxShadow: elev.xs, fontFamily: "Inter" }}>
          <LogOut size={17} /><span className="text-sm font-semibold">Log Out</span>
        </button>
        <p className="text-center mt-4 text-xs" style={{ color: C.grayLight, fontFamily: "Inter" }}>Sarathi AI v1.0.0 · Made in India 🇮🇳</p>
      </div>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
const NAV_WITH_BAR: Screen[] = ["home", "roadwatch", "documents", "legal", "profile", "sos"];

export default function App() {
  const [screen, setScreen] = useState<Screen>("onboarding");

  const navigate = (path: string) => setScreen(pathToScreen(path));
  const showNav = NAV_WITH_BAR.includes(screen);

  const renderScreen = () => {
    switch (screen) {
      case "onboarding": return <OnboardingScreen />;
      case "login":      return <LoginScreen />;
      case "home":       return <HomeScreen />;
      case "sos":        return <EmergencySOSScreen />;
      case "assistant":  return <AIAccidentAssistant />;
      case "evidence":   return <EvidenceVault />;
      case "report":     return <IncidentReportGenerator />;
      case "legal":      return <LegalAssistance />;
      case "roadwatch":  return <RoadWatchScreen />;
      case "documents":  return <DocumentWallet />;
      case "voice":      return <VoiceAssistant />;
      case "profile":    return <ProfileScreen />;
      default:           return <HomeScreen />;
    }
  };

  // Map screen to which nav tab is active
  const activeTab: Screen = (() => {
    if (screen === "legal") return "legal";
    if (screen === "roadwatch") return "roadwatch";
    if (screen === "documents") return "documents";
    if (screen === "profile") return "profile";
    if (screen === "sos") return "sos";
    return "home";
  })();

  return (
    <NavCtx.Provider value={navigate}>
      <style>{`
        @keyframes sosPulse { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2);opacity:0} }
        @keyframes wavebar { 0%{transform:scaleY(0.3)} 100%{transform:scaleY(1)} }
        ::-webkit-scrollbar { display: none; }
        * { -webkit-tap-highlight-color: transparent; }
        .leaflet-control-zoom { border-radius:12px!important;overflow:hidden;border:none!important;box-shadow:0 4px 14px rgba(0,0,0,0.14)!important }
        .leaflet-control-zoom a { border:none!important }
      `}</style>

      {/* Desktop scene — phone mockup centered on grey background */}
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: "#EAECF0", padding: 20 }}>
        {/* Subtle 3D tilt on desktop */}
        <div style={{ transform: "perspective(1400px) rotateX(1deg) rotateY(-1.5deg)", transformOrigin: "center center", transition: "transform 0.6s ease" }}>
          <div style={{
            width: 390, height: 844,
            borderRadius: 52,
            background: C.offWhite,
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12), 0 24px 60px rgba(0,0,0,0.16), 0 48px 96px rgba(0,0,0,0.12)",
          }}>
            {/* Phone edge bevel */}
            <div style={{ position: "absolute", inset: 0, borderRadius: 52, border: "1px solid rgba(255,255,255,0.6)", pointerEvents: "none", zIndex: 999 }} />

            {/* Screen content */}
            <div className="flex-1 overflow-hidden flex flex-col" key={screen} style={{ animation: "screenEntry 0.24s ease" }}>
              {renderScreen()}
            </div>

            {/* Bottom navigation — only on main screens */}
            {showNav && screen !== "sos" && (
              <BottomNav active={activeTab} onNavigate={s => setScreen(s)} />
            )}

            {/* Always-on voice SOS listener */}
            <VoiceSOSListener onTrigger={() => setScreen("sos")} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes screenEntry {
          from { opacity: 0; transform: perspective(800px) translateZ(-32px) translateY(8px); }
          to   { opacity: 1; transform: perspective(800px) translateZ(0) translateY(0); }
        }
      `}</style>
    </NavCtx.Provider>
  );
}
