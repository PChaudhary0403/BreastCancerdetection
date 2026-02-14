"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"

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

interface UseSocketOptions {
    userId: string
    role: string
    entityId: string // doctorId or patientId
}

export function useSocket({ userId, role, entityId }: UseSocketOptions) {
    const [isConnected, setIsConnected] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [typingUser, setTypingUser] = useState<string | null>(null)
    const [sessionClosed, setSessionClosed] = useState(false)
    const [sessionReopened, setSessionReopened] = useState(false)
    const socketRef = useRef<Socket | null>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        const socket = io({
            path: "/api/socket",
            transports: ["websocket", "polling"],
        })

        socketRef.current = socket

        socket.on("connect", () => {
            setIsConnected(true)
            socket.emit("register", { userId, role, entityId })
        })

        socket.on("disconnect", () => {
            setIsConnected(false)
        })

        socket.on("new_message", (msg: ChatMessage) => {
            setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.id === msg.id)) return prev
                return [...prev, msg]
            })
        })

        socket.on("user_typing", (data: { userId: string; userName?: string; isTyping: boolean }) => {
            if (data.isTyping) {
                setTypingUser(data.userName || "Someone")
            } else {
                setTypingUser(null)
            }
        })

        socket.on("messages_read", () => {
            setMessages((prev) =>
                prev.map((m) => ({ ...m, isRead: true }))
            )
        })

        socket.on("session_closed", () => {
            setSessionClosed(true)
            setSessionReopened(false)
        })

        socket.on("session_reopened", () => {
            setSessionClosed(false)
            setSessionReopened(true)
        })

        socket.on("session_error", (data: { error: string }) => {
            alert(data.error)
        })

        socket.on("message_error", (data: { error: string }) => {
            console.error("Message error:", data.error)
        })

        return () => {
            socket.disconnect()
        }
    }, [userId, role, entityId])

    const joinChat = useCallback((sessionId: string) => {
        socketRef.current?.emit("join_chat", { sessionId })
    }, [])

    const leaveChat = useCallback((sessionId: string) => {
        socketRef.current?.emit("leave_chat", { sessionId })
    }, [])

    const sendMessage = useCallback(
        (data: {
            sessionId: string
            content: string
            senderRole: string
            senderDoctorId?: string
            senderPatientId?: string
        }) => {
            socketRef.current?.emit("send_message", data)
        },
        []
    )

    const startTyping = useCallback((sessionId: string, userName: string) => {
        socketRef.current?.emit("typing_start", { sessionId, userName })

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current?.emit("typing_stop", { sessionId })
        }, 2000)
    }, [])

    const markRead = useCallback((sessionId: string, readerRole: string) => {
        socketRef.current?.emit("mark_read", { sessionId, readerRole })
    }, [])

    const closeSession = useCallback((sessionId: string) => {
        socketRef.current?.emit("close_session", { sessionId })
    }, [])

    const reopenSession = useCallback((sessionId: string) => {
        socketRef.current?.emit("reopen_session", { sessionId })
    }, [])

    const setInitialMessages = useCallback((msgs: ChatMessage[]) => {
        setMessages(msgs)
    }, [])

    return {
        isConnected,
        messages,
        typingUser,
        sessionClosed,
        sessionReopened,
        joinChat,
        leaveChat,
        sendMessage,
        startTyping,
        markRead,
        closeSession,
        reopenSession,
        setInitialMessages,
        setSessionClosed,
    }
}
