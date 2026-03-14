from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config import CommodityConfig, build_market_query
from parsers.prices import parse_commodity_intelligence


class ParseCommodityIntelligenceTests(unittest.TestCase):
    def test_filters_query_text_and_builds_market_style_output(self) -> None:
        commodity = CommodityConfig("arabica_parchment", "Arabica Parchment", aliases=("coffee parchment",))
        raw_text = """
        Arabica Parchment latest price today in Madikeri, Kodagu and show me the latest prices analysis from last week to today to next week
        Skip to content
        About 1 results
        Arabica Parchment is trading at Rs. 26,300 to Rs. 27,000 per 50 kg in Madikeri market.
        Last week, Arabica Parchment traded around Rs. 25,800 per 50 kg.
        Traders said steady demand and limited arrivals are supporting the market.
        Next week, prices are expected near Rs. 26,500 to Rs. 27,200 per 50 kg if arrivals stay tight.
        Read more
        """

        parsed = parse_commodity_intelligence(commodity, raw_text, sources=[{"url": "https://example.com", "title": "Market note"}])

        self.assertEqual(parsed["todayPriceMin"], 526.0)
        self.assertEqual(parsed["todayPriceMax"], 540.0)
        self.assertEqual(parsed["lastWeekPrice"], 516.0)
        self.assertEqual(parsed["expectedNextPriceMin"], 530.0)
        self.assertEqual(parsed["expectedNextPriceMax"], 544.0)
        self.assertEqual(parsed["metadata"]["marketSentiment"], "Bullish")
        self.assertNotIn("latest price today in Madikeri", parsed["shortDescription"])
        self.assertNotIn("Skip to content", parsed["analysisSummary"])
        self.assertIn("Arabica Parchment is currently trading", parsed["shortDescription"])
        self.assertIn("slight increase", parsed["analysisSummary"])
        self.assertLessEqual(len(parsed["analysisBullets"]), 4)
        self.assertTrue(any("Current price:" in bullet for bullet in parsed["analysisBullets"]))
        self.assertTrue(any("Next week:" in bullet for bullet in parsed["analysisBullets"]))

    def test_extracts_last_week_exact_range(self) -> None:
        commodity = CommodityConfig("arabica_cherry", "Arabica Cherry", aliases=("coffee cherry",))
        raw_text = """
        Arabica Cherry is trading at Rs. 23,500 to Rs. 24,000 per 50 kg in Kodagu.
        Last week, Arabica Cherry traded at Rs. 22,800 to Rs. 23,200 per 50 kg.
        """

        parsed = parse_commodity_intelligence(commodity, raw_text)

        self.assertEqual(parsed["lastWeekPriceMin"], 456.0)
        self.assertEqual(parsed["lastWeekPriceMax"], 464.0)
        self.assertEqual(parsed["trend"], "Up")

    def test_extracts_next_week_exact_range(self) -> None:
        commodity = CommodityConfig("arecanut", "Arecanut", aliases=("supari",))
        raw_text = """
        Arecanut is quoted at Rs. 451 per kg in Madikeri.
        Next week, prices are expected at Rs. 455 to Rs. 462 per kg.
        """

        parsed = parse_commodity_intelligence(commodity, raw_text)

        self.assertEqual(parsed["expectedNextPriceMin"], 455.0)
        self.assertEqual(parsed["expectedNextPriceMax"], 462.0)
        self.assertTrue(any(bullet == "Next week: ₹455–₹462 per kg" for bullet in parsed["analysisBullets"]))

    def test_uses_directional_last_week_signal_without_numeric_values(self) -> None:
        commodity = CommodityConfig("black_pepper", "Black Pepper", aliases=("pepper",))
        raw_text = """
        Black Pepper is trading at Rs. 690 per kg in Kodagu.
        Prices show a slight week-on-week increase on firmer arrivals.
        """

        parsed = parse_commodity_intelligence(commodity, raw_text)

        self.assertIsNone(parsed["lastWeekPrice"])
        self.assertEqual(parsed["trend"], "Up")
        self.assertEqual(parsed["metadata"]["last_week_source_range_text"], "slight increase")
        self.assertTrue(any(bullet == "Week-on-week: slight increase" for bullet in parsed["analysisBullets"]))

    def test_uses_qualitative_forecast_without_hallucinating_numbers(self) -> None:
        commodity = CommodityConfig("black_pepper", "Black Pepper", aliases=("pepper",))
        raw_text = """
        Black Pepper is trading at Rs. 451 per kg in Kodagu.
        Next week outlook remains stable to firm on steady demand and limited arrivals.
        """

        parsed = parse_commodity_intelligence(commodity, raw_text)

        self.assertIsNone(parsed["expectedNextPrice"])
        self.assertEqual(parsed["metadata"]["forecast_direction"], "Up")
        self.assertEqual(parsed["metadata"]["forecast_phrase"], "stable to firm")
        self.assertEqual(parsed["metadata"]["marketSentiment"], "Bullish")
        self.assertTrue(any(bullet == "Outlook: stable to firm" for bullet in parsed["analysisBullets"]))

    def test_builds_shorter_query_template_for_coffee(self) -> None:
        self.assertEqual(
            build_market_query("arabica_parchment", "Arabica Parchment"),
            "Arabica Parchment price Madikeri Kodagu today trend outlook",
        )

    def test_builds_shorter_query_template_for_spice_and_nut(self) -> None:
        self.assertEqual(
            build_market_query("black_pepper", "Black Pepper"),
            "Black Pepper market price Madikeri Kodagu today trend forecast",
        )
        self.assertEqual(
            build_market_query("arecanut", "Arecanut"),
            "Arecanut market price Madikeri Kodagu today trend forecast",
        )

    def test_uses_safe_fallback_without_forecast(self) -> None:
        commodity = CommodityConfig("black_pepper", "Black Pepper", aliases=("pepper",))
        raw_text = """
        Black Pepper is trading at Rs. 690 per kg in Kodagu.
        Market arrivals were limited in the latest session.
        """

        parsed = parse_commodity_intelligence(commodity, raw_text)

        self.assertIsNone(parsed["expectedNextPrice"])
        self.assertIn("No reliable next-week outlook is available from current market sources.", parsed["analysisSummary"])
        self.assertTrue(
            any(
                bullet == "Next week: No reliable outlook available."
                or bullet == "Outlook: No reliable signal"
                for bullet in parsed["analysisBullets"]
            )
        )


if __name__ == "__main__":
    unittest.main()
