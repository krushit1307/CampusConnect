import { useParams } from "react-router-dom";

export default function PrintCharter() {
  const { id } = useParams();

  return (
    <div
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm",
        background: "white",
        color: "black",
      }}
    >
      <h1>Club Charter</h1>
      <p>Club ID: {id}</p>

      <hr />

      <h2>Official Charter</h2>

      <p>This page exists solely for PDF generation.</p>
    </div>
  );
}
