export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PlaceSource {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  maps?: {
    placeId?: string;
    uri?: string;
    title?: string;
    placeAnswerSources?: {
        reviewSnippets?: {
            content?: string;
            author?: string;
        }[];
    };
    address?: string; // Sometimes inferred or part of title in raw chunks
  };
  web?: {
      uri: string;
      title: string;
  };
}

export interface PharmacyResult {
  id: string;
  name: string;
  address?: string;
  rating?: string; // Often simulated or extracted if available in snippet
  snippet?: string;
  googleMapsUri: string;
  distance?: string;
  openingHours?: string;
}

export interface SearchState {
  query: string;
  results: PharmacyResult[];
  aiSummary: string;
  isLoading: boolean;
  error: string | null;
  location: Coordinates | null;
  locationStatus: 'idle' | 'requesting' | 'granted' | 'denied';
}