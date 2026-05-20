/**
 * MestariCopySectionsBottom — Clarity / Team / FAQ / Final CTA / Trust /
 * Footer. Lower half of the Mestari copy editor's section list.
 *
 * Mirror of `mestariCopySectionsTop.jsx`. See that file's docstring for
 * the design rationale (per-section inline setters, preserved testids,
 * iter50 extraction from the 635-LOC BackOfficeMestariCopy.jsx).
 */
import React from 'react';
import { SectionTitle, Field, Row, Card } from './copyAtoms';

// ── CLARITY + TEAM ───────────────────────────────────────────────────

export const ClarityTeamSection = ({ form, setForm, resetSection }) => {
  const setClarityField = (key, v) =>
    setForm((f) => ({ ...f, clarity: { ...f.clarity, [key]: v } }));
  const setClarityBullet = (listKey, idx, v) =>
    setForm((f) => ({ ...f, clarity: { ...f.clarity, [listKey]: f.clarity[listKey].map((b, i) => i === idx ? v : b) } }));
  const setTeam = (key, v) =>
    setForm((f) => ({ ...f, team: { ...f.team, [key]: v } }));

  return (
    <>
      <SectionTitle sub="Green/amber split. 4 bullets per side per language."
        testid="mec-section-clarity" onReset={() => resetSection('clarity')}>CLARITY (IS / IS NOT)</SectionTitle>
      <Card label="LABELS + HEADS">
        <Row>
          <Field label="Section label (FI)" value={form.clarity.label_fi}
            onChange={(v) => setClarityField('label_fi', v)} idScope="clarity-top-fi" />
          <Field label="Section label (EN)" value={form.clarity.label_en}
            onChange={(v) => setClarityField('label_en', v)} idScope="clarity-top-en" />
        </Row>
        <Row cols={4}>
          <Field label="'Is' head (FI)" value={form.clarity.is_head_fi}
            onChange={(v) => setClarityField('is_head_fi', v)} idScope="clarity-is-fi" />
          <Field label="'Is' head (EN)" value={form.clarity.is_head_en}
            onChange={(v) => setClarityField('is_head_en', v)} idScope="clarity-is-en" />
          <Field label="'Is not' head (FI)" value={form.clarity.isnt_head_fi}
            onChange={(v) => setClarityField('isnt_head_fi', v)} idScope="clarity-isnt-fi" />
          <Field label="'Is not' head (EN)" value={form.clarity.isnt_head_en}
            onChange={(v) => setClarityField('isnt_head_en', v)} idScope="clarity-isnt-en" />
        </Row>
      </Card>
      {[
        ['is_items_fi', 'IS BULLETS (FI)'],
        ['is_items_en', 'IS BULLETS (EN)'],
        ['isnt_items_fi', 'IS NOT BULLETS (FI)'],
        ['isnt_items_en', 'IS NOT BULLETS (EN)'],
      ].map(([key, label]) => (
        <Card key={key} label={label} testid={`mec-clarity-${key}`}>
          {(form.clarity[key] || []).map((bullet, idx) => (
            <Field key={`${key}-${idx}`} label={`${idx + 1}`} value={bullet}
              onChange={(v) => setClarityBullet(key, idx, v)} idScope={`${key}-${idx}`} />
          ))}
        </Card>
      ))}

      <SectionTitle sub="Founder block. Quote split into pre/emphasis/post. Single avatar initial."
        testid="mec-section-team" onReset={() => resetSection('team')}>FOUNDER</SectionTitle>
      <Card>
        <Row cols={3}>
          <Field label="Section label (FI)" value={form.team.label_fi}
            onChange={(v) => setTeam('label_fi', v)} idScope="team-fi" />
          <Field label="Section label (EN)" value={form.team.label_en}
            onChange={(v) => setTeam('label_en', v)} idScope="team-en" />
          <Field label="Avatar initial" value={form.team.initial}
            onChange={(v) => setTeam('initial', v)} idScope="team" />
        </Row>
        <Row>
          <Field label="Eyebrow (FI)" value={form.team.eyebrow_fi}
            onChange={(v) => setTeam('eyebrow_fi', v)} idScope="team-fi" />
          <Field label="Eyebrow (EN)" value={form.team.eyebrow_en}
            onChange={(v) => setTeam('eyebrow_en', v)} idScope="team-en" />
        </Row>
        {['fi', 'en'].map((lang) => (
          <Row key={`team-quote-${lang}`} cols={3}>
            <Field label={`Quote pre (${lang.toUpperCase()})`} multiline
              value={form.team[`quote_pre_${lang}`]}
              onChange={(v) => setTeam(`quote_pre_${lang}`, v)} idScope={`team-quote-${lang}`} />
            <Field label={`Quote emphasis (${lang.toUpperCase()})`}
              value={form.team[`quote_em_${lang}`]}
              onChange={(v) => setTeam(`quote_em_${lang}`, v)} idScope={`team-quote-${lang}`} />
            <Field label={`Quote post (${lang.toUpperCase()})`} multiline
              value={form.team[`quote_post_${lang}`]}
              onChange={(v) => setTeam(`quote_post_${lang}`, v)} idScope={`team-quote-${lang}`} />
          </Row>
        ))}
        <Row cols={3}>
          <Field label="Sign name" value={form.team.sign_name}
            onChange={(v) => setTeam('sign_name', v)} idScope="team" />
          <Field label="Sign suffix (FI)" value={form.team.sign_rest_fi}
            onChange={(v) => setTeam('sign_rest_fi', v)} idScope="team-fi" />
          <Field label="Sign suffix (EN)" value={form.team.sign_rest_en}
            onChange={(v) => setTeam('sign_rest_en', v)} idScope="team-en" />
        </Row>
        <Row>
          <Field label="Cred prefix (FI)" multiline value={form.team.cred_pre_fi}
            onChange={(v) => setTeam('cred_pre_fi', v)} idScope="team-fi" />
          <Field label="Cred prefix (EN)" multiline value={form.team.cred_pre_en}
            onChange={(v) => setTeam('cred_pre_en', v)} idScope="team-en" />
        </Row>
        <Row>
          <Field label="Cred link label (FI)" value={form.team.cred_link_fi}
            onChange={(v) => setTeam('cred_link_fi', v)} idScope="team-fi" />
          <Field label="Cred link label (EN)" value={form.team.cred_link_en}
            onChange={(v) => setTeam('cred_link_en', v)} idScope="team-en" />
        </Row>
      </Card>
    </>
  );
};

// ── FAQ + FINAL + TRUST + FOOTER ─────────────────────────────────────

export const FaqFinalFooterSection = ({ form, setForm, resetSection }) => {
  const setFaqTop = (key, v) =>
    setForm((f) => ({ ...f, faq: { ...f.faq, [key]: v } }));
  const setFaqItem = (idx, key, v) =>
    setForm((f) => ({ ...f, faq: { ...f.faq, items: f.faq.items.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setFinal = (key, v) =>
    setForm((f) => ({ ...f, final: { ...f.final, [key]: v } }));
  const setFooterTop = (key, v) =>
    setForm((f) => ({ ...f, footer: { ...f.footer, [key]: v } }));
  const setFooterLink = (idx, key, v) =>
    setForm((f) => ({ ...f, footer: { ...f.footer, links: f.footer.links.map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));
  const setTrustLang = (lang, key, v) =>
    setForm((f) => ({ ...f, trust: { ...f.trust, [lang]: { ...((f.trust && f.trust[lang]) || {}), [key]: v } } }));
  const setTrustLink = (idx, key, v) =>
    setForm((f) => ({ ...f, trust: { ...f.trust, links: (f.trust && f.trust.links ? f.trust.links : []).map((c, i) => i === idx ? { ...c, [key]: v } : c) } }));

  return (
    <>
      <SectionTitle sub="4 Q&A items."
        testid="mec-section-faq" onReset={() => resetSection('faq')}>FAQ</SectionTitle>
      <Card label="LABEL">
        <Row>
          <Field label="Section label (FI)" value={form.faq.label_fi}
            onChange={(v) => setFaqTop('label_fi', v)} idScope="faq-top-fi" />
          <Field label="Section label (EN)" value={form.faq.label_en}
            onChange={(v) => setFaqTop('label_en', v)} idScope="faq-top-en" />
        </Row>
      </Card>
      {form.faq.items.map((it, idx) => (
        <Card key={`faq-${idx}`} label={`Q ${idx + 1}`} testid={`mec-faq-${idx}`}>
          <Row>
            <Field label="Question (FI)" value={it.q_fi}
              onChange={(v) => setFaqItem(idx, 'q_fi', v)} idScope={`faq-${idx}-fi`} />
            <Field label="Question (EN)" value={it.q_en}
              onChange={(v) => setFaqItem(idx, 'q_en', v)} idScope={`faq-${idx}-en`} />
          </Row>
          <Row>
            <Field label="Answer (FI)" multiline value={it.a_fi}
              onChange={(v) => setFaqItem(idx, 'a_fi', v)} idScope={`faq-${idx}-fi`} />
            <Field label="Answer (EN)" multiline value={it.a_en}
              onChange={(v) => setFaqItem(idx, 'a_en', v)} idScope={`faq-${idx}-en`} />
          </Row>
        </Card>
      ))}

      <SectionTitle sub="Final CTA section + 5 meta tokens per locale."
        testid="mec-section-final" onReset={() => resetSection('final')}>FINAL CTA</SectionTitle>
      <Card>
        <Row>
          <Field label="Eyebrow (FI)" value={form.final.eyebrow_fi}
            onChange={(v) => setFinal('eyebrow_fi', v)} idScope="final-fi" />
          <Field label="Eyebrow (EN)" value={form.final.eyebrow_en}
            onChange={(v) => setFinal('eyebrow_en', v)} idScope="final-en" />
        </Row>
        {['fi', 'en'].map((lang) => (
          <Row key={`final-headline-${lang}`} cols={3}>
            <Field label={`Headline pre (${lang.toUpperCase()})`}
              value={form.final[`headline_pre_${lang}`]}
              onChange={(v) => setFinal(`headline_pre_${lang}`, v)} idScope={`final-h-${lang}`} />
            <Field label={`Headline emphasis (${lang.toUpperCase()})`}
              value={form.final[`headline_em_${lang}`]}
              onChange={(v) => setFinal(`headline_em_${lang}`, v)} idScope={`final-h-${lang}`} />
            <Field label={`Headline post (${lang.toUpperCase()})`}
              value={form.final[`headline_post_${lang}`]}
              onChange={(v) => setFinal(`headline_post_${lang}`, v)} idScope={`final-h-${lang}`} />
          </Row>
        ))}
        <Row>
          <Field label="CTA label (FI)" value={form.final.cta_fi}
            onChange={(v) => setFinal('cta_fi', v)} idScope="final-fi" />
          <Field label="CTA label (EN)" value={form.final.cta_en}
            onChange={(v) => setFinal('cta_en', v)} idScope="final-en" />
        </Row>
        {['fi', 'en'].map((lang) => (
          <Row key={`final-meta-${lang}`} cols={5}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Field key={i} label={`Meta ${i} (${lang.toUpperCase()})`}
                value={form.final[`meta_${lang}_${i}`]}
                onChange={(v) => setFinal(`meta_${lang}_${i}`, v)} idScope={`final-meta-${lang}-${i}`} />
            ))}
          </Row>
        ))}
      </Card>

      <SectionTitle sub="4 trust pills · plain-language GDPR note · checkbox label wording · 3 external links. Renders on the email-capture step right before submit."
        testid="mec-section-trust" onReset={() => resetSection('trust')}>TRUST STRIP (EMAIL GATE)</SectionTitle>
      {['fi', 'en'].map((lang) => {
        const tLang = (form.trust && form.trust[lang]) || {};
        return (
          <Card key={`trust-${lang}`} label={lang === 'fi' ? 'FINNISH' : 'ENGLISH'} testid={`mec-trust-${lang}`}>
            <Row cols={4}>
              <Field label="Pill 1" value={tLang.pill_1}
                onChange={(v) => setTrustLang(lang, 'pill_1', v)} idScope={`trust-${lang}`} />
              <Field label="Pill 2" value={tLang.pill_2}
                onChange={(v) => setTrustLang(lang, 'pill_2', v)} idScope={`trust-${lang}`} />
              <Field label="Pill 3" value={tLang.pill_3}
                onChange={(v) => setTrustLang(lang, 'pill_3', v)} idScope={`trust-${lang}`} />
              <Field label="Pill 4" value={tLang.pill_4}
                onChange={(v) => setTrustLang(lang, 'pill_4', v)} idScope={`trust-${lang}`} />
            </Row>
            <Field label="GDPR note (paragraph under the pills)" multiline value={tLang.note}
              onChange={(v) => setTrustLang(lang, 'note', v)} idScope={`trust-${lang}-note`} />
            <Row cols={3}>
              <Field label="Checkbox prefix" value={tLang.accept_pre}
                onChange={(v) => setTrustLang(lang, 'accept_pre', v)} idScope={`trust-${lang}-acc`} />
              <Field label="Checkbox link label" value={tLang.accept_link}
                onChange={(v) => setTrustLang(lang, 'accept_link', v)} idScope={`trust-${lang}-acc`} />
              <Field label="Checkbox suffix" value={tLang.accept_post}
                onChange={(v) => setTrustLang(lang, 'accept_post', v)} idScope={`trust-${lang}-acc`} />
            </Row>
          </Card>
        );
      })}
      {(form.trust && form.trust.links ? form.trust.links : []).map((link, idx) => (
        <Card key={`trust-link-${idx}`} label={`EXTERNAL LINK ${idx + 1}`} testid={`mec-trust-link-${idx}`}>
          <Row cols={3}>
            <Field label="Href (route or URL)" value={link.href}
              onChange={(v) => setTrustLink(idx, 'href', v)} idScope={`trust-link-${idx}`} />
            <Field label="Label (FI)" value={link.label_fi}
              onChange={(v) => setTrustLink(idx, 'label_fi', v)} idScope={`trust-link-${idx}-fi`} />
            <Field label="Label (EN)" value={link.label_en}
              onChange={(v) => setTrustLink(idx, 'label_en', v)} idScope={`trust-link-${idx}-en`} />
          </Row>
        </Card>
      ))}

      <SectionTitle sub="Back-link, 4 nav links, disclaimer + peluuri.fi link."
        testid="mec-section-footer" onReset={() => resetSection('footer')}>FOOTER</SectionTitle>
      <Card label="LINKS + DISCLAIMER">
        <Row>
          <Field label="Back-link label (FI)" value={form.footer.home_fi}
            onChange={(v) => setFooterTop('home_fi', v)} idScope="footer-fi" />
          <Field label="Back-link label (EN)" value={form.footer.home_en}
            onChange={(v) => setFooterTop('home_en', v)} idScope="footer-en" />
        </Row>
        {form.footer.links.map((link, idx) => (
          <Row key={`footerlink-${idx}`} cols={3}>
            <Field label={`Link ${idx + 1} href`} value={link.href}
              onChange={(v) => setFooterLink(idx, 'href', v)} idScope={`footer-link-${idx}`} />
            <Field label={`Link ${idx + 1} label (FI)`} value={link.label_fi}
              onChange={(v) => setFooterLink(idx, 'label_fi', v)} idScope={`footer-link-${idx}-fi`} />
            <Field label={`Link ${idx + 1} label (EN)`} value={link.label_en}
              onChange={(v) => setFooterLink(idx, 'label_en', v)} idScope={`footer-link-${idx}-en`} />
          </Row>
        ))}
        <Row>
          <Field label="Disclaimer paragraph (FI)" multiline value={form.footer.disclaimer_fi}
            onChange={(v) => setFooterTop('disclaimer_fi', v)} idScope="footer-disclaimer-fi" />
          <Field label="Disclaimer paragraph (EN)" multiline value={form.footer.disclaimer_en}
            onChange={(v) => setFooterTop('disclaimer_en', v)} idScope="footer-disclaimer-en" />
        </Row>
        <Row cols={4}>
          <Field label="Peluuri link href" value={form.footer.disclaimer_link_href}
            onChange={(v) => setFooterTop('disclaimer_link_href', v)} idScope="footer-peluuri" />
          <Field label="Peluuri link label" value={form.footer.disclaimer_link_label}
            onChange={(v) => setFooterTop('disclaimer_link_label', v)} idScope="footer-peluuri" />
          <Field label="Disclaimer tail (FI)" value={form.footer.disclaimer_tail_fi}
            onChange={(v) => setFooterTop('disclaimer_tail_fi', v)} idScope="footer-fi" />
          <Field label="Disclaimer tail (EN)" value={form.footer.disclaimer_tail_en}
            onChange={(v) => setFooterTop('disclaimer_tail_en', v)} idScope="footer-en" />
        </Row>
      </Card>
    </>
  );
};
