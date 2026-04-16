from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

EU_PALETTE = ["#003399", "#FFCC00", "#0066CC", "#FF6600", "#009933", "#CC0000",
              "#663399", "#00CCCC", "#FF3366", "#336600"]

DATASETS = {
    "ai_adoption_eu.csv": {
        "description": "Share of EU enterprises (10+ employees) using any AI technology. Source: Eurostat isoc_eb_ai.",
        "columns": ["country", "country_code", "year", "adoption_rate_pct"],
        "coverage": "2021-2025, 27 EU countries",
    },
    "digital_skills_eu.csv": {
        "description": "Share of individuals (16-74) with at least basic overall digital skills. Source: Eurostat isoc_sk_dskl_i21.",
        "columns": ["country", "country_code", "year", "digital_skills_score"],
        "coverage": "2021-2025, 27 EU countries",
    },
    "ecommerce_eu.csv": {
        "description": "Share of individuals who bought or ordered goods/services online in the last 3 months. Source: Eurostat isoc_ec_ibuy + isoc_ec_ib20.",
        "columns": ["country", "country_code", "year", "pct_population_buying_online"],
        "coverage": "2002-2025, 27 EU countries",
    },
    "cloud_adoption_eu.csv": {
        "description": "Share of EU enterprises (10+ employees) buying cloud computing services. Source: Eurostat isoc_cicce_use.",
        "columns": ["country", "country_code", "year", "cloud_adoption_pct"],
        "coverage": "2014-2025, 27 EU countries",
    },
    "gdp_eu.csv": {
        "description": "GDP at current market prices, in millions of EUR. Source: Eurostat nama_10_gdp.",
        "columns": ["country", "country_code", "year", "gdp_eur_millions"],
        "coverage": "1975-2025, 27 EU countries",
    },
    "rd_spending_eu.csv": {
        "description": "Gross domestic expenditure on R&D as a percentage of GDP. Source: Eurostat rd_e_gerdtot.",
        "columns": ["country", "country_code", "year", "rd_spending_pct_gdp"],
        "coverage": "1981-2024, 27 EU countries",
    },
    "ict_employment_eu.csv": {
        "description": "ICT specialists as a percentage of total employment. Source: Eurostat isoc_sks_itspt.",
        "columns": ["country", "country_code", "year", "ict_specialists_pct"],
        "coverage": "2004-2024, 27 EU countries",
    },
}
