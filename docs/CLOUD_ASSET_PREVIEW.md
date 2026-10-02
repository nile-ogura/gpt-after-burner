# Cloud photo preview

`public/assets/clouds/cumulus-photo-v1.png` is an original preview asset generated with the built-in image generation tool on 2026-10-02. V1 is retained as provenance and is not loaded by the accepted runtime. The accepted default uses v2 and two distinct silhouette variants described below. The original v1 tool output remains at `/home/ogura/.codex/generated_images/01a0f828-c984-7da3-a8bc-6664390a77f3/exec-02ac465c-ea4d-4837-8616-a55942da7963.png`.

The returned PNG is RGBA, 1774 × 887, with transparent corner pixels and alpha range 0–254. Direct inspection shows more varied convective structure and stronger local shadow than the procedural clouds. Its cutout boundary has visible saturated cyan/blue fringes in the viewer, and low-alpha pixels reach the left and bottom image boundary. Those are preview limitations requiring an in-engine comparison; this is not an accepted quality result or an AAA claim.

## Generation prompt

Create one original photorealistic game asset: a natural cumulus congestus cloud bank as a transparent RGBA cutout for a rear-view jet flight game. Show a single complete irregular cluster, seen from flight altitude, wider than tall, with clear transparent padding on all four sides and no cropped billows. Sunlight comes from upper left, producing luminous slightly warm upper rims and deep cool blue-gray undersides. Prioritize convincing translucent water-vapor volume, irregular convective structure at several scales, wispy feathered peripheral edges and localized small billows, with larger soft interior shadow regions. Fine detail must vary naturally rather than covering every surface. It should resemble photographed atmospheric clouds, avoiding uniform spherical lobes, plastic/clay appearance, embossed dimples, outlines, or illustration. Only the isolated cloud bank; no sky background, ocean, mountain, aircraft, text, frame, watermarks or checkerboard.

Tool settings: `transparent_background: true`; no reference images; built-in image generation, with no CLI fallback.

## Boundary cleanup variant

`public/assets/clouds/cumulus-photo-v2.png` is a built-in image-generation edit of the local v1 PNG, generated with `transparent_background: true` and `referenced_image_paths` containing the absolute workspace v1 path. The original returned file remains at `/home/ogura/.codex/generated_images/01a0f828-c984-7da3-a8bc-6664390a77f3/exec-dcb9db66-77d5-47fa-8047-7a9c6c72f7a5.png`.

The image viewer still shows some blue at the bottom edge. Read-only pixel inspection adds an important qualification: saturated royal-blue pixels (B > 230, R < 40, G < 80) in both versions have alpha at most 2/255. The renderer's existing alphaTest 0.016 rejects them at full resolution, though mip filtering and other edge colors still require an actual game capture. V2 reduces that pixel count from 6,683 to 3,844. Neither preview alone establishes an in-engine halo defect or a pass.

Edit prompt:

Edit this original cloud RGBA asset with a precise boundary cleanup only. Preserve the complete cloud silhouette, transparent background, padding, irregular multi-scale billows, interior density structure, warm upper-left sunlight, and natural cool blue-gray internal shadows. Remove the artificial saturated cyan/cobalt/royal-blue fringe visible along the right and lower cutout boundary, and remove the tiny colored speckle contamination at upper-left edges. Boundary RGB should be the physically plausible softly lit off-white or neutral cool gray water vapor from the immediately adjoining cloud, with naturally fading translucent alpha. Do not replace the halo with an enlarged solid white outline. Do not expand, crop, move or materially reshape the cloud. Keep the atmospheric photographic appearance and delicate wisps. Do not modify the legitimate broad blue-gray interior shadows. Output only the cleaned isolated cloud on a genuinely transparent RGBA background, with no sky, ground, text, frame or checkerboard.

## Accepted default and comparison option

Production and ordinary development startup use three shared SRGB maps, in index order v2 / congestus / wispy, for all nine banks. Each bank retains its original texture index, position and width, with height set to width × 0.5 to preserve the PNG's native 2:1 aspect ratio. Opacity, fog, transparency and alpha test remain unchanged. This removes the first experiment's mixed photographic/procedural appearance and single-silhouette repetition. All three textures are disposed with the environment. The established `?qa&cloudPhoto` capture URL remains compatible and now selects the same default.

The accepted nine banks are fixed MeshBasicMaterial quads sharing one PlaneGeometry. They use world-up Y and face (0, 230, 0), with DoubleSide and forceSinglePass. This makes the cloud images rotate naturally with the world during a full camera roll. The shared quad geometry is disposed once.

Seed clouds are retained only for development QA through `?qa&seedClouds`, or regenerated with `?qa&bakeClouds`. These use the original seed Sprites and sizes. Normal startup does not request the unused seed PNGs. Independent review accepted the photographed banks in 03:47 straight/bank/mobile and 03:49–50 roll 90/180/270/mobile captures: irregular local structure and distinct shapes improved; no cyan edge, rectangular card boundary or foam pits were visible. Cloud orientation followed world roll. This is a limited visual adoption pass, not commercial AAA parity or smooth-motion/performance validation.

## Distinct silhouette variants

Two more original banks were generated with the built-in tool using the already inspected absolute local v2 path as a reference and `transparent_background: true`. These assets are copied from the returned output; no Python image edits were performed.

| Asset | Original returned file | Direct inspection |
| --- | --- | --- |
| `public/assets/clouds/cumulus-wispy-v1.png` | `/home/ogura/.codex/generated_images/01a0f828-c984-7da3-a8bc-6664390a77f3/exec-cba307c8-ebcd-4fc3-ae96-d968043874d8.png` | Lower continuous bank, two unequal broad crests and broken peripheral wisps. |
| `public/assets/clouds/cumulus-congestus-v1.png` | `/home/ogura/.codex/generated_images/01a0f828-c984-7da3-a8bc-6664390a77f3/exec-f2bb565b-1d0f-4019-9cfc-bfad02623974.png` | Tall right-side tower and a lower left-side cluster, strong deep occlusion. |

Both PNGs are RGBA 1774 × 887. Alpha range is 0–255 for wispy and 0–254 for congestus. Maximum boundary alpha is 1/255, and pure royal-blue fringe pixels have alpha at most 2/255, as with v2. Visible silhouettes and lighting were inspected with the local image viewer; acceptance remains subject to in-engine review. The variants are deliberately different shapes with the same upper-left light direction.

The exact common prompt prefix was:

Use the attached cloud solely as a style and lighting reference for a new original photorealistic cloud texture variant for a jet flight game. Match its warm sunlight from upper left, cool blue-gray deep vapor shadows, irregular convective detail and naturally feathered transparent water-vapor edges. The new bank must have a materially different silhouette and arrangement rather than copying its billows. Output a horizontal 2:1 RGBA image with the entire isolated cloud inside clear transparent padding on all sides. Keep the genuinely transparent background; no sky, ground, airplane, text, logo, frame, checkerboard, saturated cyan/blue cutout fringe, uniform pockmarks or glossy/plastic spherical lobes.

Wispy suffix:

Variant A: a low, broad, continuous cloud bank with three uneven rolling regions, one subtle rising crest on the left-third, fragmented wispy ends and shallow gaps rather than tall towers. Most of the cloud should occupy the middle horizontal band, with extended irregular delicate tendrils at the sides and a substantial coherent dark underside. Rich localized folds and density variation, photographed from flight altitude.

Congestus suffix:

Variant B: a tall asymmetrical cumulus congestus formation dominated by one irregular rising tower on the right-third and a smaller broken cluster to its left. Clearly different from the reference's central rounded mound. Include a deep recessed dark vapor core, fragmented outer protrusions, localized fine cauliflower structure and delicate dissipating wisps below. The complete vertical tower must fit well inside the wide canvas with transparent padding, photographed from flight altitude.

## Cloud illumination in aircraft reflections

Once the selected cloud textures are ready, the environment performs one additional 256-pixel cube capture at (0, 230, 0), then converts it into a new PMREM reflection map. The temporary capture scene contains the sky and fixed cloud quads facing the capture position. Fixed quads give all six cube faces consistent orientation; the visible scene retains nine cloud objects (default fixed quads or development seed Sprites). The sky-only background cube remains unchanged, preventing duplicated cloud imagery behind the cloud objects.

The old PMREM map and temporary cube target, PMREM generator, plane geometry and quad materials are disposed. The retained new environment is disposed with the environment module. Texture userData records `cloudEnvironmentBaked`, `cloudBanks` (9) and `reflectionStatic` for runtime QA.

This is a static reflection snapshot with one startup cost. Scrolling clouds and later scenery/light changes do not trigger another bake; it is not dynamic volumetric sky lighting or a guarantee of commercial AAA fidelity.
