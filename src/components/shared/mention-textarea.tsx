"use client";

import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { Textarea } from "@/components/ui/textarea";
import { User, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MentionableUser {
    id: string;
    name: string;
}

export interface MentionableDoc {
    id: string;
    name: string;
}

export interface MentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
    users: MentionableUser[];
    docs: MentionableDoc[];
    className?: string;
    autoFocus?: boolean;
}

// ─── Token formats ────────────────────────────────────────────────────────────
// Storage (sent via onChange / saved to Convex): @[Name](user:id) or @[Name](doc:id)
// Display (shown in the textarea):               @[Name]
//
// The mentionMap bridges them: name → { type, id }

type MentionItem =
    | { kind: "user"; id: string; name: string }
    | { kind: "doc"; id: string; name: string };

type MentionEntry = { type: "user" | "doc"; id: string };

/** Convert storage-encoded string → display string, populating mentionMap as a side-effect. */
function decodeForDisplay(
    encoded: string,
    mentionMap: Map<string, MentionEntry>
): string {
    return encoded.replace(/@\[([^\]]+)\]\((user|doc):([^)]+)\)/g, (_, name, type, id) => {
        mentionMap.set(name, { type: type as "user" | "doc", id });
        return `@[${name}]`;
    });
}

/** Convert display string → storage string using the mentionMap. */
function encodeForStorage(
    display: string,
    mentionMap: Map<string, MentionEntry>
): string {
    // Match @[Name] that is NOT already followed by (type:id)
    return display.replace(/@\[([^\]]+)\](?!\()/g, (match, name) => {
        const entry = mentionMap.get(name);
        if (!entry) return match;
        return `@[${name}](${entry.type}:${entry.id})`;
    });
}

/**
 * Detects whether the user is currently typing a @mention at the cursor.
 * Returns the query text and the index of the triggering @ if active.
 */
function getMentionQuery(
    value: string,
    cursorPos: number
): { query: string; atIndex: number } | null {
    const textBefore = value.slice(0, cursorPos);
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex === -1) return null;

    const afterAt = textBefore.slice(atIndex + 1);

    // Completed token: @[...] — not an active mention
    if (afterAt.startsWith("[")) return null;

    // A space or newline means the @ mention ended (or wasn't a mention)
    if (/[\s]/.test(afterAt)) return null;

    return { query: afterAt, atIndex };
}

/**
 * Replaces the active @query with the given token string.
 */
function insertToken(
    value: string,
    atIndex: number,
    cursorPos: number,
    token: string
): { newValue: string; newCursor: number } {
    const newValue = value.slice(0, atIndex) + token + value.slice(cursorPos);
    return { newValue, newCursor: atIndex + token.length };
}

// ─── MentionTextarea ──────────────────────────────────────────────────────────

export function MentionTextarea({
    value,
    onChange,
    onKeyDown,
    placeholder,
    rows = 2,
    users,
    docs,
    className,
    autoFocus,
}: MentionTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Map from mention display name → { type, id } for encode/decode
    const mentionMapRef = useRef<Map<string, MentionEntry>>(new Map());

    // Internal display value shown in the textarea (decoded, no IDs)
    const [display, setDisplay] = useState(() =>
        decodeForDisplay(value, mentionMapRef.current)
    );

    // Track the last encoded value we emitted so we can detect external resets
    const lastEncodedRef = useRef(value);

    // Sync display when the parent changes value externally (e.g., field reset or load)
    useEffect(() => {
        if (value !== lastEncodedRef.current) {
            const newDisplay = decodeForDisplay(value, mentionMapRef.current);
            setDisplay(newDisplay);
            lastEncodedRef.current = value;
        }
    }, [value]);

    const [mentionState, setMentionState] = useState<{ query: string; atIndex: number } | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const query = mentionState?.query.toLowerCase() ?? "";

    // Flat list: users first, then docs — filtered by typed query
    const items: MentionItem[] = [
        ...users
            .filter((u) => u.name.toLowerCase().includes(query))
            .map((u) => ({ kind: "user" as const, id: u.id, name: u.name })),
        ...docs
            .filter((d) => d.name.toLowerCase().includes(query))
            .map((d) => ({ kind: "doc" as const, id: d.id, name: d.name })),
    ];
    const showDropdown = mentionState !== null && items.length > 0;

    // Keep activeIndex in bounds when the list changes
    useEffect(() => {
        setActiveIndex(0);
    }, [items.length]);

    const selectItem = useCallback(
        (item: MentionItem) => {
            if (!mentionState) return;

            // Register in mentionMap so we can encode later
            mentionMapRef.current.set(item.name, { type: item.kind, id: item.id });

            // Insert the human-readable display token: @[Name]
            const displayToken = `@[${item.name}] `;
            const cursorPos = textareaRef.current?.selectionStart ?? display.length;
            const { newValue: newDisplay, newCursor } = insertToken(
                display,
                mentionState.atIndex,
                cursorPos,
                displayToken
            );

            setDisplay(newDisplay);
            setMentionState(null);

            // Emit the storage-encoded version to the parent
            const encoded = encodeForStorage(newDisplay, mentionMapRef.current);
            lastEncodedRef.current = encoded;
            onChange(encoded);

            // Restore cursor after React re-renders the textarea
            setTimeout(() => {
                const el = textareaRef.current;
                if (!el) return;
                el.focus();
                el.selectionStart = newCursor;
                el.selectionEnd = newCursor;
            }, 0);
        },
        [mentionState, display, onChange]
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newDisplay = e.target.value;
        setDisplay(newDisplay);

        const cursor = e.target.selectionStart ?? newDisplay.length;
        const state = getMentionQuery(newDisplay, cursor);
        setMentionState(state);
        if (state) setActiveIndex(0);

        // Emit the storage-encoded version to the parent
        const encoded = encodeForStorage(newDisplay, mentionMapRef.current);
        lastEncodedRef.current = encoded;
        onChange(encoded);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showDropdown) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
                return;
            }
            if ((e.key === "Enter" || e.key === "Tab") && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                selectItem(items[activeIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setMentionState(null);
                return;
            }
        }
        onKeyDown?.(e);
    };

    // Close dropdown on outside click
    useEffect(() => {
        if (!showDropdown) return;
        const close = () => setMentionState(null);
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, [showDropdown]);

    return (
        <div className="relative">
            <Textarea
                ref={textareaRef}
                value={display}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={rows}
                className={className}
                autoFocus={autoFocus}
            />

            {showDropdown && (
                <div
                    className="absolute z-50 left-0 bottom-full mb-1.5 w-72 max-h-52 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg py-1"
                    onMouseDown={(e) => e.preventDefault()} // keep textarea focused
                >
                    {items.map((item, idx) => (
                        <Fragment key={`${item.kind}:${item.id}`}>
                            {/* Section header when kind changes */}
                            {(idx === 0 || items[idx - 1].kind !== item.kind) && (
                                <p className="px-2.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {item.kind === "user" ? "People" : "Documents"}
                                </p>
                            )}
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectItem(item);
                                }}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-left transition-colors",
                                    idx === activeIndex
                                        ? "bg-accent text-accent-foreground"
                                        : "hover:bg-accent/50 text-foreground"
                                )}
                            >
                                {item.kind === "user" ? (
                                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                ) : (
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className="truncate">{item.name}</span>
                            </button>
                        </Fragment>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── MentionBody — render stored comment body with mention chips ──────────────

/**
 * Renders a comment body string, converting @[Name](user|doc:id) tokens into
 * styled inline chips or custom previews. Plain text is preserved as-is.
 *
 * @param renderDoc - Optional callback: given (docId, docName) returns a React node.
 *   When provided, doc tokens are rendered using this callback instead of the default chip.
 *   Use this to render inline file previews (see DocAttachmentPreview).
 */
export function MentionBody({
    body,
    renderDoc,
}: {
    body: string;
    renderDoc?: (id: string, name: string) => React.ReactNode;
}) {
    // Capture: [1]=name, [2]=type, [3]=id
    const MENTION_RE = /@\[([^\]]+)\]\((user|doc):([^)]+)\)/g;

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = MENTION_RE.exec(body)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(<span key={key++}>{body.slice(lastIndex, match.index)}</span>);
        }
        const [, name, type, id] = match;

        if (type === "doc" && renderDoc) {
            nodes.push(
                <span key={key++} className="block">
                    {renderDoc(id, name)}
                </span>
            );
        } else {
            nodes.push(
                <span
                    key={key++}
                    className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-semibold leading-none",
                        type === "user"
                            ? "bg-primary/10 text-primary"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    )}
                >
                    @{name}
                </span>
            );
        }
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < body.length) {
        nodes.push(<span key={key++}>{body.slice(lastIndex)}</span>);
    }

    return <>{nodes}</>;
}
