<script setup lang="ts">
import { ref, onMounted } from "vue";
import { presets, type Presets, type Preset } from "@/stablediffusion";
import { ages, type Ages, genders, type Genders } from "@/characterselection"
import qrcode from "qrcode.vue";

// video stream for camera capture
let preview = ref<HTMLVideoElement>();

// capture preview element
let snapshot = ref<HTMLImageElement>();
let image = ref<string | null>(null);

// generated image element
let diffusion = ref<HTMLImageElement>();

// character selection
let gender = ref<Genders>();
let age = ref<Ages>();

// style preset selection
let preset = ref<Presets>();

// initialize once
onMounted(async () => {

  // start the video stream
  let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  stream.getVideoTracks()[0].applyConstraints({ aspectRatio: 1/1 }); // NOP on firefox
  preview.value!.srcObject = stream;

});

// keybindings
document.addEventListener("keydown", (ev) => {

  // shift-S triggers capture/retake
  if (ev.shiftKey && ev.key === "S") {
    console.log("Capture/Retake hotkey (shift-S) pressed")
    return image.value === null ? take_snapshot() : clear_snapshot();
  };

});

// capture a still image from camera feed
function take_snapshot() {

  // early-exit, if ref is undefined
  if (preview.value === undefined || preview.value.paused) {
    console.error("camera feed not available yet");
    return;
  }

  // refuse to update snapshot, if diffusion is running
  if (diffusion_inflight.value === true) return;

  // get the height from video for square
  let camera = preview.value!;
  let height = camera.videoHeight;
  let left = (camera.videoWidth - height)/2;

  // create a new canvas for drawing
  let canvas = document.createElement("canvas");
  canvas.width = canvas.height = height;

  // draw inner square to canvas
  let ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(camera,
    left, 0, height, height,
       0, 0, height, height,
  );

  // set the preview to canvas contents
  snapshot.value!.src = canvas.toDataURL();
  image.value = canvas.toDataURL();

  // automatically start hallucination with current settings on photo
  if (gender.value !== undefined && age.value !== undefined && preset.value !== undefined) {
    hallucinate();
  }

}

// reset snapshot and enable live view for capture
function clear_snapshot() {
  if (diffusion_inflight.value === true) return;
  snapshot.value!.src = "/assets/transparent.png";
  image.value = null;
}

// select a gender via button
function select_gender(value: Genders) {
  if (diffusion_inflight.value === true) return;
  gender.value = value;
  hallucinate();
}

// select an age via button
function select_age(value: Ages) {
  if (diffusion_inflight.value === true) return;
  age.value = value;
  hallucinate();
}

// select a style from preview grid
function select_preset(value: Presets) {
  if (diffusion_inflight.value === true) return;
  preset.value = value;
  hallucinate();
}

// clear all selections and preview image
function clear_all() {
  gender.value = undefined;
  age.value = undefined;
  preset.value = undefined;
  clear_snapshot();
  downlink.value = undefined;
}

// is a diffusion currently in-flight?
const diffusion_inflight = ref<boolean>(false);

// send capture to stable-diffusion for transformation
async function hallucinate() {

  // prevent multiple inflight
  if (diffusion_inflight.value === true) {
    console.warn("another request is already processing!");
    return;
  }

  // don't run if not everything is selected
  if (gender.value === undefined || age.value === undefined || preset.value === undefined) {
    console.warn("make a selection!");
    return;
  }

  // mark request in-flight
  diffusion_inflight.value = true;

  // start polling progress
  let poll = { timeout: 0 };
  (async () => {
    progress.value = 0.0;
    await poll_progress();
    poll_rearm(poll);
  })();

  try {
    // Store the full data URI for the original image
    const originalImageDataURI = image.value;
    
    // capture is a data-uri, extract the base64 string for diffusion
    let imgdata = image.value!.substring(22);

    // run the diffusion with character arguments
    let output = await presets[preset.value].func(imgdata, gender.value, age.value);
    
    // set generated image (ignore controlnet previews since they've been removed)
    diffusion.value!.src = output[0];
    
    // Wait a moment for the image to load before uploading
    setTimeout(() => {
      // Pass the original image data URI to upload
      upload(originalImageDataURI);
    }, 500);

  } finally {
    diffusion_inflight.value = false;
    clearTimeout(poll.timeout);
    progress.value = 0.0;
  }
}

function poll_rearm(poll: { timeout: number }) {
  if (diffusion_inflight.value === false) return;
  poll.timeout = setTimeout(async () => {
    await poll_progress();
    poll_rearm(poll);
  }, 100);
};


const progressbar = ref<HTMLProgressElement>();
const progress = ref<number>(0.0);
async function poll_progress() {
  let request = await fetch("/sdapi/v1/progress?skip_current_image=true", { headers: { "accept": "application/json" } });
  let prg = (await request.json()).progress;
  if (typeof prg === "number") {
    console.log("progress:", prg);
    if (prg > 0.1) {
      progressbar.value!.value = prg;
    } else {
      progressbar.value!.removeAttribute("value");
    }
  };
}

// downloadlink for QR code
let downlink = ref<string>();

// upload the file to fileserver.py
async function upload(originalImageDataURI: string) {
  if (!diffusion.value || diffusion.value.src === '/assets/transparent.png') {
    console.warn("No generated image to upload");
    return;
  }
  
  try {
    console.log("Uploading generated image...");
    
    // First, upload the generated image using the original working format
    const response = await fetch('http://localhost:8000/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: diffusion.value.src
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const data = await response.json();
    console.log("Generated image uploaded successfully:", data.url);
    
    // Set the download link
    downlink.value = data.url;
    
    // Now, upload the original image separately if available
    if (originalImageDataURI) {
      console.log("Uploading original image...");
      
      const originalResponse = await fetch('http://localhost:8000/upload-original', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: originalImageDataURI
        })
      });
      
      if (originalResponse.ok) {
        const originalData = await originalResponse.json();
        console.log("Original image uploaded successfully:", originalData.url);
      } else {
        console.warn("Failed to upload original image");
      }
    }
  } catch (error) {
    console.error("Error uploading images:", error);
  }
}

</script>

<template>
  <div id="pageroot">
    <header class="app-header">
      <div class="logo-container">
        <img src="/aimlLogo.png" alt="AIML Logo" class="aiml-logo" />
      </div>
      <div class="header-actions">
        <button @click="clear_all" class="reset-button">
          Reset
        </button>
      </div>
    </header>

    <main class="app-content">
      <section class="camera-section">
        <div class="section-header">
          <h2>Click Photo</h2>
          <div class="action-buttons">
            <button class="action-button" @click="take_snapshot" :disabled="diffusion_inflight">
              Capture
            </button>
            <button class="action-button secondary" @click="clear_snapshot" :disabled="diffusion_inflight || image === null">
              Retake
            </button>
        </div>
      </div>

        <div class="camera-container">
          <div id="cameraimg" class="camera-frame">
            <video ref="preview" autoplay playsinline v-show="image === null"></video>
            <img ref="snapshot" src="/assets/transparent.png" v-show="image !== null" />
            <div class="overlay" v-show="image === null">
              <span>Click Capture</span>
    </div>
          </div>
        </div>
      </section>

      <section class="options-section">
        <div class="character-selection">
          <div class="section-header">
            <h2>Design Your Character</h2>
      </div>

          <div class="selection-group">
            <h3>Age</h3>
            <div class="button-group">
              <button 
                v-for="a in ages" 
                :key="a" 
                @click="select_age(a)" 
                :class="['selection-button', age === a ? 'active' : '']"
                :disabled="diffusion_inflight">
                {{ a }}
              </button>
            </div>
          </div>
          
          <div class="selection-group">
            <h3>Gender</h3>
            <div class="button-group">
              <button 
                v-for="g in genders" 
                :key="g" 
                @click="select_gender(g)" 
                :class="['selection-button', gender === g ? 'active' : '']"
                :disabled="diffusion_inflight">
                {{ g }}
              </button>
            </div>
          </div>
        </div>

        <div class="style-selection">
          <div class="section-header">
            <h2>Choose Your Style</h2>
      </div>
  
          <div class="style-grid">
            <div 
              v-for="(p, name) in presets" 
              :key="name"
              @click="select_preset(name)" 
              :class="['style-card', preset === name ? 'active' : '']"
              :disabled="diffusion_inflight">
              <img :src="p.icon" :alt="p.label" />
              <span class="style-name">{{ p.label }}</span>
              </div>
          </div>
        </div>
      </section>

      <section class="result-section">
        <div class="section-header">
          <h2>AI Generated Photo</h2>
          <div class="action-buttons">
            <a :href="downlink" target="_blank" class="action-button" :class="{ disabled: !downlink }">
              Download
            </a>
          </div>
        </div>
        
        <div class="result-container">
          <div class="result-frame">
            <img ref="diffusion" src="/assets/transparent.png" />
            <progress ref="progressbar" max="1.0" :value="progress"></progress>
            <div class="overlay" v-show="!diffusion_inflight && (!diffusion || diffusion.src === '/assets/transparent.png')">
              <span>Select options to generate your portrait</span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="app-footer">
      <p>AI Photo Booth - Create stunning AI portraits with your photo</p>
    </footer>
  </div>
</template>

<style scoped>
/* Modern App Layout */
#pageroot {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--purple-bg) 0%, #2d1b4d 100%);
  padding: 0;
}

/* Header Styling */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1.5rem;
  background: linear-gradient(to right, rgba(26, 22, 37, 0.9), rgba(68, 51, 122, 0.8));
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(159, 122, 234, 0.2);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.logo-container {
  display: flex;
  align-items: center;
}

.aiml-logo {
  max-width: 120px;
  filter: drop-shadow(0 0 8px rgba(159, 122, 234, 0.4));
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.reset-button {
  background: rgba(68, 51, 122, 0.5);
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.reset-button:hover {
  background: rgba(107, 70, 193, 0.7);
  transform: translateY(-2px);
  box-shadow: 0 3px 8px rgba(159, 122, 234, 0.3);
}

/* Main Content Layout */
.app-content {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  gap: 2rem;
  padding: 2rem;
  flex-grow: 1;
}

/* Section Styling */
.camera-section {
  grid-column: 1;
}

.options-section {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.result-section {
  grid-column: 3;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.2rem;
  border-bottom: 1px solid rgba(159, 122, 234, 0.2);
  padding-bottom: 0.8rem;
}

.section-header h2 {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--light-purple);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Camera and Result Frames */
.camera-frame, .result-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1/1;
  border-radius: 16px;
  overflow: hidden;
  background-color: rgba(26, 22, 37, 0.7);
  border: 2px solid rgba(159, 122, 234, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 
              0 0 0 1px rgba(159, 122, 234, 0.2),
              0 0 20px rgba(159, 122, 234, 0.2) inset;
  transition: all 0.3s ease;
}

.camera-frame:hover, .result-frame:hover {
  border-color: rgba(159, 122, 234, 0.6);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4), 
              0 0 0 2px rgba(159, 122, 234, 0.3),
              0 0 30px rgba(159, 122, 234, 0.3) inset;
}

.camera-frame video, .camera-frame img,
.result-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-frame video {
  transform: scaleX(-1);
}

/* Character Selection Styling */
.character-selection {
  background: rgba(26, 22, 37, 0.7);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(159, 122, 234, 0.2);
  backdrop-filter: blur(8px);
}

.selection-group {
  margin-bottom: 1.5rem;
}

.selection-group h3 {
  font-size: 1.2rem;
  color: var(--light-purple);
  margin-bottom: 1rem;
  font-weight: 500;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.selection-button {
  background-color: rgba(68, 51, 122, 0.5);
  color: white;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
}

.selection-button:hover {
  background-color: rgba(107, 70, 193, 0.7);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(159, 122, 234, 0.3);
}

.selection-button.active {
  background: linear-gradient(135deg, var(--primary-purple), var(--purple-hover));
  box-shadow: 0 4px 10px rgba(159, 122, 234, 0.4);
}

/* Style Grid Optimization */
.style-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
  margin-top: 0.5rem;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 0.5rem;
  scrollbar-width: thin;
}

.style-card {
  position: relative;
  background-color: rgba(26, 22, 37, 0.5);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  aspect-ratio: 1/1;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
}

.style-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 10px rgba(159, 122, 234, 0.3);
}

.style-card.active {
  border: 2px solid var(--light-purple);
  box-shadow: 0 5px 15px rgba(159, 122, 234, 0.5);
}

.style-card img {
  width: 100%;
  height: 85%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.style-name {
  font-size: 0.65rem;
  padding: 0.15rem;
  text-align: center;
  color: white;
  width: 100%;
  background-color: rgba(26, 22, 37, 0.8);
  height: 15%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Scrollbar for style grid */
.style-grid::-webkit-scrollbar {
  width: 6px;
}

.style-grid::-webkit-scrollbar-track {
  background: rgba(26, 22, 37, 0.3);
  border-radius: 3px;
}

.style-grid::-webkit-scrollbar-thumb {
  background: var(--primary-purple);
  border-radius: 3px;
}

/* Action Buttons */
.action-button {
  background: linear-gradient(135deg, var(--primary-purple), var(--purple-hover));
  color: white;
  font-weight: 600;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  border: none;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.action-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: 0.5s;
}

.action-button:hover::before {
  left: 100%;
}

.action-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
}

.action-button.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-button.secondary {
  background: linear-gradient(135deg, #f5a623, #f8e71c);
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 0.8rem;
}

/* Progress Bar */
progress {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 8px;
  border: none;
  border-radius: 0;
  background-color: rgba(68, 51, 122, 0.3);
  z-index: 10;
}

progress::-webkit-progress-bar {
  background-color: rgba(68, 51, 122, 0.3);
}

progress::-webkit-progress-value {
  background: linear-gradient(90deg, var(--primary-purple), var(--light-purple));
  transition: width 0.2s ease;
}

/* Overlay Styling */
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(26, 22, 37, 0.7);
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 12px;
}

.camera-frame:hover .overlay,
.result-frame:hover .overlay {
  opacity: 1;
}

.overlay span {
  color: white;
  font-size: 1.2rem;
  font-weight: 600;
  text-align: center;
  padding: 1rem;
  background-color: rgba(107, 70, 193, 0.7);
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

/* Footer Styling */
.app-footer {
  padding: 1rem;
  text-align: center;
  background-color: rgba(26, 22, 37, 0.8);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(159, 122, 234, 0.2);
}

.app-footer p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

/* Responsive adjustments */
@media (max-width: 1400px) {
  .style-grid {
    grid-template-columns: repeat(5, 1fr);
    max-height: 240px;
  }
}

@media (max-width: 900px) {
  .style-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .selection-button {
    padding: 0.5rem 0.8rem;
    font-size: 0.85rem;
  }
}
</style>

