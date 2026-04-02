"use client";

import { useState } from "react";
import {
  Copy,
  Download,
  Save,
  Check,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  ThumbsUp,
  Send,
  ArrowBigUp,
  ArrowBigDown,
  Music,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface PostData {
  id: string;
  platform: string;
  content: string;
  hashtags: string[];
  mediaUrls: string[];
  charCount: number;
  charLimit: number;
}

interface PreviewCardProps {
  post: PostData;
  brandName?: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
}

// ─── Platform Colors ─────────────────────────────────────────────

const PLATFORM_STYLES: Record<string, { accent: string; bg: string; label: string; icon: string }> = {
  x: { accent: "#ffffff", bg: "rgba(0,0,0,0.4)", label: "X", icon: "𝕏" },
  meta: { accent: "#E1306C", bg: "rgba(30,0,20,0.4)", label: "Instagram", icon: "◎" },
  linkedin: { accent: "#0A66C2", bg: "rgba(0,15,40,0.4)", label: "LinkedIn", icon: "in" },
  reddit: { accent: "#FF4500", bg: "rgba(40,10,0,0.4)", label: "Reddit", icon: "⬡" },
  tiktok: { accent: "#00F2EA", bg: "rgba(0,20,25,0.4)", label: "TikTok", icon: "♪" },
};

// ─── Shared Action Bar ──────────────────────────────────────────

function ActionBar({ post, onSave }: { post: PostData; onSave: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const copyText = () => {
    const full = post.hashtags.length
      ? `${post.content}\n\n${post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
      : post.content;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex items-center gap-1 border-t border-white/5 px-4 py-2">
      <button onClick={copyText} className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-white">
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      {post.mediaUrls[0] && (
        <a href={post.mediaUrls[0]} download className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-white">
          <Download className="h-3 w-3" />
          Image
        </a>
      )}
      <button onClick={handleSave} className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-accent">
        {saved ? <Check className="h-3 w-3 text-accent" /> : <Save className="h-3 w-3" />}
        {saved ? "Saved" : "Save Draft"}
      </button>
      <CharCounter count={post.content.length} limit={post.charLimit} />
    </div>
  );
}

function CharCounter({ count, limit }: { count: number; limit: number }) {
  const pct = count / limit;
  const color = pct > 1 ? "text-red-400" : pct > 0.9 ? "text-yellow-400" : "text-slate-600";
  return (
    <span className={`font-mono text-[9px] ${color}`}>
      {count}/{limit}
    </span>
  );
}

// ─── X Preview ──────────────────────────────────────────────────

export function XPostPreview({ post, brandName, onContentChange, onSave }: PreviewCardProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2" style={{ background: PLATFORM_STYLES.x.bg }}>
        <span className="text-sm font-bold text-white">{PLATFORM_STYLES.x.icon}</span>
        <span className="text-xs font-semibold text-white">{PLATFORM_STYLES.x.label}</span>
      </div>

      {/* Post mockup */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-accent/30 to-cyan-500/30" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{brandName ?? "Brand"}</span>
              <span className="text-xs text-slate-500">@{(brandName ?? "brand").toLowerCase().replace(/\s/g, "")}</span>
              <span className="text-xs text-slate-600">· now</span>
            </div>
            {/* Editable content */}
            <textarea
              value={post.content}
              onChange={(e) => onContentChange(e.target.value)}
              className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-0"
              rows={Math.max(2, Math.ceil(post.content.length / 50))}
            />
            {/* Image */}
            {post.mediaUrls[0] && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
                <img src={post.mediaUrls[0]} alt="" className="aspect-video w-full object-cover" />
              </div>
            )}
            {/* Engagement row */}
            <div className="mt-3 flex items-center justify-between pr-8 text-slate-600">
              <MessageCircle className="h-4 w-4 hover:text-sky-400 cursor-pointer" />
              <Repeat2 className="h-4 w-4 hover:text-emerald-400 cursor-pointer" />
              <Heart className="h-4 w-4 hover:text-pink-400 cursor-pointer" />
              <Bookmark className="h-4 w-4 hover:text-sky-400 cursor-pointer" />
              <Share className="h-4 w-4 hover:text-sky-400 cursor-pointer" />
            </div>
          </div>
        </div>
      </div>
      <ActionBar post={post} onSave={onSave} />
    </div>
  );
}

// ─── Instagram Preview ──────────────────────────────────────────

export function InstagramPostPreview({ post, brandName, onContentChange, onSave }: PreviewCardProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2" style={{ background: PLATFORM_STYLES.meta.bg }}>
        <span className="text-sm" style={{ color: PLATFORM_STYLES.meta.accent }}>{PLATFORM_STYLES.meta.icon}</span>
        <span className="text-xs font-semibold" style={{ color: PLATFORM_STYLES.meta.accent }}>{PLATFORM_STYLES.meta.label}</span>
      </div>

      {/* Post mockup */}
      <div>
        {/* User row */}
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-purple-500/40 to-pink-500/40" />
          <span className="text-xs font-semibold text-white">{(brandName ?? "brand").toLowerCase().replace(/\s/g, "")}</span>
        </div>
        {/* Image */}
        {post.mediaUrls[0] && (
          <img src={post.mediaUrls[0]} alt="" className="aspect-square w-full object-cover" />
        )}
        {/* Engagement */}
        <div className="flex items-center gap-4 px-4 py-2 text-white">
          <Heart className="h-5 w-5 hover:text-red-400 cursor-pointer" />
          <MessageCircle className="h-5 w-5 cursor-pointer" />
          <Send className="h-5 w-5 cursor-pointer" />
          <Bookmark className="ml-auto h-5 w-5 cursor-pointer" />
        </div>
        {/* Caption */}
        <div className="px-4 pb-3">
          <span className="text-xs font-semibold text-white">{(brandName ?? "brand").toLowerCase().replace(/\s/g, "")} </span>
          <textarea
            value={post.content}
            onChange={(e) => onContentChange(e.target.value)}
            className="inline w-full resize-none border-0 bg-transparent p-0 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-0"
            rows={Math.max(2, Math.ceil(post.content.length / 60))}
          />
          {post.hashtags.length > 0 && (
            <p className="mt-1 text-xs text-sky-400/60">
              {post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
            </p>
          )}
        </div>
      </div>
      <ActionBar post={post} onSave={onSave} />
    </div>
  );
}

// ─── LinkedIn Preview ───────────────────────────────────────────

export function LinkedInPostPreview({ post, brandName, onContentChange, onSave }: PreviewCardProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2" style={{ background: PLATFORM_STYLES.linkedin.bg }}>
        <span className="text-xs font-bold" style={{ color: PLATFORM_STYLES.linkedin.accent }}>{PLATFORM_STYLES.linkedin.icon}</span>
        <span className="text-xs font-semibold" style={{ color: PLATFORM_STYLES.linkedin.accent }}>{PLATFORM_STYLES.linkedin.label}</span>
      </div>

      <div className="p-4">
        {/* Author */}
        <div className="flex gap-3">
          <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30" />
          <div>
            <p className="text-sm font-semibold text-white">{brandName ?? "Brand"}</p>
            <p className="text-[10px] text-slate-500">Company · 1st</p>
            <p className="text-[10px] text-slate-600">Just now · 🌐</p>
          </div>
        </div>
        {/* Content */}
        <textarea
          value={post.content}
          onChange={(e) => onContentChange(e.target.value)}
          className="mt-3 w-full resize-none border-0 bg-transparent p-0 text-xs leading-relaxed text-slate-300 focus:outline-none focus:ring-0"
          rows={Math.max(3, Math.ceil(post.content.length / 65))}
        />
        {post.hashtags.length > 0 && (
          <p className="mt-1 text-xs text-sky-500/60">
            {post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
          </p>
        )}
        {/* Image */}
        {post.mediaUrls[0] && (
          <div className="mt-3 overflow-hidden border border-white/10">
            <img src={post.mediaUrls[0]} alt="" className="aspect-video w-full object-cover" />
          </div>
        )}
        {/* Reactions */}
        <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-500">
          <span>👍</span><span>💡</span><span>❤️</span>
          <span className="ml-1">0</span>
        </div>
        <div className="mt-2 flex items-center gap-4 border-t border-white/5 pt-2 text-slate-500">
          <button className="flex items-center gap-1 text-[10px] hover:text-white"><ThumbsUp className="h-3 w-3" /> Like</button>
          <button className="flex items-center gap-1 text-[10px] hover:text-white"><MessageCircle className="h-3 w-3" /> Comment</button>
          <button className="flex items-center gap-1 text-[10px] hover:text-white"><Repeat2 className="h-3 w-3" /> Repost</button>
          <button className="flex items-center gap-1 text-[10px] hover:text-white"><Send className="h-3 w-3" /> Send</button>
        </div>
      </div>
      <ActionBar post={post} onSave={onSave} />
    </div>
  );
}

// ─── Reddit Preview ─────────────────────────────────────────────

export function RedditPostPreview({ post, brandName, onContentChange, onSave }: PreviewCardProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2" style={{ background: PLATFORM_STYLES.reddit.bg }}>
        <span className="text-sm" style={{ color: PLATFORM_STYLES.reddit.accent }}>{PLATFORM_STYLES.reddit.icon}</span>
        <span className="text-xs font-semibold" style={{ color: PLATFORM_STYLES.reddit.accent }}>{PLATFORM_STYLES.reddit.label}</span>
      </div>

      <div className="flex">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 border-r border-white/5 px-3 py-4">
          <ArrowBigUp className="h-5 w-5 text-slate-500 hover:text-orange-400 cursor-pointer" />
          <span className="text-xs font-bold text-slate-400">1</span>
          <ArrowBigDown className="h-5 w-5 text-slate-500 hover:text-blue-400 cursor-pointer" />
        </div>

        <div className="flex-1 p-4">
          <p className="text-[10px] text-slate-600">
            r/startup · Posted by u/{(brandName ?? "brand").toLowerCase().replace(/\s/g, "_")} · just now
          </p>
          <textarea
            value={post.content}
            onChange={(e) => onContentChange(e.target.value)}
            className="mt-2 w-full resize-none border-0 bg-transparent p-0 text-xs leading-relaxed text-slate-300 focus:outline-none focus:ring-0"
            rows={Math.max(3, Math.ceil(post.content.length / 65))}
          />
          {post.mediaUrls[0] && (
            <div className="mt-3 overflow-hidden border border-white/10">
              <img src={post.mediaUrls[0]} alt="" className="aspect-video w-full object-cover" />
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
            <button className="flex items-center gap-1 hover:text-white"><MessageCircle className="h-3 w-3" /> 0 Comments</button>
            <button className="flex items-center gap-1 hover:text-white"><Share className="h-3 w-3" /> Share</button>
            <button className="flex items-center gap-1 hover:text-white"><Bookmark className="h-3 w-3" /> Save</button>
          </div>
        </div>
      </div>
      <ActionBar post={post} onSave={onSave} />
    </div>
  );
}

// ─── TikTok Preview ─────────────────────────────────────────────

export function TikTokPostPreview({ post, brandName, onContentChange, onSave }: PreviewCardProps) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2" style={{ background: PLATFORM_STYLES.tiktok.bg }}>
        <span className="text-sm" style={{ color: PLATFORM_STYLES.tiktok.accent }}>{PLATFORM_STYLES.tiktok.icon}</span>
        <span className="text-xs font-semibold" style={{ color: PLATFORM_STYLES.tiktok.accent }}>{PLATFORM_STYLES.tiktok.label}</span>
      </div>

      <div className="relative">
        {/* Image / video placeholder */}
        {post.mediaUrls[0] ? (
          <div className="relative">
            <img src={post.mediaUrls[0]} alt="" className="aspect-[9/16] max-h-[400px] w-full object-cover" />
            {/* Overlaid engagement */}
            <div className="absolute bottom-0 right-0 flex flex-col items-center gap-4 p-3">
              <div className="flex flex-col items-center">
                <Heart className="h-7 w-7 text-white drop-shadow" />
                <span className="text-[10px] font-bold text-white drop-shadow">0</span>
              </div>
              <div className="flex flex-col items-center">
                <MessageCircle className="h-7 w-7 text-white drop-shadow" />
                <span className="text-[10px] font-bold text-white drop-shadow">0</span>
              </div>
              <div className="flex flex-col items-center">
                <Bookmark className="h-7 w-7 text-white drop-shadow" />
                <span className="text-[10px] font-bold text-white drop-shadow">0</span>
              </div>
              <div className="flex flex-col items-center">
                <Share className="h-7 w-7 text-white drop-shadow" />
                <span className="text-[10px] font-bold text-white drop-shadow">0</span>
              </div>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30" style={{ animationDuration: "3s" }}>
                <Music className="m-auto mt-1 h-4 w-4 text-white" />
              </div>
            </div>
            {/* Bottom text overlay */}
            <div className="absolute bottom-0 left-0 right-14 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
              <p className="text-xs font-bold text-white">@{(brandName ?? "brand").toLowerCase().replace(/\s/g, "")}</p>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[9/16] max-h-[300px] items-center justify-center bg-black/30">
            <Music className="h-10 w-10 text-slate-700" />
          </div>
        )}
        {/* Caption (editable below) */}
        <div className="p-4">
          <textarea
            value={post.content}
            onChange={(e) => onContentChange(e.target.value)}
            className="w-full resize-none border-0 bg-transparent p-0 text-xs text-slate-300 focus:outline-none focus:ring-0"
            rows={Math.max(2, Math.ceil(post.content.length / 55))}
          />
          {post.hashtags.length > 0 && (
            <p className="mt-1 text-xs" style={{ color: PLATFORM_STYLES.tiktok.accent + "99" }}>
              {post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
            </p>
          )}
        </div>
      </div>
      <ActionBar post={post} onSave={onSave} />
    </div>
  );
}

// ─── Router ─────────────────────────────────────────────────────

export function PlatformPreviewCard(props: PreviewCardProps) {
  switch (props.post.platform) {
    case "x": return <XPostPreview {...props} />;
    case "meta": return <InstagramPostPreview {...props} />;
    case "linkedin": return <LinkedInPostPreview {...props} />;
    case "reddit": return <RedditPostPreview {...props} />;
    case "tiktok": return <TikTokPostPreview {...props} />;
    default: return <XPostPreview {...props} />;
  }
}
