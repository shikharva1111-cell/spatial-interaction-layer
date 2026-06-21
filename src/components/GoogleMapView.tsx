import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Navigation, Search, X, LocateFixed, AlertTriangle } from "lucide-react";
import { computeRoute, searchNearby } from "../lib/maps.functions";

export type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  primaryType: string;
  rating?: number;
  ratingCount?: number;
  distanceKm?: number;
};

const TYPE_META: Record<string, { label: string; color: string; emoji: string }> = {
  hospital: { label: "Hospital", color: "#DC2626", emoji: "H" },
  police: { label: "Police", color: "#1D4ED8", emoji: "P" },
  gas_station: { label: "Fuel", color: "#F59E0B", emoji: "F" },
  car_repair: { label: "Repair", color: "#059669", emoji: "R" },
};
function metaFor(type: string) {
  return TYPE_META[type] ?? { label: "Place", color: "#64748B", emoji: "•" };
}
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

declare global {
  interface Window {
    google: any;
    __initGoogleMapsCb?: () => void;
    __gmapsLoading?: Promise<void>;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;
  window.__gmapsLoading = new Promise<void>((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error("Missing Google Maps browser key"));
      return;
    }
    window.__initGoogleMapsCb = () => resolve();
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__initGoogleMapsCb",
      libraries: "places,geometry",
      v: "weekly",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return window.__gmapsLoading;
}

const C = {
  navy: "#0A1628",
  white: "#FFFFFF",
  offWhite: "#F8FAFC",
  gray: "#64748B",
  grayBorder: "#E2E8F0",
  red: "#DC2626",
  green: "#059669",
  amber: "#F59E0B",
  blue: "#2563EB",
};

export type Hazard = {
  position: { lat: number; lng: number };
  severity: "high" | "medium" | "low";
  name: string;
  incidents: number;
};

type RouteInfo = { distanceKm: number; durationMin: number; steps: string[] };

export function GoogleMapView({
  hazards,
  fallbackCenter,
  onNearbyChange,
  nearbyFilter,
}: {
  hazards: Hazard[];
  fallbackCenter: { lat: number; lng: number };
  onNearbyChange?: (places: NearbyPlace[]) => void;
  nearbyFilter?: string[];
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const followRef = useRef(true);
  const nearbyMarkersRef = useRef<any[]>([]);
  const lastFetchLocRef = useRef<{ lat: number; lng: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [computing, setComputing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; primary: string; secondary: string }>>([]);
  const [hazardAlerts, setHazardAlerts] = useState<Array<{ name: string; severity: Hazard["severity"]; incidents: number; distanceKm: number }>>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(false);

  const computeRouteFn = useServerFn(computeRoute);
  const searchNearbyFn = useServerFn(searchNearby);

  // Init map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const g = window.google;
        const map = new g.maps.Map(mapDivRef.current, {
          center: fallbackCenter,
          zoom: 14,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapRef.current = map;

        // Hazard circles
        hazards.forEach((h) => {
          const color = h.severity === "high" ? C.red : h.severity === "medium" ? C.amber : C.gray;
          new g.maps.Circle({
            map,
            center: h.position,
            radius: h.severity === "high" ? 300 : h.severity === "medium" ? 200 : 150,
            strokeColor: color,
            strokeOpacity: 0.7,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.18,
            clickable: false,
          });
        });

        // Drag disables follow
        map.addListener("dragstart", () => {
          followRef.current = false;
        });

        setReady(true);
      })
      .catch((e) => setError(e.message ?? "Maps failed to load"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time geolocation
  useEffect(() => {
    if (!ready || typeof navigator === "undefined" || !navigator.geolocation) return;
    const g = window.google;
    const onPos = (pos: GeolocationPosition) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLoc(loc);
      const map = mapRef.current;
      if (!map) return;
      if (!userMarkerRef.current) {
        userMarkerRef.current = new g.maps.Marker({
          map,
          position: loc,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: C.blue,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 3,
          },
          zIndex: 999,
        });
        accuracyCircleRef.current = new g.maps.Circle({
          map,
          center: loc,
          radius: Math.max(pos.coords.accuracy, 20),
          strokeColor: C.blue,
          strokeOpacity: 0.4,
          strokeWeight: 1,
          fillColor: C.blue,
          fillOpacity: 0.12,
          clickable: false,
        });
        map.setCenter(loc);
        map.setZoom(16);
      } else {
        userMarkerRef.current.setPosition(loc);
        accuracyCircleRef.current.setCenter(loc);
        accuracyCircleRef.current.setRadius(Math.max(pos.coords.accuracy, 20));
        if (followRef.current) map.panTo(loc);
      }
    };
    const onErr = () => {
      // Silent fallback — keep fallbackCenter
    };
    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000,
    });
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [ready]);

  // Real nearby places via Places API (New) — refetch when user moves > 500m or filter changes
  useEffect(() => {
    if (!ready || !userLoc) return;
    const last = lastFetchLocRef.current;
    if (last && haversineKm(last, userLoc) < 0.5 && !nearbyFilter) return;
    lastFetchLocRef.current = userLoc;
    let cancelled = false;
    searchNearbyFn({
      data: {
        lat: userLoc.lat,
        lng: userLoc.lng,
        radius: 3000,
        types: nearbyFilter && nearbyFilter.length ? nearbyFilter : undefined,
      },
    })
      .then((resp) => {
        if (cancelled) return;
        const g = window.google;
        const map = mapRef.current;
        nearbyMarkersRef.current.forEach((m) => m.setMap(null));
        nearbyMarkersRef.current = [];
        const places: NearbyPlace[] = resp.places.map((p) => ({
          ...p,
          distanceKm: haversineKm(userLoc, { lat: p.lat, lng: p.lng }),
        }));
        places.forEach((p) => {
          const meta = metaFor(p.primaryType);
          const marker = new g.maps.Marker({
            map,
            position: { lat: p.lat, lng: p.lng },
            title: p.name,
            label: { text: meta.emoji, color: "#fff", fontWeight: "700", fontSize: "12px" },
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: meta.color,
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          });
          nearbyMarkersRef.current.push(marker);
        });
        places.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
        onNearbyChange?.(places);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Failed to load nearby places");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, userLoc, nearbyFilter, searchNearbyFn, onNearbyChange]);

  // Places API (New) autocomplete via AutocompleteSuggestion
  useEffect(() => {
    if (!ready || !showSearch) return;
    const query = searchText.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          (await window.google.maps.importLibrary("places")) as any;
        if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken();
        const req: any = { input: query, sessionToken: sessionTokenRef.current };
        if (userLoc) {
          req.locationBias = {
            circle: { center: { lat: userLoc.lat, lng: userLoc.lng }, radius: 50000 },
          };
        }
        const { suggestions: out } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
        if (cancelled) return;
        setSuggestions(
          (out ?? [])
            .map((s: any) => {
              const p = s.placePrediction;
              if (!p) return null;
              return {
                placeId: p.placeId,
                primary: p.mainText?.text ?? p.text?.text ?? "",
                secondary: p.secondaryText?.text ?? "",
              };
            })
            .filter(Boolean)
            .slice(0, 6),
        );
      } catch (e) {
        if (!cancelled) setSuggestions([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchText, showSearch, ready, userLoc]);

  const pickSuggestion = useCallback(async (placeId: string, label: string) => {
    try {
      const { Place } = (await window.google.maps.importLibrary("places")) as any;
      const place = new Place({ id: placeId });
      await place.fetchFields({ fields: ["location", "displayName", "formattedAddress"] });
      const loc = place.location;
      if (!loc) return;
      setDestination({
        lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
        lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
        name: place.displayName ?? label,
      });
      setShowSearch(false);
      setSearchText("");
      setSuggestions([]);
      sessionTokenRef.current = null;
    } catch (e) {
      setError("Could not load destination");
    }
  }, []);


  // Compute route when destination set
  useEffect(() => {
    if (!destination || !userLoc || !ready) return;
    const g = window.google;
    const map = mapRef.current;
    setComputing(true);
    computeRouteFn({
      data: {
        origin: { lat: userLoc.lat, lng: userLoc.lng },
        destination: { lat: destination.lat, lng: destination.lng },
      },
    })
      .then((resp) => {
        const r = resp.routes?.[0];
        if (!r?.polyline?.encodedPolyline) throw new Error("No route");
        const path = g.maps.geometry.encoding.decodePath(r.polyline.encodedPolyline);

        routePolylineRef.current?.setMap(null);
        routePolylineRef.current = new g.maps.Polyline({
          map,
          path,
          strokeColor: C.blue,
          strokeOpacity: 0.95,
          strokeWeight: 6,
        });

        destMarkerRef.current?.setMap(null);
        destMarkerRef.current = new g.maps.Marker({
          map,
          position: destination,
          label: { text: "B", color: "#fff", fontWeight: "700" },
        });

        const bounds = new g.maps.LatLngBounds();
        path.forEach((p: any) => bounds.extend(p));
        map.fitBounds(bounds, 80);
        followRef.current = false;

        const seconds = parseInt((r.duration ?? "0s").replace("s", ""), 10);
        const steps =
          r.legs?.flatMap(
            (l) =>
              l.steps
                ?.map((s) => s.navigationInstruction?.instructions)
                .filter((x): x is string => Boolean(x)) ?? [],
          ) ?? [];
        setRoute({
          distanceKm: (r.distanceMeters ?? 0) / 1000,
          durationMin: Math.max(1, Math.round(seconds / 60)),
          steps,
        });

        // Detect accident-prone / hazard zones along this route
        const thresholdKm = { high: 0.5, medium: 0.35, low: 0.2 };
        const alerts = hazards
          .map((h) => {
            let minKm = Infinity;
            for (const pt of path) {
              const plat = typeof pt.lat === "function" ? pt.lat() : pt.lat;
              const plng = typeof pt.lng === "function" ? pt.lng() : pt.lng;
              const d = haversineKm(h.position, { lat: plat, lng: plng });
              if (d < minKm) minKm = d;
            }
            return { name: h.name, severity: h.severity, incidents: h.incidents, distanceKm: minKm };
          })
          .filter((a) => a.distanceKm <= thresholdKm[a.severity])
          .sort((a, b) => {
            const rank = { high: 0, medium: 1, low: 2 } as const;
            return rank[a.severity] - rank[b.severity];
          });
        setHazardAlerts(alerts);
        setDismissedAlerts(false);
      })
      .catch((e) => setError(e.message ?? "Route failed"))
      .finally(() => setComputing(false));
  }, [destination, userLoc, ready, computeRouteFn, hazards]);

  const recenter = useCallback(() => {
    if (userLoc && mapRef.current) {
      followRef.current = true;
      mapRef.current.panTo(userLoc);
      mapRef.current.setZoom(16);
    }
  }, [userLoc]);

  const clearRoute = useCallback(() => {
    routePolylineRef.current?.setMap(null);
    destMarkerRef.current?.setMap(null);
    routePolylineRef.current = null;
    destMarkerRef.current = null;
    setDestination(null);
    setRoute(null);
    setHazardAlerts([]);
    if (searchInputRef.current) searchInputRef.current.value = "";
  }, []);

  if (!BROWSER_KEY) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6 text-center" style={{ background: C.offWhite }}>
        <div>
          <AlertTriangle size={28} style={{ color: C.amber, margin: "0 auto 8px" }} />
          <p className="text-sm font-semibold" style={{ color: C.navy }}>Google Maps key missing</p>
          <p className="text-xs mt-1" style={{ color: C.gray }}>Connect Google Maps Platform to enable navigation.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={mapDivRef} className="absolute inset-0" />

      {error && (
        <div className="absolute top-20 left-5 right-5 z-[1000] rounded-xl px-3 py-2 text-xs"
          style={{ background: C.red, color: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.18)" }}>
          {error}
        </div>
      )}

      {/* Recenter button */}
      <button
        onClick={recenter}
        className="absolute z-[1000] w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ right: 20, bottom: 280, background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
        aria-label="Recenter"
      >
        <LocateFixed size={18} style={{ color: C.navy }} />
      </button>

      {/* Navigate / Search trigger */}
      {!destination && !showSearch && (
        <button
          onClick={() => setShowSearch(true)}
          className="absolute z-[1000] flex items-center gap-2 px-4 h-11 rounded-xl"
          style={{ right: 20, bottom: 330, background: C.navy, color: "#fff", boxShadow: "0 8px 22px rgba(10,22,40,0.35)" }}
        >
          <Navigation size={16} /> <span className="text-sm font-semibold">Navigate</span>
        </button>
      )}

      {/* Search bar + suggestions */}
      {showSearch && (
        <div className="absolute top-16 left-5 right-5 z-[1000] rounded-2xl overflow-hidden"
          style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          <div className="flex items-center gap-2 px-3 h-12">
            <Search size={16} style={{ color: C.gray }} />
            <input
              ref={searchInputRef}
              autoFocus
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Where to?"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: C.navy }}
            />
            <button
              onClick={() => { setShowSearch(false); setSearchText(""); setSuggestions([]); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg"
            >
              <X size={16} style={{ color: C.gray }} />
            </button>
          </div>
          {suggestions.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.grayBorder}` }}>
              {suggestions.map((s) => (
                <button
                  key={s.placeId}
                  onClick={() => pickSuggestion(s.placeId, s.primary)}
                  className="w-full text-left px-4 py-2.5 flex items-start gap-2 hover:bg-slate-50"
                  style={{ borderBottom: `1px solid ${C.grayBorder}` }}
                >
                  <Navigation size={14} style={{ color: C.gray, marginTop: 3 }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{s.primary}</p>
                    {s.secondary && <p className="text-xs truncate" style={{ color: C.gray }}>{s.secondary}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Route summary */}
      {destination && (
        <div className="absolute top-16 left-5 right-5 z-[1000] rounded-2xl p-3"
          style={{ background: C.white, border: `1px solid ${C.grayBorder}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${C.blue}18` }}>
              <Navigation size={16} style={{ color: C.blue }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{destination.name}</p>
              <p className="text-xs" style={{ color: C.gray }}>
                {computing
                  ? "Calculating route…"
                  : route
                    ? `${route.durationMin} min · ${route.distanceKm.toFixed(1)} km`
                    : "—"}
              </p>
            </div>
            <button onClick={clearRoute} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: C.offWhite }}>
              <X size={15} style={{ color: C.gray }} />
            </button>
          </div>
          {route && route.steps[0] && (
            <p className="mt-2 text-xs pl-11" style={{ color: C.navy }} dangerouslySetInnerHTML={{ __html: `Next: ${route.steps[0]}` }} />
          )}
        </div>
      )}

      {/* Hazard / accident-prone alerts along route */}
      {destination && hazardAlerts.length > 0 && !dismissedAlerts && (
        <div className="absolute left-5 right-5 z-[1000] rounded-2xl overflow-hidden"
          style={{ top: 140, background: C.white, border: `1px solid ${hazardAlerts[0].severity === "high" ? C.red : C.amber}`, boxShadow: "0 8px 24px rgba(0,0,0,0.14)" }}>
          <div className="flex items-center justify-between px-3 py-2"
            style={{ background: hazardAlerts[0].severity === "high" ? C.red : C.amber }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} color="#fff" />
              <p className="text-xs font-bold" style={{ color: "#fff" }}>
                {hazardAlerts.length} risk zone{hazardAlerts.length > 1 ? "s" : ""} on route
              </p>
            </div>
            <button onClick={() => setDismissedAlerts(true)} className="w-6 h-6 flex items-center justify-center rounded">
              <X size={13} color="#fff" />
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {hazardAlerts.slice(0, 4).map((a, i) => {
              const col = a.severity === "high" ? C.red : a.severity === "medium" ? C.amber : C.gray;
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2"
                  style={{ borderTop: i ? `1px solid ${C.grayBorder}` : undefined }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: col }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: C.navy }}>{a.name}</p>
                    <p className="text-[10px]" style={{ color: C.gray }}>
                      {a.incidents} incidents · {a.distanceKm < 0.05 ? "on route" : `${(a.distanceKm * 1000).toFixed(0)}m away`}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase" style={{ color: col }}>{a.severity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
