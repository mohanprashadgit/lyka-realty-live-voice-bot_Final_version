# Approved Dubai knowledge ? Task 6 / Task 8

Reviewed 2026-11-06. Runtime data: `approvedDubai.json`; trusted transaction import: `transactions.json`; retrieval: `../services/liveKnowledge.ts`.

## Curation contract

Each record has a topic/id, source URL or internal identifier, publisher, publication/effective date (null means unknown), verification date, geography, source tier, confidence, limitations and revalidation interval. Verification means this page was inspected on that date; it does not establish the effective date of a law or independently audit a developer claim.

Official authorities take precedence for legal/regulatory topics. Developer and official tourism material supports general locality context only. Internal calculation/verification policies are explicitly labelled. Lyka service descriptions are approved by the user's Task 6/8 brief; eligibility and operational arrangements still need company confirmation. No verified current unit inventory is loaded.

The retriever selects at most four topical records, excludes expired/future verification dates, and returns stale source references separately. It does not scrape the internet during a call. A maintainer must revisit the actual source, review applicable service/jurisdiction and update facts/date; never advance dates without review. Restart the Node server after updating approved knowledge. Visa records expire after 14 days; most legal facts after 30; locality context after 180. Internal policies have their own intervals. Retrieval failure or missing evidence must result in uncertainty and specialist verification, not a guessed answer.

DLD, GDRFA and ICP visa records remain separate. Do not combine different service requirements into a universal eligibility rule. Exact fees, documents, valuation requirements and outcomes need the applicable current authority. No guaranteed visa, return or refund.

## Transaction import contract

`transactions.json` is intentionally an empty array: no verified row-level registered-sale dataset was available during implementation. DLD's public page exposed its datasets but did not supply comparable rows. Legacy `knowledgeData.ts` listing prices, yields and permit-like strings are not transaction evidence.

Only a reviewed official DLD export may populate this file. Every row must include `id`, `kind: registered_sale`, official `source` URL, `verifiedAt`, transaction `date`, canonical `location`, `project`, `propertyType`, optional `bedrooms`, positive finite `area`, `areaUnit: sqft|sqm`, `areaBasis: built_up|plot`, positive finite total `price`, uppercase `currency`, and `status: ready|off_plan`. Retain the export and mapping audit outside customer notes. Do not load a customer quotation or advertised listing here. Server tools cannot supply their own comparable rows.

Comparison requires same location, property type, currency, readiness and area basis; same project/bedrooms when supplied; area within 20%; transactions within 180 days; verification within 30 days; at least three distinct records. Sqm is converted explicitly to sqft. It reports median and range per sqft, sample size, observation dates and source URLs. It never converts currencies, compares land to apartments, or presents historical observations as today's valuation. Floor, condition, developer, fees and payment terms remain limitations. Empty, stale or insufficient matches return no numerical market rate.

## Coverage and limits

General ownership/transfer, project escrow, delays/disputes, title verification, charges, tenancy, succession referrals, mortgage basics, investor residency, investment calculations, payment-plan verification, Lyka support, twelve requested Dubai communities and four Tamil Nadu locations are indexed. Detailed case-specific legal remedies, tax advice, school/medical service directories, living-cost amounts, bank rates, exact project amenities and live unit availability are not established by these short records. Retrieve and verify additional evidence before claiming them. No celebrity-investment claims are included.

Regional snippets are optional public place context, separate from CRM memory. They do not authorize assumptions about religion, wealth, participation, current event timing or the agent's personal history. Unknown towns get a neutral acknowledgement.

## Source register

| Record | Publisher / source | Recheck after days |
|---|---|---:|
| ownership | [DLD](https://dubailand.gov.ae/en/frequently-asked-questions/) | 30 |
| escrow | [DLD](https://dubailand.gov.ae/en/eservices/register-project/) | 30 |
| delay | [DLD](https://dubailand.gov.ae/en/frequently-asked-questions/) | 30 |
| buying | [DLD](https://dubailand.gov.ae/en/frequently-asked-questions/) | 30 |
| sale | [DLD](https://dubailand.gov.ae/en/eservices/property-sale-registration/) | 30 |
| title | [DLD](https://dubailand.gov.ae/en/eservices/title-deed-verification-overview/title-deed-verification/) | 30 |
| charges | [DLD](https://mollak.dubailand.gov.ae/publicpages/service-charge-index.html) | 30 |
| tenancy | [RDC](https://rdc.gov.ae/frequently-asked-questions) | 30 |
| succession | [DLD](https://backoffice.dubailand.gov.ae/en/eservices/real-estate-inheritance-registration/) | 30 |
| mortgage | [CBUAE](https://rulebook.centralbank.ae/en/rulebook/regulations-regarding-mortgage-loans) | 30 |
| visa-dld | [DLD](https://dubailand.gov.ae/en/eservices/request-for-golden-visa-investor/) | 14 |
| visa-gdrfa | [GDRFA](https://gdrfad.gov.ae/en/services/8ea80da4-f43e-11eb-0320-0050569629e8) | 14 |
| visa-icp | [ICP](https://icp.gov.ae/en/services/uae-golden-residency/) | 14 |
| market | [DLD](https://dubailand.gov.ae/en/open-data/real-estate-data/) | 30 |
| investment | Lyka calculation policy ? `internal:investment-methodology` | 365 |
| plans | Lyka verification policy ? `internal:payment-verification-policy` | 365 |
| offers | Lyka user-approved brief ? `user:approved-task6-task8-brief` | 90 |
| marina | [Dubai DET](https://www.visitdubai.com/en/explore-dubai/dubai-neighbourhoods) | 180 |
| downtown | [Dubai DET](https://www.visitdubai.com/en/explore-dubai/dubai-neighbourhoods) | 180 |
| business-bay | [Dubai Government](https://www.dubai.ae/web/dubai.ae/visit/staying-in-dubai/dubai-neighborhoods/) | 180 |
| jbr | [Dubai DET](https://www.visitdubai.com/en/explore-dubai/dubai-neighbourhoods) | 180 |
| palm | [Dubai DET](https://www.visitdubai.com/explore-dubai/dubai-neighbourhoods/palm-jumeirah) | 180 |
| hills | [Emaar](https://www.emaar.com/en/property-for-sale/dubai-hills-estate) | 180 |
| jvc | [Nakheel](https://www.nakheel.com/en/developments/nakheel-projects/jumeirahvillagecircle) | 180 |
| international | [Nakheel](https://www.nakheel.com/en/developments/nakheel-projects/internationalcity) | 180 |
| dso | [Dubai Silicon Oasis](https://www.dso.ae/) | 180 |
| madurai | [Madurai District](https://madurai.nic.in/festivals-and-events/) | 180 |
| nagercoil | [Kanniyakumari District](https://kanniyakumari.nic.in/) | 180 |
| arjan | [Dubai Holding Community Management](https://prod.dubaiholdingcommunities.ae/communities/arjan) | 180 |
| dubai-south | [Dubai South](https://www.dubaisouth.ae/en) | 180 |
| dubai-creek-harbour | [Emaar](https://www.emaar.com/en/our-communities/dubai-creek-harbour) | 180 |
| salem | [Salem District Administration](https://salem.nic.in/tourism/tourist-places/) | 180 |
| tirunelveli | [Tirunelveli District Administration](https://tirunelveli.nic.in/tourism/tourist-places/) | 180 |
