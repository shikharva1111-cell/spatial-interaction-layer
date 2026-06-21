import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

type LatLng = { lat: number; lng: number };

export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { origin: LatLng; destination: LatLng; travelMode?: "DRIVE" | "WALK" | "TWO_WHEELER" }) => {
      if (
        !input ||
        typeof input.origin?.lat !== "number" ||
        typeof input.origin?.lng !== "number" ||
        typeof input.destination?.lat !== "number" ||
        typeof input.destination?.lng !== "number"
      ) {
        throw new Error("Invalid origin/destination");
      }
      return input;
    },
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !connKey) throw new Error("Missing Google Maps connector credentials");

    const body = {
      origin: { location: { latLng: data.origin } },
      destination: { location: { latLng: data.destination } },
      travelMode: data.travelMode ?? "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      polylineEncoding: "ENCODED_POLYLINE",
    };

    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.distanceMeters",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Routes API ${res.status}: ${text}`);
    }
    return (await res.json()) as {
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
        legs?: Array<{
          steps?: Array<{
            navigationInstruction?: { instructions?: string; maneuver?: string };
            distanceMeters?: number;
            polyline?: { encodedPolyline?: string };
          }>;
        }>;
      }>;
    };
  });

export const searchNearby = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lng: number; radius?: number; types?: string[] }) => {
    if (typeof input?.lat !== "number" || typeof input?.lng !== "number") {
      throw new Error("Invalid location");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !connKey) throw new Error("Missing Google Maps connector credentials");

    const includedTypes = data.types ?? ["hospital", "police", "gas_station", "car_repair"];
    const body = {
      includedTypes,
      maxResultCount: 15,
      locationRestriction: {
        circle: {
          center: { latitude: data.lat, longitude: data.lng },
          radius: Math.min(Math.max(data.radius ?? 3000, 100), 50000),
        },
      },
      rankPreference: "DISTANCE",
    };

    const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchNearby", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.rating,places.userRatingCount,places.businessStatus",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Places Nearby ${res.status}: ${text}`);
    }
    const json = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        primaryType?: string;
        types?: string[];
        rating?: number;
        userRatingCount?: number;
        businessStatus?: string;
      }>;
    };
    return {
      places: (json.places ?? []).map((p) => ({
        id: p.id,
        name: p.displayName?.text ?? "Unnamed",
        address: p.formattedAddress ?? "",
        lat: p.location?.latitude ?? 0,
        lng: p.location?.longitude ?? 0,
        primaryType: p.primaryType ?? p.types?.[0] ?? "place",
        rating: p.rating,
        ratingCount: p.userRatingCount,
      })),
    };
  });
