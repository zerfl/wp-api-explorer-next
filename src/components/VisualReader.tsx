"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Calendar,
  Check,
  Copy,
  Download,
  File,
  FileCode,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  Music4,
  User,
} from "lucide-react";
import { CSSProperties, useMemo, useState } from "react";

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
    "wp:term"?: Array<
      Array<{
        id: number;
        name: string;
        taxonomy: string;
      }>
    >;
  };
}

interface WpMediaEntity {
  id: number;
  date: string;
  mime_type?: string;
  link?: string;
  source_url?: string;
  guid?: { rendered: string };
  alt_text?: string;
  title?: { rendered: string };
  media_type?: string;
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

  const items = useMemo(
    () => (Array.isArray(data) ? data : data ? [data] : []) as Record<string, unknown>[],
    [data]
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center space-y-2.5 rounded-lg border border-dashed border-border/60 bg-card/10 py-12 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/70" aria-hidden="true" />
        <h4 className="text-base font-semibold text-foreground">No records returned</h4>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
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

  const isPostLike =
    /\/(posts|pages|posts\/.*|pages\/.*)$/i.test(routePath) ||
    (items[0] &&
      typeof items[0] === "object" &&
      "title" in items[0] &&
      "link" in items[0] &&
      !("mime_type" in items[0]));

  const isMedia =
    /\/(media|media\/.*)$/i.test(routePath) ||
    (items[0] &&
      typeof items[0] === "object" &&
      "mime_type" in items[0] &&
      "media_details" in items[0]);

  const isComment =
    /\/(comments|comments\/.*)$/i.test(routePath) ||
    (items[0] &&
      typeof items[0] === "object" &&
      "post" in items[0] &&
      "author_name" in items[0] &&
      "content" in items[0] &&
      !("title" in items[0]));

  const isUser =
    /\/(users|users\/.*)$/i.test(routePath) ||
    (items[0] &&
      typeof items[0] === "object" &&
      "slug" in items[0] &&
      "avatar_urls" in items[0]);

  if (isPostLike) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {items.map((rawPost) => {
          const post = rawPost as unknown as WpPostEntity;
          const author = post._embedded?.author?.[0];
          const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];
          const terms = post._embedded?.["wp:term"] || [];
          const title = post.title?.rendered || `Entry #${post.id}`;
          const excerpt = post.excerpt?.rendered || "";
          const featuredImgUrl =
            featuredMedia?.media_details?.sizes?.medium?.source_url ||
            featuredMedia?.source_url ||
            featuredMedia?.media_details?.sizes?.full?.source_url;
          const categories = terms.flatMap((taxList) =>
            taxList.filter((term) => term.taxonomy === "category")
          );

          return (
            <Card
              key={post.id}
              className="group flex flex-col overflow-hidden border-border/60 bg-card/30 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              {featuredImgUrl ? (
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featuredImgUrl}
                    alt={featuredMedia?.alt_text || "Featured media"}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {categories.length > 0 ? (
                    <div className="absolute left-3 top-3 flex max-w-[90%] flex-wrap gap-1.5">
                      {categories.slice(0, 2).map((category) => (
                        <Badge
                          key={category.id}
                          className="bg-primary/95 px-2 py-0.5 text-xs font-semibold text-primary-foreground"
                        >
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="relative flex h-24 w-full items-center justify-center border-b border-border/20 bg-gradient-to-r from-primary/10 to-accent/10">
                  <FileText className="h-7 w-7 text-muted-foreground/30" />
                  {categories.length > 0 ? (
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      {categories.slice(0, 2).map((category) => (
                        <Badge
                          key={category.id}
                          className="bg-primary/95 px-2 py-0.5 text-xs font-semibold text-primary-foreground"
                        >
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <CardHeader className="space-y-2 p-5 pb-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{formatDate(post.date)}</span>
                  {post.status ? (
                    <Badge
                      variant="outline"
                      className={`ml-auto py-0.5 text-xs font-semibold uppercase ${
                        post.status === "publish"
                          ? "border-green-500/30 bg-green-500/5 text-green-500"
                          : "border-yellow-500/30 text-yellow-500"
                      }`}
                    >
                      {post.status}
                    </Badge>
                  ) : null}
                </div>

                {post.link ? (
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-base font-semibold leading-snug text-foreground transition-colors hover:text-primary"
                    dangerouslySetInnerHTML={{ __html: cleanHtml(title) }}
                  />
                ) : (
                  <h4
                    className="text-base font-semibold leading-snug text-foreground"
                    dangerouslySetInnerHTML={{ __html: cleanHtml(title) }}
                  />
                )}
              </CardHeader>

              <CardContent className="flex-1 p-5 pt-0">
                {excerpt ? (
                  <div
                    className="line-clamp-3 text-sm leading-relaxed text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: cleanHtml(excerpt) }}
                  />
                ) : (
                  <p className="text-sm italic text-muted-foreground/70">
                    No description excerpt available.
                  </p>
                )}
              </CardContent>

              <CardFooter className="mt-3 flex items-center justify-between border-t border-border/20 bg-card/10 p-5 pt-0">
                <div className="mt-3.5 flex items-center gap-2">
                  {author?.avatar_urls?.["24"] || author?.avatar_urls?.["48"] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={author.avatar_urls["48"] || author.avatar_urls["24"]}
                      alt={author.name}
                      className="h-6 w-6 rounded-full border border-border/60 object-cover"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-foreground/80">
                    {author?.name || "Author"}
                  </span>
                </div>

                {post.link ? (
                  <div className="mt-3.5 flex items-center gap-1.5">
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-primary"
                      aria-label="View original post (opens in a new tab)"
                    >
                      <LinkIcon className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  }

  if (isMedia) {
    const mediaItems = items as unknown as WpMediaEntity[];

    return (
      <>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
          {mediaItems.map((media) => {
            const mime = media.mime_type || "";
            const mediaKind = getMediaKind(media);
            const srcUrl = media.source_url || media.guid?.rendered || "";
            const previewUrl =
              media.media_details?.sizes?.medium?.source_url ||
              media.media_details?.sizes?.thumbnail?.source_url ||
              srcUrl;
            const title = media.title?.rendered || `Media #${media.id}`;
            const aspectRatio = getAspectRatioStyle(media);

            return (
              <Card
                key={media.id}
                className="group flex flex-col overflow-hidden border-border/60 bg-card/30 shadow-md transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <a
                  href={srcUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block border-b border-border/20 bg-background/50 text-left"
                >
                  <div
                    className="flex w-full items-center justify-center overflow-hidden bg-slate-950/30"
                    style={aspectRatio}
                  >
                    {mediaKind === "image" && previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={previewUrl}
                        alt={media.alt_text || title}
                        className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : mediaKind === "video" && srcUrl ? (
                      <video
                        src={srcUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="h-full w-full object-contain p-3"
                      />
                    ) : mediaKind === "audio" ? (
                      <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
                        <Music4 className="h-12 w-12 text-primary/80" />
                        <div className="text-base font-semibold text-foreground">Audio file</div>
                        {srcUrl ? <audio controls src={srcUrl} className="w-full max-w-[260px]" /> : null}
                      </div>
                    ) : mediaKind === "document" ? (
                      <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 p-6 text-center">
                        <FileText className="h-12 w-12 text-primary/80" />
                        <div className="text-base font-semibold text-foreground">Document preview</div>
                        <div className="text-sm text-muted-foreground">{mime || "application/pdf"}</div>
                      </div>
                    ) : (
                      <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 p-6 text-center">
                        <File className="h-12 w-12 text-primary/80" />
                        <div className="text-base font-semibold text-foreground">File preview</div>
                        <div className="text-sm text-muted-foreground">{mime || "Unknown type"}</div>
                      </div>
                    )}
                  </div>

                  <Badge className="absolute bottom-3 right-3 bg-black/75 px-2 py-0.5 text-xs text-white hover:bg-black/90">
                    {mime || media.media_type || "file"}
                  </Badge>
                </a>

                <CardContent className="flex flex-1 flex-col justify-between space-y-3 p-4">
                  <div className="space-y-1.5">
                    <span
                      className="block truncate text-base font-semibold text-foreground"
                      title={title}
                      dangerouslySetInnerHTML={{ __html: cleanHtml(title) }}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(media.date)}</span>
                      {media.media_details?.width && media.media_details?.height ? (
                        <span className="font-mono">
                          {media.media_details.width}x{media.media_details.height}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/10 pt-3">
                    <a
                      href={srcUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Open file
                    </a>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleCopyUrl(srcUrl)}
                        aria-label={copiedUrl === srcUrl ? "File URL copied" : "Copy file URL"}
                      >
                        {copiedUrl === srcUrl ? (
                          <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                      <a
                        href={srcUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background/80 hover:text-foreground"
                        aria-label="Download file (opens in a new tab)"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </>
    );
  }

  if (isComment) {
    return (
      <div className="space-y-4">
        {items.map((rawComment) => {
          const comment = rawComment as unknown as WpCommentEntity;
          return (
            <Card
              key={comment.id}
              className="border-border/60 bg-card/20 shadow-sm transition-colors hover:border-primary/25"
            >
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-border/10 bg-card/10 p-4 pb-2.5">
                {comment.author_avatar_urls?.["48"] || comment.author_avatar_urls?.["24"] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={comment.author_avatar_urls["48"] || comment.author_avatar_urls["24"]}
                    alt={comment.author_name}
                    className="h-10 w-10 rounded-full border border-border/45 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4.5 w-4.5 text-primary" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-base font-semibold text-foreground">
                    {comment.author_name || "Anonymous"}
                  </h4>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {formatDate(comment.date)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {comment.status ? (
                    <Badge
                      className={`text-xs font-semibold uppercase ${
                        comment.status === "approved" || comment.status === "approve"
                          ? "border border-green-500/20 bg-green-500/10 text-green-500"
                          : "border border-yellow-500/20 bg-yellow-500/10 text-yellow-500"
                      }`}
                    >
                      {comment.status}
                    </Badge>
                  ) : null}
                  {comment.post ? (
                    <Badge variant="outline" className="border-border/50 font-mono text-xs">
                      Post ID: {comment.post}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="prose max-w-none p-4 pt-3 text-sm leading-relaxed text-foreground/80 dark:prose-invert">
                <div dangerouslySetInnerHTML={{ __html: cleanHtml(comment.content?.rendered || "") }} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
        {items.map((rawUser) => {
          const user = rawUser as unknown as WpUserEntity;
          const avatarUrl = user.avatar_urls?.["96"] || user.avatar_urls?.["48"] || user.avatar_urls?.["24"];
          return (
            <Card
              key={user.id}
              className="flex flex-col items-center border-border/60 bg-card/30 p-5 text-center shadow-sm transition-all hover:border-primary/30"
            >
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="mb-3.5 h-16 w-16 rounded-full border border-border/80 object-cover shadow-inner"
                />
              ) : (
                <div className="mb-3.5 flex h-16 w-16 items-center justify-center rounded-full border border-border/60 bg-primary/10 shadow-inner">
                  <User className="h-8 w-8 text-primary" />
                </div>
              )}

              {user.link ? (
                <a
                  href={user.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold leading-snug text-foreground transition-colors hover:text-primary"
                >
                  {user.name}
                </a>
              ) : (
                <h4 className="text-base font-semibold leading-snug text-foreground">{user.name}</h4>
              )}

              <code className="mt-0.5 block text-xs text-muted-foreground">@{user.slug || user.username}</code>

              {user.description ? (
                <p className="mt-3.5 w-full border-t border-border/10 pt-3 text-sm leading-relaxed text-muted-foreground/80 line-clamp-3">
                  {user.description}
                </p>
              ) : (
                <p className="mt-3.5 w-full border-t border-border/10 pt-3 text-sm italic leading-relaxed text-muted-foreground/50">
                  No bio description provided.
                </p>
              )}

              {user.link ? (
                <a
                  href={user.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-1 pt-3.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Profile link
                </a>
              ) : null}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/25 p-4">
        <FileCode className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground/60" />
        <div className="space-y-1.5">
          <h4 className="text-base font-semibold text-foreground">Custom endpoint inspection</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This endpoint returned {items.length} records. Use the Data Grid or Raw JSON tabs for deeper inspection.
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {items.slice(0, 5).map((item, idx: number) => {
          const keys = typeof item === "object" && item !== null ? Object.keys(item) : [];
          return (
            <Card key={idx} className="border-border/60 bg-card/20 p-4">
              <span className="mb-2.5 block font-mono text-xs font-semibold text-primary">
                Record #{idx + 1} {"id" in item ? `(ID: ${String(item.id)})` : ""}
              </span>
              <div className="grid grid-cols-1 gap-3 border-t border-border/10 pt-3 sm:grid-cols-2 md:grid-cols-3">
                {keys.slice(0, 9).map((key) => {
                  const rawValue = item[key];
                  const displayValue =
                    typeof rawValue === "object" && rawValue !== null
                      ? JSON.stringify(rawValue)
                      : String(rawValue);
                  return (
                    <div key={key} className="min-w-0 rounded border border-border/20 bg-background/30 p-2 text-sm">
                      <span className="mb-0.5 block truncate font-semibold text-foreground/80">{key}</span>
                      <span
                        className="block truncate font-mono text-xs text-muted-foreground"
                        title={displayValue}
                      >
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
                {keys.length > 9 ? (
                  <div className="flex items-center justify-center rounded border border-dashed border-primary/20 bg-primary/5 p-2 text-sm font-medium text-primary">
                    + {keys.length - 9} more properties
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
        {items.length > 5 ? (
          <div className="text-center text-sm text-muted-foreground">
            Showing first 5 of {items.length} records. View other tabs for complete data.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getMediaKind(media: WpMediaEntity): "image" | "video" | "audio" | "document" | "file" {
  const mime = media.mime_type || "";

  if (mime.startsWith("image/")) {
    return "image";
  }

  if (mime.startsWith("video/")) {
    return "video";
  }

  if (mime.startsWith("audio/")) {
    return "audio";
  }

  if (mime === "application/pdf") {
    return "document";
  }

  return "file";
}

function getAspectRatioStyle(media: WpMediaEntity): CSSProperties {
  const width = media.media_details?.width;
  const height = media.media_details?.height;

  if (width && height) {
    return {
      aspectRatio: `${width} / ${height}`,
      minHeight: "220px",
    };
  }

  return {
    aspectRatio: "16 / 10",
    minHeight: "220px",
  };
}
