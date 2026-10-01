import { Router, type IRouter } from "express";
import {
  SearchTravelPlacesQueryParams,
  SearchTravelPlacesResponse,
} from "@workspace/api-zod";

type PlaceCategory =
  | "Neighborhood"
  | "Food"
  | "Shopping"
  | "Outdoors"
  | "Culture"
  | "Attraction";

type TravelPlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  area: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationHours: number;
  startHour: string;
  endHour: string;
  estimatedCost: number;
  costKnown: boolean;
  priceNote: string;
  preferenceTags: string[];
  description: string;
  venueHours: string;
  source: string;
};

type PlaceSearchResult = ReturnType<typeof SearchTravelPlacesResponse.parse>;
type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
};
type WikiPage = {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  dist: number;
};

const router: IRouter = Router();
const PLACE_SOURCE = "Wikimedia geosearch + Photon/OpenStreetMap geocoding";
const USER_AGENT =
  "Wayfarer travel planner/1.0 (destination place lookup; Wikimedia and OpenStreetMap data)";
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; data: PlaceSearchResult }>();
const inFlight = new Map<string, Promise<PlaceSearchResult>>();
let nextPhotonRequestAt = 0;

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function placeKey(value: string): string {
  return normalize(value.split(",")[0] ?? value);
}

function distanceBetween(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyPlace(title: string): {
  category: PlaceCategory;
  durationHours: number;
  startHour: string;
  endHour: string;
  tags: string[];
} {
  if (
    /\b(chinatown|little india|old town|historic quarter|old quarter|kampong|arab street|district)\b/i.test(
      title,
    )
  ) {
    return {
      category: "Neighborhood",
      durationHours: 2,
      startHour: "09:00",
      endHour: "11:00",
      tags: ["Local life", "History"],
    };
  }
  if (
    /\b(food|hawker|restaurant|cafe|café|market|bazaar|food centre|food center)\b/i.test(
      title,
    )
  ) {
    return {
      category: "Food",
      durationHours: 1.5,
      startHour: "12:00",
      endHour: "13:30",
      tags: ["Food & wine", "Local life"],
    };
  }
  if (/\b(shop|shopping|mall|department store|centre|center)\b/i.test(title)) {
    return {
      category: "Shopping",
      durationHours: 1.5,
      startHour: "15:00",
      endHour: "16:30",
      tags: ["Local life", "Design"],
    };
  }
  if (
    /\b(park|garden|beach|waterfront|promenade|viewpoint|botanic|botanical|island|bay|reserve)\b/i.test(
      title,
    )
  ) {
    return {
      category: "Outdoors",
      durationHours: 2,
      startHour: "15:00",
      endHour: "17:00",
      tags: ["Outdoors", "Coast"],
    };
  }
  if (
    /\b(museum|gallery|cathedral|church|mosque|temple|shrine|palace|fort|memorial|monument|theatre|theater|art|heritage)\b/i.test(
      title,
    )
  ) {
    return {
      category: "Culture",
      durationHours: 2,
      startHour: "10:00",
      endHour: "12:00",
      tags: ["History", "Design"],
    };
  }
  return {
    category: "Attraction",
    durationHours: 1.5,
    startHour: "10:00",
    endHour: "11:30",
    tags: ["Local life", "History"],
  };
}

function curatedSingaporePlaces(
  latitude: number,
  longitude: number,
): TravelPlace[] {
  const items: Array<
    Omit<TravelPlace, "distanceMeters"> & { latitude: number; longitude: number }
  > = [
    {
      id: "sg-chinatown",
      name: "Chinatown, Singapore",
      category: "Neighborhood",
      area: "Chinatown",
      latitude: 1.2837,
      longitude: 103.8448,
      durationHours: 2,
      startHour: "09:00",
      endHour: "11:00",
      estimatedCost: 0,
      costKnown: true,
      priceNote: "The neighborhood is public; shops and attractions may charge.",
      preferenceTags: ["Local life", "History", "Food & wine"],
      description:
        "Explore Singapore's Chinatown, with temples, heritage streets, and local food nearby.",
      venueHours: "Open neighborhood; verify individual venue hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-little-india",
      name: "Little India",
      category: "Neighborhood",
      area: "Little India",
      latitude: 1.3066,
      longitude: 103.8493,
      durationHours: 2,
      startHour: "09:30",
      endHour: "11:30",
      estimatedCost: 0,
      costKnown: true,
      priceNote: "The neighborhood is public; shops and attractions may charge.",
      preferenceTags: ["Local life", "History", "Food & wine"],
      description:
        "Walk through one of Singapore's best-known cultural neighborhoods.",
      venueHours: "Open neighborhood; verify individual venue hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-mustafa-centre",
      name: "Mustafa Centre",
      category: "Shopping",
      area: "Little India",
      latitude: 1.3108,
      longitude: 103.8554,
      durationHours: 1.5,
      startHour: "15:00",
      endHour: "16:30",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Shopping spend varies; confirm current opening hours.",
      preferenceTags: ["Local life", "Design"],
      description:
        "A large, well-known shopping stop in the Little India area.",
      venueHours: "Check current opening hours before visiting.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-universal-studios",
      name: "Universal Studios Singapore",
      category: "Attraction",
      area: "Sentosa",
      latitude: 1.254,
      longitude: 103.8238,
      durationHours: 5,
      startHour: "10:00",
      endHour: "15:00",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Ticket prices and operating days vary; check the official site.",
      preferenceTags: ["Outdoors", "Local life"],
      description:
        "A full-day theme park option at Resorts World Sentosa.",
      venueHours: "Check the official calendar and operating hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-gardens-by-the-bay",
      name: "Gardens by the Bay",
      category: "Outdoors",
      area: "Marina Bay",
      latitude: 1.2816,
      longitude: 103.8636,
      durationHours: 3,
      startHour: "15:00",
      endHour: "18:00",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Outdoor areas and conservatories have different entry rules.",
      preferenceTags: ["Outdoors", "Design"],
      description:
        "A major waterfront garden destination in the Marina Bay area.",
      venueHours: "Check current garden and conservatory hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-marina-bay-sands-skypark",
      name: "Marina Bay Sands SkyPark",
      category: "Attraction",
      area: "Marina Bay",
      latitude: 1.2834,
      longitude: 103.8607,
      durationHours: 1.5,
      startHour: "17:00",
      endHour: "18:30",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Admission varies; check the official visitor information.",
      preferenceTags: ["Design", "Outdoors"],
      description:
        "A high-rise observation stop overlooking Marina Bay.",
      venueHours: "Check current admission and opening hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-merlion-park",
      name: "Merlion Park",
      category: "Outdoors",
      area: "Marina Bay",
      latitude: 1.2868,
      longitude: 103.8545,
      durationHours: 1,
      startHour: "17:00",
      endHour: "18:00",
      estimatedCost: 0,
      costKnown: true,
      priceNote: "Public waterfront park.",
      preferenceTags: ["Outdoors", "Local life"],
      description:
        "A public waterfront viewpoint with views across Marina Bay.",
      venueHours: "Public space; check local access notices.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-national-gallery",
      name: "National Gallery Singapore",
      category: "Culture",
      area: "Civic District",
      latitude: 1.2905,
      longitude: 103.8519,
      durationHours: 2.5,
      startHour: "10:00",
      endHour: "12:30",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Admission depends on exhibitions and visitor type.",
      preferenceTags: ["Design", "History"],
      description:
        "A major art museum in Singapore's Civic District.",
      venueHours: "Check current gallery hours and admission.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-botanic-gardens",
      name: "Singapore Botanic Gardens",
      category: "Outdoors",
      area: "Tanglin",
      latitude: 1.3138,
      longitude: 103.8159,
      durationHours: 2.5,
      startHour: "15:00",
      endHour: "17:30",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Entry rules vary for gardens and paid sections.",
      preferenceTags: ["Outdoors", "Local life"],
      description:
        "A large historic garden landscape on Singapore's central island.",
      venueHours: "Check current garden and paid-section hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-zoo",
      name: "Singapore Zoo",
      category: "Attraction",
      area: "Mandai",
      latitude: 1.4043,
      longitude: 103.793,
      durationHours: 4,
      startHour: "09:00",
      endHour: "13:00",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Admission and transport costs vary; check the official site.",
      preferenceTags: ["Outdoors", "Local life"],
      description:
        "A destination zoo in the Mandai area; plan extra time for the journey.",
      venueHours: "Check the official calendar and opening hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-jewel-changi",
      name: "Jewel Changi Airport",
      category: "Attraction",
      area: "Changi",
      latitude: 1.3602,
      longitude: 103.989,
      durationHours: 2,
      startHour: "14:00",
      endHour: "16:00",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Individual attractions and shopping have separate costs.",
      preferenceTags: ["Design", "Food & wine"],
      description:
        "A dining and shopping destination connected to Singapore Changi Airport.",
      venueHours: "Check individual attraction and shop hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-maxwell-food-centre",
      name: "Maxwell Food Centre",
      category: "Food",
      area: "Chinatown",
      latitude: 1.2803,
      longitude: 103.8448,
      durationHours: 1.5,
      startHour: "12:00",
      endHour: "13:30",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Meal prices depend on stall and order.",
      preferenceTags: ["Food & wine", "Local life"],
      description:
        "A well-known hawker centre in the Chinatown area.",
      venueHours: "Check current stall and centre hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-tekka-centre",
      name: "Tekka Centre",
      category: "Food",
      area: "Little India",
      latitude: 1.3067,
      longitude: 103.8504,
      durationHours: 1.5,
      startHour: "12:00",
      endHour: "13:30",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Meal prices depend on stall and order.",
      preferenceTags: ["Food & wine", "Local life"],
      description:
        "A market and hawker-centre stop in the Little India area.",
      venueHours: "Check current stall and centre hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-lau-pa-sat",
      name: "Lau Pa Sat",
      category: "Food",
      area: "Downtown Core",
      latitude: 1.2806,
      longitude: 103.8504,
      durationHours: 1.5,
      startHour: "18:00",
      endHour: "19:30",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Meal prices depend on stall and order.",
      preferenceTags: ["Food & wine", "Local life"],
      description:
        "A historic market building used as a popular food centre.",
      venueHours: "Check current stall and centre hours.",
      source: "Curated Singapore highlight",
    },
    {
      id: "sg-chinatown-complex",
      name: "Chinatown Complex Food Centre",
      category: "Food",
      area: "Chinatown",
      latitude: 1.2823,
      longitude: 103.8437,
      durationHours: 1.5,
      startHour: "12:00",
      endHour: "13:30",
      estimatedCost: 0,
      costKnown: false,
      priceNote: "Meal prices and stall hours vary.",
      preferenceTags: ["Food & wine", "Local life"],
      description:
        "A large food-centre stop inside the Chinatown Complex.",
      venueHours: "Check current stall and centre hours.",
      source: "Curated Singapore highlight",
    },
  ];

  return items.map((item) => ({
    ...item,
    distanceMeters: distanceBetween(
      latitude,
      longitude,
      item.latitude,
      item.longitude,
    ),
  }));
}

async function waitForPhotonSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextPhotonRequestAt - now);
  nextPhotonRequestAt = Math.max(now, nextPhotonRequestAt) + 1_000;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

async function geocodeDestination(destination: string): Promise<{
  latitude: number;
  longitude: number;
  cityName: string;
  country?: string;
}> {
  await waitForPhotonSlot();
  const params = new URLSearchParams({
    q: destination,
    limit: "8",
    lang: "en",
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`The city lookup service returned ${response.status}.`);
  }

  const result = (await response.json()) as { features?: PhotonFeature[] };
  const query = normalize(destination.split(",")[0] ?? destination);
  const candidates = (result.features ?? [])
    .map((feature) => {
      const properties = feature.properties ?? {};
      const coordinates = feature.geometry?.coordinates;
      if (
        !properties.name ||
        !coordinates ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1])
      ) {
        return null;
      }
      const placeType = (properties.osm_value ?? "").toLowerCase();
      const placeTypeScore: Record<string, number> = {
        city: 70,
        town: 65,
        municipality: 60,
        village: 50,
        suburb: 30,
        locality: 20,
      };
      if (!(placeType in placeTypeScore)) return null;
      const name = normalize(properties.name);
      const exactMatch = name === query ? 100 : name.includes(query) ? 60 : 0;
      return {
        latitude: coordinates[1],
        longitude: coordinates[0],
        cityName: properties.name,
        country: properties.country,
        score: exactMatch + placeTypeScore[placeType],
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) {
    throw new PlaceLookupError(
      404,
      `No city or town was found for “${destination}”. Try adding the country.`,
    );
  }
  return best;
}

class PlaceLookupError extends Error {
  constructor(
    readonly status: 404 | 502,
    message: string,
  ) {
    super(message);
  }
}

function categoryScore(place: TravelPlace): number {
  const title = normalize(place.name);
  const wellKnown = /\b(chinatown|little india|universal studios|gardens by the bay|national gallery|botanic gardens|merlion|mustafa|zoo|old town|historic quarter)\b/.test(
    title,
  )
    ? 100
    : 0;
  const category = {
    Neighborhood: 34,
    Food: 30,
    Culture: 28,
    Outdoors: 26,
    Attraction: 22,
    Shopping: 18,
  }[place.category];
  return wellKnown + category - place.distanceMeters / 1_000;
}

async function fetchWikipediaPlaces(
  latitude: number,
  longitude: number,
): Promise<WikiPage[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${latitude}|${longitude}`,
    gsradius: "10000",
    gslimit: "500",
    format: "json",
  });
  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?${params}`,
    {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(18_000),
    },
  );
  if (!response.ok) {
    throw new Error(`The nearby-place service returned ${response.status}.`);
  }

  const result = (await response.json()) as {
    query?: { geosearch?: WikiPage[] };
  };
  return (result.query?.geosearch ?? []).filter(
    (page) =>
      Number.isFinite(page.pageid) &&
      Number.isFinite(page.lat) &&
      Number.isFinite(page.lon) &&
      Number.isFinite(page.dist) &&
      page.title.length >= 3 &&
      page.title.length <= 90 &&
      !/\b(mrt station|metro station|railway station|bus station|hospital|school|university|condominium|apartment block|accident|riot|murder|disaster|list of|politician|footballer|election)\b/i.test(
        page.title,
      ) &&
      !/^\d{4}\b/.test(page.title) &&
      !/\([^)]*disambiguation[^)]*\)/i.test(page.title),
  );
}

function wikiPlace(
  page: WikiPage,
  cityName: string,
  centerLatitude: number,
  centerLongitude: number,
): TravelPlace {
  const classification = classifyPlace(page.title);
  const shortName = page.title.replace(/,\s*[^,]+$/, "").trim();
  const area =
    page.dist < 1_500
      ? `Central ${cityName}`
      : `${(page.dist / 1_000).toFixed(1)} km from ${cityName}`;
  return {
    id: `wiki-${page.pageid}`,
    name: shortName || page.title,
    category: classification.category,
    area,
    latitude: page.lat,
    longitude: page.lon,
    distanceMeters: distanceBetween(
      centerLatitude,
      centerLongitude,
      page.lat,
      page.lon,
    ),
    durationHours: classification.durationHours,
    startHour: classification.startHour,
    endHour: classification.endHour,
    estimatedCost: 0,
    costKnown: false,
    priceNote: "Current admission and purchase prices are not listed; verify before visiting.",
    preferenceTags: classification.tags,
    description: `${page.title} is listed as a nearby place in Wikipedia's geographic index. Confirm current visitor details before going.`,
    venueHours: "Check current opening hours and access before visiting.",
    source: "Wikimedia geosearch",
  };
}

function uniquePlaces(places: TravelPlace[]): TravelPlace[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = placeKey(place.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadPlaces(destination: string): Promise<PlaceSearchResult> {
  const location = await geocodeDestination(destination);
  const pages = await fetchWikipediaPlaces(
    location.latitude,
    location.longitude,
  );
  const discovered = pages.map((page) =>
    wikiPlace(
      page,
      location.cityName,
      location.latitude,
      location.longitude,
    ),
  );
  const curated = /\bsingapore\b/i.test(destination)
    ? curatedSingaporePlaces(location.latitude, location.longitude)
    : [];
  const places = uniquePlaces([...curated, ...discovered])
    .sort((a, b) => categoryScore(b) - categoryScore(a))
    .slice(0, 120);

  if (places.length === 0) {
    throw new PlaceLookupError(
      404,
      `No nearby places were found for “${destination}”. Try a larger city or a nearby city name.`,
    );
  }

  const resolvedLocation = location.country
    ? `${location.cityName}, ${location.country}`
    : location.cityName;
  return SearchTravelPlacesResponse.parse({
    destination,
    resolvedLocation,
    source: PLACE_SOURCE,
    fetchedAt: new Date(),
    places,
  });
}

async function getPlaces(destination: string): Promise<PlaceSearchResult> {
  const key = normalize(destination);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (cached) cache.delete(key);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = loadPlaces(destination)
    .then((data) => {
      if (cache.size >= 100) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
      return data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

router.get("/travel/places", async (req, res): Promise<void> => {
  const parsed = SearchTravelPlacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a destination with at least 2 characters." });
    return;
  }

  const destination = parsed.data.destination.trim();
  try {
    const data = await getPlaces(destination);
    res.json(SearchTravelPlacesResponse.parse(data));
  } catch (error) {
    if (error instanceof PlaceLookupError) {
      req.log.warn(
        { destination, status: error.status, message: error.message },
        "Travel place lookup did not succeed",
      );
      res.status(error.status).json({ error: error.message });
      return;
    }
    req.log.error(
      { destination, error },
      "Travel place data providers failed",
    );
    res.status(502).json({
      error:
        "Could not reach the open place-data services. Please retry in a moment.",
    });
  }
});

export default router;