"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderOpen, Clock, AlertTriangle, ChevronDown, ChevronUp, FileText, File, MessageSquare, Send, Loader2, Eye, Download, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { MentionBody } from "@/components/shared/mention-textarea";

type PortalCase = {
  _id: string;
  caseNumber: string;
  title: string;
  visaType: string;
  status: string;
  priority: string;
  deadline: number | null;
  assigneeName: string | null;
  updatedAt: number;
};

type ExternalComment = {
  _id: string;
  body: string;
  authorName: string;
  isCurrentClient: boolean;
  createdAt: number;
};

type PortalDocument = {
  _id: string;
  name: string;
  status: string;
  mimeType: string;
};

type CaseDetail = {
  notes: string | null;
  documents: PortalDocument[];
  externalComments: ExternalComment[];
};

const priorityStyle: Record<string, string> = {
  Low:    "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
  Medium: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  High:   "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  Urgent: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
};

const statusDot: Record<string, string> = {
  Active:        "bg-emerald-500",
  "In Progress": "bg-blue-500",
  "On Hold":     "bg-amber-500",
  "In Review":   "bg-violet-500",
  Completed:     "bg-emerald-500",
  Archived:      "bg-slate-400",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Portal Document Viewer ───────────────────────────────────────────────────

type DocViewerDoc = { _id: string; name: string; mimeType: string };

function PortalDocViewer({ doc, onClose }: { doc: DocViewerDoc; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const isImage = doc.mimeType.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";

  useEffect(() => {
    fetch(`/api/portal/document-url?docId=${encodeURIComponent(doc._id)}`)
      .then((r) => r.json())
      .then((data) => { if (data.url) setUrl(data.url); })
      .finally(() => setLoading(false));
  }, [doc._id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1 truncate">{doc.name}</span>
        {(isImage || isPdf) && url && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Reset zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}
        {url && (
          <a
            href={url}
            download={doc.name}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-6 bg-muted/20">
        {loading ? (
          <div className="flex items-center justify-center w-full h-full">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : !url ? (
          <div className="text-center text-muted-foreground py-20">
            <p className="font-medium">Could not load document</p>
          </div>
        ) : isImage ? (
          <img
            src={url}
            alt={doc.name}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s" }}
            className="max-w-full rounded-lg shadow-md"
          />
        ) : isPdf ? (
          <iframe
            src={url}
            title={doc.name}
            className="w-full border-0 rounded-lg shadow-md"
            style={{ height: `${zoom * 100}%`, minHeight: "100%", transition: "height 0.15s" }}
          />
        ) : (
          <div className="text-center text-muted-foreground py-20 space-y-4">
            <FileText className="h-12 w-12 mx-auto opacity-30" />
            <div>
              <p className="font-medium text-foreground">Preview not available</p>
              <p className="text-sm mt-1">This file type cannot be previewed in the browser.</p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Open / Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Portal Doc Attachment Preview ───────────────────────────────────────────

function PortalDocAttachmentPreview({ docId, name, mimeType }: { docId: string; name: string; mimeType: string }) {
  const [viewerDoc, setViewerDoc] = useState<DocViewerDoc | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  // Pre-fetch thumbnail URL for images
  useEffect(() => {
    if (!isImage) return;
    fetch(`/api/portal/document-url?docId=${encodeURIComponent(docId)}`)
      .then((r) => r.json())
      .then((data) => { if (data.url) setThumbUrl(data.url); });
  }, [docId, isImage]);

  return (
    <>
      <div
        className="inline-flex flex-col mt-2 cursor-pointer rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors bg-background max-w-xs"
        onClick={() => setViewerDoc({ _id: docId, name, mimeType })}
        title={`Click to view ${name}`}
      >
        {isImage ? (
          thumbUrl ? (
            <>
              <img src={thumbUrl} alt={name} className="max-h-48 w-auto object-cover" />
              <div className="px-3 py-1.5 border-t bg-muted/20 flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{name}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 w-48 bg-muted/40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )
        ) : (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
              {isPdf
                ? <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                : <File className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{name}</p>
              <p className="text-xs text-muted-foreground">
                {isPdf ? "PDF Document" : "Document"} · Click to view
              </p>
            </div>
          </div>
        )}
      </div>
      {viewerDoc && <PortalDocViewer doc={viewerDoc} onClose={() => setViewerDoc(null)} />}
    </>
  );
}

// ─── Case Detail Panel ────────────────────────────────────────────────────────

function CaseDetailPanel({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<DocViewerDoc | null>(null);

  const fetchDetail = useCallback((showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    fetch(`/api/portal/cases/detail?caseId=${encodeURIComponent(caseId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setDetail(data.detail ?? null);
      })
      .catch(() => setError("Failed to load case details."))
      .finally(() => { if (showSpinner) setLoading(false); });
  }, [caseId]);

  // Initial load (with spinner) + poll every 8 s for new comments
  useEffect(() => {
    fetchDetail(true);
    const interval = setInterval(() => fetchDetail(false), 8000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  const handleSubmitComment = async () => {
    const body = commentBody.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/cases/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, body }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setCommentBody("");
      fetchDetail(false);
    } catch {
      setError("Failed to submit comment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !detail) {
    return <p className="text-sm text-red-600 dark:text-red-400 px-1 py-4">{error ?? "Could not load details."}</p>;
  }

  function renderDoc(id: string, name: string) {
    const doc = detail!.documents.find((d) => d._id === id);
    const mimeType = doc?.mimeType ?? "application/octet-stream";
    return <PortalDocAttachmentPreview docId={id} name={name} mimeType={mimeType} />;
  }

  return (
    <div className="space-y-6">
      {/* Notes */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Notes</h3>
        </div>
        {detail.notes ? (
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2.5">
            <MentionBody body={detail.notes} renderDoc={renderDoc} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes provided.</p>
        )}
      </section>

      <div className="border-t border-border" />

      {/* Documents */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Documents</h3>
          {detail.documents.length > 0 && (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
              {detail.documents.length}
            </span>
          )}
        </div>
        {detail.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No documents for this case.</p>
        ) : (
          <div className="space-y-1.5">
            {detail.documents.map((d) => (
              <div key={d._id} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                <span className="text-sm flex-1 truncate">{d.name}</span>
                <span className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground shrink-0">{d.status}</span>
                <button
                  type="button"
                  onClick={() => setViewingDoc({ _id: d._id, name: d.name, mimeType: d.mimeType })}
                  className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="View document"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      {/* Comments — external only */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Comments</h3>
          {detail.externalComments.length > 0 && (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
              {detail.externalComments.length}
            </span>
          )}
        </div>

        {/* New comment input */}
        <div className="flex gap-3 mb-4">
          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-1.5">
            Me
          </div>
          <div className="flex-1 space-y-2">
            <textarea
              className="w-full min-h-[64px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition-colors"
              placeholder="Add a comment… your attorney can see this"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!commentBody.trim() || submitting}
                onClick={handleSubmitComment}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />
                }
                Comment
              </button>
              <span className="text-[11px] text-muted-foreground">Ctrl+Enter to send</span>
            </div>
          </div>
        </div>

        {detail.externalComments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No comments yet.</p>
        ) : (
          <div className="space-y-4">
            {detail.externalComments.map((c) => {
              const initials = c.authorName.split(" ").map((n: string) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
              return (
                <div key={c._id} className="flex gap-3">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold">{c.isCurrentClient ? "You" : c.authorName}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap rounded-md bg-blue-500/5 border border-blue-500/10 px-3 py-2">
                      <MentionBody body={c.body} renderDoc={renderDoc} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Document viewer overlay */}
      {viewingDoc && (
        <PortalDocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortalCasesPage() {
  const [cases, setCases] = useState<PortalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/cases")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setCases(data.cases ?? []);
      })
      .catch(() => setError("Failed to load cases."))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Cases</h1>
        <p className="text-sm text-muted-foreground mt-1">View the status and details of your active matters.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && cases.length === 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-16 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground">No active cases</p>
          <p className="text-sm text-muted-foreground mt-1 italic">Your cases will appear here once created by your attorney.</p>
        </div>
      )}

      {!loading && cases.length > 0 && (
        <div className="space-y-3">
          {cases.map((c) => {
            const isExpanded = expandedId === c._id;
            return (
              <div key={c._id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                {/* Case header row */}
                <button
                  type="button"
                  className="w-full text-left p-5 focus:outline-none"
                  onClick={() => toggleExpand(c._id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{c.caseNumber}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${priorityStyle[c.priority] ?? "bg-slate-500/15 text-slate-700 border-slate-500/20"}`}>
                          {c.priority}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mt-1.5">{c.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${statusDot[c.status] ?? "bg-slate-400"}`} />
                          {c.status}
                        </span>
                        {c.visaType !== "None" && <span>{c.visaType}</span>}
                        {c.assigneeName && <span>Member: {c.assigneeName}</span>}
                      </div>
                    </div>
                    <div className="flex items-start gap-3 shrink-0">
                      <div className="text-right space-y-1">
                        {c.deadline && (
                          <div className={`flex items-center gap-1 text-xs justify-end ${c.deadline < Date.now() ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                            {c.deadline < Date.now() && <AlertTriangle className="h-3.5 w-3.5" />}
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(c.deadline)}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">Updated {formatDate(c.updatedAt)}</p>
                      </div>
                      <div className="mt-0.5 text-muted-foreground">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />
                        }
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expandable detail panel */}
                {isExpanded && (
                  <div className="border-t border-border px-5 py-5 bg-muted/10">
                    <CaseDetailPanel caseId={c._id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
