"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|odt|jpg|jpeg|png|webp|xls|xlsx|csv)$/i;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

interface InlineFileUploadProps {
    caseId: Id<"cases">;
    onUploaded?: (docId: Id<"documents">, docName: string, mimeType: string) => void;
}

export function InlineFileUpload({ caseId, onUploaded }: InlineFileUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const { getToken } = useAuth();
    const confirmUpload = useMutation(api.documents.mutations.confirmUpload);

    // Fetch the case to get clientId (needed by requestUpload)
    const caseData = useQuery(api.cases.queries.get, { id: caseId });

    const handleFile = async (file: File) => {
        if (!ALLOWED_EXTENSIONS.test(file.name)) {
            toast.error("Only PDF, DOC, ODT, JPG, PNG, WEBP, XLS, XLSX, CSV files are allowed.");
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            toast.error("File must be 20 MB or smaller.");
            return;
        }
        if (!caseData) {
            toast.error("Case not loaded. Please try again.");
            return;
        }
        setUploading(true);
        try {
            const token = await getToken({ template: "convex" });
            if (!token) throw new Error("Not authenticated");

            // ── Step 1: request pre-signed PUT URL ──────────────────────────────
            const requestRes = await fetch("/api/documents/request-upload", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    clientId: caseData.clientId,
                    caseId,
                    filename: file.name,
                    mimeType: file.type || "application/octet-stream",
                    fileSize: file.size,
                    visibility: "internal",
                }),
            });

            if (!requestRes.ok) {
                const err = await requestRes.json().catch(() => ({}));
                throw new Error((err as any).error || "Failed to request upload URL");
            }

            const { uploadUrl, documentId } = await requestRes.json() as {
                uploadUrl: string;
                documentId: Id<"documents">;
            };

            // ── Step 2: PUT file directly to S3 ────────────────────────────────
            const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": file.type || "application/octet-stream",
                    "x-amz-server-side-encryption": "aws:kms",
                },
                body: file,
            });

            if (!putRes.ok) throw new Error("S3 upload failed");

            // ── Step 3: confirm upload (marks document active) ──────────────────
            await confirmUpload({ id: documentId });

            const name = file.name.replace(/\.[^.]+$/, "");
            toast.success(`"${name}" uploaded to Documents.`);
            onUploaded?.(documentId, name, file.type || "application/octet-stream");
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.odt,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button
                size="sm"
                variant="outline"
                disabled={uploading || !caseData}
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
            >
                {uploading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Paperclip className="h-3.5 w-3.5" />
                }
                {uploading ? "Uploading…" : "Attach file"}
            </Button>
        </>
    );
}
