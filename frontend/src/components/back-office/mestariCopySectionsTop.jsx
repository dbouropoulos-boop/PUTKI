/**
 * MestariCopySections — every section renderer for the Mestari copy editor.
 *
 * Extracted from BackOfficeMestariCopy.jsx in iter50 because that file was
 * approaching the 700-LOC soft cap. Each section is a pure presentational
 * component: it reads from `form`, writes via `setForm`, and the parent
 * threads `resetSection` to clear that section back to defaults.
 *
 * Setters are defined inline per section (a few lines each) rather than
 * threaded through props — keeps each section self-contained and avoids
 * leaking 17 callbacks through the component tree.
 *
 * All section data-testids on the public surface are preserved (testing
 * agents key off them).
 */
import React from 'react';
import { SectionTitle, Field, Row, Card } from './copyAtoms';

// ── HEADER + HERO ────────────────────────────────────────────────────

export const HeaderHeroSection = ({ form, setForm, resetSection }) => {
  const setHeader = (key, v) =>
    setForm((f) => ({ ...f, header: { ...f.header, [key]: v } }));
  const setHero = (lang, key, v) =>
    setForm((f) => ({ ...f, hero: { ...f.hero, [lang]: { ...f.hero[lang], [key]: v } } }));

  return (
    <>
      <SectionTitle sub="Logo back-link label." testid="mec-section-header"
        onReset={() => resetSection('header')}>HEADER</SectionTitle>
      <Card>
        <Row>
          <Field label="Logo back text (FI)" value={form.header.back_fi}
            onChange={(v) => setHeader('back_fi', v)} idScope="header" />
          <Field label="Logo back text (EN)" value={form.header.back_en}
            onChange={(v) => setHeader('back_en', v)} idScope="header" />
        </Row>
      </Card>

      <SectionTitle sub="Eyebrow · headline · sub · research-positioning block · CTA · 4 meta tokens."
        testid="mec-section-hero" onReset={() => resetSection('hero')}>HERO</SectionTitle>
      {['fi', 'en'].map((lang) => (
        <Card key={`hero-${lang}`} label={lang === 'fi' ? 'FINNISH' : 'ENGLISH'} testid={`mec-hero-${lang}`}>
          <Field label="Eyebrow" value={form.hero[lang].eyebrow}
            onChange={(v) => setHero(lang, 'eyebrow', v)} idScope={`hero-${lang}`} />
          <Field label="Headline" value={form.hero[lang].headline}
            onChange={(v) => setHero(lang, 'headline', v)} idScope={`hero-${lang}`} />
          <Field label="Sub" multiline value={form.hero[lang].sub}
            onChange={(v) => setHero(lang, 'sub', v)} idScope={`hero-${lang}`} />
          <Row>
            <Field label="Positioning bold prefix" value={form.hero[lang].positioning_strong}
              onChange={(v) => setHero(lang, 'positioning_strong', v)} idScope={`hero-${lang}`} />
            <Field label="Positioning rest" multiline value={form.hero[lang].positioning_rest}
              onChange={(v) => setHero(lang, 'positioning_rest', v)} idScope={`hero-${lang}`} />
          </Row>
          <Row cols={4}>
            <Field label="Meta 1" value={form.hero[lang].meta_1}
              onChange={(v) => setHero(lang, 'meta_1', v)} idScope={`hero-${lang}`} />
            <Field label="Meta 2" value={form.hero[lang].meta_2}
              onChange={(v) => setHero(lang, 'meta_2', v)} idScope={`hero-${lang}`} />
            <Field label="Meta 3" value={form.hero[lang].meta_3}
              onChange={(v) => setHero(lang, 'meta_3', v)} idScope={`hero-${lang}`} />
            <Field label="Meta 4" value={form.hero[lang].meta_4}
              onChange={(v) => setHero(lang, 'meta_4', v)} idScope={`hero-${lang}`} />
          </Row>
          <Field label="CTA label" value={form.hero[lang].cta}
            onChange={(v) => setHero(lang, 'cta', v)} idScope={`hero-${lang}`} />
        </Card>
      ))}
    </>
  );
};

// ── CRED + METHOD + STACK + STEPS ────────────────────────────────────

export const MethodStackSection = ({ form, setForm, resetSection }) => {
  const setCred = (idx, key, v) =>
    setForm((f) => ({ ...f, cred: f.cred.map((c, i) => i === idx ? { ...c, [key]: v } : c) }));
  const setMethodTop = (key, v) =>
    setForm((f) => ({ ...f, method: { ...f.method, [key]: v } }));
  const setMethodCard = (idx, key, v) =>
    setForm((f) => ({ ...f, method: { ...f.method, cards: f.method.cards.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setStackTop = (key, v) =>
    setForm((f) => ({ ...f, stack: { ...f.stack, [key]: v } }));
  const setStackItem = (idx, key, v) =>
    setForm((f) => ({ ...f, stack: { ...f.stack, items: f.stack.items.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setStepsTop = (key, v) =>
    setForm((f) => ({ ...f, steps: { ...f.steps, [key]: v } }));
  const setStepsRow = (idx, key, v) =>
    setForm((f) => ({ ...f, steps: { ...f.steps, rows: f.steps.rows.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));

  return (
    <>
      <SectionTitle sub="4 fixed cells. Big number + unit + descriptor."
        testid="mec-section-cred" onReset={() => resetSection('cred')}>CREDIBILITY BAR</SectionTitle>
      {form.cred.map((cell, idx) => (
        <Card key={`cred-${idx}`} label={`CELL ${idx + 1}`} testid={`mec-cred-${idx}`}>
          <Row cols={3}>
            <Field label="Number" value={cell.num}
              onChange={(v) => setCred(idx, 'num', v)} idScope={`cred-${idx}`} />
            <Field label="Unit (FI)" value={cell.unit_fi}
              onChange={(v) => setCred(idx, 'unit_fi', v)} idScope={`cred-${idx}`} />
            <Field label="Unit (EN)" value={cell.unit_en}
              onChange={(v) => setCred(idx, 'unit_en', v)} idScope={`cred-${idx}`} />
          </Row>
          <Row>
            <Field label="Description (FI)" multiline value={cell.desc_fi}
              onChange={(v) => setCred(idx, 'desc_fi', v)} idScope={`cred-${idx}`} />
            <Field label="Description (EN)" multiline value={cell.desc_en}
              onChange={(v) => setCred(idx, 'desc_en', v)} idScope={`cred-${idx}`} />
          </Row>
        </Card>
      ))}

      <SectionTitle sub="Section label + 1-paragraph intro + 4 method cards (number · title · 3-part body · tag)."
        testid="mec-section-method" onReset={() => resetSection('method')}>METHOD</SectionTitle>
      <Card label="LABELS + INTRO">
        <Row>
          <Field label="Section label (FI)" value={form.method.label_fi}
            onChange={(v) => setMethodTop('label_fi', v)} idScope="method-top" />
          <Field label="Section label (EN)" value={form.method.label_en}
            onChange={(v) => setMethodTop('label_en', v)} idScope="method-top" />
        </Row>
        {['fi', 'en'].map((lang) => (
          <Row key={`mintro-${lang}`} cols={3}>
            <Field label={`Intro pre (${lang.toUpperCase()})`} multiline
              value={form.method[`intro_pre_${lang}`]}
              onChange={(v) => setMethodTop(`intro_pre_${lang}`, v)} idScope={`method-intro-${lang}`} />
            <Field label={`Intro emphasis (${lang.toUpperCase()})`}
              value={form.method[`intro_em_${lang}`]}
              onChange={(v) => setMethodTop(`intro_em_${lang}`, v)} idScope={`method-intro-${lang}`} />
            <Field label={`Intro post (${lang.toUpperCase()})`} multiline
              value={form.method[`intro_post_${lang}`]}
              onChange={(v) => setMethodTop(`intro_post_${lang}`, v)} idScope={`method-intro-${lang}`} />
          </Row>
        ))}
      </Card>
      {form.method.cards.map((card, idx) => (
        <Card key={`mcard-${idx}`} label={`CARD ${idx + 1}`} testid={`mec-method-card-${idx}`}>
          <Row>
            <Field label="Number/eyebrow (FI)" value={card.num_fi}
              onChange={(v) => setMethodCard(idx, 'num_fi', v)} idScope={`method-card-${idx}-fi`} />
            <Field label="Number/eyebrow (EN)" value={card.num_en}
              onChange={(v) => setMethodCard(idx, 'num_en', v)} idScope={`method-card-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Title (FI)" value={card.title_fi}
              onChange={(v) => setMethodCard(idx, 'title_fi', v)} idScope={`method-card-${idx}-fi`} />
            <Field label="Title (EN)" value={card.title_en}
              onChange={(v) => setMethodCard(idx, 'title_en', v)} idScope={`method-card-${idx}-en`} />
          </Row>
          {['fi', 'en'].map((lang) => (
            <Row key={`mcard-${idx}-${lang}`} cols={3}>
              <Field label={`Body pre (${lang.toUpperCase()})`} multiline
                value={card[`body_pre_${lang}`]}
                onChange={(v) => setMethodCard(idx, `body_pre_${lang}`, v)} idScope={`method-card-${idx}-body-${lang}`} />
              <Field label={`Body emphasis (${lang.toUpperCase()})`}
                value={card[`body_em_${lang}`]}
                onChange={(v) => setMethodCard(idx, `body_em_${lang}`, v)} idScope={`method-card-${idx}-body-${lang}`} />
              <Field label={`Body post (${lang.toUpperCase()})`} multiline
                value={card[`body_post_${lang}`]}
                onChange={(v) => setMethodCard(idx, `body_post_${lang}`, v)} idScope={`method-card-${idx}-body-${lang}`} />
            </Row>
          ))}
          <Row>
            <Field label="Tag (FI)" value={card.tag_fi}
              onChange={(v) => setMethodCard(idx, 'tag_fi', v)} idScope={`method-card-${idx}-fi`} />
            <Field label="Tag (EN)" value={card.tag_en}
              onChange={(v) => setMethodCard(idx, 'tag_en', v)} idScope={`method-card-${idx}-en`} />
          </Row>
        </Card>
      ))}

      <SectionTitle sub="3 layers behind the diagnostic."
        testid="mec-section-stack" onReset={() => resetSection('stack')}>STACK</SectionTitle>
      <Card label="LABEL">
        <Row>
          <Field label="Section label (FI)" value={form.stack.label_fi}
            onChange={(v) => setStackTop('label_fi', v)} idScope="stack-top" />
          <Field label="Section label (EN)" value={form.stack.label_en}
            onChange={(v) => setStackTop('label_en', v)} idScope="stack-top" />
        </Row>
      </Card>
      {form.stack.items.map((it, idx) => (
        <Card key={`stack-${idx}`} label={`ITEM ${idx + 1}`} testid={`mec-stack-item-${idx}`}>
          <Row>
            <Field label="Eyebrow (FI)" value={it.label_fi}
              onChange={(v) => setStackItem(idx, 'label_fi', v)} idScope={`stack-${idx}-fi`} />
            <Field label="Eyebrow (EN)" value={it.label_en}
              onChange={(v) => setStackItem(idx, 'label_en', v)} idScope={`stack-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Title (FI)" value={it.title_fi}
              onChange={(v) => setStackItem(idx, 'title_fi', v)} idScope={`stack-${idx}-fi`} />
            <Field label="Title (EN)" value={it.title_en}
              onChange={(v) => setStackItem(idx, 'title_en', v)} idScope={`stack-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Body (FI)" multiline value={it.body_fi}
              onChange={(v) => setStackItem(idx, 'body_fi', v)} idScope={`stack-${idx}-fi`} />
            <Field label="Body (EN)" multiline value={it.body_en}
              onChange={(v) => setStackItem(idx, 'body_en', v)} idScope={`stack-${idx}-en`} />
          </Row>
        </Card>
      ))}

      <SectionTitle sub="3 rows of how-it-works."
        testid="mec-section-steps" onReset={() => resetSection('steps')}>HOW IT WORKS</SectionTitle>
      <Card label="LABEL">
        <Row>
          <Field label="Section label (FI)" value={form.steps.label_fi}
            onChange={(v) => setStepsTop('label_fi', v)} idScope="steps-top" />
          <Field label="Section label (EN)" value={form.steps.label_en}
            onChange={(v) => setStepsTop('label_en', v)} idScope="steps-top" />
        </Row>
      </Card>
      {form.steps.rows.map((row, idx) => (
        <Card key={`step-${idx}`} label={`ROW ${idx + 1}`} testid={`mec-step-${idx}`}>
          <Row cols={3}>
            <Field label="Number" value={row.num}
              onChange={(v) => setStepsRow(idx, 'num', v)} idScope={`step-${idx}`} />
            <Field label="Title (FI)" value={row.title_fi}
              onChange={(v) => setStepsRow(idx, 'title_fi', v)} idScope={`step-${idx}-fi`} />
            <Field label="Title (EN)" value={row.title_en}
              onChange={(v) => setStepsRow(idx, 'title_en', v)} idScope={`step-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Description (FI)" multiline value={row.desc_fi}
              onChange={(v) => setStepsRow(idx, 'desc_fi', v)} idScope={`step-${idx}-fi`} />
            <Field label="Description (EN)" multiline value={row.desc_en}
              onChange={(v) => setStepsRow(idx, 'desc_en', v)} idScope={`step-${idx}-en`} />
          </Row>
        </Card>
      ))}
    </>
  );
};
