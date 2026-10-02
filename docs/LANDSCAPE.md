# Bounded landscape refinement

This scoped goal improves coastline geology and water repetition while preserving the existing environment API and original game rules. It does not establish commercial AAA parity or a hardware frame-rate guarantee. Source was held while root captures ran, then changed only in `src/environment.js` after the explicit release.

## Implementation

- A canonical 36km height field cuts curving, branching drainage valleys into broad coastal slopes. The previous height quantization and small repeated height stripes were removed. Central-difference normals sample beyond tile edges, preserving lighting across both tile boundaries and the periodic wrap.
- Dry rock, vegetation, valley soil, sand and wet shore colors follow height, slope and drainage rather than uniform shading. The current albedo candidate is an original 1,254² photographic-style neutral rock texture generated with the built-in `image_gen` tool. A code-generated 512² periodic mineral/lichen fallback remains for loading failures. Neither adds bump, shadow or environment BRDF sampling.
- High terrain remains a 96×212-cell grid. Low terrain shares the exact same position, normal, UV and color `BufferAttribute` objects, using every second row and column in a separate index buffer. `renderer.getPixelRatio() <= .8` selects this index buffer; meshes, materials and world positions remain unchanged.
- Ocean normal variation uses two static wind-texture samples at different world scales/directions. The former analytical sine/cosine normal bands were removed; fine waves fade with view distance. Existing sea level, ocean mesh size and the low-amplitude broad vertex displacement contract remain intact.
- Cloud assets, placement, world-up orientation and the one-time static PMREM are unchanged from the independently accepted adoption scope.

## Geometry verification

A Node harness imported the actual module's internal geometry builders without changing production exports. It checked generated arrays, triangle winding, shared attribute identity, tile boundaries and height-field periodicity.

| Check | Result |
| --- | --- |
| Coast meshes | 4 |
| Vertices per mesh | 20,661 |
| High triangles per mesh | 40,704 |
| Low triangles per mesh | 10,176; 75% reduction |
| Shared high/low position, normal, UV, color objects | Exact identity |
| Low indices | In bounds, upward winding, nondegenerate |
| Geometry attributes | All finite |
| Shared and wrapped height, normal, color boundaries | Maximum error 0 |
| Sampled 36km height periodicity | Maximum error 0 |
| Generated height range | −10 to 1,708.243m |
| Unit normal length error | At most 4.49×10⁻⁸ |
| Ocean vertices / mean sea level | 4,225 / 0m |
| First-revision rock albedo channel range | 147–237, fully opaque; rejected visually |
| Production build | PASS |

`Coast terrain` meshes expose `terrainHighGeometry`, `terrainLowGeometry`, and `userData.terrain` metadata (`side`, `sourceOffset`, grid size, index counts and selected `lod`) for independent in-browser inspection. Both index buffers and their shared attributes are disposed when the environment is disposed.

## First independent review and correction

The 04:46 high/low coast and close diagnostic captures were checked independently. Sea bands were reduced, high/low terrain silhouettes stayed consistent, and no tile gaps appeared. **The material gate failed at P1:** the narrow noise-isoline fissures made large smooth closed loops across the mountains, resembling a contour map. The same loops were visible in the neutral albedo preview. This was a texture problem rather than an LOD problem.

The fissure computation was removed entirely from the code-generated fallback. The current generated photographic-style candidate supplies small irregular mineral grains and weathering instead. Its physical vertical repeat is 120m, giving exactly 150 repeats over each 18km tile. Horizontal repeat follows the actual image aspect ratio; this square asset also has a 120m horizontal repeat. SRGB, repeat wrapping, linear magnification and trilinear mipmap minification are explicit. Photo load failure retains the native fallback. Height, normals, vertex colors and the two terrain index buffers are unchanged by this material correction.

Close diagnostic cameras sit outside the playable flight rail; they test material appearance and do not represent additional playable territory.

## Asset provenance

The generated original was preserved unchanged at `/home/ogura/.codex/generated_images/01a0f828-c984-7da3-a8bc-6664390a77f3/exec-fc179bf0-c088-475f-91ba-88fd1691965d.png` and copied unchanged to `public/assets/terrain/coastal-rock-albedo-v1.png`. No commercial game texture or screenshot was reused. No Python image editing, recoloring or seam repair was applied.

The original and project copy have the same SHA-256: `311e615ad870512607bc2dc84e2dd79fe9e0fc3bc2d729bea69cfbfdfe865f14`.

Read-only pixel measurements found a 1,254×1,254 image, average RGB 137.92/132.10/123.89, and quadrant mean differences of approximately 2.4 levels. Mean absolute opposite-edge RGB differences are 25.75/29.57 levels, versus 20.81 for ordinary neighboring pixels: exact pixel-edge equality is not established. Repeat wrapping and mipmaps must be checked in actual terrain captures for a visible seam; the prompt alone is not proof of seamlessness.

Generation prompt:

> Create one original, seamless tileable PBR BASE COLOR / ALBEDO texture, square 1:1, for natural rough exposed coastal bedrock. Photographic material-scan quality, close orthographic top-down surface view, completely fills the square. Neutral diffuse flat overcast lighting with NO directional illumination, NO cast shadows, NO baked ambient occlusion, NO specular highlights. Fine and medium irregular mineral grains in warm-neutral gray stone with restrained pale ochre and tiny localized muted gray-green lichen, diverse organic broken surface structure. Natural photographic tiny jagged weathering and occasional very fine angular fractured seams; no wide fissures. Color variation should carry authentic rock information, keep predominantly mid-to-light neutral gray suitable for multiplication by terrain vertex colors. Both horizontal and vertical edges join seamlessly with no border, no seam, no layout, no perspective, no foreground object or background. Avoid large separate boulders, contour-map lines, smooth looping black outlines, uniformly pockmarked foam, embossed cellular bubbles, uniform procedural cloud noise, horizontal strata stripes, text, logo or watermark. This is a flat opaque ground-material asset, not an illustration, not a rendered scene. Rich microstructure but restrained contrast; densely irregular mineral variation at multiple physical scales.

## Independent corrected-material gate

**PASS, bounded material adoption:** the independent reviewer inspected the five corrected 04:57 neutral/flight/close high and balanced images. The previous P1 contour loops were gone; near rock read as small mineral grains and weathering. No obvious tile boundary, rectangular patch or static moiré was seen. High and reduced-index views retained the valley/ridge silhouette. The earlier sea-repetition improvement and cloud adoption pass remain valid.

**Remaining P2 limitations:** the close material is dark and predominantly brown/granular, and the rock/vegetation distinction at flight distance is weak. This gate does not establish exact photo-edge pixel equality, absence of moving shimmer or LOD popping, or commercial AAA quality. Terrain close-ups are still diagnostic images outside the playable rail.

## Measured rendering load

Root recorded the current build at 1440×900 on ANGLE/Vulkan SwiftShader, using the paused Stage 1 scene and 24 rendered frames after five warmups. Actual browser inspection found all four photographic maps ready, high terrain index counts of 122,112 and low counts of 30,528, with zero browser/shader errors.

| Profile | Pixel ratio | Frames/sec | 95th percentile | Draw calls | Total triangles |
| --- | --- | --- | --- | --- | --- |
| High | 1.00 | 1.25 | 850ms | 116 | 223,960 |
| Balanced diagnostic | 0.65 | 3.58 | 300ms | 68 | 75,863 |

The low terrain index buffers reduce terrain triangles by 75%; total scene triangle counts also include aircraft, enemies and effects. Other scene modules changed since the previous baseline, so frame-rate differences cannot be attributed solely to terrain or extrapolated to physical GPUs. **Software smooth-play performance remains FAIL.** The independent material adoption pass, exact geometry boundary checks and measured rendering-load record complete only this bounded landscape refinement. Commercial AAA parity remains FAIL and the main overall goal remains active. Moving-surface and LOD-transition behavior have not been proven by the static visual gate. See `docs/PERFORMANCE.md` and `artifacts/performance.json` for benchmark conditions and raw results.

## Subsequent macro-material and middle-distance wave goal

A new bounded goal addresses the remaining dark uniform mountain face and coarse middle-distance ocean pattern. The preceding evidence and first scope's completion remain valid for that revision; the new appearance has not passed review yet.

This revision preserves the original photographic asset and its 120m metric UV, height field, normals, low/high indices and clouds. CPU vertex colors distinguish vegetated drainage, warm talus and exposed neutral-gray faces. A shared `rockExposure` attribute controls how the existing single terrain map sample is used: strongly exposed faces take bounded mineral luminance detail, while soil and vegetation retain the original color multiplication. This is a local material adjustment, with no global scene exposure change, extra map samples, normal maps or lighting loops. Land vertices with exposure greater than .65 account for 10.83%; those below .05 account for 48.96%.

The same two ocean wind-texture samples use finer world scales and different rotations. Fine detail is weighted more strongly through the middle distance and fades between 1.5km and 8km. Ocean height and topology remain unchanged.

Actual-source verification found all high/low attributes, including the new exposure attribute, exactly shared and finite. Shared and wrap height, normal, color and exposure errors remained 0. Height range stayed −10 to 1,708.243m, with the same quarter-size low index buffer. Terrain map sample count remains one, ocean sample count remains two, and no new shader loop was added. Production build passed.

Round 8 browser captures compiled the v2 shader without errors and confirmed photographic readiness, the exposure attribute's high/low identity and finiteness, and quarter-size indices. Camera/FOV/state time were matched for the high/low pairs. `terrain-water-phase-plus4.png` preserves camera and game state with a second presentation-time phase; these two still images do not prove moving shimmer behavior.

**Independent bounded macro-material/water gate: PASS.** The reviewer inspected the five round8 images and confirmed that gray exposed rock, dark green drainage and soil were distinguishable, improving the former uniform brown surface. No black contour loops, clipped white slab, terrain tile gap or silhouette mismatch appeared in high/.65 pairs. Middle-distance water had finer irregular structure, quieter far water, and no obvious grid or moiré in the fixed +4s phase. This completes only the bounded revision's implementation, browser verification and static adoption review. Remaining P2s include smooth diagonal gray/green bands on large slopes, weak structural distinction between woods/talus/rock layers, and photographic grain covering planar faces. Forest geometry, natural geology, commercial AAA quality and temporal shimmer are not passed by this gate. The earlier FPS measurements predate the v2 material shader; no new frame-rate improvement is inferred from equal sampler counts.

The implementer's separate still-image check found clearer gray rock/green drainage/soil separation without black loops, blank white painting, obvious square tiles or static moiré. High/low silhouettes were maintained, and the water lost the previous coarse horizontal structure. Remaining P2s include rounded mountain faces with periodically spaced bright/dark folds, uniform close grain, canopy represented by color patches, and a matte/granular sea with limited optical depth. An image-only masked A/B preference was recorded before the source key was disclosed: B was preferred for aircraft detail and scene integration. Familiarity with the local style prevents claiming a fully blind test. Neither these observations nor shader correctness establish commercial AAA parity, motion quality, physics accuracy or hardware FPS.

## Subsequent mountain macro-geometry candidate

The next bounded goal addresses rounded broad slopes and periodically spaced diagonal gray/green folds visible in the round8 chase view. This candidate changes CPU height generation and its material attributes only. The adopted photographic rock asset, 120m metric UV, `coastal-geology-contrast-v2` single-sample terrain shader, two-sample water shader, clouds, grid topology and environment API are preserved.

Two shore fields are generated once at startup and reused by their two adjacent 18km meshes. The former regular gully-cell locations and simple broad mound are replaced by a warped, irregular periodic ridge mass. A finite deterministic downhill erosion approximation forms connected drainage; bounded deposited material and four talus-relaxation passes inform soil and exposed-rock distribution. Three weak periodic smoothing passes limit thin peaks and high/low surface divergence. This is a geometric landscape approximation rather than a mass-conserving hydrological simulation. Its CPU work is not repeated during frames.

The field samples a canonical 36km longitudinal coordinate. Tile normals and the local-relief material mask use the same ghost samples outside each tile, so a material change cannot introduce an otherwise invisible seam. Underwater coast queries continue returning −10m. The reduced index buffer shares all five high-resolution vertex attributes, including `rockExposure`; it still contains one quarter as many triangles.

Actual-source numerical checks after the final smoothing passes:

| Check | Candidate result |
| --- | --- |
| Terrain meshes / vertices per mesh | 4 / 20,661 |
| High / low index count per mesh | 122,112 / 30,528 |
| High / low triangles per mesh | 40,704 / 10,176 |
| Position, normal, UV, color, exposure high/low identity | Exact shared objects |
| Attribute values and bounds | Finite; bounding-sphere radius below 15km |
| Shared and wrap height, normal, color, exposure error | 0 |
| Sampled 36km height periodicity error | 0 |
| Height range | −10 to 1,565.199m |
| Unit normal length error | Below 4.92×10⁻⁸ |
| Largest adjacent high-grid height difference | 271.050m |
| Low surface difference at omitted vertices | Max 122.302m; RMS 12.076m over 61,672 samples |
| Node two-field/mesh generation plus numeric inspection | Approximately 1.18s, startup only |
| Production build | PASS |

Before the weak smoothing passes, the largest low-surface difference was 197.732m (RMS 16.534m), and the maximum adjacent height difference was 348.369m. The reduction is a numerical safeguard, not evidence that the remaining cliff faces look natural. Sharing attributes preserves retained vertices exactly; it does not make the coarse triangle surface identical between them. At this checkpoint, ordinary-chase and close high/low images still needed to check silhouette differences, excessive sharpness, periodic bands and the readability of real 3D valleys. The candidate **awaited independent GPU-image adoption review**. Prior round8 acceptance applies to the preceding revision; commercial AAA parity and smooth-play performance remain unachieved.

The completed 06:17 terrain subset compiled this candidate with zero recorded errors and all photographic maps ready. Source hash for the environment is `183d83ac8ca00957e802e6a5c8bd52b9928280b530833bf0fee3f29ce6569784`. The implementer's actual-image check found unequal mountain shoulders and valley mouths in the ordinary chase view, replacing the former regularly spaced diagonal folds. Large dark cliff faces still have weak rock/vegetation separation, and their geological structure remains a P2 concern.

A read-only comparison with the frozen round8 source found the sky/ocean builders, the v2 rock shader, and the rock-loader/cloud-builder section byte-for-byte unchanged. The photographic rock hash remains `311e615ad870512607bc2dc84e2dd79fe9e0fc3bc2d729bea69cfbfdfe865f14`. The current source hash matches the captured source hash. The five-frame evidence records ratio 1/.65, identical paired camera/quaternion/FOV and presentation phase, all maps ready without fallback, and `eroded-coast-v3` on all four meshes. This supports cost/asset preservation and static-pair validity, not rendering speed or visual adoption.

The preserved old close-camera image is predominantly near rock grain and does not expose enough of the new ridge/basin structure to judge macro shape. Sampling the actual field found ground height 285.639m at that camera (800m altitude), and 1,021.465m at its 650m target. The camera is above ground, but its target lies inside the new mountain face. The old camera/time/tile-matched evidence is retained; a separately identified high-altitude diagnostic supplements it rather than silently replacing it. No obvious high/low hole, needle or black contour loop was seen in this close subset. **Old-close macro structure remains NOT ASSESSABLE**. Adoption still needed the supplemental geometry view and strict independent verdict recorded below.

Root preserved the completed source-held run in `artifacts/review-round9/`. The additional low chase check retained recognizable shoulders, valley mouths and the shore silhouette without a conspicuous open seam or drastic collapse; reduced fine detail is visible. This is the implementer's check, not the independent adoption verdict. The run is camera/clock/tile matched to round8, not whole-world pixel matched, because historical cloud/reflection states were incompletely recorded.

For the round9 masked comparison, the implementer viewed only `comparison-masked.png` before reporting the preference: **B**. Its rear-aircraft shape, finer sea, cloud and combat lighting appeared more integrated. A's unequal new shoulders improve the landscape but broad dark faces and weak rock/vegetation relationships remain. B contains almost no visible terrain, so this pair cannot directly compare geological quality. Local-style familiarity and different camera/action/native resolution prevent a fully blind claim; this still comparison says nothing about FPS or physics. The source key was not read before the report.

## Independent macro-geometry gate and completion audit

**PASS, bounded static macro-shape adoption.** The separate reviewer directly inspected ordinary chase high/.65 and the four supplemental images fixed in `artifacts/review-round9/supplemental/`. Unequal connected ridges, bowls and lower channels with varied heights/widths are now visible in geometry and shading, correspond to the ordinary chase shoulders/valley mouths, and replace the prior uniform diagonal-slope impression. The reviewer found no obvious open seam, needle or equal groove grid. The full independent verdict is recorded in `docs/REVIEW.md`, Round 17.

The supplemental overview camera is `(2900,1800,1683.3333)`, targeting `(5000,900,-116.6667)`; the wider coast camera is `(1700,2200,3383.3333)`, targeting `(5300,650,-1316.6667)`, both FOV 45. Their 1800/2200m altitudes are above all terrain vertices. Their JSON independently records equal high/.65 camera, player and clock within each pose, photographic readiness without fallback and empty errors. These new external QA cameras are outside playable territory and are not pixel-matched replacements for the preserved 800m close attempt.

The final actual-source audit regenerated the four meshes and confirmed height −10 to 1565.198608m, normal unit error at most 4.9136×10⁻⁸, exact high/low attribute identity, quarter-size indices, finite bounds, shared/wrap height/normal/color/exposure error 0 and sampled 36km periodicity error 0. All 624 sampled underwater-coast queries returned −10m. Source, original photo/UV, v2 rock shader, water and cloud preservation were checked against the frozen captured source; existing `createEnvironment`/`update` use is retained in the successful root GPU run.

**Remaining P2 and unpassed claims:** large dark rounded tops, continuous smooth steep walls and photographic grain still look authored; convincing strata, woodland structure and talus morphology are weak. Narrow crests/shoulders have angular or shape differences under quarter indices, although broad ridge/coast agreement passed. Natural geological fidelity remains **FAIL**. Moving LOD transitions, shimmer, physical erosion accuracy, individual-tree rendering and commercial AAA are not established by these stills. The independent adoption pass completes only this scoped irregular macro-shape objective and its numerical/static verification.

Root separately measured this revision's full paused software-rendered scene: high ratio1 **1.21fps / p95 900ms / 118 calls / 226,328 triangles**; diagnostic ratio.65 **3.20fps / p95 350.1ms / 69 calls / 77,047 triangles**. The sampler/triangle contracts did not produce smooth play on SwiftShader. Rendering performance remains **FAIL**; physical-GPU performance remains unknown. Main AAA quality remains unachieved, and the official side remained preferred in the latest masked comparison.

## Subsequent canyon-floor and forest-geometry candidate

This new scoped goal addresses the remaining content gap: canyon stages still used the reflective sea, while forest scenery changed coast colors without actual vegetation geometry. The root-owned sky shader was separately moved to `src/sky.js`; its import, sky calls and cirrus texture disposal are preserved by this environment revision. Original game rules and aircraft physics are unchanged.

The independent reviewer revisited the supplied video in the browser. At STAGE8 09:58.487, a yellow/ochre dry strip lies between brown vertical rock walls. STAGE17 15:57.580 instead has yellow-green/olive ground and darker gray-green walls. Neither sample shows a broad blue reflective sea. STAGE11 12:07.327 and 12:17.327 shows dense blue-green/dark navy canopy, with occasional higher crown groups. Roots, trunks and real tree dimensions are hidden in that 2D footage. See `docs/REFERENCES.md` for the observation record. The new 3D stems and height/corridor limits are a modern visual interpretation, not dimensions or collision rules measured from the video. Full pillar-wall reconstruction remains outside this floor/forest revision.

Two dry ground tiles cover 48km horizontally, the same width as the existing ocean, and 18km each longitudinally. Their height/color/ghost-normal field repeats over 36km. They scroll and wrap with the existing terrain tile transforms. This complete floor extends below and beyond the sidewalls rather than leaving a water gap where the valley meets the wall. Canyon8 uses yellow/ochre mineral soil, canyon17 uses an olive palette plus gray-green wall tint, and forest uses darker soil. The original photographic albedo is reused without image editing or new texture loading. Ground UVs expand by width/6400 so its physical repeat stays 120m.

The sea is hidden only in canyon and forest modes. Coast, mountain, dusk, runway-service and carrier-return modes hide the new floor and vegetation and retain the prior sea/terrain height contracts. Sky, cloud assets/static reflection, coast macro height, original terrain LOD and gameplay modules are unchanged by this candidate. The new objects are pure scenery; no new enemies, projectiles, terrain collisions or scoring rules are introduced.

Forest contains 384 geometric trees in high and 192 in low, distributed through unequal clusters with varied rotation, scale and blue-green color. Each tile has one `Forest canopy <offset>` and one `Forest trunks <offset>` `InstancedMesh`; all share two native low-poly geometries and two diffuse materials. The low selection keeps half the trees distributed across all clusters. Roots are placed on the actual high or low floor triangle surface, and instance heights update only when the profile changes. This avoids floating roots caused by using an analytic height where the rendered low triangle differs. No new texture sampler, fragment loop or tree shadow is added.

### Geometry and inspection contract

`Biome ground -5800` / `Biome ground -23800` expose `biomeGroundHighGeometry`, `biomeGroundLowGeometry`, palette attributes, and `userData.biomeGround`: source offset, 48000×18000 size, 17×65 vertices, 36000 period, high/low index counts, current palette/LOD, min/max height and local/world coverage. The triangle mapping uses the ordinary plane diagonal: first half when normalized cell u+v<=1. Forest meshes expose `userData.forest` with high/low/current counts, source offset, profile, maximum top, conservative central clearance, packed-Float32 root error and grounding tolerance 1e−5m. Numeric metadata is inspectable; it does not replace root's independent actual-geometry browser checks.

Actual-source Node verification constructed both floors and forest groups, checked all attributes/matrices/bounds for finiteness, and used Three.js downward ray intersections to check tree roots against the actual selected triangle index buffer:

| Check | Candidate result |
| --- | --- |
| Floor height | 4.498798–15.487936m |
| Floor shared/wrap height, normal, all three palette errors | 0 |
| Sampled 36km floor periodicity error | 0 |
| Floor high/low attributes | Exact shared objects; finite |
| High / low indices per ground tile | 6144 / 1536 |
| Tree root error against actual high/low ray intersection | Max 1.868×10⁻⁶m |
| Actual transformed tree vertex maximum altitude | 50.211342m |
| Clearance below the 80m player minimum | At least 29.788658m |
| Actual transformed minimum absolute tree X | 434.580638m; central ±300m remains clear |
| High floor + vegetation triangles | 4096 + 19200 = 23296 |
| Low floor + vegetation triangles | 1024 + 9600 = 10624 |
| Added draw calls if all six meshes are visible | At most 6; the sea draw is removed in these modes |
| JavaScript syntax | PASS |

The module is **SOURCE HOLD for root's stage8/17/11 GPU capture and independent adoption review**. Root owns the production build and 22 gameplay tests; these were not redundantly rerun by the scenery implementer. The numeric limits prove bounds and contact, not dense woodland appearance. Sparse coverage, identical low-poly crowns, soil dominating the ordinary rear view, palette readability and sidewall/floor contact are explicit pending visual concerns. A static acceptance cannot certify natural transitions, moving LOD/shimmer, physics, dense realistic forestry, AAA parity or hardware frame rate.

### Attempt 1 independent visual result

The root preserved the initial connection-refused startup failure (zero biome images), restarted the development server, and completed the retry with 11 stage images and actual indexed-triangle checks in `artifacts/review-round10/biomes-attempt1/`. Independent review of the fixed high/.65 rear and bank images gave the **canyon-floor scope PASS**: stage8's brown/ochre and stage17's dark olive floor remain continuous between walls, with no visible holes or return to reflective sea. This does not certify the original game's column-shaped wall morphology.

**Forest adoption FAIL (P2).** The same review and the implementer's separate preview agree that stage11 is dominated by dark bare soil; the sparse small blue faceted crowns read as stones or crystals. Numerically grounded trees do not meet the video reference's dense blue-green canopy. The active floor/forest goal remains unfinished. Its next bounded correction must create irregular overlapping near/mid-distance crown masses, with readable upper and shaded faces, differing heights/widths and preserved canopy area in low, while retaining the clear flight corridor, actual ground contact and altitude limits. The failed images/source remain preserved; no pass is inferred from the grounding tests.

### Forest correction 2: periodic canopy mass candidate

The next revision preserves the accepted canyon floors and palettes. In forest mode, two `Forest mass <offset>` meshes each contain two disconnected strips with irregular clearing edges. A periodic CPU height field varies the upper crown volume; both side edges end at y=1m, buried below the dry floor's 4.498798m minimum, instead of ending as a floating sheet. The mass remains outside the central ±300m flight corridor. This is an approximation of grouped crowns, not individually simulated trees. Roots/trunks remain on actual floor triangles. Rooted trees reduce to 64 high / 32 low per tile, use crown-scale photographic UVs and smooth ellipsoid normals, while the mass uses tangents of its deformed height field for normals.

Root generated and copied the new original, unmodified 1254² diffuse asset `public/assets/terrain/forest-canopy-albedo-v1.png`; provenance and a clearly labelled prompt summary are recorded in `docs/FOREST_ASSET_PREVIEW.md` and `artifacts/forest-canopy-asset-v1.json`. The exact tool prompt was not retained and is not reconstructed as a verbatim record. Its original output is `/home/ogura/.codex/generated_images/01a0f826-6479-73b2-b0bc-24d13f7c7747/exec-adbb44c2-ee83-4b44-871f-7267adeb86e4.png`, SHA-256 `bb75b78643a99fa466c52dcdf7185f062d9b9f87d9b8ee56aaf005d0e723c3e9`. No image edits or official-game texture reuse occurred. Opposite image edges are not pixel-identical (mean channel difference ~17 versus sampled ordinary horizontal neighbor difference11.5), so seamless appearance remains an actual-scene review concern. The texture retains 120m metric repeats, sRGB and trilinear mip filtering. Forest mass, forest-only floor undergrowth and rooted crowns each use one diffuse sample; canyon/restoring modes immediately reuse the original rock map. Near-neutral cool vertex palettes avoid multiplying the already-dark foliage photograph by the previous near-black soil/blue crown tints. There are no new fragment loops, leaf transparency or forest shadow casters. A small native foliage map remains the explicit loader-failure fallback.

Each mass's side order is `[-1,+1]`; each strip has 13 columns ×145 rows (1,885 vertices), at localZ `-9000+row*125`. Column t progresses from inner to outer edge; negative-side winding is reversed to face upward. Its UV is `(worldX/6400, (localZ+sourceOffset)/18000)`, with repeat `(6400/(120×imageAspect),150)`. The 36km wrap therefore differs by 300 complete texture repetitions. High and low geometries share the same position/normal/UV/color objects; low selects every second grid column/row. `forestCanopyHighGeometry` / `forestCanopyLowGeometry` and `userData.canopyMass` expose strip layout, period, counts, min/max height, minimum absolute X, buried edge height, UV convention/tolerance, revision, one-sample cost and map readiness/fallback. All mass/trees are hidden outside forest; canyon keeps only its accepted dry floor.

Actual-source verification of the correction, before GPU acceptance:

| Check | Correction 2 result |
| --- | --- |
| Mass actual vertex height | 1–56.806583m |
| Mass actual minimum absolute X | 362.078766m |
| Rooted tree actual transformed maximum height | 62.967566m (at least17.032434m below player minimum80m) |
| Rooted tree actual minimum absolute X | 445.983155m |
| Root contact versus actual high/low Three.js ray intersection | Max1.379×10⁻⁶m |
| Mass normal unit error | Max3.058×10⁻⁸ |
| Mass shared-edge position/normal/color/UV error | 0 |
| Mass wrap position/normal/color error | 0 |
| Float32 wrap UV residual after subtracting2 | 1.490×10⁻⁸ (about2.24×10⁻⁶ texture repetitions) |
| Mass attribute/bounds finiteness and high/low attribute identity | PASS |
| Mass indices per tile, high/low | 20,736 / 5,184 (quarter) |
| High scene additions: floor + mass + trees | 4096 + 13,824 + 6400 =24,320 triangles |
| Low scene additions: floor + mass + trees | 1024 +3456 +3200 =7680 triangles |
| Forest visible addition draw budget | At most8, two more than failed attempt1; sea draw removed |

The correction is a candidate awaiting root's fixed actual forest rear/detail/bank high/.65 captures and strict independent adoption. Texture seams/repetition, crown volume hierarchy, clearing-edge solidity and low-profile canopy area must be judged in those frames. The active goal remains unfinished, and AAA/smooth-play performance remain unpassed.

### Correction 2 actual review result

An initial navigation/network-idle timeout produced no forest frames; its cause was not established and the failure JSON was preserved. With the same frozen game source, explicit DOM/readiness/settled-frame waiting completed the retry with no errors. Five forest rear-high/.65, bank and detail-high/.65 images plus evidence, manifest and all source are fixed in `artifacts/review-round10/biomes-attempt2/`. Root's independent actual-geometry audit confirmed eight visible addition meshes, 24,320/7680 triangles, finite/shared quarter-index mass attributes, <70m tops, >300m central clearance, contact error below1.68×10⁻⁶m, zero join-height/X/normal/texture-phase errors, and hidden scenery in stage1/5/13/23. These are numerical/API acceptance results, separate from the following image rejection.

**Forest adoption remains FAIL (target P2)** from both independent reviewers. The new blue-green leaf/crown photograph is richer and the blue-crystal appearance improves, but ordinary rear/high/.65/bank still reads as a dark textured carpet or broad embankments. Detail is a smooth low rolling surface with aerial foliage texture and a small boulder-like rooted crown. Near/mid overlapping crowns, upper/shaded faces and crown-scale silhouette differences remain weak. No definite new P1 hole or HUD obstruction was observed. The implementer's separate read-only image review agrees; the roughly100×125m canopy grid supplies landscape-scale shoulders rather than the required10–30m crown hierarchy. Texture readiness, eight meshes and grounding numbers do not close the active goal. A further bounded geometric revision must address those particular visible weaknesses without changing the accepted canyon floors, original gameplay, central clearance or environment API. Commercial AAA remains FAIL.

### Forest correction 3: bounded near/mid crown pool candidate

The next correction reuses the four rooted-crown/trunk instanced meshes. Each holds at most768 instances, with a global limit768 across both tiles. Each tile has4800 deterministic uneven stand records; only forward near/mid records within worldZ `player.z+[-3600,-80]` are eligible for the visible pool. The camera frustum ranks visible crown bounds first; existing callers without a camera use a forward cone from renderer aspect. Compaction occurs after20m scrolling, a profile/view change, entry into forest, or a40m horizontal player movement. Candidates are ranked deterministically with source-index tie-breaking. The same camera/placement chooses identical source records in high/.65, using high-reference root height for selection, while the actual stem matrix roots on the selected high/low floor triangle. Crown geometry is also identical in both profiles. This preserves canopy density in low, at a deliberately larger geometry cost.

Each crown now has five asymmetrical smooth ellipsoidal lobes (100 triangles) with restrained lower-face vertex shading, a single foliage photo sample, and a brighter upper-crown material. The ten-triangle stem stays rooted. Crown heights36–52m are bounded by the floor maximum below70m; broad lower canopy mass is reduced so it does not hide the new crown shoulders. The ground restores the neutral mineral photo with a dark forest soil/undergrowth palette, instead of treating the same aerial tree image as both soil and upper foliage. Mass/crown materials retain the original unmodified canopy photo. Canyon8/17, sky/clouds, gameplay, the coast height/UV contracts and all nonforest visibility guards remain unchanged. No alpha overdraw, additional shadows, map sample or fragment loop is introduced. Actual tree appearance remains a candidate, not a consequence of these choices.

`userData.forest` retains source offset, profile/count, grounded-root error/tolerance and height/central-clearance fields. It adds `sourceCount:4800`, capacity/global `poolLimit:768`, forward selection window, refresh distance, crown/trunk triangle counts, revision `pooled-five-lobe-forest-v3`, `sourceIndices` (plain integer arrays) and `localRootPositions` (plain `[x,rootY,localZ]` number arrays). `worldOffsetZ` is refreshed with the current ground transform; `placementAtRefresh` records the compaction position. World roots reconstruct from the local record plus the mesh position. Zero-active far meshes are hidden and have explicitly finite zero bounds. Moving compaction pop is not verified or claimed smooth.

Actual-source testing swept scroll advances0,2622.222222,17500,18000,35900 and36000m, with the same actual camera in both profiles. All sampled phase/profile active roots were checked against downward Three.js intersections of actual floor indices; all active transformed crown/stem vertices and every matrix were finite. Source indices match between profiles and return exactly after a36km wrap:

| Check | Correction 3 numerical result |
| --- | --- |
| Maximum global active crown count across sampled phases | 768 |
| Sampled actual transformed crown/stem maximum height | 64.506825m; theoretical bound <67.487936m |
| Sampled actual minimum absolute crown/stem X | 419.545953m |
| Actual floor ray-intersection root error | Max1.242×10⁻⁶m |
| Local geometry normal unit error | Max3.575×10⁻⁸ |
| Lower canopy mass height / minimum absolute X | 1–34.653259m /362.078766m |
| Mass shared edge position/normal/color/UV error | 0 |
| Mass wrap position/normal/color error | 0; Float32 UV residual1.490×10⁻⁸ after subtracting2 |
| High/low crown source indices and geometry | Identical; actual root height follows current floor indices |
| Full36km source selection repeat | Exact in sampled actual-source test |
| Mass high/low attribute objects | Shared; finite; quarter indices retained |
| Empty instance-pool bounds | Explicitly finite zero bounds |
| Maximum high floor + mass + crown/stem triangles | 4096 +13,824 +84,480 =102,400 |
| Maximum low floor + mass + crown/stem triangles | 1024 +3456 +84,480 =88,960 |
| Visible additions | Six to eight meshes, no extra calls over correction2 |

The earlier≈25k additional-triangle target proved insufficient when spread across36km. Root explicitly allowed the larger bounded pool to address the actual repeated visual failure. This count is a renderer bound, not a performance pass. The source is held for root's production build, independent browser geometry checks and the same five forest image poses. Near/mid silhouette overlap, upper/understory separation, crown scale and retained low density must pass independent actual-image review before this goal closes. Previous failed attempts remain fixed. AAA and software smooth play remain unpassed; no hardware-rate guarantee is made.

### Correction 3 actual review and correction 4 candidate

Root built v3 and fixed five successful no-error browser frames with source/evidence in `artifacts/review-round10/biomes-attempt3/`. Browser checks found768 selected crowns in both profiles, identical source IDs/geometry, six active meshes, declared102,400/88,960 triangles, crown top63.495m and root error below1.06×10⁻⁶m. Independent review gave the **raised-volume/soil-separation/low-retention components PASS**, but **overall forest adoption FAIL**: dark bare gaps and thin detached hedge/rock islands still dominate ordinary rear/bank; enlarged Ico0 outlines show hard polyhedral corners instead of convincing crowns. The implementer observed the improved stems/shoulders but also dark rounded groves and open undergrowth. These partial passes do not replace the full density/natural-crown gate.

Independent source review also reproduced a separate P2 cache issue: a camera translation with unchanged orientation/paused ground placement could retain the prior selected records. The pool invalidator now tracks camera position and all player coordinates at20m thresholds in addition to placement, orientation/FOV/aspect and profile. This functional correction is separate from the visual revision and does not prove smooth moving compaction.

V4 keeps individually rooted trees, each with three asymmetrical **Ico1 lobes (240 crown triangles)** and its own ten-triangle stem. Actual curved silhouette is finer than v3's20-face lobes; no large multi-tree crown is falsely supported by one giant stem. Rather than200 isolated stand centers, each tile supplies **24,000 tree records**:48 lanes×250 rows×two sides, with curved density edges, cross-lane domain warp, per-tree lateral/longitudinal jitter, varied heights/widths/rotation and nominal25m×72m spacing before distortion. The dense source coverage allows neighboring near/mid crowns to overlap as a continuous stand. The unrendered source lattice is not an extra scene mesh. The global visible pool remains at most768, with actual forward-camera-frustum priority and identical records/crown geometry in high/.65. Both profiles retain every selected crown; only soil/far-mass indices change. Accepted canyon8/17, root-owned sky/main camera, clouds/reflection and all flight/scoring rules are preserved.

Metadata revision is `pooled-round-lobe-forest-v4`, `sourceCount:24000`, `crownTriangles:240`, `trunkTriangles:10`; source IDs remain plain unique integers within the declared tile source range, local rooted positions remain plain number triplets. Position refresh fields add camera/player coordinates at refresh and both20m thresholds. Existing period, world-offset, placement, contact, clearance and map contracts remain inspectable. The original foliage asset is unchanged and continues to use one map sample, opaque diffuse materials and no extra foliage shadows or fragment loops. Floor/upper material separation remains intentional.

Actual-source testing at scroll0,2622.222222,18000 and36000m in both profiles confirms identical768-record selection between profiles and exact return after one36km period. Actual transformed vertices and all matrices are finite; sampled tree top64.472343m, minimum absolute X420.226312m, root error against actual floor-ray intersections1.263×10⁻⁶m, local normal unit error3.333×10⁻⁸. Native construction of the floors/pool/mass helpers took231.8ms in the Node harness; this excludes renderer/shader startup and says nothing about frame rate. Camera translation+1200m, playerY+200m and playerZ+500m each produced the same selection as a newly constructed pool with that final view/state. Camera translation and playerZ changed the selected records; playerY alone correctly matched the unchanged-camera fresh result. These tests verify invalidation consistency, not temporal pop/shimmer.

Worst-case added foliage/ground geometry is **209,920 triangles high /196,480 low**, six to eight visible meshes. The extra107,520 triangles over v3 are explicitly allocated to curved outline and dense volume; their performance cost must be measured in a focused stage11 diagnostic. The v4 source is held for the same five fixed image poses and strict independent forest acceptance. Current scoped goal stays active; no still, source count, texture or smooth mathematical surface establishes dense woodland/AAA or smooth play on software or physical hardware.

### Correction 4 fixed review, cache verification and measured cost

Root built the held source and fixed the five successful forest frames, evidence, manifest and source in `artifacts/review-round10/biomes-attempt4/`, with no browser errors and matching environment SHA-256 `d06bdfd19f2128c7333860867cc200db10ede072fb3d9c1d3585f467fd9a24ad`. Two independent reviewers and the implementer's separate image inspection agree: near-canopy area, rounded shoulders, neighboring overlap and low-profile density visibly improve, but **full forest adoption remains FAIL (target P2)**. Rear/bank show rows of similar rounded crowns and fairly straight stand borders, with empty sideward mid-distance ground. Detail reduces the prior polyhedral corners but still reads as dark blue-green mottled balls or wet rocks, with an aerial forest image projected onto individual crowns, weak upper/interior light separation and texture/intersection streaks. No definite new P1 hole, tile break, floating root or HUD obstruction was observed. These partial improvements do not relax the original dense-woodland gate or establish commercial AAA.

Independent exact-source cache testing verifies the specified correction: translating cameraX by1200m changes481 selected IDs and matches a freshly constructed pool at that final view; playerY+200m with the camera held refreshes metadata but correctly preserves IDs/fresh equality; translating camera and playerY together changes10 IDs/fresh equality; playerZ+500m changes18 IDs/fresh equality. High/.65 retain identical768 IDs and the same240+10-triangle geometry. Geometry/matrices are finite, and maximum normal-length error is3.33×10⁻⁸. This is a bounded invalidation PASS; it does not demonstrate moving compaction continuity or absence of popping.

Root separately measured this exact held stage11 scene in `artifacts/review-round10/performance-forest-v4/performance-forest.json`:1440×900, SwiftShader, paused after8s simulation and labelled8s environment-only settling, frozen camera/presentation, five warmup frames followed by24 raw RAF intervals per profile. It is a new forest-scene measurement, not a stage1-matched causal comparison:

| Profile | Pixel ratio | Measured FPS | p95 interval | Draw calls | Rendered triangles |
| --- | --- | --- | --- | --- | --- |
| High | 1 | 0.97 | 1083.3ms | 139 | 441,480 |
| Diagnostic balanced | .65 | 2.30 | 500ms | 90 | 278,759 |

The run completed without errors. These software-renderer values remain transparent measurements; physical-GPU performance and smooth motion are not inferred. **The user subsequently explicitly accepted low FPS on this PC. Frame-rate thresholds therefore no longer block visual adoption, and low FPS alone is not treated as an AAA failure.** The forest rejection above is solely the visible density/shape/material rejection, independent of these timing values.

The finite canyon/forest candidate construction, geometry/API verification, independent adoption review and cost-recording scope is now recorded through v4. Its result is canyon-floor PASS, specified cache PASS, partial forest components PASS and **full forest visual FAIL**. Required woodland corrections remain open in the primary game objective and a new bounded v5 scope; closing this reviewed-candidate scope does not mean the requested woodland quality or the user's complete game has been achieved. Accepted canyon palettes, all gameplay rules, original photo assets, world-period/contact/altitude contracts and sky/cloud APIs remain intact. Moving LOD/compaction, natural geology and commercial AAA remain unverified or below their visual gates.

### Forest correction 5: irregular stands and native crown material candidate

The next finite goal implements a candidate, verifies its bounded source/API geometry, and hands held source to independent image review. It does not assert that the forest visual gate has passed. The v4 rejected images, numerical evidence, raw performance and masked comparison remain fixed.

V5 removes the48-lane×250-row source layout. Each18km tile instead has48,000 deterministic independent seeded positions across both sides; periodic stand fields vary the curved inner/outer borders, correlated widths and heights, with per-tree yaw and material variation. This is irregular seeded sampling, not a claim of mathematically certified blue-noise spacing. Source IDs still cover `0..47999`. Individual trees remain separately rooted on the current indexed floor. Heights24–52m and independent lateral scales create a wider range of aspect ratios than the old shared proportional globes. Two asymmetric three-lobe geometries retain240 crown triangles each, with slight locally sculpted shoulders and normals computed from deformed-surface tangents. Both profiles use the identical two geometry objects and the same selected records; there is no reduction of crown density in low.

The global visible pool increases to2048 to supply near and middle-distance canopy area. Eligible forward depth remains80–3600m. Frustum-prioritized deterministic candidates are distributed over depth bands `<900`, `900–1850`, `1850–3600m` with nominal30/40/30 percent quotas; unused capacity is filled deterministically. This avoids selecting a single favored depth and cutting off most sideward middle-distance crowns. Camera/player20m invalidation and the full36km repeat are preserved. Moving pool changes and LOD popping are not proven smooth by these tests.

Individual crowns now use a distinct code-native128² repeating sRGB diffuse map with leaf-cluster-scale irregular detail and trilinear mip filtering. The aerial foliage photograph remains only on the distant, lower canopy masses. Crown geometry UVs repeat the leaf patch eight times horizontally and five vertically per lobe; their mapping is not a second overhead photograph of entire trees. Mid-green upper faces and darker interior faces come from native diffuse plus restrained local vertex/instance palettes under the existing scene lights; global exposure, sky and sunlight are unchanged. The map has one diffuse sample, zero new fragment loops, no foliage alpha and no additional shadow casters. Native metadata is `ready:true`, `assetStatus:'native-ready'`, `fallback:false`, `generatedBy:'code-native'`, `revision:'leaf-cluster-diffuse-v1'`, `photoSamples:0`. Opposite128² edge bytes match exactly, though this alone does not prove a convincing rendered leaf scale or absence of moving shimmer.

Each tile now contains two `Forest canopy <offset> variant <0|1>` meshes plus one shared `Forest trunks <offset>` mesh. Their `userData.forest` revision is `irregular-leaf-stands-v5`, with `sourceCount:48000`, `poolLimit/capacity:2048`, individual actual counts, variant identifiers, plain source-ID arrays and local `[x,rootY,z]` triplets. Each crown variant owns its selected subset; their disjoint union equals that tile's shared trunk IDs. Each selected tree contributes one240-triangle crown and one ten-triangle stem. The maximum added geometry is529,920 high /516,480 low, including the accepted floors and unchanged far masses. At most ten biome draws are added: two floors, two masses and six crown/trunk draws; inactive far pools remain hidden with finite zero bounds. These costs are explicit, and the user accepts low FPS on this PC; no new timing claim is made.

Actual-source verification before image acceptance:

| Check | V5 candidate result |
| --- | --- |
| All96,000 source records' maximum upper bound | 64.510569m |
| All-source conservative transformed-box minimum absolute X | 327.858003m |
| Sampled actual transformed maximum crown/stem Y | 62.801256m |
| Sampled actual transformed minimum absolute X | 343.272430m |
| Root contact against actual high/low floor ray intersections | Max1.280×10⁻⁶m |
| Geometry normal-length error | Max3.860×10⁻⁸ |
| Global active crown limit | 2048 |
| High/.65 source IDs, variant unions and variant geometry objects | Identical in sampled phases |
| Scroll phases tested | 0,2622.222222,18000,36000m |
| Full36km source selection return | Exact |
| Crown native texture | 128²; opposite-edge byte error0 |
| CameraX+1200m / playerY+200m / playerZ+500m cache versus fresh pool | Equal in specified cases |
| Native helper construction | 280.5ms in Node harness; excludes renderer/startup/FPS |

All active matrices and transformed vertices in these sampled phases are finite; all-source height/corridor limits use conservative transformed geometry-box bounds. Accepted canyon8/17 palettes, soil/upper separation, floor indices/contact, shared mass attributes/quarter indices, 36km seams, original photographs, nonforest hiding, root-owned sky/main camera and all gameplay remain unchanged. The next fixed rear-high/.65, bank and detail-high/.65 frames must independently determine whether rows, clipped-looking borders, empty sideward mid-distance ground and dark photographic ball material are actually resolved. Numeric PASS and the larger pool do not establish visual adoption or AAA quality.
