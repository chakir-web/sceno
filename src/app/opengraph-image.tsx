import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#F5F1E9", color: "#171717", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80 }}>
        <div style={{ fontSize: 28, letterSpacing: 8, color: "#A58B62" }}>MAISON D&apos;OBJETS · MAROC</div>
        <div style={{ fontSize: 120, marginTop: 20 }}>SCENO</div>
        <div style={{ fontSize: 32, marginTop: 16 }}>Paiement à la livraison</div>
      </div>
    ),
    size,
  );
}
