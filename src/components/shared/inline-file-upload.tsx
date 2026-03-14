"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|jpg|jpeg|png)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface InlineFileUploadProps {
    caseId: Id<"cases">;
    onUploaded?: (docId: Id<"documents">, docName: string, mimeType: string) => void;
}

export function InlineFileUpload({ caseId, onUploaded }: InlineFileUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const generateUploadUrl = useMutation(api.documents.mutations.generateUploadUrl);
    const createDocument = useMutation(api.documents.mutations.create);

    const handleFile = async (file: File) => {
        if (!ALLOWED_EXTENSIONS.test(file.name)) {
            toast.error("Only PDF, DOC, JPG, PNG files are allowed.");
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            toast.error("File must be 10 MB or smaller.");
            return;
        }
        setUploading(true);
        try {
            const uploadUrl = await generateUploadUrl();
            const result = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type || "application/octet-stream" },
                body: file,
            });
            if (!result.ok) throw new Error("Storage upload failed");
            const { storageId } = await result.json() as { storageId: Id<"_storage"> };
            const name = file.name.replace(/\.[^.]+$/, "");
            const docId = await createDocument({
                caseId,
                name,
                storageId,
                fileSize: file.size,
                mimeType: file.type || "application/octet-stream",
            });
            toast.success(`"${name}" uploaded to Documents.`);
            onUploaded?.(docId, name, file.type || "application/octet-stream");
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
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button
                size="sm"
                variant="outline"
                disabled={uploading}
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
