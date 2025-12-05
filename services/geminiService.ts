import { GoogleGenAI } from "@google/genai";
import { Coordinates, PharmacyResult, GroundingChunk } from "../types";

const apiKey = process.env.API_KEY;

// Initialize Gemini Client
const getAiClient = () => new GoogleGenAI({ apiKey: apiKey });

export const findPharmacies = async (
  query: string,
  location: Coordinates | null
): Promise<{ summary: string; pharmacies: PharmacyResult[] }> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = getAiClient();
  const modelId = "gemini-2.5-flash"; 

  const prompt = `Find pharmacies matching this query: "${query}". 
  If the query is a postal code or pin code, specifically find pharmacies in that postal code area.
  If the query is a list of medicines, find pharmacies that are likely to stock these types of medications (e.g., Compounding pharmacies for specialized meds, Chain pharmacies for common ones).
  Provide a helpful summary of the options.
  If the user asks for "nearest" or specific types, strictly filter for that.`;

  try {
    const tools: any[] = [{ googleMaps: {} }];
    const config: any = {
      tools,
      temperature: 0.7, 
    };

    if (location) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
        },
      };
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: config,
    });

    const summary = response.text || "Here are the pharmacies I found nearby.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] || [];

    const pharmacies: PharmacyResult[] = chunks
      .filter((chunk) => chunk.maps)
      .map((chunk, index) => {
        const mapData = chunk.maps!;
        let snippet = "View details on Google Maps";
        if (mapData.placeAnswerSources?.reviewSnippets?.[0]?.content) {
            snippet = mapData.placeAnswerSources.reviewSnippets[0].content;
        }

        return {
          id: mapData.placeId || `pharmacy-${index}`,
          name: mapData.title || "Unknown Pharmacy",
          googleMapsUri: mapData.uri || "#",
          snippet: snippet,
        };
      });

    const uniquePharmacies = Array.from(new Map(pharmacies.map(item => [item.googleMapsUri, item])).values());

    return {
      summary,
      pharmacies: uniquePharmacies,
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to fetch pharmacy data.");
  }
};

export const getPharmacyHours = async (
  pharmacyName: string,
  location: Coordinates | null
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = getAiClient();
  const modelId = "gemini-2.5-flash";
  const tools: any[] = [{ googleMaps: {} }];

  const prompt = `What are the opening hours for the pharmacy named "${pharmacyName}"${location ? ` located near latitude ${location.latitude}, longitude ${location.longitude}` : ''}?
  Provide the hours in a concise format (e.g., "Mon-Fri: 8am-8pm, Sat: 9am-5pm, Sun: Closed" or "Open 24 hours").
  If you cannot find the specific hours, say "Hours not available".`;

  try {
    const config: any = {
      tools,
      temperature: 0.1,
    };

    if (location) {
        config.toolConfig = {
            retrievalConfig: {
                latLng: { latitude: location.latitude, longitude: location.longitude }
            }
        };
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: config,
    });

    return response.text || "Hours not available";
  } catch (error) {
    console.error("Failed to fetch hours:", error);
    return "Hours not available";
  }
};

export const getPincodeFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = getAiClient();
  const modelId = "gemini-2.5-flash";
  const tools: any[] = [{ googleMaps: {} }];
  
  const prompt = `What is the postal code (pin code) for the location at Latitude: ${latitude}, Longitude: ${longitude}?
  Return ONLY the numeric postal code or pin code. Do not include any other text, labels, or explanation.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools,
        toolConfig: {
            retrievalConfig: {
                latLng: { latitude, longitude }
            }
        },
        temperature: 0.1
      },
    });

    const text = response.text || "";
    const match = text.match(/\b\d{5,6}\b/);
    return match ? match[0] : text.trim();
  } catch (error) {
    console.error("Failed to reverse geocode:", error);
    return "";
  }
};

export const analyzePrescription = async (base64Image: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  
  const ai = getAiClient();
  // Using gemini-2.5-flash which is multimodal
  const modelId = "gemini-2.5-flash";

  const prompt = `Analyze this image of a medical prescription. 
  Extract and list ONLY the names of the medicines found in the prescription. 
  Output them as a comma-separated list. 
  If no medicines are found or the image is unclear, return "No medicines detected".
  Do not include dosages, instructions, or doctor names.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming PNG for simplicity, usually detected or passed
              data: base64Image
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.text || "No medicines detected";
  } catch (error: any) {
    console.error("Prescription analysis failed:", error);
    throw new Error("Could not analyze prescription image.");
  }
};

export const checkMedicineStock = async (pharmacyName: string, medicineName: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = getAiClient();
  const modelId = "gemini-2.5-flash";

  // Note: Grounding has limited real-time inventory access. 
  // We use reasoning based on the pharmacy type/brand and the medicine type.
  const prompt = `User is asking if the pharmacy "${pharmacyName}" has the medicine "${medicineName}" in stock.
  
  Act as a helpful pharmacy assistant.
  1. Determine the category of the medicine (Common, Specialized, Restricted, etc.).
  2. Determine the type of pharmacy (Large Chain, Local, Compounding, etc.) based on the name.
  3. Provide a probabilistic assessment of stock availability (High, Medium, Low).
  4. Mention if this pharmacy typically carries this type of medication.
  5. Remind the user to call ahead to confirm.
  
  Keep the response short, under 60 words. Be polite.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.4
      }
    });

    return response.text || "Please contact the pharmacy directly to confirm availability.";
  } catch (error) {
    console.error("Stock check failed:", error);
    return "Unable to verify stock at this time. Please call the pharmacy.";
  }
};