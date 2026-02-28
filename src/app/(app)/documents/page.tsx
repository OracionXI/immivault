"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mockDocuments } from "@/lib/mock-data";
import type { Document } from "@/lib/types";
import { UploadModal } from "./upload-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Download, Upload } from "lucide-react";

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<Document[]>(mockDocuments);
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; doc: Document | null }>({ open: false, doc: null });

    const columns: Column<Document>[] = [
        { key: "name", label: "Document Name", sortable: true, render: (d) => <span className="font-medium">{d.name}</span> },
        { key: "type", label: "Type", sortable: true },
        { key: "clientName", label: "Client", sortable: true },
        { key: "uploadedAt", label: "Uploaded", sortable: true },
        { key: "expiryDate", label: "Expiry", render: (d) => d.expiryDate || "—" },
        { key: "fileSize", label: "Size" },
        { key: "status", label: "Status", render: (d) => <StatusBadge status={d.status} /> },
        {
            key: "actions", label: "Actions", render: (d) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, doc: d })}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    const handleUpload = (doc: Document) => {
        setDocuments((prev) => [...prev, { ...doc, id: `d${Date.now()}` }]);
        setModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Documents" description="Manage client documents and files" actionLabel="Upload Document" actionIcon={<Upload className="h-4 w-4" />} onAction={() => setModalOpen(true)} />
            <DataTable
                data={documents as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="name"
                searchPlaceholder="Search documents..."
                filterDropdown={{
                    key: "type",
                    placeholder: "All Types",
                    options: [
                        { label: "Identity", value: "Identity" },
                        { label: "Employment", value: "Employment" },
                        { label: "Immigration", value: "Immigration" },
                        { label: "Education", value: "Education" },
                        { label: "Financial", value: "Financial" },
                        { label: "Supporting", value: "Supporting" },
                    ],
                }}
            />
            <UploadModal open={modalOpen} onOpenChange={setModalOpen} onSave={handleUpload} />
            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, doc: deleteDialog.doc })}
                title="Delete Document"
                description={`Are you sure you want to delete "${deleteDialog.doc?.name}"?`}
                onConfirm={() => { if (deleteDialog.doc) setDocuments((prev) => prev.filter((d) => d.id !== deleteDialog.doc!.id)); setDeleteDialog({ open: false, doc: null }); }}
            />
        </div>
    );
}
