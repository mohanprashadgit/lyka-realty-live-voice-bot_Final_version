# LYKA REALTY AI CHATBOT — LEAD EXTRACTION & DATA SCHEMA

The conversational assistant extracts 22+ qualification parameters using tool calling (`update_lead_info`) and natural language parsing.

---

## 1. Structured Lead Parameters Schema

| Parameter | Data Type | Permitted Values / Examples | Extraction Guidelines |
|---|---|---|---|
| `name` | String | e.g., "Anand Swaminathan" | Extracted from greeting confirmation or user statement |
| `phone` | String | e.g., "+919840012345" | Normalized to E.164 format with country code |
| `email` | String | e.g., "anand@example.com" | Optional client email |
| `lead_source` | String | `chatbot`, `voice_call`, `inbound_web` | Channel origin |
| `intent` | String | `buy`, `sell`, `rent`, `invest` | Primary transaction purpose |
| `property_type` | String | `apartment`, `villa`, `land`, `plot`, `penthouse`, `commercial` | Desired asset class |
| `listing_category` | String | `property`, `land` | Differentiates built units vs land parcels |
| `city` | String | e.g., `Chennai`, `Bangalore`, `Dubai` | Primary target city |
| `locality` | String | e.g., `OMR`, `ECR`, `Anna Nagar`, `Medavakkam` | Micro-market neighbourhood |
| `budget_min` | Number | Integer in INR | Minimum budget boundary |
| `budget_max` | Number | Integer in INR | Maximum budget boundary |
| `currency` | String | `INR`, `AED`, `USD` | Standard currency |
| `property_size` | String / Num | e.g., `1200`, `5 cents`, `2400 sqft` | Dimension as stated |
| `area_unit` | String | `sqft`, `cents`, `grounds`, `acres`, `sqyd` | Standard measurement unit |
| `bedrooms` | String | `1 BHK`, `2 BHK`, `3 BHK`, `4 BHK`, `5+ BHK` | Bedroom configuration |
| `bathrooms` | String | `2`, `3`, etc. | Number of baths if mentioned |
| `road_access` | String / Bool | e.g., `30ft tar road`, `yes`, `no` | Road access details |
| `zoning` | String | `CMDA`, `DTCP`, `residential`, `commercial` | Legal zoning approvals |
| `amenities` | String | e.g., `swimming pool, gym, metro access, security` | Comma-separated lifestyle preferences |
| `timeline` | String | `immediately`, `within_1_month`, `within_3_months`, `within_6_months`, `just_exploring` | Expected purchase time window |
| `qualification_status` | String | `HOT`, `WARM`, `COLD`, `REACH_AGAIN`, `OPT_OUT` | Overall prospect rating |
| `notes` | String | Contextual summary | Callbacks, relationship, special requirements |

---

## 2. Indian Financial Numbering Parser Rules

The extractor deterministically converts spoken Indian amounts into integer INR numbers:

- **Lakhs ("Lakh", "Lakhs", "L"):** Multiply by $100,000$.
  - *"40 lakhs"* $\rightarrow$ `4000000`
  - *"85 L"* $\rightarrow$ `8500000`
  - *"1.5 lakh"* $\rightarrow$ `150000`
- **Crores ("Crore", "Crores", "Cr"):** Multiply by $10,000,000$.
  - *"1 crore"* $\rightarrow$ `10000000`
  - *"2.5 cr"* $\rightarrow$ `25000000`
  - *"3.20 crore"* $\rightarrow$ `32000000`
- **Strict Budget Qualifier:**
  - *"Strictly below 40 lakhs"* $\rightarrow$ `budget_max: 4000000, strict_budget: true`.

---

## 3. Land & Area Unit Conversion Matrix

| Unit | Square Feet | Cents | Grounds | Acres |
|---|---|---|---|---|
| **1 Cent** | 435.60 sq.ft | 1.000 cent | 0.1815 ground | 0.0100 acre |
| **1 Ground** | 2,400.00 sq.ft | 5.5096 cents | 1.0000 ground | 0.0551 acre |
| **1 Acre** | 43,560.00 sq.ft | 100.000 cents | 18.1500 grounds | 1.0000 acre |
| **1 Sq. Ft.** | 1.00 sq.ft | 0.002296 cent | 0.000417 ground | 0.000023 acre |

---

## 4. Lead Temperature Scoring Rules

- **`HOT`**:
  - Expresses clear intent to buy/invest within $\le 3$ months.
  - Has identified a realistic budget and target micro-market.
  - Readily shares contact and site visit interest.
- **`WARM`**:
  - Genuine interest in buying, but timeline is $3–6$ months.
  - Or flexible budget/locality still being finalized.
- **`COLD`**:
  - Casual browsing, timeline $> 6$ months, or vague interest without budget.
- **`REACH_AGAIN`**:
  - Third-party answered (brother, colleague) or client requested a callback at a specific time.
- **`OPT_OUT`**:
  - Client explicitly requested not to be contacted (DNC).
