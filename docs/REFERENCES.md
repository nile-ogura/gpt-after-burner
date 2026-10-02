# Reference verification — 2026-10-02 (Asia/Tokyo)

## AFTER BURNER II

- [User's video: 【AC】アフターバーナーII【エンディングまで】](https://www.youtube.com/watch?v=jZSvKuupWX0). Browser playback succeeded. Reviewer directly observed the opening and approximately 01:19–01:33 of attract-mode play, then sampled actual play from 05:32 onward; this is a sample, not a claim to have watched all 20:53. The attract frame shows a rear-centered twin-engine fighter, approaching formations, a SIGHT cue, missile trails and a rapidly moving ground plane. This supports rear chase camera, legible target acquisition and a fast arcade rhythm.
- [SEGA official historical entry](https://www.sega.jp/history/arcade/product/8346/). Verified AFTER BURNER II, October 1987, speed control, guns, limited lock-on missiles and 23 stages. Use this primary source for original mechanics.
- [User's overview](https://ja.wikipedia.org/wiki/アフターバーナー_(ゲーム)). Retrieved; supplementary background only.
- [User's strategy reference](https://replayburners.blog.jp/archives/19511009.html). Retrieved; practical supplementary reference, not a primary visual-quality source.

## ACE COMBAT 8: WINGS OF THEVE

- [Japanese official site](https://enso-order.acecombat.jp/) and [official gameplay concept page](https://enso-order.acecombat.jp/gameplay/). Verified title and 2026-10-02 release listing. The site's disclaimer says the displayed screens are from development; do not describe these as independently captured retail gameplay.
- [Bandai Namco English official site](https://www.bandainamcoent.com/games/ace-combat-8). Corroborates title and release listing.
- [Official rear-chase gameplay image](https://enso-order.acecombat.jp/assets/img/gameplay/concept/img_3-2.webp). URL was read from the official page's rendered image DOM and the image was opened and visually verified in the browser. This is the appropriate direct visual comparison: rear fighter, visible combat HUD, ocean, layered cloud banks, aircraft debris and trails. It is ACE COMBAT 8 imagery, not an ACE COMBAT 7 substitute or a generated imitation.
- [Official aircraft beauty frame](https://enso-order.acecombat.jp/assets/img/gameplay/concept/img_4-1.webp). Visually verified. Aircraft shading, canopy structure, panel wear, thin edge profiles and coast detail provide useful art targets. Cinematic/beauty framing, not a like-for-like gameplay comparison.
- [Official cloud vista](https://enso-order.acecombat.jp/assets/img/gameplay/concept/img_2-1.webp). Visually verified. Useful atmospheric reference; not a gameplay screenshot.
- `img_3-1.webp` was also checked. It shows a pilot/cockpit cinematic explosion, so it is deliberately excluded from the gameplay A/B.

## Observed visual principles (reviewer's own analysis)

The rear-chase frame has irregular cloud edges, strongly lit tops and darker interiors; distant layers fade rather than stop at a flat line. The sea has directional fine detail with quieter distant texture. Aircraft exhausts are dark cavities, control surfaces are thin, weapons read as separate objects, and fuselage shading reveals continuous volume. The close aircraft frame adds weathering, varied surface roughness and articulated canopy framing. The cloud vista establishes warm low-angle sunlight with blue-grey occluded cloud masses. A simple bright gradient, shiny untextured mesh, repeated cloud circles or a flat neon sea would visibly miss these qualities.

## Comparison protocol and limits

Use the official rear-chase gameplay image above beside an unaltered captured build frame, equal display area and aspect ratio. Label only A/B and randomize order before reviewer inspection. Preserve an answer key separately and report the reviewer choice before revealing it. Do not retouch either image, exaggerate exposure, conceal faults or use a promotional beauty frame as if it were equivalent gameplay. Reviewer familiarity with the local build and distinctive HUDs weakens blindness; masking names alone is not a controlled human blind study. Still-image preference cannot guarantee motion, physics, audio, content breadth, hardware performance or overall AAA equivalence. A reviewer must report remaining gaps honestly; enthusiasm is not a measurable pass criterion.

## Later comparison verification and provenance

The same official `img_3-2.webp` was re-opened and visually verified in Chrome on 2026-10-02 after a separate capture browser timed out. The image DOM reported complete loading at 3840×2160. No remote media download was used to work around that display failure.

The earlier source-hidden comparison preferred B before source disclosure; its key was A = local and B = official. The newer 03:18:12 JST pair (`artifacts/review-round4/comparison-latest-key.json`) used A = official and B = local 03:01 baseline, each displayed at 776×436.5. The masked variant `artifacts/review-round4/comparison-masked.png` applies the same 50px top/bottom crop to both; the full pair is retained as `artifacts/review-round4/comparison-latest.png`. Root reports a fresh judge with no inherited task history or key/code inspection chose A before key disclosure. This reviewer verified the masked pair after disclosure and does not claim another independent blind result. Different combat moments, distinctive HUDs and recognizable aircraft still limit blindness. This newer comparison predates the 03:47 photographic-cloud/aircraft-v6 candidate.

The cloud cutouts used by that later candidate are original AI-generated photographic-style assets, not official comparison screenshots. Candidate adoption was independently judged from actual flight/bank/portrait and paused 90/180/270-degree world-roll renders. The resulting bounded static adoption pass does not establish commercial AAA equivalence or frame rate. See [REVIEW.md](REVIEW.md) for capture times, corrections and remaining gaps.

The later coastal-rock material `public/assets/terrain/coastal-rock-albedo-v1.png` is also an original AI-generated asset, adopted without retouching its output. It is not an ACE COMBAT screenshot/texture. Its bounded adoption review uses the 04:57 high/balanced flight and close renders frozen in `artifacts/review-round7/`; the preceding rejected contour-pattern renders remain in `artifacts/review-round6/`. Asset generation and a bounded static correction pass do not establish commercial-quality geometry, seamless pixels on all edges or hardware performance.

The 05:03:52 JST comparison is frozen in `artifacts/review-round7/`: `comparison-masked.png`, full `comparison-latest.png`, `comparison-local.png` and `comparison-latest-key.json`. This reviewer viewed only the masked image first and sent preference **B before key/code/page inspection**. The later-read key confirms A = current local build and B = the same official ACE COMBAT 8 rear-chase image. This comparison includes the corrected photo clouds, rock material, wind-ocean normals and synchronized HUD. The live official 3840×2160 source and local 1280×720 browser frame are shown at equal 776×436.5 area in the full pair; the masked version applies the same top/bottom 50px crop. Familiar local style, different combat/camera moments and unequal native resolutions limit blindness and comparability. Preference B is a current-frame visual judgment, not a hardware-performance or retail-game claim; commercial AAA equivalence remains unachieved.

The 05:41:29 JST comparison is frozen in `artifacts/review-round8/` under the same four filenames, with its candidate source/conditions preserved separately in that directory. This reviewer again viewed **only the masked pair first** and sent preference **B before key/manifest/code inspection**. The subsequent key confirms **A = local aircraft-v7/geology-contrast-v2/finer-ocean candidate; B = the same verified official img_3-2.webp**. Local improvements in tonal aircraft zoning and sea granularity are visible, but B retains stronger cloud depth, aircraft articulation/self-occlusion and light/combat integration. Source native sizes, equal display area and common crop are unchanged. The familiar reviewer does not claim complete blindness; root's attempted new history-free judge was unavailable due the thread limit, so no additional fresh-judge result is invented for this round. The different-scene/development-screen limitations remain. B preference and **commercial AAA FAIL** are separate from the candidate's bounded component passes recorded in [REVIEW.md](REVIEW.md).

The latest 06:17:40 JST comparison is fixed in `artifacts/review-round9/`, with `comparison-masked.png`, full `comparison-latest.png`, local browser input `comparison-local.png` and the later-read `comparison-latest-key.json`. The familiar independent reviewer first inspected only the masked pair and reported **B before reading key/manifest/source**; the key confirms **A = eroded-coast-v3/portrait-radio local candidate, B = official img_3-2.webp**. A's coast outline is less uniform and sea detail is finer, while B remains stronger in cloud depth, aircraft aft structure and integrated combat lighting. Equal area/common crop and the unequal 3840×2160/1280×720 source sizes are unchanged. No fully blind or history-free judgment is claimed. Current **commercial AAA FAIL** remains separate from the bounded radio/macro-shape adoption decisions and supplemental outside-playable terrain cameras documented in [REVIEW.md](REVIEW.md).

## Additional canyon/forest video inspection — bounded direct samples

On 2026-10-02, the same supplied YouTube video was reopened through the Chrome browser UI and played/paused successfully. The video element's read-only DOM reported paused true and readyState 4 for the samples below; the rendered game stage and scene were also visually inspected. Exact sampled times differ from chapter starts because the player continued briefly during navigation. No remote video/media was downloaded, and no original-game physics or rule was inferred from these still samples.

| Actual sample | Directly visible appearance | Limits |
| --- | --- | --- |
| [STAGE 8, 09:58.487](https://www.youtube.com/watch?v=jZSvKuupWX0&t=598s) | Yellow/ochre central floor with horizontal moving-ground-style bands, between tall yellow-brown/dark-brown rock-pillar walls. Dark irregular rock piles and small sprite groups lie over the floor. A large red/orange explosion and dotted projectile patterns are visible low ahead of the fighter. | This is six seconds after the 09:52 chapter. Individual sprites/weapon ownership and collision rules are not established. No broad blue reflective sea surface appears in this sample. |
| [STAGE 17, 15:57.580](https://www.youtube.com/watch?v=jZSvKuupWX0&t=957s) | Yellow-green/olive central floor; tall dark gray-green rock masses with lighter mottled patches at the sides. Orange-brown boulders/piles and low vehicle/turret-like sprites occupy the floor. Yellow/red flame or projectile columns appear ahead of the fighter. | This is ten seconds after the 15:47 chapter. Vehicle/turret-like is a visual description, not a confirmed enemy type or new attack rule. No broad blue reflective sea surface appears in this sample. |
| [STAGE 11, 12:07.327](https://www.youtube.com/watch?v=jZSvKuupWX0&t=727s) and [12:17.327](https://www.youtube.com/watch?v=jZSvKuupWX0&t=737s) | Dense blue-green and dark navy canopy texture, with irregular crown clusters and some taller upright crown silhouettes. The horizon banks with the fighter against gray-purple sky; enemy fighters and airborne trails/points remain visible above the canopy. | The dense crowns hide floor/root/trunk detail. Physical tree height, species, canopy geometry and terrain height cannot be measured from these 2D sprite-based frames. |

These observations support a **terrestrial-looking canyon corridor** and visibly dense woodland in a modern interpretation, rather than using the same open coastal-water appearance everywhere. An actual 3D canyon floor, detailed trunks/canopies, weathered geological layers or their collision behavior remain newly authored implementation choices. The observed colored floor/pillar sprites and low effects do not authorize inventing progression, a ground-target mechanic, erosion physics or a forest measurement. Candidate adoption still requires separate actual-game captures under the pre-defined visual gates.

The separate 07:12 JST candidate review is documented in [REVIEW.md](REVIEW.md): stage 8/17 floor correction passed its terrestrial-appearance gate, while sparse blue faceted crowns in stage 11 failed the visible woodland gate. The 07:38 JST forest-v2 review also failed: leaf-like texture increased, but the ordinary captured surface still lacked readable overlapping elevated crown groups. At08:04 JST, v3 passed the narrower raised-volume/soil-separation criteria but failed overall forest adoption for separated hedge-like patches and boulder-like angular crowns. These implementation verdicts do not modify the original-video observations above or establish exact original physical tree density/height.

## Video rules and progression — direct observations

The supplied video's chapter list places actual STAGE 1 at 05:32. The earlier footage is an attract/demo sequence. The following table records the creator's chapter times, not exact frame-accurate duration measurements. On-screen stage transitions can lag the chapter marker by about a second.

| Stage | Video chapter start | Interval to next chapter (seconds) |
| --- | --- | --- |
| 1 | 05:32 | 40 |
| 2 | 06:12 | 37 |
| 3 | 06:49 | 41 |
| 4 | 07:30 | 41 |
| 5 | 08:11 | 19 |
| 6 | 08:30 | 41 |
| 7 | 09:11 | 41 |
| 8 | 09:52 | 31 |
| 9 | 10:23 | 50 |
| 10 | 11:13 | 43 |
| 11 | 11:56 | 42 |
| 12 | 12:38 | 41 |
| 13 | 13:19 | 19 |
| 14 | 13:38 | 43 |
| 15 | 14:21 | 44 |
| 16 | 15:05 | 42 |
| 17 | 15:47 | 32 |
| 18 | 16:19 | 45 |
| 19 | 17:04 | 42 |
| 20 | 17:46 | 43 |
| 21 | 18:29 | 41 |
| 22 | 19:10 | 38 |
| 23 | 19:48 | 19 |
| Ending | 20:07 | — |

Directly seen: 05:48 STAGE 1 has SCORE 15740, HIT 2, five large missile icons and two small reserve-aircraft icons. At 06:50 STAGE 3 has HIT 0 and a large four-engine tanker above the player with `RELOAD WEAPONS`; 10:28 STAGE 9 and 12:01 STAGE 11 have the same tanker and boom. At 15:10 STAGE 16, 17:09 STAGE 19 and 18:34 STAGE 21 the tanker and `RELOAD WEAPONS` are directly visible. At 08:21 STAGE 5 and 13:29 STAGE 13 the plane is on a runway surrounded by service vehicles/crew. At 19:58 STAGE 23 the player approaches an aircraft carrier for final landing. HIT changes with combat and resets for a new stage; SCORE persists. At 08:12 a transition displays `HIT COUNTS 2` and `POINTS 40000`.

The short tanker events are easily missed by sampling ten seconds after a chapter start: STAGE 11 is already normal forest combat at 12:06, despite the directly verified tanker at 12:01. Confirmed tanker stages are 3, 9, 11, 16, 19, 21; ground service landings are 5 and 13; STAGE 23 is the final carrier landing. At 20:17 the screen shows `MISSION COMPLETE`. At 20:37 a `BEST FIGHTERS` table has SCORE, NAME, HIT and RANK columns, a name-entry alphabet and a medal-style rank display. This video's player row is SCORE 6093140 and final HIT 80. No XP-based level advancement appears in the observed sequence.

Additional paused, frame-stepped inspection of the STAGE 1→2 transition at approximately 06:12.x directly shows `HIT COUNTS 3 / POINTS 60000`, then fifteen video frames later `HIT COUNTS 5 / POINTS 100000`. These are two points within the same animated tally, not two different stage-final totals. Together with 2→40000, they support a linear stage-HIT bonus of 20,000 per counted HIT and rule out the proposed 10,000×HIT² formula. The total display is counting up while the previous HIT counter is consumed.

The actual-play samples show guns and effectively unchanged missile icons. Therefore missile consumption, the exact number represented by one icon, missile-vs-gun HIT weighting, loss-of-life behavior and a game-over continue rule are not proven by these samples. Two reserve-aircraft icons plus the player suggest three starting aircraft, but that is an interpretation. Do not present a proposed 50/100 round model as a direct video observation. The user's strategy article separately describes final HIT weighting of two for missile kills and one for gun kills, and secret 100-missile replenishment; those are supplementary claims, not something this guns-only video empirically demonstrates.
