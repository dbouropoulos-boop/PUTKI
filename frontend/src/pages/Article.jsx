/**
 * Article — public single-article page for Layer 2 auto-published content.
 *
 * Resolves /:category/:slug against /api/content/published/:slug. Renders the
 * full editorial body with Open Graph / Twitter Card meta tags lifted from the
 * `social` object stored at publish time. Falls back to 404-like state when the
 * slug is unknown or the category in the URL doesn't match what we stored.
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Tag, ArrowUpRight } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import LegalDisclaimer from '../components/LegalDisclaimer';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const fmtPublished = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fi-FI', {
      timeZone: 'Europe/Helsinki', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const CATEGORY_LABELS = {
  urheilijat: 'URHEILIJAT',
  striimaajat: 'STRIIMAAJAT',
  saannot: 'SÄÄNNÖT',
  kasinot: 'KASINOT',
};

// Map content categories to existing index/archive pages so the "back to
// category" link doesn't 404 (the auto-published article lives under /uutiset/
// but the category index sits at its original archive path).
const CATEGORY_TARGETS = {
  striimaajat: '/striimaajat',
  kasinot: '/kasinot',
  saannot: '/saantely',     // existing Saantely archive
  urheilijat: '/skene',     // closest editorial archive until urheilijat archive ships
};

const Article = () => {
  const { category, slug } = useParams();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${BACKEND}/api/content/published/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'NOT_FOUND' : `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { if (!cancelled) setArticle(d); })
      .catch((e) => { if (!cancelled) setError(String(e.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  // Hoist social meta from the API response. Defaults keep us safe when an
  // older draft was published before the social field was introduced.
  const social = article?.social || {};
  const canonical = article?.canonical_url || (article && `https://putkihq.fi/${article.category}/${article.url_slug}`);
  useDocumentMeta({
    title: article ? `${article.headline} · PUTKI HQ` : 'PUTKI HQ',
    description: social.og_description || article?.subhead,
    ogTitle: social.og_title || article?.headline,
    ogDescription: social.og_description || article?.subhead,
    ogImage: social.og_image_url,
    ogUrl: canonical,
    twitterCard: social.twitter_card || 'summary',
    twitterDescription: social.twitter_description || article?.subhead,
    canonical,
    articleTags: social.article_tags || article?.tags || [],
  });

  if (loading) {
    return (
      <div className="container-wide py-16" data-testid="article-loading">
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}>
          LADATAAN…
        </div>
      </div>
    );
  }

  if (error === 'NOT_FOUND' || !article) {
    return (
      <div className="container-wide py-16" data-testid="article-not-found">
        <div className="mono mb-4" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#C8423C' }}>
          ARTIKKELIA EI LÖYTYNYT
        </div>
        <h1 className="display text-3xl mb-2">Ehkä se on poistettu tai julkaisua ei vielä ole tehty.</h1>
        <p className="font-serif" style={{ color: 'var(--muted)', maxWidth: 580 }}>
          Slug <code style={{ background: '#f4f1ea', padding: '1px 6px' }}>{slug}</code> ei vastaa yhtään julkaistua artikkelia. Tarkista linkki tai palaa etusivulle.
        </p>
        <Link to="/" className="btn-ghost mono mt-6 inline-flex items-center gap-2" data-testid="article-back-home">
          ← ETUSIVULLE
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-wide py-16" data-testid="article-error">
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#C8423C' }}>
          VIRHE · {error}
        </div>
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[article.category] || (article.category || '').toUpperCase();
  const tags = article.tags || social.article_tags || [];

  return (
    <article className="container-wide py-12 lg:py-16" data-testid="article-page">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <Link
            to={CATEGORY_TARGETS[article.category] || '/'}
            className="mono"
            data-testid="article-category-link"
            style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}
          >
            {categoryLabel}
          </Link>
          {article.expires_at ? (
            <span
              className="mono inline-flex items-center gap-1"
              data-testid="article-expires-pill"
              style={{ fontSize: 10, letterSpacing: '0.14em', color: '#fff', background: '#1a1a1a', padding: '3px 8px', borderRadius: 1 }}
            >
              VANHENEE {fmtPublished(article.expires_at)}
            </span>
          ) : null}
        </div>

        <h1 className="display text-3xl lg:text-5xl mb-3" data-testid="article-headline" style={{ lineHeight: 1.08 }}>
          {article.headline}
        </h1>
        {article.subhead ? (
          <p className="font-serif mb-8" data-testid="article-subhead" style={{ fontSize: 18, color: 'var(--muted)', lineHeight: 1.5 }}>
            {article.subhead}
          </p>
        ) : null}

        <div
          className="mono mb-10 flex items-center gap-4 flex-wrap"
          data-testid="article-meta"
          style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={12} strokeWidth={1.7} />
            {fmtPublished(article.published_at)}
          </span>
          {article.author ? <span>· KIRJOITTAJA {String(article.author).toUpperCase()}</span> : null}
          {article.views != null ? <span>· {article.views} LUKUKERTAA</span> : null}
        </div>

        {article.body ? (
          <div
            className="font-serif article-body"
            data-testid="article-body"
            style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--ink)' }}
            // Backend constrains body to a fixed set of editorial HTML tags;
            // we never render user-supplied input here.
            dangerouslySetInnerHTML={{ __html: article.body }}
          />
        ) : null}

        {article.external_link ? (
          <a
            href={article.external_link}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="article-external-link"
            className="inline-flex items-center gap-2 mt-8 btn-ghost mono"
            style={{ fontSize: 11, letterSpacing: '0.18em' }}
          >
            AVAA LÄHDE <ArrowUpRight strokeWidth={1.7} size={12} />
          </a>
        ) : null}

        <LegalDisclaimer />

        {tags.length ? (
          <div className="mt-12 pt-8" style={{ borderTop: '1px solid #e8e4dc' }} data-testid="article-tags">
            <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
              <Tag size={11} strokeWidth={1.7} className="inline mr-1.5" />
              AVAINSANAT
            </div>
            <div className="flex gap-2 flex-wrap">
              {tags.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="mono"
                  style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--ink)', background: '#f4f1ea', padding: '4px 9px', borderRadius: 1 }}
                >
                  {String(tag).toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default Article;
