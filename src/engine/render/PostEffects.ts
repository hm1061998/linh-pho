import * as pc from 'playcanvas';

/**
 * Screen-space effects for the hub (Art Bible §4). Ambient occlusion darkens the creases where props meet the ground,
 * which reads as a contact shadow. Bloom spreads a little light from the lanterns. Both run through PlayCanvas's camera
 * frame, so the project has no shader of its own for them. They are switched off on the low and mobile presets
 * (QualityProfile.postEffects) until their cost is measured on a phone.
 */

const SSAO_INTENSITY = 0.5;
/** Radius of the occlusion sample, in metres. Props are about 0.5–2 m, so this reaches the ground under them. */
const SSAO_RADIUS_M = 0.6;
/** Kept low: the lanterns are already bright, and a strong bloom would wash out the warm light (Art Bible §4). */
const BLOOM_INTENSITY = 0.03;

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export class PostEffects {
  private readonly frame: pc.CameraFrame;
  private readonly camera: pc.CameraComponent;
  /** The clear colour as the camera shows it without the frame: the sRGB colour the hub was tuned with. */
  private readonly displayClear: pc.Color;
  /** The same colour in linear light. The frame works in linear HDR and applies gamma last, so it needs this one. */
  private readonly hdrClear: pc.Color;

  constructor(app: pc.AppBase, camera: pc.CameraComponent) {
    this.camera = camera;
    this.displayClear = camera.clearColor.clone();
    this.hdrClear = new pc.Color(
      srgbToLinear(this.displayClear.r),
      srgbToLinear(this.displayClear.g),
      srgbToLinear(this.displayClear.b),
      1,
    );
    this.frame = new pc.CameraFrame(app, camera);
    // Linear keeps the palette as it was tuned (Art Bible §1). The frame's default curve would wash out the navy and the gold.
    this.frame.rendering.toneMapping = pc.TONEMAP_LINEAR;
    this.frame.ssao.type = pc.SSAOTYPE_COMBINE;
    this.frame.ssao.intensity = SSAO_INTENSITY;
    this.frame.ssao.radius = SSAO_RADIUS_M;
    this.frame.bloom.intensity = BLOOM_INTENSITY;
    this.frame.enabled = false;
    this.frame.update();
  }

  /** Turns the effects on or off. Off releases their render targets and restores the sRGB clear colour. */
  setEnabled(enabled: boolean): void {
    this.frame.enabled = enabled;
    this.camera.clearColor = enabled ? this.hdrClear : this.displayClear;
    if (enabled) {
      this.frame.update();
    }
  }

  /** Removes the effects from the camera. */
  dispose(): void {
    this.frame.destroy();
    this.camera.clearColor = this.displayClear;
  }
}
