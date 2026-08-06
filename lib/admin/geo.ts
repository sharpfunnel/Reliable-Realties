/**
 * Positions projected with the same geoEquirectangular().fitExtent(...) used
 * to generate WORLD_COUNTRY_PATHS, so markers line up with the landmass they
 * represent. Vercel's geolocation() returns ISO 3166-1 alpha-2 codes, hence
 * that's the key. Anything not in this table still shows up in list form —
 * it just isn't plotted on the map. Regenerate via scratchpad/generate-map.mjs.
 */
export const COUNTRY_POINTS: Record<string, { name: string; x: number; y: number }> = {
  "US": {
    "name": "United States",
    "x": 233.8,
    "y": 180.4
  },
  "CA": {
    "name": "Canada",
    "x": 213,
    "y": 136.4
  },
  "MX": {
    "name": "Mexico",
    "x": 223,
    "y": 224.1
  },
  "BR": {
    "name": "Brazil",
    "x": 359.9,
    "y": 326.2
  },
  "AR": {
    "name": "Argentina",
    "x": 328.3,
    "y": 391.5
  },
  "CO": {
    "name": "Colombia",
    "x": 299.4,
    "y": 275.4
  },
  "GB": {
    "name": "United Kingdom",
    "x": 490.8,
    "y": 138.3
  },
  "IE": {
    "name": "Ireland",
    "x": 477.9,
    "y": 144.5
  },
  "FR": {
    "name": "France",
    "x": 505.9,
    "y": 162
  },
  "DE": {
    "name": "Germany",
    "x": 528.1,
    "y": 149.6
  },
  "NL": {
    "name": "Netherlands",
    "x": 514.3,
    "y": 147.2
  },
  "BE": {
    "name": "Belgium",
    "x": 512.2,
    "y": 151.5
  },
  "CH": {
    "name": "Switzerland",
    "x": 522.1,
    "y": 161.5
  },
  "AT": {
    "name": "Austria",
    "x": 539.4,
    "y": 159.6
  },
  "ES": {
    "name": "Spain",
    "x": 490,
    "y": 178.5
  },
  "PT": {
    "name": "Portugal",
    "x": 478.4,
    "y": 181.5
  },
  "IT": {
    "name": "Italy",
    "x": 534,
    "y": 174.7
  },
  "SE": {
    "name": "Sweden",
    "x": 550.2,
    "y": 125.6
  },
  "NO": {
    "name": "Norway",
    "x": 523,
    "y": 124.5
  },
  "DK": {
    "name": "Denmark",
    "x": 525.7,
    "y": 135.8
  },
  "FI": {
    "name": "Finland",
    "x": 569.4,
    "y": 120.7
  },
  "PL": {
    "name": "Poland",
    "x": 551.6,
    "y": 147.7
  },
  "TR": {
    "name": "Turkey",
    "x": 595,
    "y": 182.8
  },
  "RU": {
    "name": "Russia",
    "x": 743,
    "y": 121.8
  },
  "IL": {
    "name": "Israel",
    "x": 594,
    "y": 204.1
  },
  "AE": {
    "name": "United Arab Emirates",
    "x": 645.3,
    "y": 224.7
  },
  "SA": {
    "name": "Saudi Arabia",
    "x": 621.8,
    "y": 223.3
  },
  "EG": {
    "name": "Egypt",
    "x": 583.2,
    "y": 215.5
  },
  "NG": {
    "name": "Nigeria",
    "x": 523.5,
    "y": 263.3
  },
  "KE": {
    "name": "Kenya",
    "x": 602.3,
    "y": 287.8
  },
  "GH": {
    "name": "Ghana",
    "x": 497.3,
    "y": 266.5
  },
  "ZA": {
    "name": "South Africa",
    "x": 561.8,
    "y": 370.5
  },
  "PK": {
    "name": "Pakistan",
    "x": 687.1,
    "y": 205.8
  },
  "IN": {
    "name": "India",
    "x": 713.3,
    "y": 228.4
  },
  "BD": {
    "name": "Bangladesh",
    "x": 744.1,
    "y": 223.9
  },
  "CN": {
    "name": "China",
    "x": 781.3,
    "y": 190.9
  },
  "JP": {
    "name": "Japan",
    "x": 873.4,
    "y": 190.1
  },
  "KR": {
    "name": "South Korea",
    "x": 845.1,
    "y": 190.9
  },
  "TH": {
    "name": "Thailand",
    "x": 772.7,
    "y": 244.9
  },
  "VN": {
    "name": "Vietnam",
    "x": 792.4,
    "y": 249.8
  },
  "PH": {
    "name": "Philippines",
    "x": 828.9,
    "y": 253
  },
  "MY": {
    "name": "Malaysia",
    "x": 775.1,
    "y": 276.5
  },
  "SG": {
    "name": "Singapore",
    "x": 780.3,
    "y": 284.3
  },
  "ID": {
    "name": "Indonesia",
    "x": 807.5,
    "y": 290
  },
  "AU": {
    "name": "Australia",
    "x": 861.3,
    "y": 356.2
  },
  "NZ": {
    "name": "New Zealand",
    "x": 972.2,
    "y": 398.3
  }
};

export function countryName(code: string): string {
  return COUNTRY_POINTS[code]?.name ?? code;
}

export function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️";
  const points = [...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...points);
}
