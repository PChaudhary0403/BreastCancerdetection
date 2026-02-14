"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useSocket } from "@/lib/useSocket"
import {
    MessageCircle, X, Send, Minimize2, Maximize2,
    Lock, Unlock, AlertTriangle, Wifi, WifiOff,
    ChevronDown, User, Stethoscope
} from "lucide-react"

interface ChatSession {
    id: string
    caseId: string
    status: string
    isMandatory: boolean
    patient?: {
        id: string
        pseudonymId: string
        user: { name: string | null }
    }
    doctor?: {
        id: string
        specialty: string
        user: { name: string | null }
    }
    case?: {
        id: string
        status: string
        regionCode: string
    }
    messages?: Array<{
        id: string
        content: string
        senderRole: string
        createdAt: string
    }>
    _count?: {
        messages: number
    }
}

interface ChatMessage {
    id: string
    sessionId: string
    senderRole: string
    senderDoctorId?: string | null
    senderPatientId?: string | null
    content: string
    isRead: boolean
    createdAt: string
}

interface ChatWidgetProps {
    userRole: "PATIENT" | "DOCTOR"
    userId: string
    entityId: string // doctorId or patientId
    userName: string
}

export default function ChatWidget({ userRole, userId, entityId, userName }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
    const [messageInput, setMessageInput] = useState("")
    const [isLoadingSessions, setIsLoadingSessions] = useState(false)
    const [totalUnread, setTotalUnread] = useState(0)
    const [hasMandatory, setHasMandatory] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const {
        isConnected,
        messages,
        typingUser,
        sessionClosed,
        joinChat,
        leaveChat,
        sendMessage,
        startTyping,
        markRead,
        closeSession: socketCloseSession,
        reopenSession: socketReopenSession,
        setInitialMessages,
        setSessionClosed,
    } = useSocket({ userId, role: userRole, entityId })

    // Fetch sessions
    const fetchSessions = useCallback(async () => {
        setIsLoadingSessions(true)
        try {
            const res = await fetch("/api/chat")
            if (res.ok) {
                const data = await res.json()
                setSessions(data.sessions || [])

                // Calculate unread
                const unread = (data.sessions || []).reduce(
                    (acc: number, s: ChatSession) => acc + (s._count?.messages || 0), 0
                )
                setTotalUnread(unread)

                // Check for mandatory sessions
                const mandatory = (data.sessions || []).some(
                    (s: ChatSession) => s.isMandatory && s.status === "ACTIVE"
                )
                setHasMandatory(mandatory)

                // If there's mandatory session and widget not open, auto-open
                if (mandatory && !isOpen) {
                    setIsOpen(true)
                    const mandatorySession = (data.sessions || []).find(
                        (s: ChatSession) => s.isMandatory && s.status === "ACTIVE"
                    )
                    if (mandatorySession) {
                        openSession(mandatorySession)
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching sessions:", error)
        } finally {
            setIsLoadingSessions(false)
        }
    }, [isOpen])

    // Load sessions on mount and periodically
    useEffect(() => {
        fetchSessions()
        const interval = setInterval(fetchSessions, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [fetchSessions])

    // Open a chat session
    const openSession = async (session: ChatSession) => {
        if (activeSession) {
            leaveChat(activeSession.id)
        }

        setActiveSession(session)
        setSessionClosed(session.status === "CLOSED")

        // Load message history
        try {
            const res = await fetch(`/api/chat/${session.id}`)
            if (res.ok) {
                const data = await res.json()
                setInitialMessages(data.messages || [])
            }
        } catch (error) {
            console.error("Error loading messages:", error)
        }

        joinChat(session.id)
        markRead(session.id, userRole)
    }

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Handle send
    const handleSend = () => {
        if (!messageInput.trim() || !activeSession || sessionClosed) return

        sendMessage({
            sessionId: activeSession.id,
            content: messageInput.trim(),
            senderRole: userRole,
            senderDoctorId: userRole === "DOCTOR" ? entityId : undefined,
            senderPatientId: userRole === "PATIENT" ? entityId : undefined,
        })

        setMessageInput("")
        inputRef.current?.focus()
    }

    // Handle typing
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessageInput(e.target.value)
        if (activeSession) {
            startTyping(activeSession.id, userName)
        }
    }

    // Handle close session
    const handleCloseSession = async () => {
        if (!activeSession) return

        if (activeSession.isMandatory) {
            alert("Cannot close communication during active screening. Complete the review first.")
            return
        }

        try {
            const res = await fetch(`/api/chat/${activeSession.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "close" }),
            })

            if (res.ok) {
                socketCloseSession(activeSession.id)
                setSessionClosed(true)
                fetchSessions()
            } else {
                const err = await res.json()
                alert(err.error || "Failed to close session")
            }
        } catch (error) {
            console.error("Error closing session:", error)
        }
    }

    // Handle reopen session
    const handleReopenSession = async () => {
        if (!activeSession) return

        try {
            const res = await fetch(`/api/chat/${activeSession.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reopen" }),
            })

            if (res.ok) {
                socketReopenSession(activeSession.id)
                setSessionClosed(false)
                fetchSessions()
            }
        } catch (error) {
            console.error("Error reopening session:", error)
        }
    }

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const today = new Date()
        if (date.toDateString() === today.toDateString()) return "Today"
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
        return date.toLocaleDateString()
    }

    // Group messages by date
    const groupedMessages = messages.reduce<Record<string, ChatMessage[]>>((groups, msg) => {
        const dateKey = formatDate(msg.createdAt)
        if (!groups[dateKey]) groups[dateKey] = []
        groups[dateKey].push(msg)
        return groups
    }, {})

    const getParticipantName = (session: ChatSession) => {
        if (userRole === "DOCTOR") {
            return session.patient?.user?.name || `Patient ${session.patient?.pseudonymId?.slice(-6)}`
        }
        return `Dr. ${session.doctor?.user?.name || "Doctor"}`
    }

    const getCaseLabel = (session: ChatSession) => {
        return `Case #${session.caseId.slice(-8).toUpperCase()}`
    }

    // Floating chat button + widget
    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-[9999] group"
                    id="chat-widget-toggle"
                >
                    <div className="relative">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-indigo-500/40 ${hasMandatory
                                ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30 animate-pulse"
                                : "bg-gradient-to-br from-indigo-600 to-blue-700 shadow-indigo-500/30"
                            }`}>
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        {totalUnread > 0 && (
                            <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg animate-bounce">
                                {totalUnread > 9 ? "9+" : totalUnread}
                            </span>
                        )}
                        {hasMandatory && (
                            <span className="absolute -top-1 -left-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-900" />
                            </span>
                        )}
                    </div>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div
                    className={`fixed bottom-6 right-6 z-[9999] transition-all duration-300 ${isMinimized ? "w-80 h-14" : "w-96 h-[600px]"
                        }`}
                    id="chat-widget-window"
                >
                    <div className="w-full h-full rounded-2xl shadow-2xl shadow-black/20 overflow-hidden flex flex-col bg-white border border-slate-200/80">
                        {/* Header */}
                        <div className={`px-4 py-3 flex items-center justify-between shrink-0 ${hasMandatory
                                ? "bg-gradient-to-r from-red-600 via-rose-600 to-red-700"
                                : "bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700"
                            }`}>
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-white/90" />
                                <div>
                                    <h3 className="text-sm font-semibold text-white">
                                        {activeSession
                                            ? getParticipantName(activeSession)
                                            : "Messages"}
                                    </h3>
                                    {activeSession && (
                                        <p className="text-[10px] text-white/70">
                                            {getCaseLabel(activeSession)}
                                            {activeSession.isMandatory && " • Mandatory"}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Connection indicator */}
                                <div className="mr-1" title={isConnected ? "Connected" : "Disconnected"}>
                                    {isConnected ? (
                                        <Wifi className="w-3.5 h-3.5 text-green-300" />
                                    ) : (
                                        <WifiOff className="w-3.5 h-3.5 text-red-300" />
                                    )}
                                </div>
                                {activeSession && (
                                    <button
                                        onClick={() => {
                                            leaveChat(activeSession.id)
                                            setActiveSession(null)
                                            setInitialMessages([])
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-all"
                                        title="Back to sessions"
                                    >
                                        <ChevronDown className="w-4 h-4 rotate-90" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-all"
                                >
                                    {isMinimized ? (
                                        <Maximize2 className="w-4 h-4" />
                                    ) : (
                                        <Minimize2 className="w-4 h-4" />
                                    )}
                                </button>
                                {!hasMandatory && (
                                    <button
                                        onClick={() => {
                                            if (activeSession) leaveChat(activeSession.id)
                                            setIsOpen(false)
                                            setActiveSession(null)
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                                {hasMandatory && (
                                    <div className="p-1.5 text-white/50 cursor-not-allowed" title="Chat is mandatory during screening">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Body */}
                        {!isMinimized && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {!activeSession ? (
                                    // Session List
                                    <div className="flex-1 overflow-y-auto">
                                        {isLoadingSessions ? (
                                            <div className="flex items-center justify-center h-32">
                                                <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                            </div>
                                        ) : sessions.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                                    <MessageCircle className="w-8 h-8 text-slate-300" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-600 mb-1">
                                                    No conversations yet
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {userRole === "DOCTOR"
                                                        ? "Start reviewing a case to begin chatting with patients"
                                                        : "Your doctor will initiate a conversation during screening"}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-100">
                                                {sessions.map((session) => (
                                                    <button
                                                        key={session.id}
                                                        onClick={() => openSession(session)}
                                                        className="w-full p-4 hover:bg-slate-50 transition-all duration-200 text-left group"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${session.isMandatory && session.status === "ACTIVE"
                                                                    ? "bg-red-100"
                                                                    : session.status === "CLOSED"
                                                                        ? "bg-slate-100"
                                                                        : "bg-indigo-100"
                                                                }`}>
                                                                {userRole === "DOCTOR" ? (
                                                                    <User className={`w-5 h-5 ${session.isMandatory && session.status === "ACTIVE"
                                                                            ? "text-red-600"
                                                                            : session.status === "CLOSED"
                                                                                ? "text-slate-400"
                                                                                : "text-indigo-600"
                                                                        }`} />
                                                                ) : (
                                                                    <Stethoscope className={`w-5 h-5 ${session.isMandatory && session.status === "ACTIVE"
                                                                            ? "text-red-600"
                                                                            : session.status === "CLOSED"
                                                                                ? "text-slate-400"
                                                                                : "text-indigo-600"
                                                                        }`} />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between mb-0.5">
                                                                    <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                                                                        {getParticipantName(session)}
                                                                    </span>
                                                                    {session.messages?.[0] && (
                                                                        <span className="text-[10px] text-slate-400">
                                                                            {formatTime(session.messages[0].createdAt)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500 mb-1">
                                                                    {getCaseLabel(session)}
                                                                </p>
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-xs text-slate-400 truncate max-w-[180px]">
                                                                        {session.messages?.[0]?.content || "No messages yet"}
                                                                    </p>
                                                                    <div className="flex items-center gap-1.5">
                                                                        {session.isMandatory && session.status === "ACTIVE" && (
                                                                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-semibold rounded-full">
                                                                                <Lock className="w-2.5 h-2.5" />
                                                                                Mandatory
                                                                            </span>
                                                                        )}
                                                                        {session.status === "CLOSED" && (
                                                                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-semibold rounded-full">
                                                                                Closed
                                                                            </span>
                                                                        )}
                                                                        {(session._count?.messages || 0) > 0 && (
                                                                            <span className="w-5 h-5 bg-indigo-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                                                                {session._count!.messages}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // Active Chat
                                    <>
                                        {/* Mandatory banner */}
                                        {activeSession.isMandatory && !sessionClosed && (
                                            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 shrink-0">
                                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                                                <p className="text-[11px] text-amber-700 font-medium">
                                                    Mandatory communication — active during screening process
                                                </p>
                                            </div>
                                        )}

                                        {/* Session closed banner */}
                                        {sessionClosed && (
                                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <Unlock className="w-3.5 h-3.5 text-slate-400" />
                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                        This conversation has been closed
                                                    </p>
                                                </div>
                                                {userRole === "DOCTOR" && (
                                                    <button
                                                        onClick={handleReopenSession}
                                                        className="text-[11px] text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                                                    >
                                                        Reopen
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-gradient-to-b from-slate-50/50 to-white">
                                            {Object.entries(groupedMessages).map(([date, msgs]) => (
                                                <div key={date}>
                                                    <div className="flex items-center justify-center my-3">
                                                        <span className="text-[10px] text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 font-medium shadow-sm">
                                                            {date}
                                                        </span>
                                                    </div>
                                                    {msgs.map((msg) => {
                                                        const isMine = msg.senderRole === userRole
                                                        return (
                                                            <div
                                                                key={msg.id}
                                                                className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}
                                                            >
                                                                <div
                                                                    className={`max-w-[75%] px-3.5 py-2 rounded-2xl shadow-sm ${isMine
                                                                            ? "bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-br-md"
                                                                            : "bg-white text-slate-800 border border-slate-100 rounded-bl-md"
                                                                        }`}
                                                                >
                                                                    <p className="text-[13px] leading-relaxed break-words">
                                                                        {msg.content}
                                                                    </p>
                                                                    <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? "text-white/60" : "text-slate-400"
                                                                        }`}>
                                                                        <span className="text-[9px]">
                                                                            {formatTime(msg.createdAt)}
                                                                        </span>
                                                                        {isMine && msg.isRead && (
                                                                            <span className="text-[9px]">✓✓</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ))}

                                            {/* Typing indicator */}
                                            {typingUser && (
                                                <div className="flex justify-start mb-2">
                                                    <div className="bg-white border border-slate-100 px-4 py-2.5 rounded-2xl rounded-bl-md shadow-sm">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="flex gap-0.5">
                                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 ml-1">
                                                                {typingUser} is typing
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Input area */}
                                        {!sessionClosed ? (
                                            <div className="px-3 py-3 bg-white border-t border-slate-100 shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        value={messageInput}
                                                        onChange={handleInputChange}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && !e.shiftKey) {
                                                                e.preventDefault()
                                                                handleSend()
                                                            }
                                                        }}
                                                        placeholder="Type a message..."
                                                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                                    />
                                                    <button
                                                        onClick={handleSend}
                                                        disabled={!messageInput.trim()}
                                                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                {/* Doctor: close session button */}
                                                {userRole === "DOCTOR" && !activeSession.isMandatory && (
                                                    <button
                                                        onClick={handleCloseSession}
                                                        className="mt-2 w-full text-center text-[11px] text-slate-400 hover:text-red-500 transition-colors py-1"
                                                    >
                                                        Close this conversation
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="px-3 py-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
                                                <p className="text-xs text-slate-400">
                                                    This conversation has been closed
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
