/**
 * Renders a JSON-LD object as a <script type="application/ld+json"> in a server
 * component — zero client JS. Data comes from trusted local builders
 * (`lib/seo/jsonld.ts`), never user input.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const payload = Array.isArray(data) ? data : [data]
  return (
    <>
      {payload.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  )
}
