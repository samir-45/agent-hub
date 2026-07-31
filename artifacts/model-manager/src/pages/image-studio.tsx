import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  Sparkles,
  ArrowLeft,
  Wand2,
  Download,
  Copy,
  Check,
  Maximize2,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Sliders,
  Layers,
  Ratio,
  Palette,
  ExternalLink,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export interface GeneratedImage {
  id: number;
  url: string;
  prompt: string;
  enhancedPrompt?: string;
  model: string;
  aspectRatio: string;
  style: string;
  width: number;
  height: number;
  createdAt: string;
}

const DEFAULT_MODELS = [
  { id: 'flux', name: 'FLUX.1 Schnell', badge: 'Ultra-Fast' },
  { id: 'flux-realism', name: 'FLUX Realism', badge: 'Photorealistic' },
  { id: 'flux-candid', name: 'FLUX Candid', badge: 'Portrait' },
  { id: 'flux-anime', name: 'FLUX Anime', badge: 'Anime' },
  { id: 'flux-3d', name: 'FLUX 3D', badge: '3D Render' },
  { id: 'any-dark', name: 'Any Dark', badge: 'Dark Mode' },
  { id: 'turbo', name: 'SDXL Turbo', badge: 'Instant' },
  { id: 'black-forest-labs/flux-1-schnell', name: 'FLUX.1 Schnell (OpenRouter)', badge: 'Free' },
  { id: 'black-forest-labs/flux-1-dev', name: 'FLUX.1 Dev (OpenRouter)', badge: 'Photorealistic' },
  { id: 'recraft-ai/recraft-v3', name: 'Recraft v3', badge: 'Vector & Graphic' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square (1024x1024)', icon: '⬛' },
  { id: '16:9', label: '16:9 Widescreen (1280x720)', icon: '🖼️' },
  { id: '9:16', label: '9:16 Portrait (720x1280)', icon: '📱' },
  { id: '4:3', label: '4:3 Standard (1024x768)', icon: '💻' },
  { id: '3:4', label: '3:4 Tall (768x1024)', icon: '📄' },
];

const STYLES = [
  { id: 'none', label: 'Default / None' },
  { id: 'photorealistic', label: 'Photorealistic / 8K' },
  { id: 'anime', label: 'Anime & Manga' },
  { id: 'digital-art', label: 'Digital Concept Art' },
  { id: 'cyberpunk', label: 'Cyberpunk & Sci-Fi' },
  { id: 'cinematic', label: 'Cinematic Movie Still' },
  { id: '3d-render', label: '3D Render / Octane' },
  { id: 'minimalist', label: 'Minimalist Design' },
];

const PROMPT_SUGGESTIONS = [
  "A futuristic cyberpunk cityscape illuminated by green neon lights in heavy rain, 8k resolution, photorealistic",
  "Cute 3D render robot mascot holding a glowing emerald crystal, soft studio lighting, Pixar style",
  "Minimalist abstract landscape with dark mountains, emerald glowing river, dark moody aesthetic",
  "Astronaut floating in deep space near a glowing green nebula, cinematic photorealistic 8k",
];

const STORAGE_KEY = 'agent_hub_generated_images';

function buildRefParam(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.includes('pollinations.ai')) return '';
  return `&image=${encodeURIComponent(trimmed)}`;
}

export default function ImageStudio() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [refImageUrl, setRefImageUrl] = useState('');
  const [modelsList, setModelsList] = useState(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [isGenerating, setIsGenerating] = useState(false);

  // Dynamically fetch live active free image generation models!
  useEffect(() => {
    async function fetchLiveImageModels() {
      try {
        const res = await fetch('https://image.pollinations.ai/models');
        if (res.ok) {
          const liveIds: string[] = await res.json();
          if (Array.isArray(liveIds) && liveIds.length > 0) {
            const dynamicList = liveIds.map((id) => {
              const formattedName = id
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

              let badge = 'Free';
              if (id.includes('flux')) badge = 'FLUX Engine';
              else if (id.includes('anime')) badge = 'Anime';
              else if (id.includes('dark')) badge = 'Stylized';
              else if (id.includes('turbo')) badge = 'Instant';

              return {
                id,
                name: `${formattedName} (Free)`,
                badge,
              };
            });

            // Keep presets in pool if not already in dynamic list
            DEFAULT_MODELS.forEach((dm) => {
              if (!dynamicList.some((m) => m.id === dm.id)) {
                dynamicList.push(dm);
              }
            });

            setModelsList(dynamicList);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch live image models, using default preset list:', err);
      }
    }

    fetchLiveImageModels();
  }, []);

  const [history, setHistory] = useState<GeneratedImage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeImage, setActiveImage] = useState<GeneratedImage | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (activeImage) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [activeImage?.url]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
    } catch {}
  }, [history]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    let newImage: GeneratedImage | null = null;

    // Dimensions mapping
    const DIMENSIONS: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1280, height: 720 },
      '9:16': { width: 720, height: 1280 },
      '4:3': { width: 1024, height: 768 },
      '3:4': { width: 768, height: 1024 },
    };

    // Try API endpoint first
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const localKey = typeof window !== 'undefined' ? localStorage.getItem('openrouter_user_api_key') : null;
      if (localKey) {
        headers['x-openrouter-key'] = localKey;
      }
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
          aspectRatio: selectedRatio,
          style: selectedStyle,
          negativePrompt: negativePrompt.trim(),
          refImageUrl: refImageUrl.trim(),
        }),
      });

      if (res.ok) {
        const text = await res.text();
        if (text.startsWith('{')) {
          newImage = JSON.parse(text);
        }
      }
    } catch {}

    // Instant Fallback Engine (Guarantees image generation succeeds even if server endpoint is restarting or unavailable)
    if (!newImage) {
      const { width, height } = DIMENSIONS[selectedRatio] || { width: 1024, height: 1024 };
      let enhanced = prompt.trim();
      if (refImageUrl.trim()) {
        enhanced = `Image-to-Image transformation of reference photo, maintaining original visual composition, pose, and structure, stylized with: ${enhanced}`;
      }
      if (selectedStyle && selectedStyle !== 'none') {
        enhanced = `${enhanced}, ${selectedStyle} style, highly detailed, 8k resolution`;
      }
      if (negativePrompt.trim()) {
        enhanced = `${enhanced} --no ${negativePrompt.trim()}`;
      }

      const seed = Math.floor(Math.random() * 1000000);
      const encoded = encodeURIComponent(enhanced);
      const polModel = selectedModel.includes('/') ? (selectedModel.split('/').pop()?.includes('flux') ? 'flux' : 'flux') : selectedModel;
      const refParam = buildRefParam(refImageUrl);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&model=${encodeURIComponent(polModel || 'flux')}${refParam}&nologo=true`;

      newImage = {
        id: Date.now(),
        url,
        prompt: prompt.trim(),
        enhancedPrompt: enhanced,
        model: selectedModel,
        aspectRatio: selectedRatio,
        style: selectedStyle,
        width,
        height,
        createdAt: new Date().toISOString(),
      };
    }

    setHistory((prev) => [newImage!, ...prev]);
    setActiveImage(newImage);
    setIsGenerating(false);

    toast({
      title: 'Image generated!',
      description: `Created with ${selectedModel.split('/')[1] || selectedModel}`,
    });
  };

  const handleGenerateVariations = async (targetImg: GeneratedImage) => {
    if (isGenerating) return;
    setIsGenerating(true);
    toast({
      title: '✨ Generating 4 Intelligent Variations…',
      description: `Synthesizing creative iterations for "${targetImg.prompt.slice(0, 30)}..."`,
    });

    const DIMENSIONS: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1280, height: 720 },
      '9:16': { width: 720, height: 1280 },
      '4:3': { width: 1024, height: 768 },
      '3:4': { width: 768, height: 1024 },
    };

    const { width, height } = DIMENSIONS[targetImg.aspectRatio] || { width: 1024, height: 1024 };
    const cleanBasePrompt = (targetImg.prompt || '').replace(/\(Variation #\d+\)/g, '').trim();

    const variationModifiers = [
      'cinematic dramatic lighting, 8k resolution, masterpiece, vivid depth',
      'wide angle perspective, atmospheric lighting, studio quality, sharp focus',
      'octane render, artstation trending, vibrant color palette, intricate detail',
      'photorealistic, 85mm portrait lens, ultra high resolution, natural light',
    ];

    const baseSeed = Math.floor(Math.random() * 800000) + 100000;
    const cleanModel = targetImg.model.includes('anime') ? 'flux-anime' : 'flux';
    const newVariations: GeneratedImage[] = [];

    for (let i = 0; i < 4; i++) {
      const seed = baseSeed + (i + 1) * 314159;
      const variationPrompt = `${cleanBasePrompt}, ${variationModifiers[i]}`;
      const encoded = encodeURIComponent(variationPrompt);
      // Construct clean URL without recursive image= parameters
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&model=${encodeURIComponent(cleanModel)}&nologo=true`;

      newVariations.push({
        id: Date.now() + i,
        url,
        prompt: `${cleanBasePrompt} (Variation #${i + 1})`,
        enhancedPrompt: variationPrompt,
        model: targetImg.model,
        aspectRatio: targetImg.aspectRatio,
        style: targetImg.style,
        width,
        height,
        createdAt: new Date().toISOString(),
      });
    }

    setHistory((prev) => [...newVariations, ...prev]);
    setIsGenerating(false);
    toast({
      title: '🎉 4 Intelligent Variations Created!',
      description: 'Added 4 distinct artistic variations to your gallery.',
    });
  };

  const handleUseAsReference = (targetImg: GeneratedImage) => {
    setPrompt(targetImg.prompt);
    setRefImageUrl(targetImg.url);
    if (targetImg.aspectRatio) setSelectedRatio(targetImg.aspectRatio);
    toast({
      title: '🖼️ Image set as reference!',
      description: 'Loaded prompt and reference image into Image Studio controls.',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setRefImageUrl(dataUrl);
        // Convert to local proxy URL so AI engines can access image over HTTP
        try {
          const res = await fetch('/api/images/upload-ref', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data: dataUrl }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              setRefImageUrl(data.url);
            }
          }
        } catch {}
        toast({
          title: '🖼️ Image uploaded!',
          description: `Loaded "${file.name}" as reference image.`,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEnhancePrompt = () => {
    if (!prompt.trim()) return;
    const enhancements = [
      "highly detailed, 8k resolution, cinematic lighting, masterpiece, sharp focus",
      "trending on ArtStation, octane render, dramatic lighting, vivid colors",
      "ultra-realistic texture, studio lighting, award winning photograph, 85mm lens",
    ];
    const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    setPrompt((p) => `${p.trim()}, ${randomEnhancement}`);
    toast({ title: 'Prompt enhanced!', description: 'Added quality & lighting descriptors.' });
  };

  const handleCopyPrompt = (p: string, id: number) => {
    navigator.clipboard.writeText(p);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Prompt copied to clipboard' });
  };

  const handleDeleteImage = (id: number) => {
    setHistory((prev) => prev.filter((img) => img.id !== id));
    if (activeImage?.id === id) setActiveImage(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background noise-bg flex flex-col">
      {/* Top Emerald Accent Line */}
      <div className="h-[2px] w-full gradient-primary shrink-0" />

      {/* Header */}
      <div className="border-b border-border/60 bg-card/60 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted/60" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center shadow-md glow-primary">
                  <Sparkles className="h-4 w-4 text-black stroke-[2.5]" />
                </div>
                <h1 className="text-sm font-bold tracking-tight text-foreground font-mono">
                  Image Studio
                </h1>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] px-1.5 py-0 font-mono font-semibold uppercase">
                  AI Engine
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {history.length > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  {history.length} image{history.length !== 1 ? 's' : ''} in gallery
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Studio Workspace Body */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Controls Sidebar (Left 4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
              <Sliders className="h-4 w-4 text-emerald-400" />
              Generation Parameters
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-emerald-400" />
                Model Engine
              </Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="rounded-xl border-border/60 bg-muted/30">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {modelsList.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{m.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                          {m.badge}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Ratio className="h-3.5 w-3.5 text-emerald-400" />
                Aspect Ratio
              </Label>
              <div className="grid grid-cols-5 gap-1.5">
                {ASPECT_RATIOS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRatio(r.id)}
                    className={`py-2 px-1 rounded-xl text-center border transition-all duration-200 cursor-pointer ${
                      selectedRatio === r.id
                        ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400 font-bold shadow-sm'
                        : 'border-border/40 hover:bg-muted/40 text-muted-foreground'
                    }`}
                    title={r.label}
                  >
                    <div className="text-xs font-mono">{r.id}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Style Preset */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-emerald-400" />
                Style Preset
              </Label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="rounded-xl border-border/60 bg-muted/30">
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Negative Prompt */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs text-muted-foreground">Negative Prompt (Optional)</Label>
              <Input
                placeholder="blurry, low quality, distorted, extra limbs"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                className="rounded-xl text-xs border-border/60 bg-muted/30"
              />
            </div>

            {/* Image-to-Image / Edit Reference Input */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 font-semibold">
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
                  Img-to-Img & Image Editing
                </Label>
                {refImageUrl && (
                  <button
                    onClick={() => setRefImageUrl('')}
                    className="text-[10px] text-destructive hover:underline font-mono cursor-pointer"
                  >
                    Clear Reference
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Paste URL or upload image below..."
                  value={refImageUrl}
                  onChange={(e) => setRefImageUrl(e.target.value)}
                  className="rounded-xl text-xs border-border/60 bg-muted/30 font-mono flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 shrink-0 cursor-pointer"
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </Button>
                <input
                  id="file-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {refImageUrl && (
                <div className="space-y-2 mt-2 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-emerald-500/50 shrink-0 shadow-md">
                      <img src={refImageUrl} alt="Reference" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-emerald-400 font-semibold">Reference Image Loaded</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">Type prompt changes below or select a quick edit remix</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 rounded-lg border-border/60 hover:border-emerald-500/40 hover:text-emerald-400 justify-start"
                      onClick={() => setPrompt((p) => `${p ? p + ', ' : ''}cyberpunk remix, neon glow, futuristic detail`)}
                    >
                      ✨ Cyberpunk Remix
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 rounded-lg border-border/60 hover:border-emerald-500/40 hover:text-emerald-400 justify-start"
                      onClick={() => setPrompt((p) => `${p ? p + ', ' : ''}redraw in anime art style, Studio Ghibli vibes`)}
                    >
                      🎨 Anime Redraw
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 rounded-lg border-border/60 hover:border-emerald-500/40 hover:text-emerald-400 justify-start"
                      onClick={() => setPrompt((p) => `${p ? p + ', ' : ''}3D octane render, 3D Pixar character style`)}
                    >
                      🧊 3D Render
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 rounded-lg border-border/60 hover:border-emerald-500/40 hover:text-emerald-400 justify-start"
                      onClick={() => setPrompt((p) => `${p ? p + ', ' : ''}vector pencil sketch drawing, monochrome`)}
                    >
                      ✏️ Vector Sketch
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Prompt Ideas */}
          <Card className="glass-card rounded-2xl p-4">
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-400" /> Prompt Ideas
            </p>
            <div className="space-y-2">
              {PROMPT_SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(s)}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground p-2 rounded-xl border border-transparent hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all line-clamp-2 cursor-pointer"
                >
                  "{s}"
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Prompt Input & Output Gallery (Right 8 cols) */}
        <div className="lg:col-span-8 space-y-6 flex flex-col min-h-0">
          {/* Prompt Area */}
          <Card className="glass-card rounded-2xl p-4 space-y-3 shrink-0 shadow-lg">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                Image Prompt
              </Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleEnhancePrompt}
                disabled={!prompt.trim() || isGenerating}
                className="h-7 text-xs gap-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Enhance Prompt
              </Button>
            </div>

            <Textarea
              placeholder="Describe the image you want to generate in detail… (e.g., A futuristic cyberpunk city at night with green neon reflections)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              className="resize-none min-h-[90px] border-border/60 bg-muted/20 rounded-xl text-sm focus-visible:ring-emerald-500/50"
              rows={3}
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground font-mono">
                Model: <span className="text-foreground font-medium">{selectedModel.split('/')[1]}</span>
              </span>
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="gap-2 rounded-xl gradient-primary text-black font-semibold border-0 shadow-lg glow-primary-hover transition-all duration-300 hover:scale-105"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Image…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 stroke-[2.5]" />
                    Generate Image
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Output / History Gallery Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isGenerating && (
              <Card className="glass-card rounded-2xl p-12 mb-6 text-center flex flex-col items-center justify-center border-dashed border-2 border-emerald-500/40 animate-pulse">
                <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg glow-primary">
                  <Loader2 className="h-8 w-8 text-black animate-spin" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">Synthesizing Pixels…</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Rendering prompt with <span className="text-emerald-400 font-mono">{selectedModel.split('/')[1]}</span> engine
                </p>
              </Card>
            )}

            {history.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 stagger-children">
                {history.map((img) => (
                  <Card
                    key={img.id}
                    className="glass-card rounded-2xl overflow-hidden group hover:border-emerald-500/50 transition-all duration-300 shadow-md"
                  >
                    <div className="relative aspect-square bg-card/60 overflow-hidden cursor-pointer" onClick={() => setActiveImage(img)}>
                      <img
                        src={img.url}
                        alt={img.prompt}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.retried) {
                            target.dataset.retried = 'true';
                            if (target.src.includes('&image=')) {
                              target.src = target.src.replace(/&image=[^&]*/, '');
                            } else {
                              const cleanPrompt = encodeURIComponent((img.prompt || 'artistic scene').replace(/\(Variation #\d+\)/g, '').trim());
                              const freshSeed = Math.floor(Math.random() * 900000) + 100000;
                              target.src = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${img.width || 1024}&height=${img.height || 1024}&seed=${freshSeed}&model=flux&nologo=true`;
                            }
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end">
                        <p className="text-xs text-white line-clamp-2 mb-2 font-medium">"{img.prompt}"</p>
                        <div className="flex items-center justify-between text-[10px] text-white/70 font-mono">
                          <span>{img.aspectRatio} · {img.model.split('/')[1]}</span>
                          <span className="flex items-center gap-1 text-emerald-400 font-bold"><Maximize2 className="h-3 w-3" /> Preview</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
                        {img.prompt}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-lg hover:text-emerald-400"
                          onClick={() => handleGenerateVariations(img)}
                          title="Generate 4 variations"
                        >
                          <Wand2 className="h-3.5 w-3.5 text-emerald-400" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-lg hover:text-emerald-400"
                          onClick={() => handleUseAsReference(img)}
                          title="Use as Img-to-Img reference"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-lg hover:text-emerald-400"
                          onClick={() => handleCopyPrompt(img.prompt, img.id)}
                          title="Copy prompt"
                        >
                          {copiedId === img.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <a href={img.url} target="_blank" rel="noopener noreferrer" download={`generated-${img.id}.png`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg hover:text-emerald-400" title="Download image">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-lg hover:text-destructive"
                          onClick={() => handleDeleteImage(img.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : !isGenerating ? (
              <Card className="border-dashed border-2 border-border/40 rounded-2xl p-16 text-center flex flex-col items-center justify-center bg-card/40">
                <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-5 shadow-lg glow-primary">
                  <ImageIcon className="h-8 w-8 text-black" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">No images generated yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Select a model engine, enter your creative prompt, and click Generate to start rendering images
                </p>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      {/* High-Res Lightbox Modal */}
      {activeImage && (
        <Dialog open={!!activeImage} onOpenChange={() => setActiveImage(null)}>
          <DialogContent className="max-w-4xl w-[92vw] max-h-[90vh] p-0 overflow-hidden bg-[#090c0a] border border-emerald-500/30 rounded-2xl flex flex-col gap-0">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-card/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <DialogTitle className="text-sm font-bold text-foreground">Image Lightbox</DialogTitle>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {activeImage.model} · {activeImage.width}x{activeImage.height}
                  </p>
                </div>
              </div>
            </div>

            {/* Image Preview Container */}
            <div className="flex-1 min-h-0 bg-black/80 flex items-center justify-center p-4 overflow-hidden relative w-full">
              {imageError ? (
                <div className="w-full h-[45vh] max-w-lg flex flex-col items-center justify-center rounded-2xl bg-card/40 border border-destructive/30 p-8 text-center space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-1">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Preview Failed to Decode</h4>
                  <p className="text-xs text-muted-foreground">The image server or endpoint was unavailable or timed out.</p>
                  <Button
                    size="sm"
                    className="rounded-xl gradient-primary text-black font-semibold border-0 text-xs gap-1.5 shadow-lg mt-2"
                    onClick={() => {
                      const seed = Math.floor(Math.random() * 1000000);
                      const newUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(activeImage.prompt)}?width=${activeImage.width}&height=${activeImage.height}&seed=${seed}&model=flux&nologo=true`;
                      setActiveImage({ ...activeImage, url: newUrl });
                    }}
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Regenerate Preview
                  </Button>
                </div>
              ) : (
                <>
                  {!imageLoaded && (
                    <div className="w-full h-[45vh] max-w-lg flex flex-col items-center justify-center rounded-2xl bg-card/40 border border-emerald-500/20 animate-pulse p-8 shadow-inner">
                      <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center mb-3 shadow-lg glow-primary">
                        <Loader2 className="h-6 w-6 text-black animate-spin" />
                      </div>
                      <p className="text-xs font-mono text-emerald-400 font-semibold tracking-wide">Rendering High-Res Preview…</p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">Synthesizing image buffer</p>
                    </div>
                  )}
                  <img
                    src={activeImage.url}
                    alt={activeImage.prompt}
                    onLoad={() => { setImageLoaded(true); setImageError(false); }}
                    onError={() => { setImageLoaded(false); setImageError(true); }}
                    className={`max-h-[52vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10 transition-opacity duration-300 ${
                      imageLoaded && !imageError ? 'opacity-100' : 'opacity-0 absolute'
                    }`}
                  />
                </>
              )}
            </div>

            {/* Footer Bar */}
            <div className="p-4 bg-card/90 border-t border-border/50 shrink-0 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold mb-0.5">Prompt</p>
                  <p className="text-xs text-foreground leading-relaxed line-clamp-2">{activeImage.prompt}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => handleGenerateVariations(activeImage)}
                  >
                    <Wand2 className="h-3.5 w-3.5" /> 4 Variations
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs gap-1.5 border-border/60 hover:bg-muted/60"
                    onClick={() => {
                      handleUseAsReference(activeImage);
                      setActiveImage(null);
                    }}
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-emerald-400" /> Img-to-Img
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs gap-1.5 border-border/60 hover:bg-muted/60"
                    onClick={() => handleCopyPrompt(activeImage.prompt, activeImage.id)}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy Prompt
                  </Button>
                  <a href={activeImage.url} target="_blank" rel="noopener noreferrer" download={`generated-${activeImage.id}.png`}>
                    <Button size="sm" className="rounded-xl gradient-primary text-black font-semibold border-0 text-xs gap-1.5 shadow-lg">
                      <Download className="h-3.5 w-3.5" /> Download High-Res
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
