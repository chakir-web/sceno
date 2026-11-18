import { describe, expect, it } from "vitest";
import { canTransitionShipment } from "@/lib/orders/transitions";
import {
  creationRefusal,
  ozoneDispatchBlock,
  deliveryNoteRef,
  interpretOzoneBody,
  mapOzoneStatusToScenoStatus,
  matchOzoneCity,
  officialDeliveryNotePdfUrl,
  type OzoneCity,
} from "@/lib/shipping/ozone-rules";

const cities: OzoneCity[] = [
  { id: "37", ref: "AGA", name: "Agadir", deliveredPriceMad: 35, returnedPriceMad: 0, refusedPriceMad: 0 },
  { id: "1", ref: "CASA", name: "Casablanca", deliveredPriceMad: 25, returnedPriceMad: 0, refusedPriceMad: 0 },
  { id: "2", ref: "CASA2", name: "Casablanca", deliveredPriceMad: 25, returnedPriceMad: 0, refusedPriceMad: 0 },
  { id: "90", ref: "RBA", name: "Rabat", deliveredPriceMad: 30, returnedPriceMad: 0, refusedPriceMad: 0 },
];

const ready = {
  confirmed: true,
  trackingNumber: "",
  parcelId: "",
  receiver: "Sara Bennani",
  phone: "0612345678",
  address: "12 rue des orangers",
  priceMad: 250,
  cityId: "90",
};

describe("création Ozone", () => {
  it("refuse une commande non confirmée", () => {
    expect(creationRefusal({ ...ready, confirmed: false })).toBe("not_confirmed");
  });

  it("n'autorise Ozone qu'après confirmation, et seulement pour l'admin", () => {
    const open = { role: "admin", confirmation: "confirmed", shipment: "pending", trackingNumber: "", parcelId: "" };
    expect(ozoneDispatchBlock({ ...open, confirmation: "new" })).toBe("not_confirmed");
    expect(ozoneDispatchBlock({ ...open, confirmation: "confirming" })).toBe("not_confirmed");
    expect(ozoneDispatchBlock({ ...open, confirmation: "cancelled" })).toBe("not_confirmed");
    expect(ozoneDispatchBlock({ ...open, confirmation: "unreachable" })).toBe("not_confirmed");
    expect(ozoneDispatchBlock({ ...open, role: "confirmer" })).toBe("forbidden");
    expect(ozoneDispatchBlock(open)).toBeNull();
    expect(ozoneDispatchBlock({ ...open, shipment: "shipped" })).toBe("already_shipped");
    expect(ozoneDispatchBlock({ ...open, shipment: "refused" })).toBe("already_shipped");
    expect(ozoneDispatchBlock({ ...open, trackingNumber: "OZE123" })).toBe("ozone_exists");
    const started = new Date().toISOString();
    expect(ozoneDispatchBlock({ ...open, dispatchStartedAt: started, now: Date.now() })).toBe("ozone_busy");
    expect(ozoneDispatchBlock({ ...open, trackingNumber: "OZE123", dispatchStartedAt: started })).toBe("ozone_exists");
  });

  it("refuse une ville Ozone absente", () => {
    expect(matchOzoneCity("Tanger", cities)).toBeNull();
    expect(creationRefusal({ ...ready, cityId: "" })).toBe("city_unknown");
  });

  it("refuse un doublon de suivi ou de colis", () => {
    expect(creationRefusal({ ...ready, trackingNumber: "OZE123" })).toBe("ozone_exists");
    expect(creationRefusal({ ...ready, parcelId: "P-1" })).toBe("ozone_exists");
  });

  it("accepte une commande confirmée complète", () => {
    expect(creationRefusal(ready)).toBeNull();
    expect(matchOzoneCity("rabat", cities)?.id).toBe("90");
    expect(matchOzoneCity("Casablanca", cities)).toBeNull();
  });

  it("traite RESULT ERROR comme un échec, même avec un HTTP réussi", () => {
    const reading = interpretOzoneBody({
      CHECK_API: { RESULT: "SUCCESS", MESSAGE: "Valide API Key" },
      TRACKING: { "TRACKING-NUMBER": "OZE000000000", RESULT: "ERROR", MESSAGE: "Tracking number not found" },
    });
    expect(reading.ok).toBe(false);
    if (!reading.ok) expect(reading.message).toBe("Tracking number not found");
    expect(canTransitionShipment("pending", "prepared", "confirmed")).toBe(true);
    expect(mapOzoneStatusToScenoStatus("Livré")).toBeNull();
    expect(mapOzoneStatusToScenoStatus("delivered")).toBeNull();
    expect(mapOzoneStatusToScenoStatus("EXPEDIÉ")).toBeNull();
  });

  it("refuse une réponse de création sans numéro de suivi", () => {
    const reading = interpretOzoneBody({ RECEIVER: "Client", PRICE: "250" });
    expect(reading.ok).toBe(false);
  });

  it("conserve un statut Ozone brut sans le traduire", () => {
    const reading = interpretOzoneBody({
      CHECK_API: { RESULT: "SUCCESS", MESSAGE: "Valide API Key" },
      TRACKING: { RESULT: "SUCCESS", "TRACKING-NUMBER": "OZE1", STATUT: "Ramassé" },
    });
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.facts.status).toBe("Ramassé");
      expect(mapOzoneStatusToScenoStatus(reading.facts.status)).toBeNull();
    }
  });

  it("prépare le bordereau officiel sans l'inventer", () => {
    expect(deliveryNoteRef({ ref: "BL240115001" })).toBe("BL240115001");
    expect(deliveryNoteRef({ CHECK_API: { RESULT: "ERROR", MESSAGE: "refus" } })).toBeNull();
    expect(officialDeliveryNotePdfUrl("BL240115001")).toBe("https://client.ozoneexpress.ma/pdf-delivery-note?dn-ref=BL240115001");
    expect(officialDeliveryNotePdfUrl("../secret")).toBeNull();
  });

  it("extrait le numéro de suivi d'une création réussie", () => {
    const reading = interpretOzoneBody({
      "TRACKING-NUMBER": "OZE123456789",
      RECEIVER: "Client",
      PRICE: "250",
    });
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.facts.trackingNumber).toBe("OZE123456789");
      expect(reading.facts.status).toBeNull();
      expect(mapOzoneStatusToScenoStatus(reading.facts.status)).toBeNull();
    }
  });
});
