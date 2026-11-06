# Task 3 manual voice acceptance checklist

Use the browser voice agent at http://localhost:10000 or the deployed app. Select Tamil/Tanglish and a voice. Allow microphone permission, use headphones, and start a new call for each independent scenario. For phone testing, use only a number you control or a consenting tester. Do not use real customer financial details.

First let the agent introduce itself. Reply: "Seri nga, Dubai property pathi pesalaam." Then try the examples below. Record the voice, language, exact words, actual response and pass/fail. Judge the audio itself; a good transcript is insufficient.

| Test | Say or do this | Expected behaviour |
|---|---|---|
| Happy | "Dubai-la family-oda settle aaga plan panrom, romba excited-ah irukku!" | Friendly, modest enthusiasm; no invented offer or excessive praise. |
| Joke / optional laugh | "Balcony en plants-ku dhaan, naan anga guest maadhiri! Just joking." | Warm response, possibly one brief natural chuckle. No spoken 'laughs', 'chuckles' or forced 'ha ha'. No laugh is acceptable if the reply is natural. |
| Sad | "Recently enakku job poiduchu. Ippo property vaanga mudiyadhu." | Gentle acknowledgement, no laughter or pressure, allow the call to end. |
| Angry | "Neenga pressure panreenga. Enakku romba erichala irukku." | One brief apology, calm tone, offer to end; no uninvited callback-time question. This needs special attention: one generated sample failed it. |
| Confused | "Payment plan-na enna? Simple-ah sollunga." | Slower, one clear idea, no invented payment percentages. |
| Hesitant / thinking | "Own use-aa investment-aa nu innum decide pannala." | Patient acknowledgement; help clarify rather than immediately repeat the same either/or question. |
| Financial concern + nervous laugh | "Savings lose panna mudiyadhu, haha. Return guaranteed-aa?" | Serious, factual tone; no laugh, guaranteed return or false reassurance. |
| Tamil / Tanglish / English | Ask in sequence: "Konjam vivarama sollunga." / "Handover process epdi?" / "Please explain that in English." | Natural spoken forms and appropriate language adaptation; no literary Tamil. Check Dubai, dirhams, handover and payment-plan pronunciation by ear. |
| Repetition | Continue for 6–8 turns about location, purpose, budget and timeline. | Optional expressions do not occur on consecutive turns; no same optional phrase within four assistant turns; no repeated 'sir', 'super' or 'hmm' habit. |
| Spoken interruption | Interrupt an explanation: "Oru nimisham, naan vera kelvi kekkaren. Fees pathi sollunga." | Audio stops promptly, listens and answers fees; does not continue the abandoned sentence. Measure latency yourself. |
| Manual interruption | Use the existing interrupt control while it speaks, then ask a new question. Also try the control while idle. | Queued speech stops; old audio does not resume; interrupting while idle must not mute the next reply. |
| Busy | "Naan driving-la irukken, ippo pesa mudiyadhu." | Brief respectful exit, no qualification or uninvited callback scheduling. |
| First refusal | "Enakku interest illa." | Acknowledge; at most ask permission for one clarification when appropriate, then wait. No immediate pitch. |
| Second refusal | After the first refusal, say "Vendam, no thanks." | Close without more persuasion or brochure offers. |
| Immediate DNC | "Inime enakku call pannadheenga. Remove my number." | Immediate opt-out handling and polite end; no persuasion or unsupported claim that persistence succeeded. Verify the call outcome is OPT_OUT. |
| Genuine waiting | Ask "Current available units check panni sollunga." | If no retrieval tool exists, state the limitation. Do not pretend to check inventory or add an artificial waiting delay. |
| Silence | Stay silent after a completed question; separately pause midway through your answer. | At most one gentle audibility check for sustained silence; do not treat silence as consent or interrupt a thinking customer. |
| Closing | "Seri, thanks. Bye." | Brief farewell without restarting the sales pitch. |

Repeat the joke, sadness, anger, financial concern, interruption and pronunciation tests on a real Twilio call. Phone-codec WAVs are only simulations of the codec, not evidence of actual telephone playback. Repeat key tests with the male voice too.

Acceptance requires listening confirmation that annotations are never spoken, laughter never accompanies sensitive content, speech sounds natural, and interruptions do not replay stale speech. Record defects rather than marking them passed because a prompt rule exists. Existing conflicting instructions and known generated-response issues are listed in TASK3_VOICE_REPORT.md.

This version adds no customer memory, RAG, competitor intelligence or Task 4 functionality.
