"""
Iteration 23 - Phase 1 brief Section 10 source-citation validator tests.

Verifies that `validate_content()` rejects articles lacking a specific
outlet attribution (with rejection_reason `source_citation_missing`),
while allowing:
  • streamer_alert template (exempt by design - auto-live signal)
  • sports recaps citing `data: ergast` / `data: nhl stats` / `data: opta`
"""
import os
import sys

BACKEND = os.path.join(os.path.dirname(__file__), os.pardir)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from content_generator import validate_content


def _doc(**overrides):
    base = {
        "headline": "Veikkaus tiukentaa vedonlyöntirajojaan",
        "subhead": "Uudet rajat astuvat voimaan kesäkuussa",
        "body": "",
        "betting_angle": "Markkinakerroin heijastaa nopeasti tiukentuneita rajoja kaikilla kotimaisilla operaattoreilla.",
        "facts_used": ["fact1", "fact2"],
    }
    base.update(overrides)
    return base


class TestSourceCitationValidator:
    def test_passes_with_yle_citation(self):
        body = (
            "Helsinki - Ylen mukaan Veikkaus aikoo tiukentaa vedonlyönnin "
            "ylärajoja kesäkuusta alkaen. Päätös syntyi sisäisessä "
            "arvioinnissa. Uusi yläraja koskee kaikkia urheilumarkkinoita "
            "ja astuu voimaan asteittain. Liikevaihtovaikutus arvioidaan "
            "myöhemmin."
        )
        r = validate_content("regulatory_analysis", _doc(body=body))
        assert all(not e.startswith("source_citation_missing") for e in r["errors"]), r["errors"]

    def test_passes_with_hs_citation(self):
        body = (
            "Helsingin Sanomat raportoi, että Liigan toimitusjohtaja "
            "vaatii tiukempaa sponsorisääntelyä. Asia eteni hallituksen "
            "kokouksessa lähde vahvistaa. Päätös käsitellään valiokunnassa "
            "ensi viikolla."
        )
        r = validate_content("regulatory_analysis", _doc(body=body))
        assert all(not e.startswith("source_citation_missing") for e in r["errors"]), r["errors"]

    def test_passes_with_english_citation(self):
        body = (
            "According to Yle, Veikkaus is tightening its sports betting limits "
            "as of June. The new caps apply to all sports markets and roll out "
            "in phases. Revenue impact will be measured later this year."
        )
        r = validate_content("regulatory_analysis", _doc(body=body))
        assert all(not e.startswith("source_citation_missing") for e in r["errors"]), r["errors"]

    def test_rejects_no_citation_phrase(self):
        """Body has named source but no citation phrase - rejected."""
        body = (
            "Yle on Suomen yleisradio. Veikkaus on tehnyt päätöksen. "
            "Rajat muuttuvat kesäkuussa. Yksityiskohdat eivät ole vielä "
            "julkisia. Markkinat reagoivat seuraavalla viikolla."
        )
        r = validate_content("regulatory_analysis", _doc(body=body))
        assert "source_citation_missing:no_citation_phrase" in r["errors"]

    def test_rejects_no_named_source(self):
        """Body has citation phrase but no named outlet - rejected."""
        body = (
            "Markkinaraporttien mukaan Veikkaus aikoo tiukentaa "
            "vedonlyöntirajojaan kesäkuusta alkaen. Lähde ei ole "
            "vielä vahvistettu. Päätös vaikuttaa kaikkiin urheilumarkkinoihin "
            "ja astuu voimaan asteittain. Liikevaihtovaikutus arvioidaan myöhemmin."
        )
        r = validate_content("regulatory_analysis", _doc(body=body))
        assert "source_citation_missing:no_named_source" in r["errors"]

    def test_streamer_alert_exempt(self):
        """Auto-live signal template skips the citation validator entirely."""
        r = validate_content("streamer_alert", {"headline": "Streamer X is live"})
        # validate_content returns early for streamer_alert before citation check
        assert all(not e.startswith("source_citation_missing") for e in r["errors"]), r["errors"]

    def test_sports_recap_data_attribution_accepted(self):
        """F1/NHL/Football recaps may cite `data: <provider>` in lieu of named outlet."""
        body = (
            "Imola - data: Ergast vahvistaa, että Bottas sijoittui kymmenenneksi "
            "lauantain aika-ajossa. Bottas-tiimi totesi jälkikäteen, että "
            "rengasstrategia oli väärä. Sunnuntain kilpailussa odotetaan "
            "kuivaa säätä ja tasaista vauhtia."
        )
        r = validate_content("sports_recap", _doc(body=body))
        assert all(not e.startswith("source_citation_missing") for e in r["errors"]), r["errors"]

    def test_late_citation_outside_window_still_rejected(self):
        """Citation must appear within first 400 chars of body."""
        filler = "Tähän tulee paljon yleistä taustatekstiä ja kontekstia. " * 8  # ~440 chars
        body = filler + "Ylen mukaan asia on niin."
        r = validate_content("regulatory_analysis", _doc(body=body))
        # Body opening has neither citation phrase nor named source.
        assert any(e.startswith("source_citation_missing") for e in r["errors"]), r["errors"]
