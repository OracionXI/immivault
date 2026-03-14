"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DocumentViewer } from "./document-viewer";
import { FileText, File } from "lucide-react";
import { Loader2 } from "lucide-react";

interface DocAttachmentPreviewProps {
    docId: string;
    name: string;
    mimeType: string;
}

/**
 * Renders an inline file attachment preview — similar to social media comment attachments.
 * Images show a thumbnail; PDFs and other docs show a clickable file card.
 * Clicking opens the full DocumentViewer dialog.
 */
export function DocAttachmentPreview({ docId, name, mimeType }: DocAttachmentPreviewProps) {
    const [viewerOpen, setViewerOpen] = useState(false);
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    // Only fetch the URL upfront for image thumbnails; DocumentViewer fetches its own URL on open.
    const url = useQuery(
        api.documents.queries.getViewUrl,
        isImage ? { id: docId as Id<"documents"> } : "skip"
    );

    return (
        <>
            <div
                className="inline-flex flex-col mt-2 cursor-pointer rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors bg-background max-w-xs"
                onClick={() => setViewerOpen(true)}
                title={`Click to view ${name}`}
            >
                {isImage ? (
                    url ? (
                        <>
                            <img
                                src={url}
                                alt={name}
                                className="max-h-48 w-auto object-cover"
                            />
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
                            {isPdf ? (
                                <FileText className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                                <File className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                            )}
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
            <DocumentViewer
                open={viewerOpen}
                onOpenChange={setViewerOpen}
                docId={docId as Id<"documents">}
                name={name}
                mimeType={mimeType}
            />
        </>
    );
}
