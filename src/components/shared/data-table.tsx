"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, X } from "lucide-react";

export interface Column<T> {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    render?: (item: T) => React.ReactNode;
}

export interface FilterDropdown {
    key: string;
    placeholder: string;
    options: { label: string; value: string }[];
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    searchKey?: string;
    searchPlaceholder?: string;
    pageSize?: number;
    onRowClick?: (item: T) => void;
    filterDropdown?: FilterDropdown;
}

export function DataTable<T extends Record<string, unknown>>({
    data,
    columns,
    searchKey,
    searchPlaceholder = "Search...",
    pageSize = 10,
    onRowClick,
    filterDropdown,
}: DataTableProps<T>) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [activeFilter, setActiveFilter] = useState("all");

    const filtered = useMemo(() => {
        let result = [...data];

        if (search && searchKey) {
            const lowerSearch = search.toLowerCase();
            result = result.filter((item) => {
                const value = item[searchKey];
                return typeof value === "string" && value.toLowerCase().includes(lowerSearch);
            });
        }

        if (activeFilter !== "all" && filterDropdown) {
            result = result.filter((item) => item[filterDropdown.key] === activeFilter);
        }

        if (sortKey) {
            result.sort((a, b) => {
                const aVal = String(a[sortKey] ?? "");
                const bVal = String(b[sortKey] ?? "");
                return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            });
        }

        return result;
    }, [data, search, searchKey, activeFilter, filterDropdown, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const isFiltering = search || activeFilter !== "all";

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 w-full">
                {/* Search — 50% width */}
                {searchKey && (
                    <div className="relative w-1/2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(0);
                            }}
                            className="pl-9 pr-8"
                        />
                        {search && (
                            <button
                                onClick={() => { setSearch(""); setPage(0); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Filter dropdown + result count — right-aligned */}
                <div className="ml-auto flex items-center gap-3">
                    {filterDropdown && (
                        <Select
                            value={activeFilter}
                            onValueChange={(v) => { setActiveFilter(v); setPage(0); }}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder={filterDropdown.placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{filterDropdown.placeholder}</SelectItem>
                                {filterDropdown.options.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {isFiltering && (
                        <p className="text-sm text-muted-foreground whitespace-nowrap">
                            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                        </p>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden">
                <Table className="table-fixed w-full">
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            {columns.map((col) => (
                                <TableHead key={col.key} style={col.width ? { width: col.width } : undefined}>
                                    {col.sortable ? (
                                        <button
                                            className="flex items-center gap-1.5 font-medium hover:text-foreground transition-colors"
                                            onClick={() => handleSort(col.key)}
                                        >
                                            {col.label}
                                            <ArrowUpDown className="h-3.5 w-3.5" />
                                        </button>
                                    ) : (
                                        col.label
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paged.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    No results found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paged.map((item, idx) => (
                                <TableRow
                                    key={idx}
                                    className={onRowClick ? "cursor-pointer" : ""}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {columns.map((col) => (
                                        <TableCell key={col.key} className="max-w-0 truncate">
                                            {col.render
                                                ? col.render(item)
                                                : String(item[col.key] ?? "")}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p>
                        Showing {page * pageSize + 1}–
                        {Math.min((page + 1) * pageSize, filtered.length)} of{" "}
                        {filtered.length}
                    </p>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={page === 0}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Prev
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
