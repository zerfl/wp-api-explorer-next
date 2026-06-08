"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar,
  Check,
  Copy,
  Download,
  Eye,
  FileCode,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  PlayCircle,
  User
} from "lucide-react";
import { useState } from "react";

interface WpPostEntity {
  id: number;
  date: string;
  status?: string;
  link?: string;
  title?: { rendered: string };
  content?: { rendered: string };
  excerpt?: { rendered: string };
  _embedded?: {
    author?: Array<{
      name: string;
      avatar_urls?: Record<string, string>;
    }>;
    "wp:featuredmedia"?: Array<{
      source_url: string;
      alt_text?: string;
      media_details?: {
        sizes?: Record<string, { source_url: string }>;
      };
    }>;
    "wp:term"?: Array<Array<{
      id: number;
      name: string;
      taxonomy: string;
    }>>;
  };
}

interface WpMediaEntity {
  id: number;
  date: string;
  mime_type?: string;
  source_url?: string;
  guid?: { rendered: string };
  alt_text?: string;
  title?: { rendered: string };
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url: string }>;
  };
}

interface WpCommentEntity {
  id: number;
  date: string;
  status?: string;
  post?: number;
  author_name?: string;
  content?: { rendered: string };
  author_avatar_urls?: Record<string, string>;
}

interface WpUserEntity {
  id: number;
  name?: string;
  slug?: string;
  username?: string;
  description?: string;
  link?: string;
  avatar_urls?: Record<string, string>;
}

interface VisualReaderProps {
  data: unknown;
  routePath: string;
}

export default function VisualReader({ data, routePath }: VisualReaderProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<WpMediaEntity | null>(null);

  // Normalizing data as an array
  const items = (Array.isArray(data) ? data : data ? [data] : []) as Record<string, unknown>[];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/60 rounded-lg bg-card/10 text-center space-y-2.5">
        <MessageSquare className="h-10 w-10 text-muted-foreground/55" />
        <h4 className="text-sm font-semibold text-foreground">No records returned</h4>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          The query completed successfully but returned an empty dataset. Try adjusting your parameters.
        </p>
      </div>
    );
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const cleanHtml = (html: string) => {
    if (!html) return "";
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Determine renderer based on route path
  const isPostOrPage = /\/(posts|pages|posts\/.*|pages\/.*)$/i.test(routePath) || 
                       (items[0] && typeof items[0] === "object" && "title" in items[0] && "excerpt" in items[0]);
  
  const isMedia = /\/(media|media\/.*)$/i.test(routePath) || 
                  (items[0] && typeof items[0] === "object" && "mime_type" in items[0] && "media_details" in items[0]);

  const isComment = /\/(comments|comments\/.*)$/i.test(routePath) ||
                    (items[0] && typeof items[0] === "object" && "post" in items[0] && "author_name" in items[0] && "content" in items[0] && !("title" in items[0]));

  const isUser = /\/(users|users\/.*)$/i.test(routePath) ||
                 (items[0] && typeof items[0] === "object" && "slug" in items[0] && "avatar_urls" in items[0]);

  // 1. POSTS & PAGES RENDERER
  if (isPostOrPage) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {items.map((rawPost) => {
          const post = rawPost as unknown as WpPostEntity;
          const author = post._embedded?.author?.[0];
          const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];
          const terms = post._embedded?.["wp:term"] || [];
          
          const title = post.title?.rendered || `Post #${post.id}`;
          const excerpt = post.excerpt?.rendered || "";
          
          const featuredImgUrl = featuredMedia?.source_url || 
            featuredMedia?.media_details?.sizes?.medium?.source_url || 
            featuredMedia?.media_details?.sizes?.full?.source_url;

          const categories = terms.flatMap((taxList) => 
            taxList.filter((term) => term.taxonomy === "category")
          );

          return (
            <Card key={post.id} className="border-border/60 hover:border-primary/40 bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-0.5 shadow-md hover:shadow-lg group">
              {/* Featured Image */}
              {featuredImgUrl ? (
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featuredImgUrl}
                    alt={featuredMedia.alt_text || "Featured media"}
                    className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-500"
                  />
                  {categories.length > 0 && (
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[90%]">
                      {categories.slice(0, 2).map((cat) => (
                        <Badge key={cat.id} className="bg-primary/95 text-primary-foreground text-xs hover:bg-primary px-2 py-0.5 font-bold shadow-sm">
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative h-24 w-full bg-gradient-to-r from-primary/10 to-accent/10 flex items-center justify-center border-b border-border/20">
                  <FileText className="h-7 w-7 text-muted-foreground/30" />
                  {categories.length > 0 && (
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {categories.slice(0, 2).map((cat) => (
                        <Badge key={cat.id} className="bg-primary/95 text-primary-foreground text-xs px-2 py-0.5 font-bold">
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <CardHeader className="p-5 pb-2.5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDate(post.date)}</span>
                  {post.status && (
                    <Badge variant="outline" className={`text-xs uppercase font-bold py-0.5 ml-auto ${
                      post.status === "publish" ? "border-green-500/30 text-green-500 bg-green-500/5" : "border-yellow-500/30 text-yellow-500"
                    }`}>
                      {post.status}
                    </Badge>
                  )}
                </div>
                
                <h4 
                  className="text-base font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors cursor-pointer"
                  dangerouslySetInnerHTML={{ __html: cleanHtml(title) }}
                />
              </CardHeader>

              <CardContent className="p-5 pt-0 flex-1">
                {excerpt ? (
                  <div 
                    className="text-sm text-muted-foreground line-clamp-3 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: cleanHtml(excerpt) }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground/60 italic">No description excerpt available.</p>
                )}
              </CardContent>

              <CardFooter className="p-5 pt-0 border-t border-border/20 mt-3 flex items-center justify-between bg-card/10">
                {/* Author Info */}
                <div className="flex items-center gap-2 mt-3.5">
                  {author?.avatar_urls?.["24"] || author?.avatar_urls?.["48"] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={author.avatar_urls["48"] || author.avatar_urls["24"]}
                      alt={author.name}
                      className="h-6 w-6 rounded-full object-cover border border-border/60"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-foreground/80">
                    {author?.name || "Author"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-3.5">
                  {post.link && (
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded hover:bg-background"
                      title="View original link"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  }

  // 2. MEDIA RENDERER
  if (isMedia) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(420px,1fr))] gap-5">
        {items.map((rawMedia) => {
          const media = rawMedia as unknown as WpMediaEntity;
          const mime = media.mime_type || "";
          const isImg = mime.startsWith("image/");
          const isVideo = mime.startsWith("video/");
          const isAudio = mime.startsWith("audio/");
          
          const srcUrl = media.source_url || media.guid?.rendered || "";
          const thumbnail = media.media_details?.sizes?.medium?.source_url || 
                            media.media_details?.sizes?.thumbnail?.source_url || 
                            srcUrl;

          return (
            <Card key={media.id} className="border-border/60 hover:border-primary/40 bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col group transition-all shadow-md hover:shadow-lg">
              {/* Media Preview Area */}
              <div className="relative aspect-video w-full bg-background/50 flex items-center justify-center overflow-hidden border-b border-border/20">
                {isImg && srcUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbnail}
                    alt={media.alt_text || media.title?.rendered}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                    onClick={() => setActiveMedia(media)}
                  />
                ) : isVideo ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/60 w-full h-full bg-slate-950/20">
                    <PlayCircle className="h-9 w-9 text-primary/80 animate-pulse" />
                    <span className="text-xs font-semibold mt-1">Video</span>
                  </div>
                ) : isAudio ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/60 w-full h-full">
                    <MessageSquare className="h-9 w-9 text-indigo-500/80" />
                    <span className="text-xs font-semibold mt-1">Audio</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/60 w-full h-full">
                    <FileText className="h-9 w-9 text-muted-foreground/50" />
                    <span className="text-xs font-semibold mt-1">File</span>
                  </div>
                )}

                <Badge className="absolute bottom-2 right-2 bg-black/75 hover:bg-black/90 text-white text-[10px] font-mono px-1.5 py-0.5 border-none">
                  {mime.split("/")[1] || "file"}
                </Badge>
              </div>

              <CardContent className="p-3 flex-1 flex flex-col justify-between space-y-2">
                <span className="text-xs font-bold text-foreground truncate block" title={media.title?.rendered}>
                  {media.title?.rendered || `Media #${media.id}`}
                </span>
                
                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/10">
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[60%]">
                    {media.media_details?.width && media.media_details?.height 
                      ? `${media.media_details.width}x${media.media_details.height}`
                      : formatDate(media.date)
                    }
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {isImg && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setActiveMedia(media)}
                        title="View Fullscreen"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyUrl(srcUrl)}
                      title="Copy URL"
                    >
                      {copiedUrl === srcUrl ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <a
                      href={srcUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-background/80"
                      title="Download File"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Media Inspect Dialog */}
        {activeMedia && (
          <Dialog open={!!activeMedia} onOpenChange={() => setActiveMedia(null)}>
            <DialogContent className="max-w-2xl bg-card border border-border shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold truncate">
                  {activeMedia.title?.rendered || "Media Preview"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {activeMedia.mime_type} - {activeMedia.media_details?.width}x{activeMedia.media_details?.height}
                </DialogDescription>
              </DialogHeader>
              <div className="relative aspect-video max-h-[60vh] w-full bg-slate-950 flex items-center justify-center rounded-md overflow-hidden border border-border/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeMedia.source_url}
                  alt={activeMedia.alt_text || "Preview"}
                  className="object-contain max-h-full max-w-full"
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs border-t border-border/20 pt-3 mt-1">
                <div className="truncate max-w-[70%] font-mono text-[10px] text-muted-foreground">
                  {activeMedia.source_url}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleCopyUrl(activeMedia.source_url || "")}
                  className="gap-1.5 shrink-0"
                >
                  {copiedUrl === (activeMedia.source_url || "") ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy Link
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // 3. COMMENTS RENDERER
  if (isComment) {
    return (
      <div className="space-y-4">
        {items.map((rawComment) => {
          const comment = rawComment as unknown as WpCommentEntity;
          return (
            <Card key={comment.id} className="border-border/60 bg-card/20 backdrop-blur-sm shadow-sm hover:border-primary/25 transition-colors">
              <CardHeader className="p-4 pb-2.5 flex flex-row items-center gap-3 space-y-0 border-b border-border/10 bg-card/10">
                {comment.author_avatar_urls?.["48"] || comment.author_avatar_urls?.["24"] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={comment.author_avatar_urls["48"] || comment.author_avatar_urls["24"]}
                  alt={comment.author_name}
                  className="h-10 w-10 rounded-full border border-border/45 object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4.5 w-4.5 text-primary" />
                </div>
              )}
              
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-foreground truncate">
                  {comment.author_name || "Anonymous"}
                </h4>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {formatDate(comment.date)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {comment.status && (
                  <Badge className={`text-[10px] font-bold uppercase ${
                    comment.status === "approved" || comment.status === "approve"
                      ? "bg-green-500/10 text-green-500 border border-green-500/20"
                      : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                  }`}>
                    {comment.status}
                  </Badge>
                )}
                {comment.post && (
                  <Badge variant="outline" className="text-[10px] font-mono border-border/50">
                    Post ID: {comment.post}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4.5 pt-3 text-sm text-foreground/80 leading-relaxed font-sans max-w-none prose dark:prose-invert">
              <div dangerouslySetInnerHTML={{ __html: cleanHtml(comment.content?.rendered || "") }} />
            </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // 4. USERS RENDERER
  if (isUser) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {items.map((rawUser) => {
          const user = rawUser as unknown as WpUserEntity;
          const avatarUrl = user.avatar_urls?.["96"] || user.avatar_urls?.["48"] || user.avatar_urls?.["24"];
          return (
            <Card key={user.id} className="border-border/60 bg-card/30 backdrop-blur-sm p-5 hover:border-primary/30 transition-all flex flex-col items-center text-center shadow-sm">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="h-16 w-16 rounded-full object-cover border border-border/80 shadow-inner mb-3.5"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border border-border/60 mb-3.5 shadow-inner">
                  <User className="h-8 w-8 text-primary" />
                </div>
              )}

              <h4 className="text-sm font-bold text-foreground leading-snug">{user.name}</h4>
              <code className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                @{user.slug || user.username}
              </code>
              
              {user.description ? (
                <p className="text-xs text-muted-foreground/80 leading-relaxed mt-3.5 border-t border-border/10 pt-3 w-full line-clamp-3">
                  {user.description}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/40 italic leading-relaxed mt-3.5 border-t border-border/10 pt-3 w-full">
                  No bio description provided.
                </p>
              )}

              {user.link && (
                <a
                  href={user.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-auto pt-3.5"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Profile Link
                </a>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  // 5. FALLBACK / CUSTOM / SCHEMA RENDERER
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/40 bg-card/25 p-4 flex items-start gap-3">
        <FileCode className="h-6 w-6 text-muted-foreground/60 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold text-foreground">Custom Endpoint Inspection</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This endpoint returned {items.length} records. Below is a structured summary of the properties in the response payload. Use the **Data Grid** or **Raw JSON** tabs for deep inspections.
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {items.slice(0, 5).map((item, idx: number) => {
          const keys = typeof item === "object" && item !== null ? Object.keys(item) : [];
          return (
            <Card key={idx} className="border-border/60 bg-card/20 backdrop-blur-sm p-4">
              <span className="text-xs font-bold text-primary font-mono block mb-2.5">
                Record #{idx + 1} {item.id ? `(ID: ${item.id})` : ""}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 border-t border-border/10 pt-3">
                {keys.slice(0, 9).map((key) => {
                  const val = item[key];
                  const displayVal = typeof val === "object" && val !== null
                    ? JSON.stringify(val)
                    : String(val);
                  return (
                    <div key={key} className="text-xs min-w-0 bg-background/30 p-2 rounded border border-border/20">
                      <span className="font-bold text-foreground/80 truncate block mb-0.5">{key}</span>
                      <span className="text-muted-foreground truncate block font-mono text-[10px]" title={displayVal}>
                        {displayVal}
                      </span>
                    </div>
                  );
                })}
                {keys.length > 9 && (
                  <div className="text-xs flex items-center justify-center bg-primary/5 p-2 rounded border border-dashed border-primary/20 text-primary font-medium">
                    + {keys.length - 9} more properties
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        {items.length > 5 && (
          <div className="text-center text-xs text-muted-foreground">
            Showing first 5 of {items.length} records. View other tabs for complete data.
          </div>
        )}
      </div>
    </div>
  );
}
