/**
 * FilterChips — category + entity filter rail.
 *
 * URL-driven state via searchParams so deep-links + browser back work.
 * Pure visual component; calls onFilterChange whenever active filters change.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { id: 'all',      key: 'filter.all',         icon: null  },
  { id: 'hot',      key: 'filter.hot',         icon: Flame },
  { id: 'streamer_alert',     key: 'filter.streamers' },
  { id: 'nhl_recap',          key: 'filter.sports' },
  { id: 'football_recap',     key: 'filter.football' },
  { id: 'f1_recap',           key: 'filter.f1' },
  { id: 'regulatory_analysis',key: 'filter.regulatory' },
  { id: 'operator_news',      key: 'filter.operators' },
];

const Chip = ({ active, onClick, children, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className="mono inline-flex items-center gap-1.5"
    style={{
      padding: '7px 13px', fontSize: 11, letterSpacing: '0.16em', fontWeight: 700,
      background: active ? 'var(--ink)' : 'var(--bg)',
      color: active ? 'var(--bg)' : 'var(--ink)',
      border: `1px solid ${active ? 'var(--ink)' : 'var(--border-strong)'}`,
      borderRadius: 999, cursor: 'pointer',
      transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease',
    }}
  >
    {children}
  </button>
);

const FilterChips = ({ onFilterChange }) => {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const [entities, setEntities] = useState([]);
  const activeCat = params.get('category') || 'all';
  const activeSev = params.get('severity');
  const activeEnt = params.get('entity');

  useEffect(() => {
    fetch(`${BACKEND}/api/content/top-entities?limit=10`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.entities) setEntities(d.entities); })
      .catch(() => {});
  }, []);

  const update = (k, v) => {
    const next = new URLSearchParams(params);
    if (v && v !== 'all') next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
    onFilterChange?.({
      category: next.get('category'),
      severity: next.get('severity'),
      entity: next.get('entity'),
    });
  };

  const onCat = (id) => {
    if (id === 'hot') {
      // "Hot" is a severity filter, not a category one
      update('severity', activeSev === 'HOT' ? null : 'HOT');
      update('category', null);
    } else if (id === 'all') {
      update('category', null); update('severity', null); update('entity', null);
    } else {
      update('category', id); update('severity', null);
    }
  };

  return (
    <div className="space-y-3" data-testid="filter-chips">
      <div>
        <div className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {t('filter.category_label').toUpperCase()}
        </div>
        <div className="flex gap-2 flex-wrap" data-testid="filter-categories">
          {CATEGORIES.map((c) => {
            const isActive = c.id === 'hot' ? activeSev === 'HOT' : (c.id === activeCat || (c.id === 'all' && !activeCat && !activeSev));
            return (
              <Chip key={c.id} active={isActive} onClick={() => onCat(c.id)} testid={`filter-cat-${c.id}`}>
                {c.icon ? <c.icon strokeWidth={2} size={12} /> : null}
                {t(c.key)}
              </Chip>
            );
          })}
        </div>
      </div>

      {entities.length > 0 && (
        <div>
          <div className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
            {t('filter.entity_label').toUpperCase()}
          </div>
          <div className="flex gap-2 flex-wrap" data-testid="filter-entities">
            {entities.map((e) => (
              <Chip key={e.id} active={activeEnt === e.id} onClick={() => update('entity', activeEnt === e.id ? null : e.id)} testid={`filter-ent-${e.id}`}>
                {e.name}
                <span style={{ opacity: 0.65, fontWeight: 500 }}>({e.count})</span>
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterChips;
