'use client'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Trash2, Pen, Loader } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { UserButton } from '@clerk/nextjs'
import { dark } from '@clerk/themes'



interface Card {
    id: string;
    content: string;
    columnId: string;
}

interface Column {
    id: string;
    title: string;
    cards: Card[];
}

function KanbanBoard() {
    const [columns, setColumns] = useState<Column[]>([]);
    const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
    const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [editingColumnTitle, setEditingColumnTitle] = useState<{id: string, title: string} | null>(null);
    const [editingCardContent, setEditingCardContent] = useState<{id: string, content: string} | null>(null);
    const [board, setBoard] = useState<{ id: string; title: string } | null>(null);
    const [editingBoardTitle, setEditingBoardTitle] = useState<{ id: string; title: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

    const handleColumnTitleEdit = (columnId: string, currentTitle: string) => {
        setEditingColumnTitle({ id: columnId, title: currentTitle });
    };

    const handleDragStart = (cardId: string) => {
        console.log('Drag started:', cardId);
        setDraggingCardId(cardId);
    };
    
    const handleDragOver = (e: React.DragEvent, columnId: string, cardId?: string) => {
        e.preventDefault();
        
        if (cardId) {
            // When dragging over a card, determine if we're on the top or bottom half
            const cardElement = e.currentTarget as HTMLElement;
            const rect = cardElement.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const position = e.clientY < midpoint ? 'top' : 'bottom';
            
            setDropPosition(position);
            setDropTargetId(cardId);
        } else {
            // When dragging over an empty column
            setDropPosition(null);
            setDropTargetId(columnId);
        }
    };

    const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
        e.preventDefault();
        if (!draggingCardId) return;

        try {
            const targetCard = dropTargetId !== targetColumnId ? dropTargetId : null;
            const position = dropPosition;

            const response = await fetch(`/api/cards/${draggingCardId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    columnId: targetColumnId,
                    targetCardId: targetCard,
                    position: position 
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to move card');
            }

            await loadBoard();
        } catch (error) {
            console.error("Error moving card:", error);
        } finally {
            setDraggingCardId(null);
            setDropTargetId(null);
            setDropPosition(null);
        }
    };

    const handleColumnTitleSave = async (columnId: string, newTitle: string) => {
        if (newTitle.trim() === '') return;
        await updateColumnTitle(columnId, newTitle);
        setEditingColumnTitle(null);
    };

    const handleCardEdit = (cardId: string, currentContent: string) => {
        setEditingCardContent({ id: cardId, content: currentContent });
    };

    const handleCardSave = async (cardId: string, content: string) => {
        try {
            // If content is empty, get the current card's content
            const currentCard = columns
                .flatMap(col => col.cards)
                .find(card => card.id === cardId);
                
            const contentToSave = content.trim() || currentCard?.content || "New Task";

            const response = await fetch(`/api/cards/${cardId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: contentToSave })
            });

            if (!response.ok) {
                throw new Error('Failed to update card');
            }

            // Update local state immediately
            setColumns(prevColumns => 
                prevColumns.map(column => ({
                    ...column,
                    cards: column.cards.map(card => 
                        card.id === cardId 
                            ? { ...card, content: contentToSave }
                            : card
                    )
                }))
            );

            setEditingCardContent(null);
        } catch (error) {
            console.error("Error updating card:", error);
        }
    };

    const handleBoardTitleEdit = (boardId: string, currentTitle: string) => {
        setEditingBoardTitle({ id: boardId, title: currentTitle });
    };
    
    const handleBoardTitleSave = async (boardId: string, newTitle: string) => {
        if (newTitle.trim() === '') return;
        try {
            const response = await fetch('/api/boards', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: newTitle })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update board title');
            }
    
            await loadBoard();
        } catch (error) {
            console.error("Error updating board title:", error);
        } finally {
            setEditingBoardTitle(null);
        }
    };
    
    useEffect(() => {
        loadBoard();
    }, []);

    async function loadBoard() {
        setIsLoading(true);  // Start loading
        try {
            const response = await fetch('/api/boards');
            const data = await response.json();
            setBoard({ id: data.id, title: data.title });
            if (data.columns) {
                setColumns(data.columns);
            }
        } catch (error) {
            console.error("Error loading board:", error);
        } finally {
            setIsLoading(false);  // End loading
        }
    }

    async function createNewCard(columnId: string) {
        try {
            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    columnId,
                    content: "New Task"
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create card');
            }

            await loadBoard();
        } catch (error) {
            console.error("Error creating card:", error);
        }
    }

    async function deleteColumn(columnId: string) {
        try {
            setDeletingColumnId(columnId);
            const response = await fetch(`/api/columns/${columnId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete column');
            }
        
            await loadBoard();
        } catch (error) {
            console.error("Error deleting column:", error);
        } finally {
            setDeletingColumnId(null);
        }
    }

    async function deleteCard(cardId: string) {
        try {
            setDeletingCardId(cardId);
            const response = await fetch(`/api/cards/${cardId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete card');
            }
    
            await loadBoard();
        } catch (error) {
            console.error("Error deleting card:", error);
        } finally {
            setDeletingCardId(null);
        }
    }

    async function createNewColumn() {
        try {
            const response = await fetch('/api/boards', {
                method: 'POST'
            });
            
            const data = await response.json();
            if (data.columns) {
                setColumns(data.columns);
            }
        } catch (error) {
            console.error("Error creating column:", error);
        }
    }

    async function updateColumnTitle(columnId: string, newTitle: string) {
        try {
            const response = await fetch(`/api/columns/${columnId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: newTitle })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update column');
            }
    
            await loadBoard();
        } catch (error) {
            console.error("Error updating column:", error);
        } finally {
            setEditingColumnId(null);
        }
    }
    async function updateCardContent(cardId: string, newContent: string) {
        try {
            const response = await fetch(`/api/cards/${cardId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: newContent })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update card');
            }
    
            await loadBoard();
        } catch (error) {
            console.error("Error updating card:", error);
        } finally {
            setEditingCardId(null);
        }
    }

    const handleDragEnd = () => {
        setDropTargetId(null);
        setDropPosition(null);
        setDraggingCardId(null);
    };

    useEffect(() => {
        document.addEventListener('dragend', handleDragEnd);
        return () => document.removeEventListener('dragend', handleDragEnd);
    }, []);

    return (
        <div className="flex flex-col min-h-screen w-full">
                        {isLoading ? (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        {/* <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-400 border-t-purple-500" /> */}
                        <Loader className="h-8 w-8 animate-spin text-purple-500" />
                        <p className="text-gray-400 text-sm">Assembling your masterpiece...</p>
                    </div>
                </div>
            ) : null}
            <div className="px-[40px] py-12">
                <div className="absolute top-4 right-8">
                    <UserButton 
                        afterSignOutUrl="/"
                        appearance={{
                            baseTheme: dark,
                            elements: {
                                avatarBox: "w-10 h-10",
                                userButtonTrigger: "p-2",
                                userButtonPopoverCard: "min-w-[240px]"
                            }
                        }}
                    />
                </div>
                <div className="flex items-center gap-4">
                    {editingBoardTitle?.id === board?.id ? (
                        <input
                            type="text"
                            value={editingBoardTitle?.title ?? board?.title}
                            onChange={(e) => {
                                if (editingBoardTitle) {
                                    setEditingBoardTitle({ ...editingBoardTitle, title: e.target.value });
                                }
                            }}
                            onBlur={() => {
                                if (editingBoardTitle && board) {
                                    handleBoardTitleSave(board.id, editingBoardTitle.title);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && editingBoardTitle && board) {
                                    handleBoardTitleSave(board.id, editingBoardTitle.title);
                                }
                                if (e.key === 'Escape') {
                                    setEditingBoardTitle(null);
                                }
                            }}
                            className="text-4xl font-bold bg-transparent text-white border-b-2 border-purple-500 outline-none px-2 py-1 min-w-[300px]"
                            autoFocus
                        />
                    ) : (
                        <div className="flex items-center gap-3">
                            
                            <h1 className="text-7xl font-bold text-white">
                                {board?.title || 'My Board'}
                            </h1>
                            <Button
                                variant="ghost"
                                className="h-auto p-2 text-gray-400 hover:text-purple-400"
                                onClick={() => board && handleBoardTitleEdit(board.id, board.title)}
                            >
                                <Pen size={24} />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-x-auto">

                    <div className="inline-flex gap-4 p-[40px]">

                            <AnimatePresence mode="popLayout">
                                {columns.map((column: Column) => (
                                    <motion.div
                                        key={column.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.4 }}
                                        transition={{ duration: 0.3 }}
                                        className="w-[350px] h-[500px] shrink-0 bg-[#161C22] rounded-md flex flex-col"
                                        onDragOver={(e) => handleDragOver(e, column.id)}
                                        onDrop={(e) => handleDrop(e, column.id)}
                                    >
                                        <div className="p-3 flex justify-between items-center border-b border-gray-800">
                                            <h3 className="text-white font-semibold flex items-center gap-2">
                                            {editingColumnTitle?.id === column.id ? (
    <input
        ref={(input) => {
            if (input && editingColumnTitle && editingColumnTitle.title === "New Column") {
                input.focus();
                input.select();
            }
        }}
        type="text"
        value={editingColumnTitle?.title ?? column.title}
        onChange={(e) => {
            if (editingColumnTitle) {
                setEditingColumnTitle({ ...editingColumnTitle, title: e.target.value });
            }
        }}
        onBlur={() => {
            if (editingColumnTitle) {
                handleColumnTitleSave(column.id, editingColumnTitle.title);
            }
        }}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && editingColumnTitle) {
                handleColumnTitleSave(column.id, editingColumnTitle.title);
            }
            if (e.key === 'Escape') {
                setEditingColumnTitle(null);
            }
        }}
        className="bg-[#1F2937] px-2 py-1 rounded-md outline-none focus:ring-1 focus:ring-purple-500"
        autoFocus
    />
) : (
    // ... rest of the code
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-300">{column.title}</span>
                                                <span className="text-gray-400 bg-gray-800 px-2 py-1 rounded-full text-sm">
                                                    {column.cards?.length || 0}
                                                </span>
                                            </div>
                                        )}
                                    </h3>
                                    <div className="flex gap-2">

                                        <Button
                                            variant="ghost"
                                            className="h-auto p-1 text-gray-400 hover:text-purple-400"
                                            onClick={() => handleColumnTitleEdit(column.id, column.title)}
                                        >
                                            <Pen size={16} />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            className="h-auto p-1 text-gray-400 hover:text-red-400"
                                            onClick={() => deleteColumn(column.id)}
                                            disabled={deletingColumnId === column.id}
                                        >
                                            {deletingColumnId === column.id ? (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div 
                                    className={`flex-grow p-2 flex flex-col gap-2 overflow-y-auto transition-colors duration-200 ${
                                        dropTargetId === column.id && !column.cards?.length 
                                            ? 'bg-purple-500/10 ring-2 ring-purple-500/20 rounded-md' 
                                            : ''
                                    }`}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        if (!column.cards?.length) {
                                            setDropTargetId(column.id);
                                            setDropPosition(null);
                                        }
                                    }}
                                    onDragLeave={(e) => {
                                        // Only clear if we're not entering a child element
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                            setDropTargetId(null);
                                            setDropPosition(null);
                                        }
                                    }}
                                    onDrop={(e) => {
                                        handleDrop(e, column.id);
                                        setDropTargetId(null);
                                        setDropPosition(null);
                                    }}
                                >
                                    <AnimatePresence mode="popLayout">
                                        {column.cards?.map((card: Card) => (
                                            <div 
                                                key={card.id}
                                                className="relative"
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const position = e.clientY < (rect.top + rect.height / 2) ? 'top' : 'bottom';
                                                    setDropPosition(position);
                                                    setDropTargetId(card.id);
                                                }}
                                            >
                                                <motion.div
                                                    draggable
                                                    onDragStart={() => handleDragStart(card.id)}
                                                    className={`group relative bg-[#1F2937] p-3 rounded-md shadow-sm hover:ring-1 
                                                        hover:ring-inset hover:ring-gray-700 cursor-move
                                                        ${draggingCardId === card.id ? 'opacity-50' : ''}`}
                                                >
                                                    {editingCardContent?.id === card.id ? (
                                                        <input
                                                            ref={(input) => {
                                                                if (input && editingCardContent.content === "New Task") {
                                                                    input.focus();
                                                                    input.select();
                                                                }
                                                            }}
                                                            type="text"
                                                            value={editingCardContent.content}
                                                            onChange={(e) => setEditingCardContent({ 
                                                                ...editingCardContent, 
                                                                content: e.target.value 
                                                            })}
                                                            onBlur={() => handleCardSave(card.id, editingCardContent.content)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleCardSave(card.id, editingCardContent.content);
                                                                }
                                                                if (e.key === 'Escape') {
                                                                    setEditingCardContent(null);
                                                                }
                                                            }}
                                                            className="bg-[#1F2937] px-2 py-1 rounded-md outline-none focus:ring-1 focus:ring-purple-500 w-full"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        card.content
                                                    )}
                                                    
                                                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            className="h-auto p-1 text-gray-400 hover:text-purple-400"
                                                            onClick={() => handleCardEdit(card.id, card.content)}
                                                        >
                                                            <Pen size={16} />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            className="h-auto p-1 text-gray-400 hover:text-red-400"
                                                            onClick={() => deleteCard(card.id)}
                                                            disabled={deletingCardId === card.id}
                                                        >
                                                            {deletingCardId === card.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 size={16} />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            </div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                <div className="p-2 border-t border-gray-800">
                                    <Button 
                                        className="w-full flex items-center gap-2 text-gray-400 hover:text-black justify-start px-2"
                                        variant="ghost"
                                        onClick={() => createNewCard(column.id)}
                                    >
                                        <Plus size={16} />
                                        Add task
                                    </Button>
                                </div>
                            </motion.div>
                        ))}

                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            className="shrink-0"
                        >
                            <Button 
                                className="h-[500px] w-[350px] min-w-[350px] cursor-pointer rounded-md bg-[#161C22] hover:bg-[#1F2937] flex items-center justify-center gap-2 text-gray-400 hover:text-white"
                                onClick={createNewColumn}
                            >
                                <Plus size={24} />
                                Add Column
                            </Button>
                        </motion.div>
                        </AnimatePresence>
                </div>
        </div>
    </div>
    );
}

export default KanbanBoard;