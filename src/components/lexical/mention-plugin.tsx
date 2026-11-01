"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    $getSelection,
    $isRangeSelection,
    $isTextNode,
    COMMAND_PRIORITY_LOW,
    KEY_BACKSPACE_COMMAND,
    KEY_DOWN_COMMAND,
    KEY_ENTER_COMMAND,
    KEY_ESCAPE_COMMAND,
    KEY_TAB_COMMAND,
    KEY_ARROW_UP_COMMAND,
    KEY_ARROW_DOWN_COMMAND,
    TextNode,
    LexicalEditor,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createMentionNode, $isMentionNode } from "./mention-node";
import { cn } from "@/lib/utils";

interface MentionOption {
    id: string;
    username: string;
    avatar: string;
}

interface MentionPluginProps {
    participants: {
        user: {
            id: string;
            username: string;
            avatar: string;
        };
    }[];
    currentUserId: string;
    getMenuContainer?: () => HTMLElement | null;
}

export function MentionPlugin({
    participants,
    currentUserId,
    getMenuContainer,
}: MentionPluginProps) {
    const [editor] = useLexicalComposerContext();
    const [queryString, setQueryString] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const options = useMemo((): MentionOption[] => {
        if (queryString === null) return [];
        const query = queryString.toLowerCase();

        const everyoneOption: MentionOption = {
            id: "everyone",
            username: "everyone",
            avatar: "",
        };

        const users: MentionOption[] = participants
            .map((p) => ({
                id: p.user.id,
                username: p.user.username,
                avatar: p.user.avatar || "/avatars/avatar1.png",
            }))
            .filter(
                (u) =>
                    u.username.toLowerCase().startsWith(query) && u.id !== currentUserId
            );

        const result = "everyone".startsWith(query)
            ? [everyoneOption, ...users]
            : users;
        return result.slice(0, 10);
    }, [queryString, participants, currentUserId]);

    const insertMention = useCallback(
        (option: MentionOption) => {
            editor.update(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) return;

                const anchor = selection.anchor;
                const anchorNode = anchor.getNode();

                if (!$isTextNode(anchorNode)) return;

                const textContent = anchorNode.getTextContent();
                const anchorOffset = anchor.offset;

                // Find the @ symbol position
                const textBeforeCursor = textContent.slice(0, anchorOffset);
                const atIndex = textBeforeCursor.lastIndexOf("@");
                if (atIndex === -1) return;

                // Split the text node: before @, mention node, after cursor
                const beforeText = textContent.slice(0, atIndex);
                const afterText = textContent.slice(anchorOffset);

                const mentionNode = $createMentionNode(option.id, option.username);
                const spaceNode = new TextNode(" ");

                if (beforeText) {
                    anchorNode.setTextContent(beforeText);
                    anchorNode.insertAfter(mentionNode);
                    mentionNode.insertAfter(spaceNode);
                } else {
                    anchorNode.replace(mentionNode);
                    mentionNode.insertAfter(spaceNode);
                    if (afterText) {
                        const afterNode = new TextNode(afterText);
                        spaceNode.insertAfter(afterNode);
                    }
                }

                // Move selection after the space
                spaceNode.selectEnd();
            });

            setQueryString(null);
            setMenuPosition(null);
        },
        [editor]
    );

    // Listen for text changes to detect @ trigger
    useEffect(() => {
        const removeListener = editor.registerTextContentListener(() => {
            editor.getEditorState().read(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
                    setQueryString(null);
                    setMenuPosition(null);
                    return;
                }

                const anchor = selection.anchor;
                const anchorNode = anchor.getNode();
                if (!$isTextNode(anchorNode)) {
                    setQueryString(null);
                    setMenuPosition(null);
                    return;
                }

                const textContent = anchorNode.getTextContent();
                const textBeforeCursor = textContent.slice(0, anchor.offset);
                const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);

                if (match) {
                    setQueryString(match[1]);
                    setSelectedIndex(0);

                    // Get cursor position for menu placement
                    const domSelection = window.getSelection();
                    if (domSelection && domSelection.rangeCount > 0) {
                        const range = domSelection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        setMenuPosition({ top: rect.top, left: rect.left });
                    }
                } else {
                    setQueryString(null);
                    setMenuPosition(null);
                }
            });
        });
        return removeListener;
    }, [editor]);

    // Handle keyboard navigation in the mention menu
    useEffect(() => {
        if (queryString === null || options.length === 0) return;

        const removeArrowUp = editor.registerCommand(
            KEY_ARROW_UP_COMMAND,
            (e) => {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(0, prev - 1));
                return true;
            },
            COMMAND_PRIORITY_LOW
        );

        const removeArrowDown = editor.registerCommand(
            KEY_ARROW_DOWN_COMMAND,
            (e) => {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(options.length - 1, prev + 1));
                return true;
            },
            COMMAND_PRIORITY_LOW
        );

        const removeEnter = editor.registerCommand(
            KEY_ENTER_COMMAND,
            (e) => {
                if (options.length > 0) {
                    e?.preventDefault();
                    insertMention(options[selectedIndex]);
                    return true;
                }
                return false;
            },
            COMMAND_PRIORITY_LOW
        );

        const removeTab = editor.registerCommand(
            KEY_TAB_COMMAND,
            (e) => {
                if (options.length > 0) {
                    e.preventDefault();
                    insertMention(options[selectedIndex]);
                    return true;
                }
                return false;
            },
            COMMAND_PRIORITY_LOW
        );

        const removeEscape = editor.registerCommand(
            KEY_ESCAPE_COMMAND,
            (e) => {
                e.preventDefault();
                setQueryString(null);
                setMenuPosition(null);
                return true;
            },
            COMMAND_PRIORITY_LOW
        );

        return () => {
            removeArrowUp();
            removeArrowDown();
            removeEnter();
            removeTab();
            removeEscape();
        };
    }, [editor, queryString, options, selectedIndex, insertMention]);

    if (queryString === null || options.length === 0 || !menuPosition)
        return null;

    return (
        <div
            ref={menuRef}
            className="absolute bottom-[calc(100%+8px)] left-0 w-60 sm:w-64 bg-popover text-popover-foreground shadow-lg border border-border rounded-lg overflow-hidden z-[60] flex flex-col"
        >
            <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">
                Sebut anggota
            </div>
            <div className="max-h-60 overflow-y-auto px-1 pb-1">
                {options.map((opt, idx) => (
                    <button
                        key={opt.id}
                        onClick={() => insertMention(opt)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                            "flex items-center gap-2.5 w-full px-2 h-8 text-[13px] text-left rounded-md select-none",
                            idx === selectedIndex ? "bg-muted text-foreground" : "text-foreground/90"
                        )}
                    >
                        {opt.id === "everyone" ? (
                            <span className="w-5 h-5 shrink-0 rounded-full bg-muted-foreground/15 flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                                @
                            </span>
                        ) : (
                            <img
                                src={opt.avatar}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                            />
                        )}
                        <span className="truncate font-medium">{opt.username}</span>
                        {opt.id === "everyone" && (
                            <span className="ml-auto text-[11px] text-muted-foreground shrink-0">semua anggota</span>
                        )}
                        {idx === selectedIndex && opt.id !== "everyone" && (
                            <kbd className="ml-auto text-[10px] text-muted-foreground font-sans shrink-0">↵</kbd>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
