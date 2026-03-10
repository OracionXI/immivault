"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DocumentViewer } from "@/components/shared/document-viewer";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, Eye, Pencil, X } from "lucide-react";
import { UploadModal } from "./upload-modal";
import { EditDocumentModal } from "./edit-document-modal";
import { useRole } from "@/hooks/use-role";
import { useSearchParams, useRouter } from "next/navigation";

type EnrichedDocument = NonNullable<ReturnType<typeof useQuery<typeof api.documents.queries.listEnriched>>>[number];
type DisplayDocument = EnrichedDocument & { uploadedDisplay: string };

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
    // Single query — client/case names already joined server-side
    const documentsQuery = useQuery(api.documents.queries.listEnriched);
    const rawDocuments = documentsQuery ?? [];
    const removeDocument = useMutation(api.documents.mutations.remove);
    const settings = useQuery(api.organisations.queries.getSettings);
    const docTypeOptions = (settings?.documentTypes ?? ["Identity", "Employment", "Immigration", "Education", "Financial", "Supporting"])
        .map((t) => ({ label: t, value: t }));
    const { isStaff } = useRole();

    const [uploadOpen, setUploadOpen] = useState(false);
    const [editDoc, setEditDoc] = useState<EnrichedDocument | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: Id<"documents"> | null; name: string }>({
        open: false, id: null, name: "",
    });
    const [viewer, setViewer] = useState<{ open: boolean; doc: EnrichedDocument | null }>({
        open: false, doc: null,
    });

    const searchParams = useSearchParams();
    const router = useRouter();

    // Case filter: pre-populated from ?case=caseId
    const [caseIdFilter, setCaseIdFilter] = useState<string>(() => searchParams.get("case") ?? "");

    // Auto-open DocumentViewer when navigated from a notification (?doc=documentId)
    useEffect(() => {
        const docId = searchParams.get("doc");
        if (!docId || rawDocuments.length === 0) return;
        const doc = rawDocuments.find((x) => x._id === docId);
        if (doc) {
            setViewer({ open: true, doc });
            router.replace("/documents", { scroll: false });
        }
    }, [searchParams, rawDocuments, router]);

    const documents = useMemo<DisplayDocument[]>(
        () => rawDocuments.map((d) => ({ ...d, uploadedDisplay: formatTs(d._creationTime) })),
        [rawDocuments]
    );

    // Apply case pre-filter before passing to DataTable
    const filteredDocuments = useMemo(
        () => caseIdFilter ? documents.filter((d) => d.caseId === caseIdFilter) : documents,
        [documents, caseIdFilter]
    );

    const filteredCaseName = caseIdFilter
        ? (rawDocuments.find((d) => d.caseId === caseIdFilter)?.caseName ?? "Selected case")
        : null;

    const handleDelete = async () => {
        if (deleteDialog.id) {
            await removeDocument({ id: deleteDialog.id });
            setDeleteDialog({ open: false, id: null, name: "" });
        }
    };

    const columns: Column<DisplayDocument>[] = [
        { key: "name", label: "Document Name", sortable: true, render: (d) => <span className="font-medium">{d.name}</span> },
        { key: "type", label: "Type", sortable: true },
        { key: "caseName", label: "Case", sortable: true },
        { key: "clientName", label: "Client", sortable: true },
        { key: "uploadedDisplay", label: "Uploaded", sortable: true },
        { key: "fileSize", label: "Size", render: (d) => <span className="text-muted-foreground">{typeof d.fileSize === "number" ? formatFileSize(d.fileSize) : "—"}</span> },
        { key: "status", label: "Status", render: (d) => <StatusBadge status={d.status} /> },
        {
            key: "actions", label: "Actions", render: (d) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="View"
                        onClick={() => setViewer({ open: true, doc: d })}
                    >
                        <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {!isStaff && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Edit"
                                onClick={() => setEditDoc(d)}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Delete"
                                onClick={() => setDeleteDialog({ open: true, id: d._id, name: d.name })}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Documents"
                description="Manage client documents and files"
                actionLabel={isStaff ? undefined : "Upload Document"}
                actionIcon={isStaff ? undefined : <Upload className="h-4 w-4" />}
                onAction={isStaff ? undefined : () => setUploadOpen(true)}
            />
            {filteredCaseName && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Filtered by case:</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                        {filteredCaseName}
                        <button
                            onClick={() => setCaseIdFilter("")}
                            className="text-primary/70 hover:text-primary transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                </div>
            )}
            <DataTable
                data={filteredDocuments as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="name"
                searchPlaceholder="Search documents..."
                loading={documentsQuery === undefined}
                filterDropdown={{
                    key: "type",
                    placeholder: "All Types",
                    options: docTypeOptions,
                }}
            />
            <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
            <EditDocumentModal
                open={editDoc !== null}
                onOpenChange={(open) => { if (!open) setEditDoc(null); }}
                document={editDoc}
            />
            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id, name: deleteDialog.name })}
                title="Delete Document"
                description={`Are you sure you want to delete "${deleteDialog.name}"? This will also remove the file from storage.`}
                onConfirm={handleDelete}
            />
            {viewer.doc && (
                <DocumentViewer
                    open={viewer.open}
                    onOpenChange={(v) => setViewer({ open: v, doc: viewer.doc })}
                    docId={viewer.doc._id}
                    name={viewer.doc.name}
                    mimeType={viewer.doc.mimeType}
                />
            )}
        </div>
    );
}
