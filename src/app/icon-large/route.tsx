import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #f97316 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 300,
          fontWeight: 700,
          letterSpacing: "-0.05em",
        }}
      >
        A
      </div>
    ),
    { width: 512, height: 512 }
  );
}
