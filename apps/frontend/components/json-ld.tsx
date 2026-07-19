/**
 * Renders a JSON-LD object as a <script type="application/ld+json"> in a server
 * component — zero client JS. Values may include API-managed content, so the
 * serialized payload is escaped before entering the script element.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const payload = Array.isArray(data) ? data : [data];
  return (
    <>
      {payload.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(item).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
