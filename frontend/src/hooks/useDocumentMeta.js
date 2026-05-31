/**
 * useDocumentMeta - small hook that synchronises <title> + <meta>/<link>
 * tags on document.head for the duration of a route's lifecycle.
 *
 * SPA pages aren't pre-rendered, so Open Graph / Twitter Card scrapers
 * (Facebook, Telegram, X, LinkedIn) won't see meta tags unless they
 * exist in the initial HTML response. For now we still set them client
 * side - this is enough for in-app share buttons and the dynamic <title>,
 * and we keep the structure ready for SSR / pre-rendering later without
 * having to retrofit components.
 */
import { useEffect } from 'react';

const TAG_KEY_ATTR = 'data-managed-by-meta-hook';

const setMeta = ({ name, property, content }) => {
  if (!content) return null;
  const sel = property
    ? `meta[property="${property}"]`
    : `meta[name="${name}"]`;
  let el = document.head.querySelector(sel);
  if (!el) {
    el = document.createElement('meta');
    if (property) el.setAttribute('property', property);
    if (name) el.setAttribute('name', name);
    el.setAttribute(TAG_KEY_ATTR, '1');
    document.head.appendChild(el);
  }
  el.setAttribute('content', String(content));
  return el;
};

const setLink = ({ rel, href, hreflang }) => {
  if (!href) return null;
  // Build a per-(rel,hreflang) selector so multiple alternates can coexist.
  const sel = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"][${TAG_KEY_ATTR}]`
    : `link[rel="${rel}"][${TAG_KEY_ATTR}]`;
  let el = document.head.querySelector(sel);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    el.setAttribute(TAG_KEY_ATTR, '1');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return el;
};

const useDocumentMeta = ({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  twitterCard,
  twitterDescription,
  canonical,
  alternates,
  articleTags,
} = {}) => {
  // Collapse all meta values into a single stable key - the hook
  // re-runs whenever any meta value changes, but the dep array stays small.
  const metaKey = JSON.stringify({
    title, description, ogTitle, ogDescription, ogImage, ogUrl,
    twitterCard, twitterDescription, canonical,
    alternates: (alternates || []).map((a) => `${a.lang || ''}|${a.href || ''}`).join('::'),
    articleTags: (articleTags || []).join('|'),
  });

  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const tags = [];
    if (description) tags.push(setMeta({ name: 'description', content: description }));
    if (ogTitle) tags.push(setMeta({ property: 'og:title', content: ogTitle }));
    if (ogDescription) tags.push(setMeta({ property: 'og:description', content: ogDescription }));
    if (ogImage) tags.push(setMeta({ property: 'og:image', content: ogImage }));
    if (ogUrl) tags.push(setMeta({ property: 'og:url', content: ogUrl }));
    tags.push(setMeta({ property: 'og:type', content: 'article' }));
    tags.push(setMeta({ property: 'og:site_name', content: 'PUTKI HQ' }));
    if (twitterCard) tags.push(setMeta({ name: 'twitter:card', content: twitterCard }));
    if (twitterDescription) tags.push(setMeta({ name: 'twitter:description', content: twitterDescription }));
    if (ogTitle) tags.push(setMeta({ name: 'twitter:title', content: ogTitle }));
    if (ogImage) tags.push(setMeta({ name: 'twitter:image', content: ogImage }));

    const linkEl = canonical ? setLink({ rel: 'canonical', href: canonical }) : null;
    const alternateEls = (alternates || []).map((a) =>
      a && a.href && a.lang ? setLink({ rel: 'alternate', hreflang: a.lang, href: a.href }) : null,
    ).filter(Boolean);
    const articleTagEls = [];
    (articleTags || []).forEach((tag) => {
      if (!tag) return;
      const el = document.createElement('meta');
      el.setAttribute('property', 'article:tag');
      el.setAttribute('content', String(tag));
      el.setAttribute(TAG_KEY_ATTR, '1');
      document.head.appendChild(el);
      articleTagEls.push(el);
    });

    return () => {
      document.title = prevTitle;
      tags.forEach((el) => el && el.parentNode && el.parentNode.removeChild(el));
      articleTagEls.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
      alternateEls.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
      if (linkEl && linkEl.parentNode) linkEl.parentNode.removeChild(linkEl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaKey]);
};

export default useDocumentMeta;
