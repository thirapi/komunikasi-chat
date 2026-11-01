"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import {
    $getRoot,
    $createParagraphNode,
    $createTextNode,
    EditorState,
    LexicalEditor,
    COMMAND_PRIORITY_LOW,
    KEY_ENTER_COMMAND,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { MentionNode, $createMentionNode } from "@/components/lexical/mention-node";
import { MentionPlugin } from "@/components/lexical/mention-plugin";
import { FloatingToolbarPlugin } from "@/components/lexical/floating-toolbar-plugin";
import { MarkdownDecoratorPlugin } from "@/components/lexical/markdown-decorator-plugin";
import { CodePastePlugin } from "@/components/lexical/code-paste-plugin";
import { RoomWithParticipantsDTO } from "@/lib/entities/models/room.model";
import { cn } from "@/lib/utils";

// Theme for Lexical — maps node types to CSS classes
const editorTheme = {
    paragraph: "mb-0 leading-relaxed",
    text: {
        bold: "font-bold",
        italic: "italic",
        strikethrough: "line-through",
        code: "break-words rounded-[4px] border border-border/70 bg-muted/60 px-1 py-px font-mono text-[0.85em] text-foreground",
        underline: "underline",
    },
};

interface MentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onSubmit?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
    roomData?: RoomWithParticipantsDTO;
    currentUserId: string;
    autoFocus?: boolean;
    inputRef?: React.RefObject<HTMLDivElement | null>;
    maxHeight?: number;
    textClassName?: string;
    draftKey?: string;
}

// Plugin: Draft Persistence
function DraftPersistencePlugin({ draftKey, value }: { draftKey?: string, value: string }) {
    const [editor] = useLexicalComposerContext();

    // Initial load
    useEffect(() => {
        if (!draftKey) return;
        const savedDraft = localStorage.getItem(`draft_${draftKey}`);
        if (savedDraft && value === "") {
            editor.update(() => {
                const root = $getRoot();
                root.clear();
                const paragraph = $createParagraphNode();
                paragraph.append($createTextNode(savedDraft));
                root.append(paragraph);
            });
        }
    }, [editor, draftKey]);

    // Save on change
    useEffect(() => {
        if (!draftKey) return;
        if (value === "") {
            localStorage.removeItem(`draft_${draftKey}`);
        } else {
            localStorage.setItem(`draft_${draftKey}`, value);
        }
    }, [value, draftKey]);

    return null;
}

// Convert raw content string (with <@userId> tokens) to Lexical initial state
function createInitialEditorState(
    rawContent: string,
    roomData?: RoomWithParticipantsDTO
): () => void {
    return () => {
        const root = $getRoot();
        root.clear();

        const paragraph = $createParagraphNode();

        // Parse <@userId> tokens and plain text
        const regex = /<@([a-zA-Z0-9_-]+)>/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(rawContent)) !== null) {
            if (match.index > lastIndex) {
                const textBefore = rawContent.slice(lastIndex, match.index);
                paragraph.append($createTextNode(textBefore));
            }

            const userId = match[1];
            let displayName = userId;

            if (userId === "everyone") {
                displayName = "everyone";
            } else {
                const participant = roomData?.participants?.find(
                    (p) => p.user.id === userId
                );
                if (participant) {
                    displayName = participant.user.username;
                }
            }

            paragraph.append($createMentionNode(userId, displayName));
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < rawContent.length) {
            paragraph.append($createTextNode(rawContent.slice(lastIndex)));
        }

        if (paragraph.getChildrenSize() === 0) {
            paragraph.append($createTextNode(""));
        }

        root.append(paragraph);
    };
}

function editorStateToPlainText(editorState: EditorState): string {
    let result = "";
    editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();

        children.forEach((child, idx) => {
            if (idx > 0) result += "\n";

            const descendants =
                "getChildren" in child ? (child as any).getChildren() : [];
            descendants.forEach((node: any) => {
                if (node.__type === "mention") {
                    result += `<@${node.__mentionId}>`;
                } else {
                    result += node.getTextContent();
                }
            });
        });
    });
    return result;
}

// Plugin: Enter to submit (without Shift)
function SubmitOnEnterPlugin({ onSubmit }: { onSubmit?: () => void }) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        if (!onSubmit) return;
        return editor.registerCommand(
            KEY_ENTER_COMMAND,
            (event: KeyboardEvent | null) => {
                if (event && !event.shiftKey) {
                    event.preventDefault();
                    onSubmit();
                    return true;
                }
                return false;
            },
            COMMAND_PRIORITY_LOW
        );
    }, [editor, onSubmit]);

    return null;
}

// Plugin: Sync external value changes into the editor
function SyncValuePlugin({
    value,
    roomData,
}: {
    value: string;
    roomData?: RoomWithParticipantsDTO;
}) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        // Sync when value changes externally and is different from editor's internal state
        editor.update(() => {
            const currentContent = editorStateToPlainText(editor.getEditorState());
            if (value !== currentContent) {
                const root = $getRoot();
                root.clear();
                
                // Parse content into nodes (preserving multi-line structure)
                const lines = value.split('\n');
                lines.forEach((line, lineIdx) => {
                    const paragraph = $createParagraphNode();
                    const regex = /<@([a-zA-Z0-9_-]+)>/g;
                    let lastIndex = 0;
                    let match;

                    while ((match = regex.exec(line)) !== null) {
                        if (match.index > lastIndex) {
                            const textBefore = line.slice(lastIndex, match.index);
                            paragraph.append($createTextNode(textBefore));
                        }

                        const userId = match[1];
                        let displayName = userId;

                        if (userId === "everyone") {
                            displayName = "everyone";
                        } else {
                            const participant = roomData?.participants?.find(
                                (p) => p.user.id === userId
                            );
                            if (participant) {
                                displayName = participant.user.username;
                            }
                        }

                        paragraph.append($createMentionNode(userId, displayName));
                        lastIndex = regex.lastIndex;
                    }

                    if (lastIndex < line.length) {
                        paragraph.append($createTextNode(line.slice(lastIndex)));
                    }

                    if (paragraph.getChildrenSize() === 0) {
                        paragraph.append($createTextNode(""));
                    }

                    root.append(paragraph);
                    
                    // Add newline behavior handled by multiple paragraphs, 
                    // except for the last line which doesn't need a trailing empty paragraph usually
                });

                // Move cursor to end if it's an external update (like emoji selection)
                const lastChild = root.getLastChild();
                if (lastChild && "selectEnd" in lastChild) {
                    (lastChild as any).selectEnd();
                }
            }
        }, { discrete: true }); // Use discrete update to ensure it's applied immediately
    }, [value, editor, roomData]);

    return null;
}

// Plugin: Auto-resize editor container
function AutoHeightPlugin({ maxHeight }: { maxHeight: number }) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerUpdateListener(() => {
            const rootElement = editor.getRootElement();
            if (rootElement) {
                rootElement.style.height = "auto";
                const scrollHeight = rootElement.scrollHeight;
                rootElement.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
            }
        });
    }, [editor, maxHeight]);

    return null;
}

// Plugin: Focus editor on mount
function AutoFocusPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const timeout = setTimeout(() => {
            editor.focus();
        }, 50);
        return () => clearTimeout(timeout);
    }, [editor]);

    return null;
}

// Plugin: Expose editor instance to parent
function EditorRefPlugin({
    editorRef,
}: {
    editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
    const [editor] = useLexicalComposerContext();
    useEffect(() => {
        editorRef.current = editor;
    }, [editor, editorRef]);
    return null;
}

export function MentionTextarea({
    value,
    onChange,
    onKeyDown,
    onSubmit,
    onBlur,
    placeholder,
    className,
    roomData,
    currentUserId,
    autoFocus,
    inputRef,
    maxHeight = 200,
    textClassName = "text-base",
    draftKey,
}: MentionTextareaProps) {
    const editorRef = useRef<LexicalEditor | null>(null);
    const isInternalChange = useRef(false);

    const initialConfig = {
        namespace: "MentionEditor",
        theme: editorTheme,
        onError: (error: Error) => console.error("[Lexical Error]", error),
        nodes: [MentionNode],
        editorState: value
            ? createInitialEditorState(value, roomData)
            : undefined,
    };

    const handleChange = useCallback(
        (editorState: EditorState) => {
            isInternalChange.current = true;
            const plainText = editorStateToPlainText(editorState);
            onChange(plainText);
            requestAnimationFrame(() => {
                isInternalChange.current = false;
            });
        },
        [onChange]
    );

    return (
        <div
            className={cn("relative", className)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
        >
            <LexicalComposer initialConfig={initialConfig}>
                <div className="relative min-h-[40px]">
                    <RichTextPlugin
                        contentEditable={
                            <ContentEditable
                                ref={inputRef}
                                className={cn(
                                    "w-full bg-transparent outline-none resize-none px-3 py-2 leading-relaxed overflow-y-auto font-sans",
                                    textClassName
                                )}
                                style={{ maxHeight: `${maxHeight}px` }}
                            />
                        }
                        placeholder={
                            placeholder ? (
                                <div
                                    className={cn(
                                        "absolute top-0 left-0 px-3 py-2 pointer-events-none text-muted-foreground/60 leading-relaxed font-sans truncate max-w-full",
                                        textClassName
                                    )}
                                >
                                    {placeholder}
                                </div>
                            ) : null
                        }
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                    <OnChangePlugin onChange={handleChange} />
                    <HistoryPlugin />
                    <MarkdownDecoratorPlugin />
                    <CodePastePlugin />
                    <FloatingToolbarPlugin />
                    <DraftPersistencePlugin draftKey={draftKey} value={value} />
                    <SubmitOnEnterPlugin onSubmit={onSubmit} />
                    <SyncValuePlugin value={value} roomData={roomData} />
                    <AutoHeightPlugin maxHeight={maxHeight} />
                    {autoFocus && <AutoFocusPlugin />}
                    <EditorRefPlugin editorRef={editorRef} />
                    {roomData?.participants && (
                        <MentionPlugin
                            participants={roomData.participants}
                            currentUserId={currentUserId}
                        />
                    )}
                </div>
            </LexicalComposer>
        </div>
    );
}
