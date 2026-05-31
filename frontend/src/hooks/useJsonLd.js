/**
 * useJsonLd — inject a <script type="application/ld+json"> into the
 * document head for the lifetime of a route.
 *
 * Pairs with useDocumentMeta. SPA pages still don't get pre-rendered,
 * but Google's crawler executes JS before indexing — so client-side
 * JSON-LD is picked up and gives us rich-result eligibility (Site
 * search box, Organization knowledge panel, breadcrumbs).
 *
 * Usage:
 *   useJsonLd({
 *     '@context': 'https://schema.org',
 *     '@type': 'Organization',
 *     name: 'Putki HQ',
 *     ...
 *   });
 *
 * Or pass an array to inject multiple schemas at once.
 */
import { useEffect } from 'react';

const useJsonLd = (schema) => {
  const key = JSON.stringify(schema);
  useEffect(() => {
    if (!schema) return undefined;
    const payloads = Array.isArray(schema) ? schema : [schema];
    const els = payloads
      .filter(Boolean)
      .map((obj) => {
        const el = document.createElement('script');
        el.type = 'application/ld+json';
        el.setAttribute('data-managed-by-jsonld-hook', '1');
        try {
          el.textContent = JSON.stringify(obj);
        } catch {
          return null;
        }
        document.head.appendChild(el);
        return el;
      })
      .filter(Boolean);
    return () => {
      els.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};

export default useJsonLd;
