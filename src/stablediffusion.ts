// This file contains functions to interact with the stable-diffusion-webui API,
// primarily through the `img2img` endpoint, to generate new pictures from a
// given reference image.

import type { Ages, Genders } from "@/characterselection";
import { chars } from "@/characterselection";

// TODO: use these (info) endpoints
// GET /controlnet/model_list
// GET /sdapi/v1/progress -- poll for spinner?
// POST /sdapi/v1/interrogate -- detect image description
// POST /rembg -- remove background
// http localhost:7860/sdapi/v1/loras | jq ".[] | .name"
// http localhost:7860/sdapi/v1/sd-models | jq ".[] | .title" -- get model names

// type alias for strings suitable for `<img>` elements
export type DataURI = string;

// enable and weight a controlnet
export type ControlNetOptions = {
  enabled: boolean;
  weight: number;
  control_mode?: "Balanced" | "My prompt is more important" | "ControlNet is more important";
}

// prompt data and generation options
export type DiffusionOptions = {

  // input image in base64
  image: string;

  // description of desired output
  prompt: string;
  negative_prompt?: string;

  // base model to use
  model: string;

  // enable controlnets
  control: {
    openpose: ControlNetOptions;
    depth: ControlNetOptions;
    softedge: ControlNetOptions;
    ip_adapter?: ControlNetOptions;
    instant_id?: ControlNetOptions;
    reference?: ControlNetOptions;
  };

  // resolution, only squares for now
  resolution?: number;

  // seed, should be random (-1)
  seed?: number;

  // more advanced generation options
  denoising_strength?: number;
  cfg_scale?: number;
  steps?: number;
  n_iter?: number;
  batch_size?: number;
  sampler?: string;
  sampler_name?: string;

}

// an img2img prompt to generate a new picture from a reference image
export async function diffusion(opt: DiffusionOptions): Promise<DataURI[]> {

  // simple "default value" function for optionals
  let use = <T>(val: T | undefined, def: T) => (val !== undefined) ? val : def;

  // assemble the POST request
  let request = await fetch("/sdapi/v1/img2img", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({
      prompt: opt.prompt,
      negative_prompt: use(opt.negative_prompt, "deformed face, distorted face, disfigured, mutation, extra limbs, ugly, poorly drawn face, bad anatomy,american, european, korean, japanese, chinese, east asian, african"),
      init_images: [ opt.image ],
      seed: use(opt.seed, -1),
      steps: use(opt.steps, 20),
      width:  use(opt.resolution, 512),
      height: use(opt.resolution, 512),
      cfg_scale: use(opt.cfg_scale, 7),
      n_iter: use(opt.n_iter, 1),
      batch_size: use(opt.batch_size, 1),
      denoising_strength: use(opt.denoising_strength, 0.95),
      sampler_name: use(opt.sampler, "DPM++ 2M Karras"),
      override_settings: {
        sd_model_checkpoint: opt.model,
      },
      alwayson_scripts: {
        ControlNet: {
          args: [
            {
              module: "openpose_full",
              model: "control_v11p_sd15_openpose",
              enabled: opt.control.openpose.enabled,
              weight: opt.control.openpose.weight,
              control_mode: use(opt.control.openpose.control_mode, "Balanced"),
              processor_res : opt.resolution || 512,
              resize_mode : "Crop and Resize",
            },
            {
              module: "depth_midas",
              model: "control_v11f1p_sd15_depth",
              enabled: opt.control.depth.enabled,
              weight: opt.control.depth.weight,
              control_mode: use(opt.control.depth.control_mode, "Balanced"),
              processor_res : opt.resolution || 512,
              resize_mode : "Crop and Resize",
            },
            {
              module: "softedge_pidinet",
              model: "control_v11p_sd15_softedge",
              enabled: opt.control.softedge.enabled,
              weight: opt.control.softedge.weight,
              control_mode: use(opt.control.softedge.control_mode, "Balanced"),
              processor_res : opt.resolution || 512,
              resize_mode : "Crop and Resize",
            },
            {
              module: "ip-adapter",
              model: "ip-adapter_sd15",
              enabled: opt.control.ip_adapter?.enabled || false,
              weight: opt.control.ip_adapter?.weight || 0.8,
              control_mode: use(opt.control.ip_adapter?.control_mode, "My prompt is more important"),
              processor_res : opt.resolution || 512,
              resize_mode : "Crop and Resize",
            },
            {
              module: "instant_id",
              model: "instantid_v1",
              enabled: opt.control.instant_id?.enabled || false,
              weight: opt.control.instant_id?.weight || 0.7,
              control_mode: use(opt.control.instant_id?.control_mode, "My prompt is more important"),
              processor_res : opt.resolution || 512,
              resize_mode : "Crop and Resize",
            },
            {
              module: "reference",
              model: "reference_only",
              enabled: opt.control.reference?.enabled || false,
              weight: opt.control.reference?.weight || 0.8,
              control_mode: use(opt.control.reference?.control_mode, "My prompt is more important"),
              processor_res : opt.resolution || 512,
              resize_mode : "Crop and Resize",
            }
          ]
        },
      },
    })
  });

  // simple helper function to generate datauri for <img> elements from base64
  const datauri = (data: string) => `data:image/png;base64,${data}`;

  // parse the response
  let response = await request.json();
  console.debug("%c Response ", "background: #b7d1cb;", response.parameters);
  return (response.images as string[]).map(datauri);

};

// diffusion shorthand for pre-made styles
function dif(image: string, model: string, depth: number, pose: number, edges: number, prompt: string) {
  console.log("%c DIFFUSION prompt %c%s%c with %c%s", "background: lightgray", "background: yellowgreen", prompt,
    "background: lightgray", "background: lightblue", JSON.stringify({ model, depth, pose, edges }));
  
  // Always use dreamshaper_8 regardless of what's passed
  model = "dreamshaper_8.safetensors";
  
  // Add stronger facial similarity to the prompt if not already present
  const facialSimilarityTerms = ["same face as reference", "identical face", "exact face structure", "preserve face", "reference face"];
  let enhancedPrompt = prompt;
  
  // Add facial similarity terms if they aren't already in the prompt
  if (!facialSimilarityTerms.some(term => prompt.includes(term))) {
    enhancedPrompt = `${prompt}, identical face as reference, exact facial features, perfect face likeness, preserve facial structure, same person`;
  }
  
  // Add family-friendly terms to ensure the output is appropriate
  enhancedPrompt = `${enhancedPrompt}, family friendly, sfw, safe for work`;
  
  return diffusion({ 
    image, 
    prompt: enhancedPrompt, 
    model, 
    denoising_strength: 0.7, // Balanced for stylization while preserving facial features
    control: controlFnWithFacialPreservation(depth, pose, edges),
    negative_prompt: "nsfw, nudity, naked, nude, sexual, suggestive, explicit content, adult content, pornographic, deformed face, distorted face, disfigured face, mutation, different face, wrong face, changed face, transformed face, bad facial features, bad face, inaccurate face, extra limbs, malformed limbs, fused fingers, extra fingers, poorly drawn hands, poorly drawn face, poorly drawn body, cross-eyed, ugly, low quality, worst quality",
    cfg_scale: 6.0,     // Lower to better balance stylization and reference image
    steps: 50,          // Higher step count for better quality
    resolution: 512,
    sampler_name: "DPM++ SDE Karras" 
  });
}

// create concise weight control object for hallucination function
// they should always be all enabled, to get previews
const f = (f: number) => f > 1.0 ? 1.0 : f < 0.0 ? 0.0 : f;
const controlfn = (depth: number, openpose: number, softedge: number) => ({
  depth:    { enabled: true, weight: f(depth), control_mode: "Balanced" as "Balanced" },
  openpose: { enabled: true, weight: f(openpose), control_mode: "My prompt is more important" as "My prompt is more important" },
  softedge: { enabled: true, weight: f(softedge + 0.2), control_mode: "Balanced" as "Balanced" },
});

// Enhanced control function with facial preservation settings
const controlFnWithFacialPreservation = (depth: number, openpose: number, softedge: number) => ({
  depth:    { enabled: true, weight: f(depth * 0.6), control_mode: "Balanced" as "Balanced" }, // Reduced for more creative freedom
  openpose: { enabled: true, weight: f(openpose * 0.6), control_mode: "My prompt is more important" as "My prompt is more important" }, 
  softedge: { enabled: true, weight: f(softedge * 0.5), control_mode: "Balanced" as "Balanced" }, // Reduced for more creative freedom
  ip_adapter: { enabled: true, weight: 1.0, control_mode: "ControlNet is more important" as "ControlNet is more important" }, // Maximum for face preservation
  instant_id: { enabled: true, weight: 1.0, control_mode: "ControlNet is more important" as "ControlNet is more important" }, // Maximum for face preservation
  reference: { enabled: true, weight: 1.0, control_mode: "ControlNet is more important" as "ControlNet is more important" }, // Maximum for reference preservation
});

// type of a style preset with icon path, hallucination function and character modifiers
export type Preset = {
  /** preview image for style selection */
  icon: string,
  /** label in user interface */
  label: string,
  /** hallucination function to be used from user interface */
  func: (image: string, gender: Genders, age: Ages) => Promise<DataURI[]>,
}

// ! stable-diffusion models
//  absolutereality181.n8IR.safetensors [463d6a9fe8]
//  animepasteldreamSoft.lTTK.safetensors [4be38c1a17]
//  caricaturizer_pcrc_style.uwgn1lmj.q5b.ckpt
//  clazy2600.xYzn.ckpt [ed2cf308d1]
//  dreamshaper8Pruned.hz5Q.safetensors [879db523c3]
//  dreamshaper_332BakedVaeClipFix.ckpt [637d5dcb91]
//  v1-5-pruned-emaonly.safetensors [6ce0161689]
//  westernanidiffusion.EpVW.safetensors [d20bc9d543]


// ! lora names
//  "ClayAnimationRedmond15-ClayAnimation-Clay"
//  "coolkidsMERGEV25.Qqci"
//  "gotchaV001.Yu4Z"
//  "modillPASTELRCV001.xsmb"
//  "neotokioV001.yBGi"
//  "stylizardV1.mPLw"
//  "watercolorv1.7lox"


export const presets = {
  gotcha: { // heavily stylized illustrations
    icon: "/assets/style/gotcha.png",
    label: "Gotcha!",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.5, 0.5, 0.4,
      `stylized cartoon, illustration, portrait of ${chars.healthyboy(gender, age)} and an animal, looking sideways, forest in the background, vibrant colors, stylized art <lora:gotchaV001.Yu4Z:0.6> <lora:add_detail:1.0>`),
  } as Preset,

  // kids: { // delightful kids' illustration
  //   icon: "/assets/style/kids.png",
  //   label: "Kids' Illustration",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.7, 0.9, 0.4,
  //     `kids illustration, children's cartoon, happy ${chars.healthyboy(gender, age)}, looking at the camera, kitchen in the background, bright colors, stylized cartoon <lora:coolkidsMERGEV25.Qqci:1> <lora:add_detail:1.0>`),
  // } as Preset,

  // marble: { // marble sculpture in a museum
  //   icon: "/assets/style/marble.png",
  //   label: "Marble Sculpture",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.5, 1.0, 0.4,
  //     `marble sculpture in a museum, white marble greek bust sculpture of ${chars.persons(gender, age)} complete marble statue, offwhite color, greek hills, art gallery in the background, stylized sculpture <lora:add_detail:1.0>`),
  // } as Preset,

  // pencil: { // rough pencil drawing
  //   icon: "/assets/style/pencil.png",
  //   label: "Pencil Sketch",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.8, 0.8, 0.3,
  //     `very rough pencil sketch, ${chars.persons(gender, age)}, black-and white, hand-drawn, scribble, artistic drawing, sketchy style <lora:add_detail:1.0>`),
  // } as Preset,

  retro: { // stylized illustration with blocky colors
    icon: "/assets/style/retro.png",
    label: "Retro Stylized",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.8, 0.6, 0.4,
      `stylized retro illustration, low palette, pastel colors, sharp lines, band album cover, ${chars.persons(gender, age)}, vintage poster style <lora:add_detail:1.0>`),
  } as Preset,

  // scifi: { // futuristic sci-fi scene
  //   icon: "/assets/style/scifi.png",
  //   label: "Sci-Fi",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 1.0, 0.8, 0.6,
  //     `futuristic sci-fi movie, ${chars.persons(gender, age)}, neon lights illumination, distant night city in the background, stylized sci-fi art <lora:add_detail:1.0>`),
  // } as Preset,

  western: { // western comics (i.e. superman)
    icon: "/assets/style/western.png",
    label: "Comic",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.7, 0.8, 0.4,
      `anime style, 2nd art, comic art,western comic, portrait, ${chars.randomhero(gender, age)}, looking to the side, metropolis in the background, comic book style, bold lineart <lora:add_detail:1.0>`),
  } as Preset,

  // anime: { // anime movie screencap
  //   icon: "/assets/style/anime.png",
  //   label: "Anime",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.9, 1.0, 0.6,
  //     `anime illustration, movie still, ${chars.anime(gender, age)}, smiling and happy, looking sideways, bright sun, summer, small town in the background, vibrant anime style <lora:add_detail:1.0>`),
  // } as Preset,

  // medieval: { // horrible medieval painting
  //   icon: "/assets/style/impasto.png",
  //   label: "Medieval Painting",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.4, 0.6, 0.2,
  //     `medieval painting, framed, textured paint, scene with a ${chars.persons(gender, age)}, historical artwork style <lora:add_detail:1.0>`),
  // } as Preset,

  // astronaut: { // astronaut
  //   icon: "/assets/style/astronaut.png",
  //   label: "Astronaut",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.6, 0.9, 0.4,
  //     `portrait of ${chars.homosapiens(gender, age)} NASA astronaut in spacesuit before rocket launch, space photography in the background, stylized space art <lora:add_detail:1.0>`),
  // } as Preset,

  // caricature: { // heavily caricaturized drawing
  //   icon: "/assets/style/caricature.png",
  //   label: "Caricature",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.6, 0.4, 0.1,
  //     `caricature, hand-drawn illustration, portrait of a ${chars.persons(gender, age)}, looking sideways, exaggerated art style <lora:add_detail:1.0>`),
  // } as Preset,

  neotokyo: { // style of dark 90s anime
    icon: "/assets/style/neotokyo.png",
    label: "NEOTOKIO",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 1.0, 0.8, 0.4,
      `neotokio, 90s anime, ${chars.persons(gender, age)}, looking at the camera, portrait, evening, narrow alley in the background, bright neon signs, cyberpunk anime <lora:NEOTOKIO_V0.01:0.7> <lora:add_detail:1.0>`),
  } as Preset,

  vaporwave: { // very colorful vibrant vaporwave illustration
    icon: "/assets/style/vaporwave.png",
    label: "Vaporwave",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 1.0, 0.8, 0.6,
      `vaporwave, illustration, vibrant colors, neon background, flying hair, ${chars.persons(gender, age)}, retro digital art style <lora:add_detail:1.0>`),
  } as Preset,

  // watercolor: { // watercolor painting
  //   icon: "/assets/style/watercolor.png",
  //   label: "Watercolor",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.8, 0.9, 0.4,
  //     `watercolor painting, hand-drawn illustration, portrait of a ${chars.persons(gender, age)}, looking sideways, clear white paper background, artistic painting <lora:watercolorv1.7lox:1> <lora:add_detail:1.0>`),
  // } as Preset,

  cyberpunk: {
    icon: "/assets/style/cyberpunk.png",
    label: "Cyberpunk",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.8, 0.9, 0.5,
      `cyberpunk portrait, blade runner, dystopian, ${chars.persons(gender, age)}, neon lights, cybernetic implants, futuristic city background, rain, night scene, highly detailed, stylized digital art <lora:add_detail:1.0>`),
  } as Preset,

  hogwarts: {
    icon: "/assets/style/hogwarts.png",
    label: "Hogwarts",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.7, 0.8, 0.4,
      `2d art, anime art, line art, fantasy portrait of ${chars.persons(gender, age)}, magic school uniform, BLACK ROBE with house crest, magic wand, stone castle interior, great hall background, magical atmosphere, stylized fantasy art <lora:HP:0.6> <lora:add_detail:1.0>`),
  } as Preset,

  // fantasy: {
  //   icon: "/assets/style/fantasy.png",
  //   label: "Fantasy Epic",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.8, 0.9, 0.5,
  //     `epic fantasy portrait, ${chars.persons(gender, age)}, wearing ornate medieval armor with intricate engravings, fantasy setting, dragons, long cape, dramatic lighting, castle throne room background, stylized fantasy illustration <lora:add_detail:1.0>`),
  // } as Preset,

  impressionist: {
    icon: "/assets/style/impressionist.png",
    label: "Impressionist",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.7, 0.8, 0.4,
      `impressionist oil painting, style of Monet, portrait of ${chars.persons(gender, age)}, vibrant brushstrokes, natural lighting, garden background with water lilies, artistic painting style <lora:add_detail:1.0>`),
  } as Preset,

  popart: {
    icon: "/assets/style/pop.png",
    label: "Pop Art",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.9, 0.7, 0.6,
      `pop art portrait, Andy Warhol style, ${chars.persons(gender, age)}, bold colors, halftone dots, high contrast, graphic art style, retro 60s aesthetic, stylized pop art <lora:add_detail:1.0>`),
  } as Preset,

  // disco: {
  //   icon: "/assets/style/disco.png",
  //   label: "Disco Night",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.8, 0.9, 0.5,
  //     `vibrant disco portrait, ${chars.persons(gender, age)}, colorful disco lights, glitter, dance floor, retro 70s style, stylized illustration, disco ball reflections <lora:add_detail:1.0>`),
  // } as Preset,

  vangogh: {
    icon: "/assets/style/vangogh.png",
    label: "Van Gogh",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.7, 0.8, 0.4,
      `oil painting in the style of Van Gogh, portrait of ${chars.persons(gender, age)}, swirling brushstrokes, impasto technique, starry night background, vibrant colors, expressive brushwork, post-impressionist style <lora:add_detail:1.0>`),
  } as Preset,

  // colourcore: {
  //   icon: "/assets/style/vaporwave.png",
  //   label: "Colourcore",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.8, 0.7, 0.5,
  //     `portrait of ${chars.persons(gender, age)}, c0l0urc0r3, cute, bright colours, candy, vibrant, high contrast, bold colors, colorful background, flat colors, flat illustration, highly stylized <lora:c0l0urc0r3XLP2:0.8> <lora:add_detail:1.0>`),
  // } as Preset,

  // nineties_anime: {
  //   icon: "/assets/style/anime.png",
  //   label: "90s Anime",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.9, 0.8, 0.6,
  //     `90s4n1m3, retro anime illustration, portrait of ${chars.anime(gender, age)}, bold expressive character, vibrant color palette, cel shaded, nostalgic 90s aesthetic, dramatic pose, highly stylized anime <lora:90s4n1m3XLP:0.8> <lora:add_detail:1.0>`),
  // } as Preset,

  ghibli: {
    icon: "/assets/style/ghibli.png",
    label: "Pastel Style",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.6, 0.7, 0.4,
      `Ghibli style, whimsical portrait of ${chars.persons(gender, age)}, pastoral setting, soft lighting, gentle colors, detailed background, hand-painted appearance <lora:Ghibli:1.0> <lora:add_detail:1.0>`),
  } as Preset,

  phandigrams: {
    icon: "/assets/style/medieval.png",
    label: "Medieval",
    func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.7, 0.8, 0.5,
      `By Phandigrams, fantasy portrait of ${chars.persons(gender, age)}, mythical medieval setting, cinematic lighting, intricate details, rich textures, atmospheric scene, stylized fantasy art <lora:Phandigrams_III:1.5> <lora:add_detail:1.0>`),
  } as Preset,

  // anime_art: {
  //   icon: "/assets/style/anime.png",
  //   label: "Anime Art",
  //   func: (image, gender, age) => dif(image, "dreamshaper_8.safetensors", 0.7, 0.7, 0.4,
  //     `Anime art, stylized illustration of ${chars.anime(gender, age)}, vivid colors, clean lines, expressive eyes, detailed artwork, professional anime style, highly stylized <lora:animeArt:1.3> <lora:add_detail:1.0>`),
  // } as Preset,
}