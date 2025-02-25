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
      negative_prompt: use(opt.negative_prompt, ""), // TODO: use preset
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
  
  return diffusion({ 
    image, 
    prompt, 
    model, 
    denoising_strength: 0.75,
    control: controlfn(depth, pose, edges),
    negative_prompt: "dark skin, brown skin, tanned skin, dark complexion, deformed face, distorted face, disfigured, mutation, extra limbs, ugly, poorly drawn face, bad anatomy,",
    cfg_scale: 7.0,     // Slightly reduced for faster generation
    steps: 30,          // Reduced from 30 to 20 for faster generation
    resolution: 512,    // Reduced from 768 to 512 for faster generation
    sampler_name: "DPM++ 2M Karras"  // Faster sampler
  });
}

// create concise weight control object for hallucination function
// they should always be all enabled, to get previews
const f = (f: number) => f > 1.0 ? 1.0 : f < 0.0 ? 0.0 : f;
const controlfn = (depth: number, openpose: number, softedge: number) => ({
  depth:    { enabled: true, weight: f(depth), control_mode: "Balanced" },
  openpose: { enabled: true, weight: f(openpose), control_mode: "My prompt is more important" },
  softedge: { enabled: true, weight: f(softedge + 0.2), control_mode: "Balanced" }, // Increase edge detection weight
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

  // free: { // hallucinate freely with no style constraints
  //   icon: "/assets/style/free.png",
  //   label: "Freely Hallucinate",
  //   func: (image, gender, age) => dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.6, 0.5, 0.2,
  //     chars.homosapiens(gender, age)),
  // } as Preset,


  gotcha: {
    icon: "/assets/style/gotcha.png",
    label: "Gotcha!",
    func: (image, gender, age) => {
      if (gender === "Couple") {
        return dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.5, 0.7, 0.5,
          `stylized cartoon, illustration, portrait of romantic ${chars.healthyboy(gender, age)}, (wheatish complexion:1.2), holding hands, intimate pose, gazing lovingly at each other, same faces as photo, forest in the background <lora:gotchaV001.Yu4Z:0.4>`);
      }
      return dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.5, 0.7, 0.5,
        `stylized cartoon, illustration, portrait of ${chars.healthyboy(gender, age)}, (wheatish complexion:1.2), same face as photo, same facial structure, looking sideways, forest in the background <lora:gotchaV001.Yu4Z:0.4>`);
    }
  } as Preset,

  // impasto: { // impasto oil painting
  //   icon: "/assets/style/impasto.png",
  //   label: "Impasto Painting",
  //   func: (image, gender, age) => dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.6, 0.6, 0.3,
  //     `((impasto)), intricate oil painting, thick textured paint, artistic, old holland classic colors, portrait of a ${chars.persons(gender, age)}, looking to the front`),
  // } as Preset,

  kids: {
    icon: "/assets/style/kids.png",
    label: "Kids' Illustration",
    func: (image, gender, age) => dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.7, 0.9, 0.5,
      `kids illustration, children's cartoon, happy ${chars.healthyboy(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), North Indian features, sharp nose, bright eyes, same face as photo, same facial structure, looking at the camera, modern Indian kitchen in the background <lora:coolkidsMERGEV25.Qqci:1>`),
  } as Preset,

  marble: {
    icon: "/assets/style/marble.png",
    label: "Marble Sculpture",
    func: (image, gender, age) => dif(image, "absolutereality181.n8IR.safetensors", 0.5, 1.0, 0.5,
      `white marble sculpture in a museum, bust of ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), North Indian features, sharp nose, high cheekbones, defined jawline, same face as photo, same facial structure, classical Indian architecture in background, realistic photo, highly detailed`),
  } as Preset,

  pencil: {
    icon: "/assets/style/pencil.png",
    label: "Pencil Sketch",
    func: (image, gender, age) => dif(image, "absolutereality181.n8IR.safetensors", 0.8, 0.9, 0.4,
      `very detailed pencil sketch, ${chars.persons(gender, age)}, fair complexion, North Indian features, sharp nose, high cheekbones, defined jawline, same face as photo, same facial structure, black-and white, hand-drawn, professional artist style`),
  } as Preset,

  retro: { // stylized illustration with blocky colors
    icon: "/assets/style/retro.png",
    label: "Retro Stylized",
    func: (image, gender, age) => dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.8, 0.6, 0.4,
      `stylized retro illustration, low palette, pastel colors, sharp lines, band album cover, North Indian ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), sharp nose, high cheekbones, same face as photo`),
  } as Preset,

  scifi: {
    icon: "/assets/style/scifi.jpg",
    label: "Sci-Fi",
    func: (image, gender, age) => {
      if (gender === "Couple") {
        return dif(image, "absolutereality181.n8IR.safetensors", 1.0, 0.8, 0.6,
          `futuristic sci-fi movie, romantic ${chars.persons(gender, age)}, (wheatish complexion:1.2), embracing each other, intimate moment, same faces as photo, neon lights illumination, modern Indian cityscape in background, cinematic lighting`);
      }
      return dif(image, "absolutereality181.n8IR.safetensors", 1.0, 0.8, 0.6,
        `futuristic sci-fi movie, ${chars.persons(gender, age)}, (wheatish complexion:1.2), same face as photo, neon lights illumination, modern Indian cityscape in background, cinematic lighting`);
    }
  } as Preset,

  western: { // western comics (i.e. superman)
    icon: "/assets/style/western.png",
    label: "Western Comic",
    func: (image, gender, age) => dif(image, "westernanidiffusion.EpVW.safetensors", 0.7, 0.8, 0.4,
      `western comic, portrait, ${chars.randomhero(gender, age)}, (wheatish complexion:1.2), same face as photo, looking to the side, metropolis in the background`)
  } as Preset,

  anime: {
    icon: "/assets/style/anime.png",
    label: "Anime",
    func: (image, gender, age) => {
      if (gender === "Couple") {
        return dif(image, "animepasteldreamSoft.lTTK.safetensors", 0.9, 1.0, 0.6,
          `anime illustration, movie still, ${chars.anime(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), North Indian features, romantic scene, holding hands, close together, defined features, large expressive eyes, same faces as photo, happy, cherry blossoms falling, bright sun, modern Indian town in the background, studio ghibli style`);
      }
      return dif(image, "animepasteldreamSoft.lTTK.safetensors", 0.9, 1.0, 0.6,
        `anime illustration, movie still, ${chars.anime(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), North Indian features, defined features, large expressive eyes, same face as photo, same facial structure, happy, looking sideways, bright sun, modern Indian town in the background, studio ghibli style`);
    }
  } as Preset,

  medieval: { // horrible medieval painting
    icon: "/assets/style/impasto.png",
    label: "Medieval Painting",
    func: (image, gender, age) => dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.4, 0.6, 0.2,
      `medieval painting, framed, textured paint, ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), , same face as photo, royal attire, palace in background`),
  } as Preset,

  astronaut: {
    icon: "/assets/style/astronaut.png",
    label: "Astronaut",
    func: (image, gender, age) => dif(image, "absolutereality181.n8IR.safetensors", 0.6, 0.9, 0.5,
      `portrait of ${chars.homosapiens(gender, age)} ISRO astronaut in spacesuit, (wheatish complexion:1.2), same face as photo, same facial structure, Indian space center in the background, realistic photo, shot on DSLR`),
  } as Preset,

  caricature: { // heavily caricaturized drawing
    icon: "/assets/style/caricature.png",
    label: "Caricature",
    func: (image, gender, age) => dif(image, "caricaturizer_pcrc_style.uwgn1lmj.q5b.ckpt", 0.6, 0.4, 0.1,
      `caricature, hand-drawn illustration, portrait of a North Indian ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), sharp nose, high cheekbones, same face as photo, looking sideways, exaggerated features but still recognizable`),
  } as Preset,

  neotokyo: { // style of dark 90s anime
    icon: "/assets/style/neotokyo.jpg",
    label: "NEOTOKIO",
    func: (image, gender, age) => dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 1.0, 0.8, 0.4,
      `neotokio, 90s anime, North Indian ${chars.persons(gender, age)}, (wheatish complexion:1.2),  same face as photo, looking at the camera, portrait, evening, narrow alley in the background, bright neon signs <lora:NEOTOKIO_V0.01:0.7>`),
  } as Preset,

  vaporwave: { // very colorful vibrant vaporwave illustration
    icon: "/assets/style/vaporwave.png",
    label: "Vaporwave",
    func: (image, gender, age) => dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 1.0, 0.8, 0.6,
      `vaporwave, illustration, vibrant colors, neon background, flying hair, North Indian ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), sharp nose, high cheekbones, same face as photo, retro 80s aesthetic`),
  } as Preset,

  watercolor: {
    icon: "/assets/style/watercolor.png",
    label: "Watercolor",
    func: (image, gender, age) => {
      if (gender === "Couple") {
        return dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.8, 0.9, 0.5,
          `watercolor painting, hand-drawn illustration, romantic portrait of a ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), North Indian features, sharp nose, high cheekbones, embracing each other, intimate moment, same faces as photo, looking at each other lovingly, sunset in background, modern Indian setting, clear white paper background, professional art <lora:watercolorv1.7lox:1>`);
      }
      return dif(image, "dreamshaper8Pruned.hz5Q.safetensors", 0.8, 0.9, 0.5,
        `watercolor painting, hand-drawn illustration, portrait of a ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), North Indian features, sharp nose, high cheekbones, same face as photo, same facial structure, looking sideways, modern Indian setting, clear white paper background, professional art <lora:watercolorv1.7lox:1>`);
    }
  } as Preset,

  romantic: {
    icon: "/assets/style/romantic.png",
    label: "Romantic",
    func: (image, gender, age) => {
      if (gender === "Couple") {
        return dif(image, "absolutereality181.n8IR.safetensors", 0.7, 0.9, 0.5,
          `romantic portrait, ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), North Indian features, sharp nose, high cheekbones, embracing intimately, foreheads touching, looking into each other's eyes lovingly, same faces as photo, soft golden hour lighting, bokeh background, rose petals falling, professional photography, cinematic`);
      }
      return dif(image, "absolutereality181.n8IR.safetensors", 0.7, 0.9, 0.5,
        `portrait, ${chars.persons(gender, age)}, (fair skin:1.3), (wheatish complexion:1.2), North Indian features, sharp nose, high cheekbones, same face as photo, soft golden hour lighting, bokeh background, professional photography, cinematic`);
    }
  } as Preset,

}

export type Presets = keyof typeof presets;