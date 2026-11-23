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
  ozoneErrorMessage,
  ozoneParcelFields,
  readOzoneCities,
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

  it("lit les villes Ozone quand l'identifiant est un nombre", () => {
    const listed = readOzoneCities({
      CITIES: {
        "37": { ID: 37, REF: "AGA", NAME: "Agadir", "DELIVERED-PRICE": 35, "RETURNED-PRICE": 0, "REFUSED-PRICE": 10 },
        "127": { ID: 127, REF: "FES", NAME: "Fes", "DELIVERED-PRICE": 40, "RETURNED-PRICE": 0, "REFUSED-PRICE": 10 },
        "1454": { ID: 1454, REF: "Ras", NAME: "Ras El Ma-FES", "DELIVERED-PRICE": 40, "RETURNED-PRICE": 0, "REFUSED-PRICE": 10 },
      },
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.cities).toHaveLength(3);
    expect(matchOzoneCity("FES", listed.cities)).toMatchObject({ id: "127", name: "Fes" });
    expect(matchOzoneCity("Fès", listed.cities)?.id).toBe("127");
    expect(matchOzoneCity("FEZ", listed.cities)).toBeNull();
    expect(matchOzoneCity("Ras El Ma-FES", listed.cities)?.id).toBe("1454");
    const block = ozoneDispatchBlock({ role: "admin", confirmation: "confirmed", shipment: "pending", trackingNumber: "", parcelId: "" });
    expect(block).toBeNull();
    expect(block === null && listed.ok).toBe(true);
  });

  it("distingue une liste illisible d'une liste sans ville exploitable", () => {
    expect(readOzoneCities({ DEBUG: true }).ok).toBe(false);
    const empty = readOzoneCities({ CITIES: { "1": { ID: 1, REF: "X", NAME: "" } } });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.message).toBe("La liste des villes Ozone est vide.");
  });

  it("prépare le colis sans appeler Ozone", () => {
    const built = ozoneParcelFields({
      receiver: "Client Test",
      phone: "0612345678",
      cityId: "127",
      address: "Adresse de test",
      priceMad: 249,
      nature: "Poncho Nuage x1",
      reference: "SC-EAC277B9",
      note: "Sans commentaire",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.fields["parcel-city"]).toBe("127");
    expect(built.fields["parcel-price"]).toBe("249.00");
    expect(built.fields["parcel-stock"]).toBe("0");
    expect(built.fields["parcel-nature"]).toBe("Poncho Nuage x1");
    expect(built.fields["parcel-note"]).toBe("SC-EAC277B9 — Sans commentaire");
    expect(built.fields).not.toHaveProperty("tracking-number");
  });

  it("autorise une nouvelle tentative seulement après l'expiration du verrou", () => {
    const open = { role: "admin", confirmation: "confirmed", shipment: "pending", trackingNumber: "", parcelId: "" };
    const now = Date.now();
    expect(ozoneDispatchBlock({ ...open, dispatchStartedAt: new Date(now - 30_000).toISOString(), now })).toBe("ozone_busy");
    expect(ozoneDispatchBlock({ ...open, dispatchStartedAt: new Date(now - 3 * 60_000).toISOString(), now })).toBeNull();
    expect(ozoneDispatchBlock({ ...open, trackingNumber: "OZE123", dispatchStartedAt: new Date(now - 3 * 60_000).toISOString(), now })).toBe("ozone_exists");
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
    expect(deliveryNoteRef({ "ADD-BL": { REF: "BL240115001" } })).toBe("BL240115001");
    expect(deliveryNoteRef({ CHECK_API: { RESULT: "ERROR", MESSAGE: "refus" } })).toBeNull();
    expect(ozoneErrorMessage({
      CHECK_API: { RESULT: "SUCCESS", MESSAGE: "Valide API Key" },
      "ADD-BL": { RESULT: "ERROR", MESSAGE: "veuillez ajouter au moins 1 colis" },
    })).toBe("veuillez ajouter au moins 1 colis");
    expect(officialDeliveryNotePdfUrl("BL240115001")).toBe("https://client.ozoneexpress.ma/pdf-delivery-note?dn-ref=BL240115001");
    expect(officialDeliveryNotePdfUrl("BL240115001", "tickets-10")).toBe("https://client.ozoneexpress.ma/pdf-delivery-note-tickets-4-4?dn-ref=BL240115001");
    expect(officialDeliveryNotePdfUrl("BL240115001", "tickets-a4")).toBe("https://client.ozoneexpress.ma/pdf-delivery-note-tickets?dn-ref=BL240115001");
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
