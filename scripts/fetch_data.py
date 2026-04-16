"""Fetch real Eurostat datasets and save as clean CSVs in data/.

Uses the `eurostat` pip package which wraps the Eurostat bulk download API.
Each dataset is reshaped into a flat CSV (long format) with country, year,
and relevant value columns. Country codes are mapped to readable names.
"""
from __future__ import annotations

import sys
from pathlib import Path

import eurostat
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# EU country code -> name (ISO-2 / Eurostat geo codes).
EU_COUNTRIES = {
    "AT": "Austria", "BE": "Belgium", "BG": "Bulgaria", "HR": "Croatia",
    "CY": "Cyprus", "CZ": "Czechia", "DK": "Denmark", "EE": "Estonia",
    "FI": "Finland", "FR": "France", "DE": "Germany", "EL": "Greece",
    "HU": "Hungary", "IE": "Ireland", "IT": "Italy", "LV": "Latvia",
    "LT": "Lithuania", "LU": "Luxembourg", "MT": "Malta", "NL": "Netherlands",
    "PL": "Poland", "PT": "Portugal", "RO": "Romania", "SK": "Slovakia",
    "SI": "Slovenia", "ES": "Spain", "SE": "Sweden",
}


def _melt_eurostat(df: pd.DataFrame, value_name: str) -> pd.DataFrame:
    """Eurostat frames have dimension columns + one column per year.
    Melt year columns into long format and map geo -> country.
    """
    year_cols = [c for c in df.columns if isinstance(c, int) or (isinstance(c, str) and c.isdigit())]
    id_cols = [c for c in df.columns if c not in year_cols]

    long = df.melt(id_vars=id_cols, value_vars=year_cols, var_name="year", value_name=value_name)
    long["year"] = long["year"].astype(int)
    long = long.dropna(subset=[value_name])

    if "geo\\TIME_PERIOD" in long.columns:
        long = long.rename(columns={"geo\\TIME_PERIOD": "geo"})

    long = long[long["geo"].isin(EU_COUNTRIES)]
    long["country"] = long["geo"].map(EU_COUNTRIES)
    long = long.rename(columns={"geo": "country_code"})
    return long


def fetch_ai_adoption() -> pd.DataFrame:
    """AI use in enterprises — % of enterprises using any AI technology.
    Dataset: isoc_eb_ai (E_AI_TANY = enterprises using any AI tech)
    """
    df = eurostat.get_data_df("isoc_eb_ai")
    long = _melt_eurostat(df, "adoption_rate_pct")
    long = long[long["indic_is"] == "E_AI_TANY"]
    long = long[long["size_emp"] == "GE10"]
    long = long[long["unit"] == "PC_ENT"]
    long = long[long["nace_r2"] == "C10-S951_X_K"]
    cols = ["country", "country_code", "year", "adoption_rate_pct"]
    return long[cols].sort_values(["country", "year"]).reset_index(drop=True)


def fetch_digital_skills() -> pd.DataFrame:
    """Share of individuals with at-least-basic digital skills, by country/year.
    Dataset: isoc_sk_dskl_i21
    """
    df = eurostat.get_data_df("isoc_sk_dskl_i21")
    long = _melt_eurostat(df, "digital_skills_score")
    # Headline: at least basic overall digital skills, individuals 16-74
    if "indic_is" in long.columns:
        long = long[long["indic_is"] == "I_DSK2_BAB"]
    if "ind_type" in long.columns:
        long = long[long["ind_type"] == "IND_TOTAL"]
    if "unit" in long.columns:
        long = long[long["unit"] == "PC_IND"]
    cols = ["country", "country_code", "year", "digital_skills_score"]
    return long[cols].sort_values(["country", "year"]).reset_index(drop=True)


def fetch_ecommerce() -> pd.DataFrame:
    """Share of individuals buying online in last 3 months, by country/year.
    Combines isoc_ec_ibuy (2002-2019) + isoc_ec_ib20 (2020+) for full history.
    """
    frames = []
    for code in ("isoc_ec_ibuy", "isoc_ec_ib20"):
        df = eurostat.get_data_df(code)
        long = _melt_eurostat(df, "pct_population_buying_online")
        long = long[long["indic_is"] == "I_BUY3"]
        long = long[long["ind_type"] == "IND_TOTAL"]
        long = long[long["unit"] == "PC_IND"]
        frames.append(long)
    all_df = pd.concat(frames, ignore_index=True)
    cols = ["country", "country_code", "year", "pct_population_buying_online"]
    return all_df[cols].drop_duplicates().sort_values(["country", "year"]).reset_index(drop=True)


def fetch_cloud_adoption() -> pd.DataFrame:
    """Cloud computing service use by enterprises, by country/year.
    Dataset: isoc_cicce_use (E_CC = enterprises buying any cloud service)
    """
    df = eurostat.get_data_df("isoc_cicce_use")
    long = _melt_eurostat(df, "cloud_adoption_pct")
    long = long[long["indic_is"] == "E_CC"]
    long = long[long["size_emp"] == "GE10"]
    long = long[long["unit"] == "PC_ENT"]
    long = long[long["nace_r2"] == "C10-S951_X_K"]
    cols = ["country", "country_code", "year", "cloud_adoption_pct"]
    return long[cols].sort_values(["country", "year"]).reset_index(drop=True)


def fetch_gdp() -> pd.DataFrame:
    """GDP at current market prices (EUR million), by country/year.
    Dataset: nama_10_gdp
    """
    df = eurostat.get_data_df("nama_10_gdp")
    long = _melt_eurostat(df, "gdp_eur_millions")
    if "na_item" in long.columns:
        long = long[long["na_item"] == "B1GQ"]
    if "unit" in long.columns:
        long = long[long["unit"] == "CP_MEUR"]
    cols = ["country", "country_code", "year", "gdp_eur_millions"]
    return long[cols].sort_values(["country", "year"]).reset_index(drop=True)


def fetch_rd_spending() -> pd.DataFrame:
    """R&D expenditure as % of GDP, by country/year.
    Dataset: rd_e_gerdtot
    """
    df = eurostat.get_data_df("rd_e_gerdtot")
    long = _melt_eurostat(df, "rd_spending_pct_gdp")
    if "unit" in long.columns:
        long = long[long["unit"] == "PC_GDP"]
    if "sectperf" in long.columns:
        long = long[long["sectperf"] == "TOTAL"]
    cols = ["country", "country_code", "year", "rd_spending_pct_gdp"]
    return long[cols].sort_values(["country", "year"]).reset_index(drop=True)


def fetch_ict_employment() -> pd.DataFrame:
    """ICT specialists as % of total employment, by country/year.
    Dataset: isoc_sks_itspt (total, both sexes aggregated)
    """
    df = eurostat.get_data_df("isoc_sks_itspt")
    long = _melt_eurostat(df, "ict_specialists_pct")
    long = long[long["unit"] == "PC_EMP"]
    cols = ["country", "country_code", "year", "ict_specialists_pct"]
    return long[cols].sort_values(["country", "year"]).reset_index(drop=True)


FETCHERS = {
    "ai_adoption_eu.csv": fetch_ai_adoption,
    "digital_skills_eu.csv": fetch_digital_skills,
    "ecommerce_eu.csv": fetch_ecommerce,
    "cloud_adoption_eu.csv": fetch_cloud_adoption,
    "gdp_eu.csv": fetch_gdp,
    "rd_spending_eu.csv": fetch_rd_spending,
    "ict_employment_eu.csv": fetch_ict_employment,
}


def main() -> int:
    failures: list[str] = []
    for filename, fetcher in FETCHERS.items():
        print(f"[fetch] {filename} ... ", end="", flush=True)
        try:
            df = fetcher()
            if df.empty:
                raise RuntimeError("empty after filtering")
            path = DATA_DIR / filename
            df.to_csv(path, index=False)
            print(f"ok ({len(df)} rows, {df['year'].min()}-{df['year'].max()})")
        except Exception as exc:
            print(f"FAILED: {exc}")
            failures.append(filename)

    if failures:
        print(f"\n{len(failures)} dataset(s) failed: {failures}", file=sys.stderr)
        return 1
    print(f"\nAll {len(FETCHERS)} datasets written to {DATA_DIR}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
