import { Router } from "express";
import { getOpenRouterApiKey } from "../lib/openrouter-client.js";

export const imagesRouter = Router();

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: string;
  negativePrompt?: string;
  refImageUrl?: string;
}

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
};

// In-memory cache for local base64 uploads so external models can fetch them as HTTP image URLs
const refImageCache = new Map<string, { buffer: Buffer; mimeType: string }>();

imagesRouter.post("/upload-ref", (req, res) => {
  try {
    const { base64Data } = req.body;
    if (!base64Data || typeof base64Data !== "string") {
      res.status(400).json({ error: "base64Data is required" });
      return;
    }

    const matches = base64Data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    let mimeType = "image/png";
    let buffer: Buffer;

    if (matches) {
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], "base64");
    } else {
      buffer = Buffer.from(base64Data, "base64");
    }

    const id = `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    refImageCache.set(id, { buffer, mimeType });

    // Host URL on current port
    const port = process.env.PORT || 19606;
    const publicUrl = `http://localhost:${port}/api/images/ref-image/${id}.png`;

    res.json({ id, url: publicUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to process image upload" });
  }
});

imagesRouter.get("/ref-image/:id.png", (req, res) => {
  const { id } = req.params;
  const cleanId = id.replace(/\.png$/, "");
  const cached = refImageCache.get(cleanId);
  if (!cached) {
    res.status(404).send("Reference image not found");
    return;
  }

  res.setHeader("Content-Type", cached.mimeType);
  res.send(cached.buffer);
});

function getPollinationsModelSlug(modelId?: string): string {
  if (!modelId) return "flux";
  if (modelId.includes("/")) {
    const slug = modelId.split("/").pop()?.toLowerCase() || "";
    if (slug.includes("flux")) return "flux";
    return "flux";
  }
  return modelId;
}

imagesRouter.post("/generate", async (req, res) => {
  try {
    const {
      prompt,
      model = "black-forest-labs/flux-1-schnell",
      aspectRatio = "1:1",
      style = "none",
      negativePrompt = "",
      refImageUrl = "",
    }: ImageGenerationRequest = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const { width, height } = DIMENSIONS[aspectRatio] || DIMENSIONS['1:1'];

    let targetRefUrl = refImageUrl.trim();
    if (targetRefUrl.startsWith("data:image")) {
      // Auto convert base64 to local HTTP URL
      const matches = targetRefUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        const id = `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        refImageCache.set(id, { buffer, mimeType });
        const port = process.env.PORT || 19606;
        targetRefUrl = `http://localhost:${port}/api/images/ref-image/${id}.png`;
      }
    }

    // Combine style preset & reference image context into prompt
    let enhancedPrompt = prompt.trim();

    if (targetRefUrl) {
      enhancedPrompt = `Image-to-Image transformation of reference photo, maintaining original visual composition, pose, and structure, stylized with: ${enhancedPrompt}`;
    }

    if (style && style !== "none") {
      enhancedPrompt = `${enhancedPrompt}, ${style} style, highly detailed, 8k resolution`;
    }

    if (negativePrompt && negativePrompt.trim()) {
      enhancedPrompt = `${enhancedPrompt} --no ${negativePrompt.trim()}`;
    }

    let imageUrl: string | null = null;
    let usedProvider = "openrouter";

    // Attempt 1: OpenRouter Image Endpoint
    try {
      const userEmail = (req as any).auth?.claims?.email || (req as any).auth?.sessionClaims?.email;
      const userRole = (req as any).auth?.claims?.publicMetadata?.role || (req as any).auth?.sessionClaims?.publicMetadata?.role;
      const userHeaderKey = req.headers["x-openrouter-key"] as string | undefined;
      const apiKey = await getOpenRouterApiKey(userEmail, userHeaderKey, userRole);
      const openRouterRes = await fetch("https://openrouter.ai/api/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:19606",
          "X-Title": "OpenRouter Image Studio",
        },
        body: JSON.stringify({
          model: model || "black-forest-labs/flux-1-schnell",
          prompt: enhancedPrompt,
          n: 1,
          size: `${width}x${height}`,
        }),
      });

      if (openRouterRes.ok) {
        const data = (await openRouterRes.json()) as any;
        if (data.data?.[0]?.url) {
          imageUrl = data.data[0].url;
        } else if (data.data?.[0]?.b64_json) {
          imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
        }
      }
    } catch (openRouterErr) {
      // Fall through to fallback engine
    }

    // Attempt 2: High-Speed FLUX Pollinations Fallback
    if (!imageUrl) {
      usedProvider = "flux-engine";
      const seed = Math.floor(Math.random() * 1000000);
      const encodedPrompt = encodeURIComponent(enhancedPrompt);
      const polModel = getPollinationsModelSlug(model);
      const refParam = targetRefUrl ? `&image=${encodeURIComponent(targetRefUrl)}` : "";
      imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=${encodeURIComponent(polModel)}${refParam}&nologo=true`;
    }

    res.json({
      id: Date.now(),
      url: imageUrl,
      prompt: prompt.trim(),
      enhancedPrompt,
      model,
      aspectRatio,
      style,
      width,
      height,
      provider: usedProvider,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Image generation failed" });
  }
});
