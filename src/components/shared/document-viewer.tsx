"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react";

interface DocumentViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    docId: Id<"documents"> | null;
    name: string;
    mimeType: string;
}

export function DocumentViewer({ open, onOpenChange, docId, name, mimeType }: DocumentViewerProps) {
    const [zoom, setZoom] = useState(1);

    const url = useQuery(
        api.documents.queries.getViewUrl,
        open && docId ? { id: docId } : "skip"
    );

    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    const handleClose = (v: boolean) => {
        onOpenChange(v);
        if (!v) setZoom(1);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="flex flex-col p-0 gap-0"
                style={{ maxWidth: "80vw", width: "80vw", height: "80vh" }}
            >
                <DialogHeader className="flex-row items-center gap-3 px-4 pr-12 py-3 border-b shrink-0">
                    <DialogTitle className="flex-1 truncate text-sm font-medium">{name}</DialogTitle>
                    {(isImage || isPdf) && (
                        <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}>
                                <ZoomOut className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
                                {Math.round(zoom * 100)}%
                            </span>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
                                <ZoomIn className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(1)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-muted/30">
                    {!url ? (
                        <div className="flex items-center justify-center w-full h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : isImage ? (
                        <img
                            src={url}
                            alt={name}
                            style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s" }}
                            className="max-w-full rounded shadow-sm"
                        />
                    ) : isPdf ? (
                        <iframe
                            src={url}
                            title={name}
                            className="w-full border-0 rounded"
                            style={{
                                height: `${zoom * 100}%`,
                                minHeight: "100%",
                                transition: "height 0.15s",
                            }}
                        />
                    ) : (
                        <div className="text-center text-muted-foreground py-20">
                            <p className="font-medium">Preview not available</p>
                            <p className="text-sm mt-1">This file type cannot be previewed in the browser.</p>
                            <Button variant="outline" className="mt-4" onClick={() => window.open(url, "_blank")}>
                                Open in new tab
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
